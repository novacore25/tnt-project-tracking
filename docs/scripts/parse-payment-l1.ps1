# =====================================================================
# L1 - PARSE SPREADSHEET PAYMENT -> CACHE (READ-ONLY, tidak menulis ke DB)
# Tanggal: 2 Oktober 2026
#
# ATURAN:
#   - Hanya `Status Pembayaran` = `Paid Off`
#   - Hanya TANGGAL < 2026-09-14 (sistem baru dipakai 14 Sep, §7)
#   - Buang baris `TOTAL` (subtotal palsu di dalam kolom tanggal)
#   - Cari kolom per NAMA, bukan per nomor (4 layout berbeda)
#   - `.Text` bukan `.Value2`
#   - Header sheet Februari di BARIS 3, sheet lain baris 1
#   - Normalisasi username: trim + lowercase + buang '@'
#
# OUTPUT:
#   docs/payment/parsed-826.csv   -> cache untuk tahap berikutnya
# =====================================================================
$ErrorActionPreference = 'Stop'
$src  = "C:\Users\Banzilla\Downloads\Form Payment Campaign TNT.xlsx"
$outD = "C:\Users\Banzilla\Documents\DEV\Project-Tracking-System-VPS\docs\payment"
if(-not (Test-Path $outD)){ New-Item -ItemType Directory -Path $outD -Force | Out-Null }
$cut  = [datetime]'2026-09-14'

function Norm-User([string]$s){
  if(-not $s){ return '' }
  $x = $s -replace "[\r\n\t]", '' -replace '^\s+','' -replace '\s+$',''
  $x = $x -replace '^@',''
  return $x.ToLower()
}
function Norm-Rek([string]$s){
  if(-not $s){ return '' }
  return ($s -replace '\D','')
}
function Norm-Nama([string]$s){
  if(-not $s){ return '' }
  $x = $s -replace "[\r\n\t]", ' '
  $x = ($x -replace '\s+',' ').Trim()
  return $x.ToLower()
}
function Parse-Rp([string]$s){
  if(-not $s){ return [int64]0 }
  $d = ($s -replace '[^\d]','')
  if([string]::IsNullOrWhiteSpace($d)){ return [int64]0 }
  return [int64]$d
}
function Parse-Tgl([string]$s){
  if(-not $s){ return $null }
  $s = $s.Trim()
  if($s -match '^\d{2}/\d{2}/\d{4}$'){ try{ return [datetime]::ParseExact($s,'dd/MM/yyyy',$null) }catch{ return $null } }
  if($s -match '^\d{4}-\d{2}-\d{2}$'){ try{ return [datetime]::ParseExact($s,'yyyy-MM-dd',$null) }catch{ return $null } }
  return $null
}

