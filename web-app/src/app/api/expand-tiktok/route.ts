import { NextResponse } from 'next/server';
import type { Session } from 'next-auth';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic';

// Domain link pendek yang resmi dipakai TikTok.
// PENTING: harus sinkron dengan isShortLink() di ImportVideoClient.tsx:54
// dan VideoClient.tsx:461 — kalau tidak, link dianggap valid di client
// lalu ditolak server (dan PIC melihat "Format URL tidak valid").
const SHORT_HOSTS = ['vt.tiktok.com', 'vm.tiktok.com', 't.tiktok.com'];

// UA browser. Tanpa ini fetch() mengirim UA bawaan Node ("undici"/"node"),
// yang paling gampang ditandai TikTok sebagai bot.
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const TIMEOUT_MS = 10_000;

// ============================================================
// RATE LIMIT
// ============================================================
// Setiap panggilan route ini = 1 request outbound ke TikTok dari IP
// server kita. Tanpa batas, route ini bisa dipakai bot untuk menembak
// TikTok terus-menerus. Kalau IP kita kena ban, fitur import video
// PIC ikut mati.
//
// Batas 120/menit chosen karena client legitimate mengirim 3 link per
// ~2,5 detik (lihat BATCH_SIZE + delay di ImportVideoClient.tsx),
// jadi batch 500 link = ~72 request/menit. 120 memberi headroom tanpa
// membiarkan abuse.
//
// CATATAN: in-memory, jadi reset kalau server restart / multi-instance.
// Coolify saat ini 1 container jadi cukup. Kalau nanti di-scale ke lebih
// dari 1 instance, pindahkan ke tabel atau Redis.
// ============================================================
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 120;

const hitLog = new Map<string, number[]>();

function checkRateLimit(key: string): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const timestamps = (hitLog.get(key) ?? []).filter(t => now - t < WINDOW_MS);

  if (timestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    hitLog.set(key, timestamps);
    return { allowed: false, retryAfter: Math.ceil((WINDOW_MS - (now - timestamps[0])) / 1000) };
  }

  timestamps.push(now);
  hitLog.set(key, timestamps);

  // Bersihkan key yang sudah stale supaya Map tidak tumbuh terus.
  if (hitLog.size > 500) {
    for (const [k, v] of hitLog) {
      if (v.every(t => now - t >= WINDOW_MS)) hitLog.delete(k);
    }
  }

  return { allowed: true, retryAfter: 0 };
}

function isValidShortUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return hostname.toLowerCase().endsWith('tiktok.com') && SHORT_HOSTS.includes(hostname.toLowerCase());
  } catch {
    return false;
  }
}

// Kalau redirect TikTok sudah membawa username, tidak perlu panggil oEmbed.
// Ini menghemat ~50% request outbound ke TikTok untuk batch 50 link.
const hasUsername = (url: string) => /tiktok\.com\/@([a-zA-Z0-9_.-]+)\//.test(url);
const hasVideoId = (url: string) => /\/video\/(\d+)/.test(url);

// Hop pertama vt.tiktok.com biasanya SUDAH langsung menunjuk ke URL video
// (terverifikasi 30 Sep 2026). Jadi kita baca header `Location` dan berhenti
// begitu dapat username + video ID.
//
// Kenapa bukan `redirect: 'follow'`?
//   - 'follow' = request kedua ke halaman video sungguhan (mahal, bisa kena login wall)
//   - 'follow' membuat response.url = halaman akhir, yang bisa kehilangan username
//   - 'manual' = 1 request, jawaban persis dari Location, seperti `curl -I`
const MAX_HOPS = 3;

