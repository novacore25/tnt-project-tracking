import { CreatorSnapshot, CampaignCreator, Video } from '@/types/database';

/**
 * Driver `pg` mengembalikan kolom `bigint` / `numeric` sebagai STRING supaya
 * presisi tidak hilang. Akibatnya `0 + "123"` = `"0123"`, yaitu RANGKAI bukan
 * penjumlahan, dan seluruh reduce berikutnya ikut jadi string.
 *
 * Gejalanya di UI: angka sangat panjang seperti
 * `Rp 03191697021080919190180009900109...` yang diawali digit 0. Digit 0 itu
 * `sum` awal yang sudah berubah jadi string, sisanya seluruh nilai gmv dirangkai.
 *
 * Semua penjumlahan rupiah WAJIB lewat toNum/sumNum. Ditemukan 1 Okt 2026 di
 * 11 tempat: sales.gmv, payment_items.nominal, dan nominal_pelunasan semuanya
 * bertipe bigint, termasuk halaman keuangan.
 */
export const toNum = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Jumlahkan satu kolom numerik dengan aman terhadap bigint/string. */
export const sumNum = <T,>(rows: T[] | null | undefined, pick: (row: T) => unknown): number =>
  (rows || []).reduce((sum, row) => sum + toNum(pick(row)), 0);

/**
 * Normalisasi kurs USD -> IDR untuk data `ads_performance` / `ads_spends`.
 *
 * ATURAN:
 * - `null` / `undefined` / `''` / NaN -> 16000 (default, sama seperti lama)
 * - `0` -> TETAP 0, bukan 16000
 * - `> 0` dan `< 1000` -> x1000 (heuristik untuk impor lama yang menulis
 *   16.993, bukan 16993)
 *
 * KENAPA `0` HARUS TETAP 0:
 *   Migration `20261001230000` menyetel satu baris jadi `kurs = 0` karena datanya
 *   korup (1052 pembelian tanpa satu klik). Nol adalah keputusan, bukan "tidak ada".
 *   Versi lama menulis `ad.kurs || 16000`, dan `0 || 16000` = `16000`, sehingga
 *   baris itu dikalikan 16000 di UI: revenue Rp 1.261,34 -> Rp 20.181.440.
 *   Pola `||` yang sama ada di 10 tempat dan semuanya sudah diganti ke helper ini.
 */
export const normalizeKurs = (raw: unknown): number => {
  if (raw === null || raw === undefined || raw === '') return 16000;
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) return 16000;
  if (n > 0 && n < 1000) return n * 1000;
  return n;
};

export const getCreatorType = (audience_age: string | null): 'Nano' | 'Micro' | 'Macro' | 'Mega' | 'Unknown' => {
  return 'Unknown'; // Karena kita tidak lagi menggunakan angka follower, default ke Unknown atau ambil dari Tier.
}


export const getLatestSnapshot = (snapshots: CreatorSnapshot[], creatorId: number): CreatorSnapshot | null => {
  const creatorSnapshots = snapshots.filter(s => s.creator_id === creatorId);
  if (creatorSnapshots.length === 0) return null;
  // sort by date descending
  return creatorSnapshots.sort((a, b) => {
    const tDiff = new Date(b.tanggal_update || 0).getTime() - new Date(a.tanggal_update || 0).getTime();
    if (tDiff !== 0) return tDiff;
    return b.id - a.id;
  })[0];
};

export const computeCampaignGMV = (cc: CampaignCreator, videos?: Video[], sales?: any[]): number => {
  let dynamicGMV = 0;
  
  if (videos && sales) {
    const ccVideos = videos.filter(v => v.campaign_creator_id === cc.id && v.content_uid);
    const contentUids = ccVideos.map(v => v.content_uid);
    if (contentUids.length > 0) {
      dynamicGMV = sumNum(sales.filter(s => contentUids.includes(s.content_uid)), row => row.gmv);
    }
  }

  // Sesuai instruksi: Mengabaikan data legacy dari Excel. Murni 100% bergantung pada data organik.
  return dynamicGMV;
};

export const getJenisKerjasama = (price: number | string | null | undefined): 'barter' | 'ratecard' => {
  return Number(price || 0) === 0 ? 'barter' : 'ratecard';
};

export const computeHighestVideoGMV = (cc: CampaignCreator, videos?: Video[], sales?: any[]): number => {
  let highest = 0;
  if (videos && sales) {
    const ccVideos = videos.filter(v => v.campaign_creator_id === cc.id && v.content_uid);
    for (const v of ccVideos) {
      const gmv = sumNum(sales.filter(s => s.content_uid === v.content_uid), row => row.gmv);
      if (gmv > highest) highest = gmv;
    }
  }
  return highest;
};

export const getConceptColor = (conceptNum: number | string | null): string => {
  const num = Number(conceptNum);
  if (!num || isNaN(num) || num === 0) return 'text-slate-700 bg-slate-100 border-slate-200 focus-within:border-slate-400 focus-within:ring-slate-400';
  
  const colors = [
    'text-blue-700 bg-blue-50 border-blue-200 focus-within:border-blue-400 focus-within:ring-blue-400',
    'text-emerald-700 bg-emerald-50 border-emerald-200 focus-within:border-emerald-400 focus-within:ring-emerald-400',
    'text-amber-700 bg-amber-50 border-amber-200 focus-within:border-amber-400 focus-within:ring-amber-400',
    'text-rose-700 bg-rose-50 border-rose-200 focus-within:border-rose-400 focus-within:ring-rose-400',
    'text-purple-700 bg-purple-50 border-purple-200 focus-within:border-purple-400 focus-within:ring-purple-400',
    'text-cyan-700 bg-cyan-50 border-cyan-200 focus-within:border-cyan-400 focus-within:ring-cyan-400',
    'text-pink-700 bg-pink-50 border-pink-200 focus-within:border-pink-400 focus-within:ring-pink-400',
    'text-lime-700 bg-lime-50 border-lime-200 focus-within:border-lime-400 focus-within:ring-lime-400',
    'text-orange-700 bg-orange-50 border-orange-200 focus-within:border-orange-400 focus-within:ring-orange-400',
    'text-indigo-700 bg-indigo-50 border-indigo-200 focus-within:border-indigo-400 focus-within:ring-indigo-400'
  ];
  
  const index = (num - 1) % colors.length;
  return colors[index];
};
