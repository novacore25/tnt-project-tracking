\pset pager off
\x on

SELECT 
  cc.id as cc_id,
  cc.campaign_id,
  cc.creator_id,
  cc.price,
  cc.qty_vt,
  cc.qty_live,
  cc.approval,
  cc.content_type,
  c.username,
  c.nama_lengkap,
  c.nama_asli,
  c.no_whatsapp,
  c.link_account,
  c.tiktok_uid,
  c.email,
  c.npwp,
  c.tempat_lahir,
  c.tanggal_lahir,
  (
    SELECT ct.nomor 
    FROM creator_contacts ct 
    WHERE ct.creator_id = c.id AND ct.status = 'aktif'
    ORDER BY ct.id DESC LIMIT 1
  ) as contact_nomor,
  (
    SELECT cpc.nomor_wa
    FROM creator_pic_contacts cpc
    WHERE cpc.creator_id = c.id
    ORDER BY cpc.is_primary DESC, cpc.id DESC LIMIT 1
  ) as pic_nomor_wa,
  (
    SELECT ci.nik 
    FROM creator_identities ci 
    WHERE ci.creator_id = c.id 
    ORDER BY ci.is_primary DESC, ci.id DESC LIMIT 1
  ) as nik_ktp,
  (
    SELECT ci.nama_ktp 
    FROM creator_identities ci 
    WHERE ci.creator_id = c.id 
    ORDER BY ci.is_primary DESC, ci.id DESC LIMIT 1
  ) as nama_ktp,
  (
    SELECT ci.alamat_ktp 
    FROM creator_identities ci 
    WHERE ci.creator_id = c.id 
    ORDER BY ci.is_primary DESC, ci.id DESC LIMIT 1
  ) as alamat_ktp,
  (
    SELECT cb.bank_name
    FROM creator_bank_accounts cb 
    WHERE cb.creator_id = c.id 
    ORDER BY cb.is_primary DESC, cb.id ASC LIMIT 1
  ) as bank_name,
  (
    SELECT cb.account_number
    FROM creator_bank_accounts cb 
    WHERE cb.creator_id = c.id 
    ORDER BY cb.is_primary DESC, cb.id ASC LIMIT 1
  ) as account_number,
  (
    SELECT cb.account_holder
    FROM creator_bank_accounts cb 
    WHERE cb.creator_id = c.id 
    ORDER BY cb.is_primary DESC, cb.id ASC LIMIT 1
  ) as account_holder,
  (
    SELECT cab.alamat_jalan || ', ' || cab.kecamatan || ', ' || cab.kota || ', ' || cab.provinsi || ' ' || COALESCE(cab.kodepos, '')
    FROM creator_address_book cab 
    WHERE cab.creator_id = c.id 
    ORDER BY cab.is_primary DESC, cab.id DESC LIMIT 1
  ) as alamat_domisili
FROM campaign_creators cc
JOIN creators c ON cc.creator_id = c.id
WHERE cc.campaign_id = 49 AND (c.username ILIKE '%luneatiquea%' OR c.nama_lengkap ILIKE '%luneatiquea%' OR c.nama_asli ILIKE '%luneatiquea%');
