export function formatAbbreviated(num: number | null | undefined, isCurrency: boolean = false): string {
  if (num === null || num === undefined) return '-';
  
  let formatted = '';
  const absNum = Math.abs(num);

  // Gunakan 'en-US' karena user memberi contoh 55.54JT dan 234.56RB (dengan titik desimal)
  if (absNum >= 1_000_000_000) {
    const val = (num / 1_000_000_000).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    formatted = val + 'Mlyr';
  } else if (absNum >= 1_000_000) {
    const val = (num / 1_000_000).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    formatted = val + 'JT';
  } else if (absNum >= 1_000) {
    const val = (num / 1_000).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    formatted = val + 'RB';
  } else {
    // Kalau dibawah ribuan tulis full (bisa pakai separator ribuan juga kalau ada)
    formatted = num.toLocaleString('id-ID'); // Tetap pakai id-ID untuk separator ribuan di angka penuh jika diperlukan
  }

  if (isCurrency) {
    return `Rp ${formatted}`;
  }
  return formatted;
}

/**
 * Format tanggal saja (tanpa jam): "10 Sep 2026"
 * Digunakan untuk field yang memang hanya menyimpan DATE (bukan timestamp),
 * seperti start_date, end_date, tanggal, tanggal_kirim (date-only fields).
 */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '-';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Format tanggal + jam:menit:detik lengkap: "DD/MM/YYYY, HH:mm:ss"
 * Digunakan untuk semua field timestamp audit seperti:
 * created_at, approved_at, not_approved_at, vt_approved_at,
 * paid_at, submitted_at, manager_reviewed_at, finance_reviewed_at,
 * executive_reviewed_at, manager_acted_at, executive_acted_at, dll.
 */
export function formatDateTime(value: string | Date | null | undefined, includeSeconds: boolean = true): string {
  if (!value) return '-';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(d.getTime())) return '-';
  const pad = (n: number) => n.toString().padStart(2, '0');
  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const year = d.getFullYear();
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());
  
  if (includeSeconds) {
    return `${day}/${month}/${year}, ${hours}:${minutes}:${seconds}`;
  }
  return `${day}/${month}/${year}, ${hours}:${minutes}`;
}

/**
 * Format nama user beserta rolenya sesuai aturan:
 * - manager, finance, executive -> tampilkan nama + role, misal "Budi (Finance)"
 * - anggota -> HANYA nama saja, misal "Siti" (tanpa role)
 */
export function formatUserWithRole(nama: string | null | undefined, role: string | null | undefined): string {
  if (!nama) return '-';
  if (!role || role.toLowerCase() === 'anggota') {
    return nama;
  }
  const roleName = role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
  return `${nama} (${roleName})`;
}

/**
 * Format tanggal + jam:menit singkat (tanpa tahun): "10 Sep, 14:30"
 * Digunakan di tempat yang ruangnya terbatas (kolom tabel sempit, tooltip, badge).
 */
export function formatDateTimeShort(value: string | Date | null | undefined): string {
  if (!value) return '-';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format angka ke format Rupiah dengan pemisah ribuan titik (Indonesian locale): "Rp 250.000.000"
 */
export function formatRupiah(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return 'Rp 0';
  const num = Number(value);
  if (isNaN(num)) return 'Rp 0';
  return `Rp ${num.toLocaleString('id-ID')}`;
}
