# =====================================================================
# L2 - GENERATE SQL ISI STAGING payment_import_staging
# Tanggal: 2 Oktober 2026
#
# KELUARAN: docs/sql/67-isi-staging-payment.sql
#
# SENGaja TIDAK memuat PII:
#   nama_penerima, nomor_rekening, nik, alamat, link_ktp -> tidak ikut.
#   Kolom-kolom itu masih ada di cache lokal docs/payment/parsed-826.csv
#   (yang .csv = otomatis tidak masuk git) dan baru ikut di SQL tahap
#   INSERT fase 2, setelah PII soal git sudah diputuskan owner.
#
# PERBAIKAN TANGGAL (keputusan owner 2 Okt 2026):
#   4 baris tertulis "17/04/2025" di sheet April 2026. Itu salah ketik.
#   Diperbaiki ke 2026-04-17, TEKS ASLINYA tetap ditulis di tanggal_asal
#   supaya jejaknya tetap bisa diaudit.
# =====================================================================
$ErrorActionPreference = 'Stop'
$root = 'C:\Users\Banzilla\Documents\DEV\Project-Tracking-System-VPS'
$src  = Join-Path $root 'docs\payment\parsed-826.csv'
$dst  = Join-Path $root 'docs\sql\67-isi-staging-payment.sql'

# Escape SQL. PENTING: 6 sel di spreadsheet punya newline/tab di dalamnya
# (contoh: 'aleena_balqis\n'). Kalau diteruskan mentah, satu baris SQL
# pecah jadi dua dan SELURUH migration gagal. Karakter kontrol ditulis
# sebagai teks dua huruf supaya jejaknya tetap bisa dibaca auditor.
function Q([string]$s){
  if([string]::IsNullOrEmpty($s)){ return 'NULL' }
  $t = $s -replace '\\', '\\\\'
  $t = $t -replace "`r", '\r'
  $t = $t -replace "`n", '\n'
  $t = $t -replace "`t", '\t'
  return "'" + ($t -replace "'", "''") + "'"
}

# Sel yang berisi lebih dari satu username. Ini satu pembayaran untuk
# beberapa akun, BUKAN beberapa pembayaran. Tidak boleh dipecah sendiri -
# pemecahan akan mengarang nominal per akun yang tidak ada di spreadsheet.
function Multi-User($x){
  return (@($x.username_mentah -split "[`r`n]" | ForEach-Object { $_.Trim() } | Where-Object { $_ })).Count -gt 1
}

function Catatan($x){
  $c = @()
  $multi = @($x.username_mentah -split "[`r`n]" | ForEach-Object { $_.Trim() } | Where-Object { $_ })
  if($multi.Count -gt 1){
    $c += ("satu sel berisi {0} username: {1} - dicatat sebagai SATU pembayaran, tidak dipecah" -f $multi.Count, ($multi -join ', '))
  }
  if($x.tanggal -like '2025-*'){
    $c += ("tanggal di spreadsheet tertulis '{0}' (tahun 2025), diperbaiki ke 2026-04-17 atas instruksi owner 2 Okt 2026" -f $x.tanggal_asal)
  }
  if(-not $x.status_klaim){
    $c += "kolom Status kosong di spreadsheet; payment_type diputuskan manual"
  }
  if($x.status_klaim -eq 'kekurangan dikit'){
    $c += "kolom Status berisi teks 'kekurangan dikit', bukan jenis pembayaran"
  }
  if(-not $x.pic){
    $c += "kolom PIC kosong di spreadsheet; submitted_by NULL"
  }
  return ($c -join ' | ')
}

function Kat($x){
  if($x.status_klaim -eq 'ADS'){ return 'ads' }
  if($x.status_klaim -eq 'LION'){ return 'lion' }
  if($x.status_klaim -eq 'CRM'){ return 'crm' }
  if($x.campaign_sheet -match '(?i)^Sampel'){ return 'operasional_lain' }
  return 'kreator'
}

$data = Import-Csv $src
$fixTypo = @($data | Where-Object { $_.tanggal -like '2025-*' }).Count

$sb = New-Object System.Text.StringBuilder
function W($t){ [void]$sb.AppendLine($t) }

W '-- ====================================================================='
W '-- ISI payment_import_staging - 826 baris payment historis (Feb-11 Sep 2026)'
W '-- Tanggal : 2 Oktober 2026'
W '-- Sumber  : docs/payment/parsed-826.csv (hasil parse read-only)'
W '--'
W '-- Sifat: INSERT ke tabel STAGING saja. Tidak menyentuh payment_items.'
W '--'
W '-- Cakupan  : hanya `Status Pembayaran` = `Paid Off`'
W '--            hanya tanggal < 2026-09-14 (sistem baru dipakai 14 Sep 2026,'
W '--            dibuktikan MIN(submitted_at) = 2026-09-14 12:42) -> nol tumpang tindih'
W '-- Baris TOTAL sudah dibuang. Tanggal 17/04/2025 dikoreksi -> 2026-04-17.'
W '--'
W '-- TIDAK ada PII di file ini: nama penerima, nomor rekening, NIK, alamat,'
W '-- dan link KTP tidak ikut. Kolom itu tersedia di cache lokal dan baru'
W '-- disisihkan pada SQL INSERT fase 2.'
W '--'
W '-- Cara jalankan (WAJIB pakai commit SHA, bukan `main`):'
W '--   curl -s "https://raw.githubusercontent.com/novacore25/tnt-project-tracking/<SHA>/docs/sql/67-isi-staging-payment.sql" \'
W '--     | docker exec -i 6ve3f9zqfkypblr0f0cea4jm psql -U postgres -d db_tnt_project_system -v ON_ERROR_STOP=1'
W '-- ====================================================================='
W ''
W 'BEGIN;'
W ''
W 'TRUNCATE payment_import_staging;'
W ''