$rows = @()
$xl = New-Object -ComObject Excel.Application
$xl.Visible = $false; $xl.DisplayAlerts = $false
try {
  $wb = $xl.Workbooks.Open($src, $false, $true)
  foreach($ws in $wb.Worksheets){
    $hdrRow = if($ws.Name -like 'Februari*'){ 3 } else { 1 }
    $H = @{}
    for($c=1; $c -le $ws.UsedRange.Columns.Count; $c++){
      $t = ($ws.Cells.Item($hdrRow,$c).Text -replace '\s+',' ').Trim()
      if($t){ $H[$t] = $c }
    }
    if(-not $H.ContainsKey('Status Pembayaran')){ Write-Output "  skip $($ws.Name): tidak ada kolom Status Pembayaran"; continue }
    $cStat = $H['Status Pembayaran']; $cTgl  = $H['Tanggal Pembayaran']
    $cTglA = $H['TANGGAL PENGAJUAN']; $cUser = $H['Username Creator']
    $cCamp = $H['Campaign']; $cSts  = $H['Status']; $cRate = $H['Ratecard']
    $cRateA= $H['Ratecard Awal']; $cRek  = $H['Nomor Rekening/ VA']
    $cNama = $H['Nama Penerima Bank']; $cPIC = $H['PIC']; $cNote = $H['Note']
    $cNik  = $H['NIK']; $cAlamat = $H['Alamat sesuai KTP']; $cKtp = $H['Link Drive KTP']
    $cKontr= $H['Kontrak']; $cTF = $H['Link Bukti TF']; $cActual = $H['Tgl Actual Payment']
    $cRek2 = $H['Rekening']

    for($r=$hdrRow+1; $r -le $ws.UsedRange.Rows.Count; $r++){
      $stat = ($ws.Cells.Item($r,$cStat).Text -replace '\s+',' ').Trim()
      if($stat -ine 'Paid Off'){ continue }
      # buang baris TOTAL
      $tglTxt = ''
      if($cTgl){ $tglTxt = $ws.Cells.Item($r,$cTgl).Text }
      if($tglTxt -match 'TOTAL'){ continue }
      $peng = ''
      if($cTglA){ $peng = $ws.Cells.Item($r,$cTglA).Text }
      $d = Parse-Tgl $tglTxt
      $tglDipakai = 'tanggal_pembayaran'; $tglVal = $tglTxt
      if(-not $d -and $peng){ $d = Parse-Tgl $peng; $tglDipakai = 'tanggal_pengajuan'; $tglVal = $peng }
      if(-not $d){ continue }
      if($d -ge $cut){ continue }   # sudah pakai sistem

      $userRaw = if($cUser){ $ws.Cells.Item($r,$cUser).Text } else { '' }
      $userN   = Norm-User $userRaw
      $camp    = if($cCamp){ ($ws.Cells.Item($r,$cCamp).Text -replace '\s+',' ').Trim() } else { '' }
      $sts     = if($cSts){ ($ws.Cells.Item($r,$cSts).Text -replace '\s+',' ').Trim() } else { '' }

      # klasifikasi: operasional = tanpa username, atau campaign berupa label top up/sampel
      $isLabel = ($camp -match '(?i)^\s*(top\s*up|sampel|sample|operational|ads|bonus)\b') -or ($camp -match '(?i)qontak|lion')
      $jenis = if((-not $userN) -or $isLabel){ 'operasional' } else { 'kreator' }

      $nominal = if($cRate){ Parse-Rp $ws.Cells.Item($r,$cRate).Text } else { [int64]0 }
      $rateAwal= if($cRateA){ Parse-Rp $ws.Cells.Item($r,$cRateA).Text } else { [int64]0 }

      # semua sel opsional dihitung lebih dulu (PowerShell tidak punya `if` inline)
      $vNama=''; $vNamaN=''; $vRek=''; $vPIC=''; $vNote=''
      $vNik=''; $vAlamat=''; $vKtp=''; $vKontr=''; $vTF=''
      $vMetode=''; $vRekLabel=''; $vActual=''
      if($cNama){ $vNama = $ws.Cells.Item($r,$cNama).Text.Trim(); $vNamaN = Norm-Nama $vNama }
      if($cRek){ $vRek = Norm-Rek $ws.Cells.Item($r,$cRek).Text }
      if($cPIC){ $vPIC = ($ws.Cells.Item($r,$cPIC).Text -replace '\s+',' ').Trim() }
      if($cNote){ $vNote = $ws.Cells.Item($r,$cNote).Text.Trim() }
      if($cNik){ $vNik = $ws.Cells.Item($r,$cNik).Text.Trim() }
      if($cAlamat){ $vAlamat = $ws.Cells.Item($r,$cAlamat).Text.Trim() }
      if($cKtp){ $vKtp = $ws.Cells.Item($r,$cKtp).Text.Trim() }
      if($cKontr){ $vKontr = $ws.Cells.Item($r,$cKontr).Text.Trim() }
      if($cTF){ $vTF = $ws.Cells.Item($r,$cTF).Text.Trim() }
      if($H.ContainsKey('Metode Pembayaran')){ $vMetode = $ws.Cells.Item($r,$H['Metode Pembayaran']).Text.Trim() }
      if($cRek2){ $vRekLabel = $ws.Cells.Item($r,$cRek2).Text.Trim() }
      if($cActual){ $vActual = $ws.Cells.Item($r,$cActual).Text.Trim() }

      $rows += [pscustomobject]@{
        sheet          = $ws.Name
        row            = $r
        tanggal        = $d.ToString('yyyy-MM-dd')
        tanggal_asal   = $tglVal
        tanggal_dari   = $tglDipakai
        username_mentah= $userRaw
        username       = $userN
        nama_penerima  = $vNama
        nama_penerima_n= $vNamaN
        nomor_rekening = $vRek
        campaign_sheet = $camp
        status_klaim   = $sts
        nominal        = $nominal
        ratecard_awal  = $rateAwal
        pic            = $vPIC
        note           = $vNote
        nik            = $vNik
        alamat         = $vAlamat
        link_ktp       = $vKtp
        link_kontrak   = $vKontr
        bukti_tf       = $vTF
        metode_bayar   = $vMetode
        rekening_label = $vRekLabel
        tgl_actual     = $vActual
        jenis          = $jenis
      }
    }
  }
  $wb.Close($false)
} finally {
  $xl.Quit(); [System.Runtime.InteropServices.Marshal]::ReleaseComObject($xl) | Out-Null
}

