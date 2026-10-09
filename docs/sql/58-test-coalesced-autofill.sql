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
  COALESCE(
    NULLIF(c.nama_lengkap, ''),
    NULLIF(c.nama_asli, ''),
    (
      SELECT ci.nama_ktp
      FROM creator_identities ci
      WHERE ci.creator_id = c.id AND ci.nama_ktp IS NOT NULL AND ci.nama_ktp != ''
      ORDER BY ci.is_primary DESC, ci.id DESC LIMIT 1
    ),
    (
      SELECT pi.nama_penerima
      FROM payment_items pi
      JOIN campaign_creators cc2 ON pi.campaign_creator_id = cc2.id
      WHERE cc2.creator_id = c.id AND pi.nama_penerima IS NOT NULL AND pi.nama_penerima != ''
      ORDER BY pi.id DESC LIMIT 1
    )
  ) as nama_lengkap,
  c.nama_asli,
  c.link_account,
  c.tiktok_uid,
  c.email,
  c.npwp,
  c.tempat_lahir,
  c.tanggal_lahir,
  COALESCE(
    (
      SELECT ct.nomor 
      FROM creator_contacts ct 
      WHERE ct.creator_id = c.id AND ct.status = 'aktif' AND ct.nomor IS NOT NULL AND ct.nomor != ''
      ORDER BY ct.id DESC LIMIT 1
    ),
    (
      SELECT cpc.nomor_wa
      FROM creator_pic_contacts cpc
      WHERE cpc.creator_id = c.id AND cpc.nomor_wa IS NOT NULL AND cpc.nomor_wa != ''
      ORDER BY cpc.is_primary DESC, cpc.id DESC LIMIT 1
    ),
    (
      SELECT pi.nomor_wa_dealing
      FROM payment_items pi
      JOIN campaign_creators cc2 ON pi.campaign_creator_id = cc2.id
      WHERE cc2.creator_id = c.id AND pi.nomor_wa_dealing IS NOT NULL AND pi.nomor_wa_dealing != ''
      ORDER BY pi.id DESC LIMIT 1
    ),
    NULLIF(c.nomor_wa_dealing, ''),
    NULLIF(c.no_whatsapp, '')
  ) as contact_nomor,
  COALESCE(
    (
      SELECT ci.nik 
      FROM creator_identities ci 
      WHERE ci.creator_id = c.id AND ci.nik IS NOT NULL AND ci.nik != ''
      ORDER BY ci.is_primary DESC, ci.id DESC LIMIT 1
    ),
    (
      SELECT pi.nik
      FROM payment_items pi
      JOIN campaign_creators cc2 ON pi.campaign_creator_id = cc2.id
      WHERE cc2.creator_id = c.id AND pi.nik IS NOT NULL AND pi.nik != ''
      ORDER BY pi.id DESC LIMIT 1
    ),
    NULLIF(c.nik, '')
  ) as nik_ktp,
  COALESCE(
    (
      SELECT ci.alamat_ktp 
      FROM creator_identities ci 
      WHERE ci.creator_id = c.id AND ci.alamat_ktp IS NOT NULL AND ci.alamat_ktp != ''
      ORDER BY ci.is_primary DESC, ci.id DESC LIMIT 1
    ),
    (
      SELECT pi.alamat_ktp
      FROM payment_items pi
      JOIN campaign_creators cc2 ON pi.campaign_creator_id = cc2.id
      WHERE cc2.creator_id = c.id AND pi.alamat_ktp IS NOT NULL AND pi.alamat_ktp != ''
      ORDER BY pi.id DESC LIMIT 1
    ),
    NULLIF(c.alamat_ktp, '')
  ) as alamat_ktp,
  COALESCE(
    (
      SELECT cb.bank_name
      FROM creator_bank_accounts cb 
      WHERE cb.creator_id = c.id 
      ORDER BY cb.is_primary DESC, cb.id ASC LIMIT 1
    ),
    (
      SELECT pi.metode_pembayaran
      FROM payment_items pi
      JOIN campaign_creators cc2 ON pi.campaign_creator_id = cc2.id
      WHERE cc2.creator_id = c.id AND pi.metode_pembayaran IS NOT NULL AND pi.metode_pembayaran != ''
      ORDER BY pi.id DESC LIMIT 1
    )
  ) as bank_name,
  COALESCE(
    (
      SELECT cb.account_number
      FROM creator_bank_accounts cb 
      WHERE cb.creator_id = c.id 
      ORDER BY cb.is_primary DESC, cb.id ASC LIMIT 1
    ),
    (
      SELECT pi.nomor_rekening
      FROM payment_items pi
      JOIN campaign_creators cc2 ON pi.campaign_creator_id = cc2.id
      WHERE cc2.creator_id = c.id AND pi.nomor_rekening IS NOT NULL AND pi.nomor_rekening != ''
      ORDER BY pi.id DESC LIMIT 1
    )
  ) as account_number,
  COALESCE(
    (
      SELECT cb.account_holder
      FROM creator_bank_accounts cb 
      WHERE cb.creator_id = c.id 
      ORDER BY cb.is_primary DESC, cb.id ASC LIMIT 1
    ),
    (
      SELECT pi.nama_penerima
      FROM payment_items pi
      JOIN campaign_creators cc2 ON pi.campaign_creator_id = cc2.id
      WHERE cc2.creator_id = c.id AND pi.nama_penerima IS NOT NULL AND pi.nama_penerima != ''
      ORDER BY pi.id DESC LIMIT 1
    )
  ) as account_holder
FROM campaign_creators cc
JOIN creators c ON cc.creator_id = c.id
WHERE cc.campaign_id = 49 AND (c.username ILIKE '%luneatiquea%' OR c.nama_lengkap ILIKE '%luneatiquea%' OR c.nama_asli ILIKE '%luneatiquea%');
