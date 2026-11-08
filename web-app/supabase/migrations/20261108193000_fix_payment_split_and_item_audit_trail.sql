-- ==============================================================================
-- Migration: 20261108193000_fix_payment_split_and_item_audit_trail.sql
-- Deskripsi: 
--   1. Bersihkan batch kosong (1270, 1271, 1297) hasil crash pemecahan batch
--   2. Selesaikan pemisahan parsial Batch 1249: 3 item lunas tetap di 1249 (status = 'paid'),
--      2 item belum lunas dipindahkan ke batch baru 'Batch - Oktober 2026 - Termin 2' (status = 'ready_to_pay')
--   3. Perbarui rpc_get_payment_batches untuk menyertakan profil aktor penindak per item
--      (manager_actor, executive_1_actor, executive_actor) agar jejak persetujuan
--      tiap kreator dapat terlihat jelas dan transparan di UI.
-- ==============================================================================

BEGIN;

-- 1. Hapus batch orphan kosong hasil crash autoSplitUnpaidBatchItems
DELETE FROM payment_batches 
WHERE id IN (1270, 1271, 1297) 
  AND NOT EXISTS (SELECT 1 FROM payment_items WHERE batch_id = payment_batches.id);

-- 2. Selesaikan pembelahan Batch 1249 (Lion Parcel)
DO $$
DECLARE
  v_new_batch_id INT;
BEGIN
  IF EXISTS (SELECT 1 FROM payment_items WHERE batch_id = 1249 AND final_status = 'ready_to_pay') THEN
    INSERT INTO payment_batches (
      campaign_id, batch_label, status, submitted_by, submitted_at,
      manager_reviewed_by, manager_reviewed_at,
      executive_reviewed_1_by, executive_reviewed_1_at,
      finance_reviewed_by, finance_reviewed_at,
      executive_reviewed_by, executive_reviewed_at,
      notes
    ) VALUES (
      58, 'Batch - Oktober 2026 - Termin 2', 'ready_to_pay',
      '8d348a80-d4b3-4b25-a9c3-9be9cfe5d401', '2026-10-13 11:10:15+00',
      '40902dfe-dec7-4a0c-9cdd-8a7bbcf242dc', '2026-10-23 07:14:17+00',
      '40902dfe-dec7-4a0c-9cdd-8a7bbcf242dc', '2026-10-23 07:14:17+00',
      '54ef8025-f06b-4ecb-b14c-b1c5b38e7c9e', '2026-10-26 13:10:36+00',
      '40902dfe-dec7-4a0c-9cdd-8a7bbcf242dc', '2026-11-05 06:04:50+00',
      'Pemisahan sisa dari Batch - Oktober 2026'
    ) RETURNING id INTO v_new_batch_id;

    -- Pindahkan 2 item SeaBank yang belum ditransfer ke batch Termin 2
    UPDATE payment_items
    SET batch_id = v_new_batch_id
    WHERE batch_id = 1249 AND final_status = 'ready_to_pay';

    -- Tutup Batch 1249 menjadi PAID 100% (berisi 3 item BRI & DANA yang sudah cair)
    UPDATE payment_batches
    SET status = 'paid',
        paid_by = '54ef8025-f06b-4ecb-b14c-b1c5b38e7c9e',
        paid_at = '2026-10-26 15:29:08+00',
        actual_payment_date = '2026-10-26'
    WHERE id = 1249;
  END IF;
END $$;

-- 3. Perbarui rpc_get_payment_batches agar mengembalikan data aktor penindak item
CREATE OR REPLACE FUNCTION public.rpc_get_payment_batches(p_campaign_id integer DEFAULT NULL::integer, p_status_in text[] DEFAULT NULL::text[])
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
  result JSONB;
