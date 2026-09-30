-- ================================================================
-- MIGRATION: Cache konversi link pendek TikTok
-- Tanggal: 30 Sep 2026
--
-- Latar belakang:
--   Setiap panggilan /api/expand-tiktok = 1 request outbound ke TikTok
--   dari IP server kita. Redirect vt.tiktok.com -> tiktok.com/@user/video/ID
--   bersifat PERMANEN dan tidak pernah berubah, jadi hasilnya aman disimpan
--   selamanya tanpa perlu expiration.
--
-- Dipakai untuk:
--   1. Menghemat request ke TikTok saat link yang sama di-paste ulang
--   2. Mengukur apakah cache benar-benar dipakai (hit_count) —
--      kalau setelah 2 minggu hit_count masih 0, cache ini tidak berguna
--      dan boleh di-drop.
--
-- CATATAN: hanya baris BERHASIL yang boleh masuk. Link yang gagal
-- konversi TIDAK boleh di-cache, kalau tidak link yang sementara mati
-- akan tersimpan permanen dan tidak pernah dicoba lagi.
-- ================================================================

CREATE TABLE IF NOT EXISTS public.tiktok_link_cache (
  short_url         TEXT PRIMARY KEY,
  final_url         TEXT NOT NULL,
  video_id          TEXT,
  creator_username  TEXT,
  hit_count         INTEGER NOT NULL DEFAULT 1,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Untuk Gauge Manager: cari entri yang belum dipakai > 90 hari lalu hapus manual.
CREATE INDEX IF NOT EXISTS idx_tlc_last_used ON public.tiktok_link_cache(last_used_at);

-- Untuk mengecek berapa banyak short link yang collapse ke video yang sama.
CREATE INDEX IF NOT EXISTS idx_tlc_video_id ON public.tiktok_link_cache(video_id);

COMMENT ON TABLE public.tiktok_link_cache IS
  'Cache permanen hasil konversi link pendek TikTok. Hanya berisi hasil BERHASIL.';
