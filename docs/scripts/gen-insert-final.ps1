# =====================================================================
# GENERATE SQL INSERT FINAL payment_batches + payment_items
# Tanggal: 2 Oktober 2026
#
# KELUARAN: docs/sql/73-insert-payment-historis.sql
#   -> FILE INI MENGANDUNG PII (NIK, nomor rekening, nama penerima)
#   -> sudah di-ignore .gitignore. JANGAN pernah di-commit.
#   -> dijalankan dari mesin owner, bukan lewat curl.
#
# KEPUTUSAN OWNER YANG SUDAH DITERAPKAN DI SINI
#   #16 tidak ada dedup, semua 826 baris dihitung
#   #17 PIC April = profil Aprilia
#   #18 PIC Rija  = profil Irsadur Rija
#   #19 17/04/2025 -> 2026-04-17
#   SALSA Baby Care -> 36 SALSA Mom & Baby
#   METOO / TOP UP LION / TOP UP QONTAK / Sampel Kime / MCN* / BOA -> DEFER
#   3 baris tanpa payment_type -> 100_akhir + catatan di notes
#   Juli r61 -> pecah jadi 5 item x Rp 400.000
#   17 baris duplikat lokasi -> tidak diimport
#
# STRUKTUR BATCH (keputusan #11 + #12)
#   kunci = (tanggal, PIC, campaign)
#   label = "2026-03-15 - PIC: Wahyu - KIME"
#   submitted_by = profil PIC, atau NULL kalau PIC tidak punya akun
#                 (nama PIC tetap tertulis di label)
# =====================================================================
$ErrorActionPreference = 'Stop'
$root = 'C:\Users\Banzilla\Documents\DEV\Project-Tracking-System-VPS'
$src  = Join-Path $root 'docs\payment\parsed-826.csv'
$dst  = Join-Path $root 'docs\sql\73-insert-payment-historis.sql'

# ---- peta campaign (SEMUA sudah dikonfirmasi owner 2 Okt 2026) ----
$peta = @{
    'PWS'=38; 'DIOLY'=40; 'SYB'=46; 'GLOWIES'=51; 'ISWHITE'=47; 'SKINMOLOGY'=43
    'WARDAH'=37; 'NAISDAY'=39; 'OMG Makeup'=33; 'OMG Skincare'=34; 'QAHIRA'=45
    'MILKYBOOST'=52; 'KIMME'=44; 'MSGLOWBEAUTY'=41; 'MSGLOWFORMEN'=42
    'Nutriflakes'=49; 'SALSA COSMETICS'=35; 'Votre Peu'=53; 'SALSA Baby Care'=36
}
$petaDb = @{
    'KIMME'='KIME'; 'PWS'='PWS'; 'DIOLY'='DIOLY'; 'OMG Makeup'='OMG Makeup'
    'SALSA COSMETICS'='SALSA Cosmetic'; 'SALSA Baby Care'='SALSA Mom & Baby'
    'WARDAH'='WARDAH'; 'NAISDAY'='NAISDAY'; 'OMG Skincare'='OMG Skincare'
    'MSGLOWBEAUTY'='MS Glow Beauty'; 'QAHIRA'='QAHIRA'; 'SYB'='SYB'
    'ISWHITE'='ISWHITE'; 'SKINMOLOGY'='SKINMOLOGY'; 'GLOWIES'='GLOWIES'
    'Nutriflakes'='NUTRIFLAKES'; 'MSGLOWFORMEN'='MS Glow For Men'
    'Votre Peu'='VOTRE PEAU'; 'MILKYBOOST'='MILKYBOOST'
}

# ---- 17 duplikat lokasi (terbukti, docs/sql/71 bagian1b) ----
$duplikat = @(
 'Agustus 2026:93','Agustus 2026:108','Agustus 2026:109','Agustus 2026:116'
 'Agustus 2026:117','Agustus 2026:118','September 2026:2','September 2026:3'
 'September 2026:4','September 2026:5','September 2026:6','September 2026:7'
 'September 2026:8','September 2026:9','September 2026:10','September 2026:11'
 'September 2026:12'
)

# ---- PIC -> nama persis di profiles ----
$picProfil = @{
    'Wahyu'='Wahyu Prakoso'; 'Maria'='Maria Alvita'; 'April'='Aprilia'
    'Rija'='Irsadur Rija';   'Tiara'='Tiara';        'Fira'='Fira'
}

