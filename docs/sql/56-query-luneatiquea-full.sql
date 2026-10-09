\pset pager off
\x on
SELECT 
  pi.id,
  pi.campaign_creator_id,
  cc.campaign_id,
  c.id as creator_id,
  c.username,
  c.nama_asli,
  pi.metode_pembayaran,
  pi.nomor_rekening,
  pi.nama_penerima,
  pi.alamat_ktp,
  pi.nik,
  pi.nominal
FROM payment_items pi
JOIN campaign_creators cc ON pi.campaign_creator_id = cc.id
JOIN creators c ON cc.creator_id = c.id
WHERE c.username ILIKE '%luneatiquea%' OR c.id = 20995;
