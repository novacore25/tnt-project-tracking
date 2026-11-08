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

/**
 * Riwayat lengkap tahapan persetujuan item per stage:
 */
export function getItemApprovalHistory(item: any): Array<{ stage: string; actor: string; role: string; time: string; note?: string }> {
  if (!item) return [];
  const history: Array<{ stage: string; actor: string; role: string; time: string; note?: string }> = [];
  
  if (item.manager_actor?.nama || item.manager_acted_at) {
    const rawRole = item.manager_actor?.role || 'manager';
    const roleCapital = rawRole.charAt(0).toUpperCase() + rawRole.slice(1);
    history.push({
      stage: 'Review Manager',
      role: roleCapital,
      actor: item.manager_actor?.nama || 'Manager',
      time: item.manager_acted_at ? formatDateTime(item.manager_acted_at, false) : '-',
      note: item.manager_note || undefined,
    });
  }
  
  if (item.executive_1_actor?.nama || item.executive_1_acted_at) {
    const rawRole = item.executive_1_actor?.role || 'executive';
    const roleCapital = rawRole.charAt(0).toUpperCase() + rawRole.slice(1);
    history.push({
      stage: 'Review Exec 1',
      role: roleCapital,
      actor: item.executive_1_actor?.nama || 'Executive',
      time: item.executive_1_acted_at ? formatDateTime(item.executive_1_acted_at, false) : '-',
      note: item.executive_1_note || undefined,
    });
  }

  if (item.executive_actor?.nama || item.executive_acted_at) {
    const rawRole = item.executive_actor?.role || 'executive';
    const roleCapital = rawRole.charAt(0).toUpperCase() + rawRole.slice(1);
    history.push({
      stage: 'Review Final',
      role: roleCapital,
      actor: item.executive_actor?.nama || 'Executive',
      time: item.executive_acted_at ? formatDateTime(item.executive_acted_at, false) : '-',
      note: item.executive_note || undefined,
    });
  }

  return history;
}

/**
 * Format badge riwayat persetujuan item:
 * "ACC : [Role] Nama [dd/mm/yyyy, hh:mm]"
 * Disertai tooltip lengkap rantai persetujuan (status sebelumnya).
 */
export function getItemApprovalBadge(item: any): { text: string; role: string; className: string; tooltip: string } | null {
  if (!item) return null;
  
  const history = getItemApprovalHistory(item);
  const tooltip = history.length > 0 
    ? `Riwayat Persetujuan:\n` + history.map((h, idx) => `${idx + 1}. [${h.role}] ${h.actor} [${h.time}]${h.note ? ` (${h.note})` : ''}`).join('\n')
    : '';

  // 1. Siap Transfer / Paid / Executive Approved
  if (['ready_to_pay', 'executive_approved', 'paid'].includes(item.final_status)) {
    if (item.executive_actor?.nama) {
      const rawRole = item.executive_actor.role || 'executive';
      const roleCapital = rawRole.charAt(0).toUpperCase() + rawRole.slice(1);
      const timeStr = item.executive_acted_at ? formatDateTime(item.executive_acted_at, false) : '';
      return {
        text: `ACC : [${roleCapital}] ${item.executive_actor.nama}${timeStr ? ` [${timeStr}]` : ''}`,
        role: roleCapital,
        className: 'text-emerald-700 bg-emerald-50 border-emerald-200',
        tooltip: tooltip || `ACC : [${roleCapital}] ${item.executive_actor.nama} [${timeStr}]`
      };
    }
    if (item.executive_1_actor?.nama) {
      const rawRole = item.executive_1_actor.role || 'executive';
      const roleCapital = rawRole.charAt(0).toUpperCase() + rawRole.slice(1);
      const timeStr = item.executive_1_acted_at ? formatDateTime(item.executive_1_acted_at, false) : '';
      return {
        text: `ACC : [${roleCapital}] ${item.executive_1_actor.nama}${timeStr ? ` [${timeStr}]` : ''}`,
        role: roleCapital,
        className: 'text-emerald-700 bg-emerald-50 border-emerald-200',
        tooltip: tooltip || `ACC : [${roleCapital}] ${item.executive_1_actor.nama} [${timeStr}]`
      };
    }
    if (item.manager_actor?.nama) {
      const rawRole = item.manager_actor.role || 'manager';
      const roleCapital = rawRole.charAt(0).toUpperCase() + rawRole.slice(1);
      const timeStr = item.manager_acted_at ? formatDateTime(item.manager_acted_at, false) : '';
      return {
        text: `ACC : [${roleCapital}] ${item.manager_actor.nama}${timeStr ? ` [${timeStr}]` : ''}`,
        role: roleCapital,
        className: 'text-purple-700 bg-purple-50 border-purple-200',
        tooltip: tooltip || `ACC : [${roleCapital}] ${item.manager_actor.nama} [${timeStr}]`
      };
    }
  }

  // 2. Executive 1 Approved / Finance Selected / Pending Finance
  if (['executive_1_approved', 'finance_selected', 'pending_finance_outstanding'].includes(item.final_status)) {
    if (item.executive_1_actor?.nama) {
      const rawRole = item.executive_1_actor.role || 'executive';
      const roleCapital = rawRole.charAt(0).toUpperCase() + rawRole.slice(1);
      const timeStr = item.executive_1_acted_at ? formatDateTime(item.executive_1_acted_at, false) : '';
      return {
        text: `ACC : [${roleCapital}] ${item.executive_1_actor.nama}${timeStr ? ` [${timeStr}]` : ''}`,
        role: roleCapital,
        className: 'text-indigo-700 bg-indigo-50 border-indigo-200',
        tooltip: tooltip || `ACC : [${roleCapital}] ${item.executive_1_actor.nama} [${timeStr}]`
      };
    }
    if (item.manager_actor?.nama) {
      const rawRole = item.manager_actor.role || 'manager';
      const roleCapital = rawRole.charAt(0).toUpperCase() + rawRole.slice(1);
      const timeStr = item.manager_acted_at ? formatDateTime(item.manager_acted_at, false) : '';
      return {
        text: `ACC : [${roleCapital}] ${item.manager_actor.nama}${timeStr ? ` [${timeStr}]` : ''}`,
        role: roleCapital,
        className: 'text-purple-700 bg-purple-50 border-purple-200',
        tooltip: tooltip || `ACC : [${roleCapital}] ${item.manager_actor.nama} [${timeStr}]`
      };
    }
  }

  // 3. Manager Approved
  if (item.final_status === 'manager_approved' && item.manager_actor?.nama) {
    const rawRole = item.manager_actor.role || 'manager';
    const roleCapital = rawRole.charAt(0).toUpperCase() + rawRole.slice(1);
    const timeStr = item.manager_acted_at ? formatDateTime(item.manager_acted_at, false) : '';
    return {
      text: `ACC : [${roleCapital}] ${item.manager_actor.nama}${timeStr ? ` [${timeStr}]` : ''}`,
      role: roleCapital,
      className: 'text-purple-700 bg-purple-50 border-purple-200',
      tooltip: tooltip || `ACC : [${roleCapital}] ${item.manager_actor.nama} [${timeStr}]`
    };
  }

  return null;
}
