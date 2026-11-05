-- Migration: 20261105104000_reconcile_mixed_batch_statuses.sql
-- Tujuan: Rekonsiliasi status payment_batches agar sesuai dengan status terendah item yang belum final.
-- Contoh: Batch 1249 memiliki 3 item 'finance_selected' (menunggu approval final) dan 2 item 'ready_to_pay'.
-- Batch ini sebelumnya tersangkut di 'ready_to_pay', sehingga 3 item tersebut tidak muncul di meja Executive Final Approval.

BEGIN;

UPDATE payment_batches pb
SET status = sub.calc_status
FROM (
  SELECT 
    batch_id,
    CASE 
      WHEN bool_or(final_status = 'pending') THEN 'pending_manager'
      WHEN bool_or(final_status = 'manager_approved') THEN 'pending_executive_1'
      WHEN bool_or(final_status IN ('executive_1_approved', 'pending_finance_outstanding')) THEN 'pending_finance'
      WHEN bool_or(final_status = 'finance_selected') THEN 'pending_executive'
      WHEN bool_or(final_status IN ('ready_to_pay', 'executive_approved')) THEN 'ready_to_pay'
      WHEN bool_and(final_status = 'paid') THEN 'paid'
      WHEN bool_and(final_status = 'rejected') THEN 'rejected'
      ELSE 'pending_manager'
    END as calc_status
  FROM payment_items
  GROUP BY batch_id
) sub
WHERE pb.id = sub.batch_id AND pb.status != sub.calc_status;

COMMIT;