$batchSize = 100
$i = 0
while($i -lt $data.Count){
  $end = [Math]::Min($i + $batchSize, $data.Count)
  W "-- baris $($i+1) s/d $end dari $($data.Count)"
  W 'INSERT INTO payment_import_staging'
  W '  (sheet,row,tanggal,tanggal_asal,tanggal_dari,username,username_mentah,'
  W '   username_multi,campaign_sheet,status_klaim,kategori,nominal,ratecard_awal,'
  W '   pic,catatan)'
  W 'VALUES'
  for($j = $i; $j -lt $end; $j++){
    $x = $data[$j]
    $tgl = $x.tanggal
    if($tgl -like '2025-*'){ $tgl = $tgl -replace '^2025-', '2026-' }
    $vals = @(
      (Q $x.sheet)
      [string][int]$x.row
      "DATE '$tgl'"
      (Q $x.tanggal_asal)
      (Q $x.tanggal_dari)
      (Q $x.username)
      (Q $x.username_mentah)
      $(if(Multi-User $x){ 'true' } else { 'false' })
      (Q $x.campaign_sheet)
      (Q $x.status_klaim)
      (Q (Kat $x))
      [string][int64]$x.nominal
      [string][int64]$x.ratecard_awal
      (Q $x.pic)
      (Q (Catatan $x))
    ) -join ', '
    $koma = if($j -lt $end - 1){ ',' } else { ';' }
    W "  ($vals)$koma"
  }
  W ''
  $i = $end
}

W '-- ---------------------------------------------------------------------'
W '-- GUARD: staging harus persis 826 baris / Rp 507.736.562'
W '-- Kalau tidak, script ini BATAL dan tidak ada data yang masuk.'
W '-- ---------------------------------------------------------------------'
W 'DO $guard$'
W 'DECLARE n int; v numeric;'
W 'BEGIN'
W '  SELECT count(*), COALESCE(sum(nominal),0) INTO n, v FROM payment_import_staging;'
W '  IF n <> 826 THEN'
W '    RAISE EXCEPTION ''GAGAL: staging berisi % baris, harusnya 826'', n;'
W '  END IF;'
W '  IF v <> 507736562 THEN'
W '    RAISE EXCEPTION ''GAGAL: total nominal staging % , harusnya 507736562'', v;'
W '  END IF;'
W 'END $guard$;'
W ''
W '-- GUARD 2: tidak boleh ada dua baris dengan kunci yang sama persis.'
W '-- Kunci = username + campaign + status + nominal + tanggal.'
W '--nol Duplikat SEBENARNYA adalah 0, jadi ini harus lolos tanpa perubahan.'
W '-- Kalau gagal, berarti parse menghasilkan baris kembar -> perbaiki parser,'
W '-- JANGAN dihapus diam-diam dari staging.'
W 'DO $guard2$'
W 'DECLARE n int;'
W 'BEGIN'
W '  SELECT count(*) INTO n FROM ('
W '    SELECT 1 FROM payment_import_staging'
W '    GROUP BY username, campaign_sheet, status_klaim, nominal, tanggal'
W '    HAVING count(*) > 1'
W '  ) d;'
W '  IF n > 0 THEN'
W '    RAISE EXCEPTION ''GAGAL: % grup baris kembar di staging'', n;'
W '  END IF;'
W 'END $guard2$;'
W ''
W 'COMMIT;'
W ''
W '-- ---------------------------------------------------------------------'
W '-- LAPORAN SETELAH DIJALANKAN'
W '--'
W '--   SELECT count(*) AS baris, sum(nominal) AS nominal'
W '--   FROM payment_import_staging;'
W '--   -- harus: 826 | 507736562'
W '--'
W '--   SELECT kategori, count(*) AS baris, sum(nominal) AS nominal'
W '--   FROM payment_import_staging GROUP BY 1 ORDER BY 3 DESC;'
W '--   -- harus: kreator 769/301301562, ads 51/180775000,'
W '--   --        operasional_lain 1/10000000, lion 3/9000000, crm 2/6660000'
W '--'
W '--   SELECT * FROM v_payment_campaign_unmapped;'
W '--   -- campaign yang belum punya campaign_id -> destined DEFER'
W '-- ---------------------------------------------------------------------'

[System.IO.File]::WriteAllText($dst, $sb.ToString(), (New-Object System.Text.UTF8Encoding($false)))

Write-Output "OK  -> $dst"
Write-Output ("  file  : {0:N0} baris, {1:N0} byte" -f $data.Count, (Get-Item $dst).Length)
Write-Output ("  typo 17/04/2025 diperbaiki : {0} baris" -f $fixTypo)
Write-Output ("  kategori: " + (($data | ForEach-Object { Kat $_ } | Group-Object | ForEach-Object { "$($_.Name)=$($_.Count)" }) -join ' '))