# ---- 5 kreator dalam 1 sel (Juli 2026 r61) ----
$agen = @('hi.syah','vv.vianaaa','eloraariyani','zaraaa.nh','beautyaul_')

function Q([string]$s){
  if([string]::IsNullOrEmpty($s)){ return 'NULL' }
  $t = $s -replace '\\','\\' -replace "`r",'\r' -replace "`n",'\n' -replace "`t",'\t'
  return "'" + ($t -replace "'","''") + "'"
}
function PT([string]$status){
  switch($status){
    '100% AKHIR' { '100_akhir' }
    '50% AWAL'   { '50_awal' }
    '50% AKHIR'  { '50_akhir' }
    '100% AWAL'  { '100_awal' }
    'ADS'        { 'ads' }
    'LION'       { 'lion' }
    'CRM'        { 'crm' }
    default      { '100_akhir' }
  }
}

$data = Import-Csv $src

# ================= filter + normalisasi =================
$rows = New-Object System.Collections.ArrayList
$deferList = New-Object System.Collections.ArrayList
$dupCount = 0

foreach($x in $data){
    $key = "$($x.sheet):$($x.row)"
    if($duplikat -contains $key){ $dupCount++; continue }
    if(-not $peta.ContainsKey($x.campaign_sheet)){ [void]$deferList.Add($x); continue }

    $cat = New-Object System.Collections.ArrayList
    $tgl = $x.tanggal
    if($tgl -like '2025-*'){
        $tgl = $tgl -replace '^2025-','2026-'
        [void]$cat.Add("tanggal di spreadsheet tertulis '$($x.tanggal_asal)' (tahun 2025), dikoreksi ke $tgl atas instruksi owner 2 Okt 2026")
    }
    if(-not $x.status_klaim){
        [void]$cat.Add("kolom Status kosong di spreadsheet; payment_type ditetapkan 100_akhir atas keputusan owner 2 Okt 2026")
    }
    if($x.status_klaim -eq 'kekurangan dikit'){
        [void]$cat.Add("kolom Status berisi teks 'kekurangan dikit' (catatan, bukan jenis pembayaran); payment_type ditetapkan 100_akhir atas keputusan owner 2 Okt 2026")
    }
    if(-not $x.pic){ [void]$cat.Add('kolom PIC kosong di spreadsheet; submitted_by NULL') }

    # ---- agency: 1 sel berisi 4 username -> 5 item x Rp 400.000 ----
    if($x.username -match 'vv\.vianaa'){
        foreach($a in $agen){
            [void]$rows.Add([pscustomobject]@{
                tanggal=$tgl; cid=$peta[$x.campaign_sheet]; cdb=$petaDb[$x.campaign_sheet]
                username=$a; pt=(PT $x.status_klaim); nominal=[int64]400000
                ratecard_awal=[int64]0; pic=$x.pic; nama=$x.nama_penerima
                rek=$x.nomor_rekening; nik=$x.nik; alamat=$x.alamat
                link_ktp=$x.link_ktp; link_kontrak=$x.link_kontrak
                bukti=$x.bukti_tf; metode=$x.metode_bayar; note=$x.note
                catatan=(($cat -join ' | ') + ' | satu pembayaran Rp 2.000.000 ke rekening agency, 1 sel berisi 4 username; dipecah jadi 5 item x Rp 400.000 atas keputusan owner 2 Okt 2026. Asal: ' + ($x.username_mentah -replace "`n",' / '))
            })
        }
        continue
    }

    [void]$rows.Add([pscustomobject]@{
        tanggal=$tgl; cid=$peta[$x.campaign_sheet]; cdb=$petaDb[$x.campaign_sheet]
        username=$x.username; pt=(PT $x.status_klaim); nominal=[int64]$x.nominal
        ratecard_awal=[int64]$x.ratecard_awal; pic=$x.pic; nama=$x.nama_penerima
        rek=$x.nomor_rekening; nik=$x.nik; alamat=$x.alamat
        link_ktp=$x.link_ktp; link_kontrak=$x.link_kontrak
        bukti=$x.bukti_tf; metode=$x.metode_bayar; note=$x.note
        catatan=($cat -join ' ')
    })
}

