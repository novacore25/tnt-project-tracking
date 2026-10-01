-- =====================================================================
-- 42 - VERIFIKASI KONDISI PAYMENT (cek apakah plan masih valid)
-- Tanggal : 2026-10-01
-- Read-only. Hanya SELECT.
--
-- TUJUAN
--   Rencana migrasi payment historical (Feb-Sep 2026) dibuat lebih awal dan
--   beberapa isinya mungkin sudah basi. Contoh yang sudah terlihat:
--   rencana §5.2 menyatakan payment_items tidak punya kolom actual_transfer,
--   tapi migration 20260914000000 mereferensikannya. Jadikolomnya perlu
--   dicek langsung ke katalog, bukan dari catatan.
--
--   File ini membandingkan apa yang ADA di rencana dengan apa yang BENAR di DB.
-- =====================================================================
\pset pager off
\t on
\set ON_ERROR_STOP off

\echo ''
\echo '=== 1. payment_type: CHECK constraint yang BENAR-BENARAN ada ==='
SELECT pg_get_constraintdef(oid) AS definisi_check
FROM pg_constraint
WHERE conrelid = 'payment_items'::regclass
  AND contype = 'c'
  AND pg_get_constraintdef(oid) ILIKE '%payment_type%';

\echo ''
\echo '=== 2. payment_items: kolom apa saja yang ada ==='
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'payment_items'
ORDER BY ordinal_position;

\echo ''
\echo '=== 3. KOLOM KRITIS yang disebut rencana §5.2 sebagai TIDAK ADA ==='
SELECT
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payment_items' AND column_name='transaction_id')       AS punya_transaction_id,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payment_items' AND column_name='actual_transfer')     AS punya_actual_transfer,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payment_items' AND column_name='actual_payment_date') AS punya_actual_payment_date,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payment_items' AND column_name='bukti_transfer_url')  AS punya_bukti_transfer_url,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payment_items' AND column_name='sender_account_id')  AS punya_sender_account_id,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payment_items' AND column_name='biaya_transfer')     AS punya_biaya_transfer;

\echo ''
\echo '=== 4. payment_batches: kolom + campaign_id NOT NULL? ==='
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'payment_batches'
ORDER BY ordinal_position;

\echo ''
\echo '=== 5. VIEW yang disebut rencana §12 ==='
SELECT table_name
FROM information_schema.views
WHERE table_schema = 'public'
  AND (table_name ILIKE '%payment%' OR table_name ILIKE '%budget%' OR table_name ILIKE '%mutation%')
ORDER BY table_name;

\echo ''
\echo '=== 6. SKEMA payment_type yang SEDANG DIPAKAI ==='
SELECT COALESCE(payment_type,'(null)') AS payment_type, count(*) AS item,
       COALESCE(sum(nominal),0) AS nominal, count(*) FILTER (WHERE final_status='paid') AS sudah_paid
FROM payment_items
GROUP BY 1 ORDER BY item DESC;

\echo ''
\echo '=== 7. ITEM YANG SUDAH ADA (potential duplikat dengan spreadsheet) ==='
SELECT pb.batch_label, pb.campaign_id, pb.status,
       pi.payment_type, cr.username, pi.nominal, pi.final_status,
       pi.created_at::date AS tgl
FROM payment_items pi
JOIN payment_batches pb ON pb.id = pi.batch_id
LEFT JOIN campaign_creators cc ON cc.id = pi.campaign_creator_id
LEFT JOIN creators cr ON cr.id = cc.creator_id
WHERE pi.final_status = 'paid'
ORDER BY pi.created_at;

\echo ''
\echo '=== 8. RINGKASAN TOTAL YANG SUDAH ADA ==='
SELECT
  (SELECT count(*) FROM payment_items)  AS total_item,
  (SELECT count(*) FROM payment_items WHERE final_status = 'paid') AS item_paid,
  (SELECT count(*) FROM payment_batches) AS total_batch,
  (SELECT COALESCE(sum(nominal),0) FROM payment_items WHERE final_status='paid') AS nominal_paid,
  (SELECT count(*) FROM creators)        AS total_creators,
  (SELECT count(*) FROM campaign_creators) AS total_cc,
  (SELECT count(DISTINCT creator_id) FROM campaign_creators) AS cc_creator_unik;

\echo ''
\echo '=== 9. UNIQUE / CONSTRAINT di payment_items & payment_batches ==='
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE tablename IN ('payment_items','payment_batches')
ORDER BY tablename, indexname;

\echo ''
\echo '=== 10. FK payment_items -> campaign_creators ==='
SELECT
  EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_name='payment_items' AND column_name='campaign_creator_id') AS punya_cc_id,
  (SELECT count(*) FROM payment_items WHERE campaign_creator_id IS NULL) AS item_tanpa_cc,
  (SELECT count(*) FROM payment_items pi WHERE pi.campaign_creator_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM campaign_creators cc WHERE cc.id = pi.campaign_creator_id)) AS cc_id_yatim;

\echo ''
\echo '=== 11. APERTINYA ada tabel/catatan \'paid\' status lain? ==='
SELECT final_status, count(*) FROM payment_items GROUP BY 1 ORDER BY 2 DESC;
