-- ==============================================================================
-- Migration: 20261104144500_reconcile_payment_funnel_statuses.sql
-- Deskripsi: Menyelaraskan status pembayaran di payment_items dan campaign_creators
--            agar tidak ada item yang melompati funnel (workflow) persetujuan.
--
-- Temuan:
--   22 item pembayaran berstatus final_status = 'paid' padahal batch-nya belum 'paid'
--   (8 item di batch pending_executive, 14 item di batch ready_to_pay).
--   Akibatnya, di UI batch tampak "Menunggu Executive" atau "Siap Transfer" tetapi
--   itemnya sudah berlabel "PAID / Selesai Dibayar" dan nominal_pelunasan di
--   campaign_creators ter-update ganda secara prematur.
--
-- Koreksi:
--   1. 8 item di batch pending_executive -> dikembalikan ke 'finance_selected'
--   2. 11 item di batch ready_to_pay (executive approved) -> dikembalikan ke 'ready_to_pay'
--   3. 3 item di batch 1249 (executive pending) -> dikembalikan ke 'finance_selected'
--   4. 22 baris campaign_creators terkait -> status_bayar = 'belum', nominal_pelunasan = 0, tgl_pembayaran = NULL
-- ==============================================================================

BEGIN;

-- Preflight guard: pastikan persis ada 22 baris anomali sebelum dieksekusi
DO $$
DECLARE
    v_anomali_count INT;
BEGIN
    SELECT COUNT(*) INTO v_anomali_count
    FROM payment_items pi
    JOIN payment_batches pb ON pi.batch_id = pb.id
    WHERE pi.final_status = 'paid' AND pb.status != 'paid';

    IF v_anomali_count != 22 THEN
        RAISE EXCEPTION 'Preflight gagal: jumlah anomali tidak sesuai (diharapkan 22, ditemukan %)', v_anomali_count;
    END IF;
END $$;

-- 1. Kembalikan 8 item di batch pending_executive ke finance_selected
UPDATE payment_items
SET final_status = 'finance_selected'
WHERE id IN (100, 125, 980, 984, 994, 1050, 1051, 1061)
  AND final_status = 'paid';

-- 2. Kembalikan 11 item di batch ready_to_pay yang sudah di-approve executive ke ready_to_pay
UPDATE payment_items
SET final_status = 'ready_to_pay'
WHERE id IN (96, 135, 146, 152, 958, 959, 960, 961, 962, 965, 966)
  AND final_status = 'paid';

-- 3. Kembalikan 3 item di batch 1249 yang belum di-approve executive ke finance_selected
UPDATE payment_items
SET final_status = 'finance_selected'
WHERE id IN (1054, 1056, 1057)
  AND final_status = 'paid';

-- 4. Reset status_bayar di campaign_creators untuk 22 kreator yang belum sah ditransfer
UPDATE campaign_creators
SET status_bayar = 'belum',
    nominal_pelunasan = 0,
    tgl_pembayaran = NULL
WHERE id IN (
    42313, 42690, 48997, 46595, 42610, 45044, 47474, 55152,
    45483, 48412, 47245, 48339, 45478, 45490, 55124, 55125, 55150, 23844, 46682,
    55155, 55157, 55158
);

-- Post-check: pastikan tidak ada lagi item yang mendahului batch status
DO $$
DECLARE
    v_sisa_anomali INT;
BEGIN
    SELECT COUNT(*) INTO v_sisa_anomali
    FROM payment_items pi
    JOIN payment_batches pb ON pi.batch_id = pb.id
    WHERE pi.final_status = 'paid' AND pb.status != 'paid';

    IF v_sisa_anomali != 0 THEN
        RAISE EXCEPTION 'Post-check gagal: masih tersisa % item anomali', v_sisa_anomali;
    END IF;
END $$;

COMMIT;