# ================= grouping batch (kunci #11) =================
# Kunci = (tanggal, PIC, campaign). Group-Object sudah otomatis mengurutkan
# nama grup, lalu diurutkan ulang berdasarkan tanggal supaya batch tampil kronologis.
$batches = New-Object System.Collections.ArrayList
$idx = 0
foreach($g in ($rows | Group-Object { "$($_.tanggal)|$($_.pic)|$($_.cdb)" } |
               Sort-Object { $_.Group[0].tanggal }, { $_.Group[0].cdb }, { $_.Group[0].pic })){
    $idx++
    $x = $g.Group[0]
    $picTxt = if($x.pic){ $x.pic } else { 'tanpa PIC' }
    [void]$batches.Add([pscustomobject]@{
        urut=$idx; tanggal=$x.tanggal; pic=$x.pic; cdb=$x.cdb; cid=$x.cid
        label="$($x.tanggal) - PIC: $picTxt - $($x.cdb)"
        items=@($g.Group)
    })
}

# ================= tulis SQL =================
$sb = New-Object System.Text.StringBuilder
function W($t){ [void]$sb.AppendLine($t) }

$totNom = ($rows | Measure-Object nominal -Sum).Sum
W '-- ====================================================================='
W '-- INSERT PAYMENT HISTORIS Feb - Sep 2026'
W '-- Tanggal : 2 Oktober 2026'
W '-- Sumber  : docs/payment/parsed-826.csv (hasil parse read-only)'
W '--'
W '-- PERINGATAN: FILE INI MENGANDUNG DATA PII.'
W '-- Berisi NIK, nomor rekening, dan nama penerima. Sengaja di-ignore oleh'
W '-- .gitignore. JANGAN pernah di-commit.'
W '-- Jalankan dari mesin owner, BUKAN lewat curl dari GitHub.'
W '--'
W '-- REKAP - semua harus cocok, kalau tidak JANGAN lanjut:'
W ("--   baris Excel terbaca        : {0}   Rp {1}" -f $data.Count, ($data|Measure-Object nominal -Sum).Sum)
W ("--   - duplikat lokasi (17)     : {0}   Rp 4250000" -f $dupCount)
W ("--   - DEFER tanpa campaign(18) : {0}   Rp {1}" -f $deferList.Count, ($deferList|Measure-Object nominal -Sum).Sum)
W ("--   = payment_items dibuat     : {0}   Rp {1}" -f $rows.Count, $totNom)
W ("--     (791 baris staging; 1 baris agency dipecah jadi 5 item)")
W ("--   payment_batches dibuat     : {0}" -f $batches.Count)
W '--'
W '-- Cara menjalankan (dari mesin owner):'
W '--   Get-Content docs\sql\73-insert-payment-historis.sql -Raw |'
W '--     wsl -e bash -c "docker exec -i 6ve3f9zqfkypblr0f0cea4jm psql -U postgres -d db_tnt_project_system -v ON_ERROR_STOP=1"'
W '-- ====================================================================='
W ''
W 'BEGIN;'
W ''
W '-- ====================================================================='
W '-- BACKUP DULU - jangan dihapus sampai owner puas'
W '-- ====================================================================='
W 'DROP TABLE IF EXISTS backup_payment_items_20261002;'
W 'CREATE TABLE backup_payment_items_20261002 AS SELECT * FROM payment_items;'
W 'DROP TABLE IF EXISTS backup_payment_batches_20261002;'
W 'CREATE TABLE backup_payment_batches_20261002 AS SELECT * FROM payment_batches;'
W ''
W '-- Tanda import agar idempotent: kalau sudah pernah jalan, script berhenti.'
W 'ALTER TABLE payment_batches ADD COLUMN IF NOT EXISTS import_riwayat text;'
W 'ALTER TABLE payment_items   ADD COLUMN IF NOT EXISTS import_riwayat text;'
W ''
W 'DO $b$'
W 'BEGIN'
W '  IF EXISTS (SELECT 1 FROM payment_batches WHERE import_riwayat = ''payment-historis-2026'') THEN'
W '    RAISE EXCEPTION ''Import ini sudah pernah jalan. Batalkan, atau hapus dulu baris dengan import_riwayat = payment-historis-2026.'';'
W '  END IF;'
W 'END $b$;'
W ''
W '-- ====================================================================='
W '-- GUARD - angka harus PERSIS cocok sebelum ada penulisan'
W '-- ====================================================================='
W 'DO $g$'
W 'DECLARE n bigint; v numeric;'
W 'BEGIN'
W '  SELECT count(*), COALESCE(sum(nominal),0) INTO n, v'
W '    FROM payment_import_staging WHERE status_import = ''siap'';'
W '  IF n <> 791 THEN'
W '    RAISE EXCEPTION ''GAGAL: staging punya % baris siap, harusnya 791'', n;'
W '  END IF;'
W '  IF v <> 375026562 THEN'
W '    RAISE EXCEPTION ''GAGAL: nominal staging siap % , harusnya 375026562'', v;'
W '  END IF;'
W '  IF EXISTS (SELECT 1 FROM payment_import_staging'
W '             WHERE status_import = ''siap'' AND campaign_id IS NULL) THEN'
W '    RAISE EXCEPTION ''GAGAL: ada baris siap tanpa campaign_id'';'
W '  END IF;'
W 'END $g$;'
W ''
W '-- ====================================================================='
W '-- payment_batches'
W '-- ====================================================================='
W 'CREATE TEMP TABLE t_batch ('
W '  urut serial PRIMARY KEY, campaign_id int, label text, tgl date,'
W '  nominal bigint, item_count int, pic text);'
W ''
foreach($b in $batches){
    $nom = ($b.items | Measure-Object nominal -Sum).Sum
    W ("INSERT INTO t_batch (urut,campaign_id,label,tgl,nominal,item_count,pic) VALUES ({0},{1},{2},DATE '{3}',{4},{5},{6});" -f `
        $b.urut, $b.cid, (Q $b.label), $b.tanggal, $nom, $b.items.Count, (Q $b.pic))
}
W ''
W '-- ====================================================================='
W '-- payment_items'
W '--'
W '-- NILAI STATUS TIDAK BOLEH DITEBAK. Sudah diverifikasi dari katalog:'
W '--   manager_status   CHECK (pending|approved|rejected)'
W '--   executive_status CHECK (pending|approved|rejected)'
W '--   final_status     CHECK (pending|manager_approved|executive_1_approved|'
W '--                            pending_finance_outstanding|finance_selected|'
W '--                            executive_approved|ready_to_pay|paid|rejected)'
W '--   executive_1_status tidak punya CHECK, tapi item yang sudah dibayar di'
W '--   sistem sekarang semuanya bernilai ''approved'' - ikut Ditiru.'
W '--'
W '-- Dipakai: manager=approved, executive_1=approved, executive=approved,'
W '-- final=paid. Ini persis pola 44 item yang sudah dibayar di sistem sekarang.'
W '-- Kalau diset ''pending'', Rp 375 juta akan tampil sebagai "belum dibayar"'
W '-- padahal uangnya sudah keluar.'
W '--'
W '-- actual_transfer = nominal dan ikut ke actual_payment_date batch,'
W '-- supaya tidak ada item yang terlihat "dibayar Rp 0".'
W '-- ====================================================================='
W 'CREATE TEMP TABLE t_item ('
W '  urut serial PRIMARY KEY, batch_urut int, campaign_creator_id int,'
W '  payment_type text, ratecard_awal bigint, nominal bigint,'
W '  metode_pembayaran text, nomor_rekening text, nama_penerima text,'
W '  nik text, alamat_ktp text, link_ktp text, link_kontrak text,'
W '  manager_status text, executive_1_status text, executive_status text,'
W '  final_status text, notes text, actual_transfer numeric,'
W '  username text, campaign_id int);'
W ''
W 'INSERT INTO t_item (batch_urut,campaign_creator_id,payment_type,ratecard_awal,nominal,metode_pembayaran,nomor_rekening,nama_penerima,nik,alamat_ktp,link_ktp,link_kontrak,manager_status,executive_1_status,executive_status,final_status,notes,actual_transfer,username,campaign_id) VALUES'

# PENTING: SEMUA baris VALUES harus berada dalam SATU statement INSERT.
# Kalau tiap baris diakhiri ';', setiap baris jadi statement sendiri dan
# baris kedua ke bawah akan error "syntax error at or near (".
# Yang diakhiri ';' hanya baris TERAKHIR. Ini bug yang sudah pernah menimpa.
$total = ($batches | ForEach-Object { $_.items.Count } | Measure-Object -Sum).Sum
$done = 0
foreach($b in $batches){
    foreach($x in $b.items){
        $done++
        $notes = (@($x.note, $x.catatan) | Where-Object { $_ }) -join ' | '
        $end = if($done -eq $total){ ');' } else { '),' }
        W ("({0},NULL,{1},{2},{3},{4},{5},{6},{7},{8},{9},{10},'approved','approved','approved','paid',{11},{12},{13},{14}{15}" -f `
            $b.urut,
            (Q $x.pt),
            ([int64]$x.ratecard_awal),
            ([int64]$x.nominal),
            (Q $x.metode),
            (Q $x.rek),
            (Q $x.nama),
            (Q $x.nik),
            (Q $x.alamat),
            (Q $x.link_ktp),
            (Q $x.link_kontrak),
            (Q $notes),
            ([int64]$x.nominal),
            (Q $x.username),
            $x.cid,
            $end)
    }
}