BEGIN
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', pb.id,
      'campaign_id', pb.campaign_id,
      'batch_label', pb.batch_label,
      'status', pb.status,
      'submitted_by', pb.submitted_by,
      'submitted_at', pb.submitted_at,
      'notes', pb.notes,
      'manager_reviewed_by', pb.manager_reviewed_by,
      'manager_reviewed_at', pb.manager_reviewed_at,
      'executive_reviewed_1_by', pb.executive_reviewed_1_by,
      'executive_reviewed_1_at', pb.executive_reviewed_1_at,
      'finance_reviewed_by', pb.finance_reviewed_by,
      'finance_reviewed_at', pb.finance_reviewed_at,
      'executive_reviewed_by', pb.executive_reviewed_by,
      'executive_reviewed_at', pb.executive_reviewed_at,
      'paid_by', pb.paid_by,
      'paid_at', pb.paid_at,
      'actual_payment_date', pb.actual_payment_date,
      'bukti_transfer_url', pb.bukti_transfer_url,
      'sender_account_id', pb.sender_account_id,
      'campaigns', jsonb_build_object('nama', c.nama),
      'submitter', (SELECT jsonb_build_object('nama', p.nama, 'role', p.role) FROM profiles p WHERE p.id = pb.submitted_by),
      'manager', (SELECT jsonb_build_object('nama', p.nama, 'role', p.role) FROM profiles p WHERE p.id = pb.manager_reviewed_by),
      'executive_1', (SELECT jsonb_build_object('nama', p.nama, 'role', p.role) FROM profiles p WHERE p.id = pb.executive_reviewed_1_by),
      'finance', (SELECT jsonb_build_object('nama', p.nama, 'role', p.role) FROM profiles p WHERE p.id = pb.finance_reviewed_by),
      'executive', (SELECT jsonb_build_object('nama', p.nama, 'role', p.role) FROM profiles p WHERE p.id = pb.executive_reviewed_by),
      'payment_items', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', pi.id,
            'batch_id', pi.batch_id,
            'nominal', pi.nominal,
            'biaya_transfer', pi.biaya_transfer,
            'final_status', pi.final_status,
            'payment_type', pi.payment_type,
            'campaign_creator_id', pi.campaign_creator_id,
            'bank_account_id', pi.bank_account_id,
            'metode_pembayaran', pi.metode_pembayaran,
            'nomor_rekening', pi.nomor_rekening,
            'nama_penerima', pi.nama_penerima,
            'notes', pi.notes,
            'ratecard_awal', pi.ratecard_awal,
            'actual_transfer', pi.actual_transfer,
            'executive_note', pi.executive_note,
            'manager_note', pi.manager_note,
            'created_at', pi.created_at,
            'manager_status', pi.manager_status,
            'manager_acted_by', pi.manager_acted_by,
            'manager_acted_at', pi.manager_acted_at,
            'manager_actor', (SELECT jsonb_build_object('nama', p_mgr.nama, 'role', p_mgr.role) FROM profiles p_mgr WHERE p_mgr.id = pi.manager_acted_by),
            'executive_1_status', pi.executive_1_status,
            'executive_1_acted_by', pi.executive_1_acted_by,
            'executive_1_acted_at', pi.executive_1_acted_at,
            'executive_1_actor', (SELECT jsonb_build_object('nama', p_e1.nama, 'role', p_e1.role) FROM profiles p_e1 WHERE p_e1.id = pi.executive_1_acted_by),
            'finance_selected', pi.finance_selected,
            'executive_status', pi.executive_status,
            'executive_acted_by', pi.executive_acted_by,
            'executive_acted_at', pi.executive_acted_at,
            'executive_actor', (SELECT jsonb_build_object('nama', p_ex.nama, 'role', p_ex.role) FROM profiles p_ex WHERE p_ex.id = pi.executive_acted_by),
            'transaction_id', pi.transaction_id,
            'nik', pi.nik,
            'alamat_ktp', pi.alamat_ktp,
            'nama_wa_pic', pi.nama_wa_pic,
            'nomor_wa_dealing', pi.nomor_wa_dealing,
            'link_ktp', pi.link_ktp,
            'link_kontrak', pi.link_kontrak,
            'campaign_creators', (
              SELECT jsonb_build_object(
                'id', cc.id,
                'tier', cc.tier,
                'price', cc.price,
                'qty_vt', cc.qty_vt,
                'status_bayar', cc.status_bayar,
                'nominal_pelunasan', cc.nominal_pelunasan,
                'creators', (
                  SELECT jsonb_build_object(
                    'id', cr.id,
                    'username', cr.username,
                    'nama_asli', cr.nama_asli,
                    'avatar_url', cr.avatar_url,
                    'nik', cr.nik,
                    'alamat_ktp', cr.alamat_ktp,
                    'link_ktp', cr.link_ktp,
                    'link_kontrak', cr.link_kontrak,
                    'nama_wa_pic', cr.nama_wa_pic,
                    'nomor_wa_dealing', cr.nomor_wa_dealing
                  ) FROM creators cr WHERE cr.id = cc.creator_id
                ),
                'profiles', (SELECT jsonb_build_object('nama', p2.nama, 'role', p2.role) FROM profiles p2 WHERE p2.id = cc.added_by)
              )
              FROM campaign_creators cc WHERE cc.id = pi.campaign_creator_id
            ),
            'creator_bank_accounts', (
              SELECT jsonb_build_object('bank_name', cba.bank_name, 'account_number', cba.account_number, 'account_holder', cba.account_holder)
              FROM creator_bank_accounts cba WHERE cba.id = pi.bank_account_id
            )
          )
        )
        FROM payment_items pi
        WHERE pi.batch_id = pb.id
      ), '[]'::jsonb)
    )
    ORDER BY pb.submitted_at DESC
  ), '[]'::jsonb) INTO result
  FROM payment_batches pb
  LEFT JOIN campaigns c ON pb.campaign_id = c.id
  WHERE 
    (p_campaign_id IS NULL OR pb.campaign_id = p_campaign_id)
    AND (p_status_in IS NULL OR pb.status = ANY(p_status_in));
    
  RETURN result;
END;
$function$;

COMMIT;
