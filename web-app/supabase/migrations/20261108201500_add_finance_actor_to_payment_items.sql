-- Migration: 20261108201500_add_finance_actor_to_payment_items.sql
-- Purpose: Menambahkan kolom audit trail finance (finance_acted_by & finance_acted_at) ke payment_items
--          dan backfill dari payment_batches untuk memastikan transparansi persetujuan Finance.

ALTER TABLE payment_items 
ADD COLUMN IF NOT EXISTS finance_acted_by uuid REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS finance_acted_at timestamp with time zone;

-- Backfill data historis dari payment_batches ke payment_items
UPDATE payment_items pi
SET finance_acted_by = pb.finance_reviewed_by,
    finance_acted_at = pb.finance_reviewed_at
FROM payment_batches pb
WHERE pi.batch_id = pb.id
  AND pi.finance_selected = true
  AND pi.finance_acted_by IS NULL
  AND pb.finance_reviewed_by IS NOT NULL;