# ---- dedup: hanya username+nominal+tanggal IDENTIK ----
# TANDANI, jangan dibuang. Penting untuk-financial: kalau ternyata bukan
# duplikat, uangnya tetap harus masuk.
$grp = $rows | Group-Object { "$($_.username)|$($_.nominal)|$($_.tanggal)" }
$clean = @()
foreach($g in $grp){
  if($g.Count -eq 1){
    $x = $g.Group[0]
    $x | Add-Member -NotePropertyName dup_group -NotePropertyValue '' -Force
    $x | Add-Member -NotePropertyName dup_ke -NotePropertyValue 1 -Force
    $clean += $x
  } else {
    $i = 1
    foreach($x in $g.Group){
      $x | Add-Member -NotePropertyName dup_group -NotePropertyValue ("{0}|{1}|{2}" -f $x.username,$x.nominal,$x.tanggal) -Force
      $x | Add-Member -NotePropertyName dup_ke -NotePropertyValue $i -Force
      $i++
      $clean += $x
    }
  }
}
$dupKeys = $grp | Where-Object { $_.Count -gt 1 }

$csv = Join-Path $outD 'parsed-826.csv'
$clean | Export-Csv -Path $csv -NoTypeInformation -Encoding UTF8

$clean | Group-Object dup_group | Where-Object { $_.Count -gt 1 } | ForEach-Object {
  Write-Output ''
  Write-Output "  $($_.Count)x  nominal=Rp$($_.Group[0].nominal)  tgl=$($_.Group[0].tanggal)"
  Write-Output "      username : [$(($_.Group | ForEach-Object { "'" + $_.username + "'" }) -join ' ~ ')]"
  Write-Output "      campaign : [$(($_.Group | ForEach-Object { $_.campaign_sheet }) -join ' ~ ')]"
  Write-Output "      status   : [$(($_.Group | ForEach-Object { $_.status_klaim }) -join ' ~ ')]"
  Write-Output "      sheet    : [$(($_.Group | ForEach-Object { "$($_.sheet):r$($_.row)" }) -join ', ')]"
  Write-Output "      nama     : [$(($_.Group | ForEach-Object { $_.nama_penerima }) -join ' ~ ')]"
  Write-Output "      rek      : [$(($_.Group | ForEach-Object { $_.nomor_rekening }) -join ' ~ ')]"
}

Write-Output ''
Write-Output '=================== HASIL L1 ==================='
Write-Output "  Baris terbaca (Paid Off, < 14 Sep) : $($rows.Count)"
Write-Output "  Baris unik (tanpa duplikat)        : $(($clean | Group-Object dup_group).Count)"
Write-Output "  Grup duplikat                     : $($dupKeys.Count)"
Write-Output "  Baris terlibat duplikat            : $(($clean | Where-Object { $_.dup_ke -gt 1 }).Count)"
Write-Output "  Total nominal (semua 826)         : Rp $($clean | Measure-Object nominal -Sum | Select-Object -ExpandProperty Sum)"
Write-Output "  Cache                             : $csv"
Write-Output ''
Write-Output '--- per bulan ---'
$clean | Group-Object sheet | Sort-Object Name | ForEach-Object {
  Write-Output ("  {0,-16} {1,4} baris  Rp {2,15}" -f $_.Name, $_.Count, ($_.Group | Measure-Object nominal -Sum | Select-Object -ExpandProperty Sum))
}
Write-Output ''
Write-Output '--- jenis ---'
$clean | Group-Object jenis | ForEach-Object {
  Write-Output ("  {0,-12} {1,4} baris  Rp {2,15}" -f $_.Name, $_.Count, ($_.Group | Measure-Object nominal -Sum | Select-Object -ExpandProperty Sum))
}
Write-Output ''
Write-Output '--- status klaim ---'
$clean | Group-Object status_klaim | Sort-Object Count -Descending | ForEach-Object {
  Write-Output ("  {0,-14} {1,4} baris  Rp {2,15}" -f $_.Name, $_.Count, ($_.Group | Measure-Object nominal -Sum | Select-Object -ExpandProperty Sum))
}
Write-Output ''
Write-Output '--- PIC ---'
$clean | Group-Object pic | Sort-Object Count -Descending | ForEach-Object {
  Write-Output ("  {0,-16} {1,4} baris  Rp {2,15}" -f $(if($_.Name){$_.Name}else{'(kosong)'}), $_.Count, ($_.Group | Measure-Object nominal -Sum | Select-Object -ExpandProperty Sum))
}
Write-Output ''
Write-Output '--- campaign di sheet (belum dipetakan) ---'
$clean | Group-Object campaign_sheet | Sort-Object Count -Descending | Select-Object -First 30 | ForEach-Object {
  Write-Output ("  {0,-28} {1,4} baris" -f $_.Name, $_.Count)
}