async function resolveShortUrl(startUrl: string): Promise<string> {
  let current = startUrl;

  for (let hop = 0; hop < MAX_HOPS; hop++) {
    const res = await fetch(current, {
      method: 'HEAD',
      redirect: 'manual',
      headers: { 'User-Agent': UA, 'Accept': '*/*' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    });

    const location = res.headers.get('location');

    // Tidak ada header Location berarti tidak ada redirect: ini URL final.
    if (!location) {
      return res.url && res.url !== current ? res.url : current;
    }

    // new URL(location, current) menangani redirect relatif.
    const next = new URL(location, current).toString();

    if (next === current) return current;
    if (hasUsername(next) && hasVideoId(next)) return next;

    current = next;
  }

  return current;
}

export async function POST(request: Request) {
  try {
    // --- Auth guard (AGENTS.md aturan #9) -----------------------------
    // proxy.ts memang sudah memblokir browser anonim (redirect /login),
    // TAPI itu hanya cek ADA cookie, bukan cookie-nya valid. Orang yang
    // mau-commit bisa set `authjs.session-token=ngarang` dan lolos.
    // Jadi tetap wajib cek di dalam handler.
    // Catatan: jangan pakai `Awaited<ReturnType<typeof auth>>` di sini.
    // `auth` itu overloaded (NextAuth v5 juga menyediakannya untuk middleware),
    // jadi ReturnType-nya menunjuk ke NextMiddleware, bukan Session.
    let session: Session | null = null;
    try {
      session = await auth();
    } catch (err) {
      console.error('[expand-tiktok] auth() threw:', err);
      return NextResponse.json(
        { error: 'Gagal memverifikasi sesi. Silakan logout lalu login ulang.' },
        { status: 500 }
      );
    }

    if (!session?.user) {
      return NextResponse.json({ error: 'Anda harus login.' }, { status: 401 });
    }

    const rateKey = session.user.id || session.user.email || 'anon';
    const rate = checkRateLimit(rateKey);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: `Terlalu banyak permintaan. Tunggu ${rate.retryAfter} detik lalu coba lagi.` },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } }
      );
    }
    // ------------------------------------------------------------------

    const { shortUrl } = await request.json();

    if (!shortUrl || typeof shortUrl !== 'string' || !isValidShortUrl(shortUrl)) {
      return NextResponse.json(
        { error: 'Bukan link pendek TikTok yang valid (vt/vm/t.tiktok.com)' },
        { status: 400 }
      );
    }

    let finalUrl = await resolveShortUrl(shortUrl);

    // Kode short tidak dikenal -> TikTok arahkan ke homepage. Bukan link video.
    if (!finalUrl || finalUrl === shortUrl || !/tiktok\.com\/@/.test(finalUrl)) {
      return NextResponse.json(
        { error: 'Link pendek tidak bisa dikonversi (kode tidak dikenal atau link sudah mati)' },
        { status: 400 }
      );
    }

    // oEmbed hanya dipanggil kalau username hilang (format /@/video/ID).
    // Kalau redirect sudah membawa username, tidak perlu request tambahan.
    if (!hasUsername(finalUrl)) {
      try {
        const videoIdMatch = finalUrl.match(/video\/(\d+)/);
        const videoId = videoIdMatch?.[1];

        if (videoId) {
          const oembedUrl = `https://www.tiktok.com/oembed?url=https://www.tiktok.com/video/${videoId}`;
          const oembedRes = await fetch(oembedUrl, {
            headers: { 'User-Agent': UA, 'Accept': 'application/json' },
            signal: AbortSignal.timeout(TIMEOUT_MS),
            cache: 'no-store',
          });
          if (oembedRes.ok) {
            const oembedData = await oembedRes.json();
            if (oembedData?.author_unique_id) {
              finalUrl = `https://www.tiktok.com/@${oembedData.author_unique_id}/video/${videoId}`;
            }
          }
        }
      } catch (err) {
        // Bukan error fatal: tanpa username, guard di bulkVerifyVideoLinksAction
        // akan menolak item dengan pesan yang jelas.
        console.error('Failed to fetch oEmbed for username:', err);
      }
    }

    return NextResponse.json({ originalUrl: shortUrl, expandedUrl: finalUrl });
  } catch (error: any) {
    // Timeout TikTok = dia menahan. Balas 504 supaya client tahu ini rate limit,
    // bukan link rusak. Client juga akan memperlambat otomatis (adaptive delay).
    const isTimeout = error?.name === 'TimeoutError' || error?.name === 'AbortError';
    if (isTimeout) {
      return NextResponse.json(
        { error: 'TikTok tidak merespons (timeout). Sistem akan memperlambat, coba lagi nanti.' },
        { status: 504 }
      );
    }
    console.error('Error expanding TikTok URL:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