W ''
W '-- ====================================================================='
W '-- 1. TULIS payment_batches'
W '--'
W '-- status = ''paid'' karena pembayaran ini sudah terjadi nyata.'
W '-- batch_label memakai format keputusan #12: "YYYY-MM-DD - PIC: X - CAMPAIGN"'
W '-- submitted_by diisi dari profiles lewat NAMA (lihat migration 20261004000000),'
W '-- bukan UUID yang diketik manual.'
W '-- ====================================================================='
W 'INSERT INTO payment_batches ('
W '  campaign_id, batch_label, submitted_by, submitted_at, status,'
W '  paid_at, actual_payment_date, notes, import_riwayat'
W ')'
W 'SELECT tb.campaign_id, tb.label, u.id, tb.tgl::timestamptz, ''paid'','
W '       tb.tgl::timestamptz, tb.tgl,'
W '       ''Impor dari Form Payment Campaign TNT.xlsx (historis, sebelum sistem dipakai). '''
W '       || tb.item_count || '' item, Rp '' || tb.nominal'
W '       || CASE WHEN u.id IS NULL THEN ''. submitted_by NULL: PIC "'''
W '       || coalesce(tb.pic,''(kosong)'') || ''" tidak punya akun di profiles.'''
W '             ELSE ''. submitted_by = '' || u.nama END,'
W '       ''payment-historis-2026'''
W '  FROM t_batch tb'
W '  LEFT JOIN profiles u ON u.nama = ('
W '       SELECT m.profile_nama FROM payment_import_map_pic m WHERE m.pic = tb.pic);'
W ''
W '-- Petakan urut -> id batch yang baru dibuat. Diperlukan untuk item.'
W 'CREATE TEMP TABLE t_map AS'
W 'SELECT tb.urut, pb.id'
W '  FROM t_batch tb'
W '  JOIN payment_batches pb'
W '    ON pb.import_riwayat = ''payment-historis-2026'''
W '   AND pb.batch_label = tb.label;'
W ''
W '-- GUARD: jumlah row t_map HARUS sama dengan t_batch.'
W '-- Kalau lebih, itu berarti JOIN ke profiles menghasilkan baris ganda -'
W '-- artinya ada >1 profil dengan nama yang sama. Kalau itu terjadi, batch'
W '-- akan ter-INSERT dua kali dan uang terhitung 2x. Tolak, jangan diloloskan.'
W 'DO $gb$'
W 'DECLARE n int; m int;'
W 'BEGIN'
W '  SELECT count(*) INTO n FROM t_batch;'
W '  SELECT count(*) INTO m FROM t_map;'
W '  IF n <> m THEN'
W '    RAISE EXCEPTION ''GAGAL: t_batch % baris tapi t_map % baris. JOIN ke profiles menghasilkan baris ganda - cek profiles.nama yang duplikat.'', n, m;'
W '  END IF;'
W '  SELECT count(*) INTO n FROM t_batch tb'
W '   WHERE NOT EXISTS (SELECT 1 FROM t_map m WHERE m.urut = tb.urut);'
W '  IF n > 0 THEN'
W '    RAISE EXCEPTION ''GAGAL: % batch tidak ketemu setelah INSERT'', n;'
W '  END IF;'
W 'END $gb$;'
W ''
W '-- ====================================================================='
W '-- 2. TULIS payment_items'
W '--'
W '-- campaign_creator_id diisi lewat creators.username, HANYA kalau username itu'
W '-- terdaftar DAN ada di campaign yang sama. Kalau tidak, NULL - beserta'
W '-- username aslinya di notes supaya jejaknya tetap ada.'
W '--'
W '-- PAKAI SUBQUERY KORELASI, bukan UPDATE ... FROM.'
W '-- PostgreSQL tidak mengizinkan tabel target disebut di klausa FROM-nya:'
W '-- "invalid reference to FROM-clause entry". Sudah pernah menimpa.'
W '--'
W '-- min(cc.id) dipakai supaya hasilnya deterministik kalau ternyata ada'
W '-- lebih dari satu baris campaign_creators untuk pasangan yang sama.'
W '--'
W '-- Item tanpa username (ads / crm / lion / sampel) tetap dapat'
W '-- campaign_creator_id NULL. Itu kondisi SAH, sudah dibuktikan oleh tes'
W '-- owner di batch 93.'
W '-- ====================================================================='
W 'UPDATE t_item t'
W '   SET campaign_creator_id = ('
W '       SELECT min(cc.id)'
W '         FROM creators cr'
W '         JOIN campaign_creators cc ON cc.creator_id = cr.id'
W '                                AND cc.campaign_id = t.campaign_id'
W '        WHERE t.username IS NOT NULL'
W '          AND lower(cr.username) = t.username)'
W ' WHERE t.username IS NOT NULL;'
W ''
W '-- Laporan: berapa item yang punya creator vs tidak.'
W '\echo ''--- item dengan campaign_creator_id ---'''
W 'SELECT count(*) FILTER (WHERE campaign_creator_id IS NOT NULL) AS dengan_kreator,'
W '       count(*) FILTER (WHERE campaign_creator_id IS NULL)     AS tanpa_kreator'
W '  FROM t_item;'
W ''
W 'INSERT INTO payment_items ('
W '  batch_id, campaign_creator_id, payment_type, ratecard_awal, nominal,'
W '  metode_pembayaran, nomor_rekening, nama_penerima, nik, alamat_ktp,'
W '  link_ktp, link_kontrak, manager_status, executive_1_status,'
W '  executive_status, final_status, notes, actual_transfer, import_riwayat'
W ')'
W 'SELECT m.id, t.campaign_creator_id, t.payment_type, t.ratecard_awal, t.nominal,'
W '       t.metode_pembayaran, t.nomor_rekening, t.nama_penerima, t.nik,'
W '       t.alamat_ktp, t.link_ktp, t.link_kontrak,'
W '       t.manager_status, t.executive_1_status, t.executive_status,'
W '       t.final_status, t.notes, t.actual_transfer, ''payment-historis-2026'''
W '  FROM t_item t'
W '  JOIN t_map m ON m.urut = t.batch_urut;'
W ''
W 'COMMIT;'
W ''
W '-- ====================================================================='
W '-- 3. LAPORAN SETELAH DIJALANKAN'
W '--'
W '--   SELECT payment_type, count(*), sum(nominal)'
W '--     FROM payment_items WHERE import_riwayat = ''payment-historis-2026'''
W '--    GROUP BY 1 ORDER BY 3 DESC;'
W '--   -- harus: 795 item, Rp 375.026.562'
W '--     100_akhir 587 | ads 51 | 50_akhir 106 | 50_awal 35 | 100_awal 16'
W '--'
W '--   SELECT c.nama, count(*), sum(pi.nominal)'
W '--     FROM payment_items pi'
W '--     JOIN payment_batches pb ON pb.id = pi.batch_id'
W '--     JOIN campaigns c ON c.id = pb.campaign_id'
W '--    WHERE pi.import_riwayat = ''payment-historis-2026'''
W '--    GROUP BY 1 ORDER BY 3 DESC;'
W '--'
W '--   SELECT count(*) FROM payment_batches'
W '--    WHERE import_riwayat = ''payment-historis-2026'';'
W '--   -- harus: 277'
W '--'
W '--   ROLLBACK / UNDO kalau ada yang tidak beres:
W '--     BEGIN;
W '--     DELETE FROM payment_items   WHERE import_riwayat = ''payment-historis-2026'';'
W '--     DELETE FROM payment_batches WHERE import_riwayat = ''payment-historis-2026'';'
W '--     ALTER TABLE payment_batches DROP COLUMN IF EXISTS import_riwayat;'
W '--     ALTER TABLE payment_items   DROP COLUMN IF EXISTS import_riwayat;'
W '--     COMMIT;'
W '--'
W '-- Backup ada di: backup_payment_items_20261002, backup_payment_batches_20261002'
W '-- ====================================================================='

[System.IO.File]::WriteAllText($dst, $sb.ToString(), (New-Object System.Text.UTF8Encoding($false)))
Write-Output "OK -> $dst"
Write-Output ("  item    : {0}   Rp {1}" -f $rows.Count, $totNom)
Write-Output ("  batch   : {0}" -f $batches.Count)
Write-Output ("  defer   : {0} baris Rp {1}" -f $deferList.Count, ($deferList|Measure-Object nominal -Sum).Sum)
Write-Output ("  file    : {0:N0} byte" -f (Get-Item $dst).Length)
