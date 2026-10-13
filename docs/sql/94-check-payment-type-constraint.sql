SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'payment_items'::regclass AND conname LIKE '%payment_type%';
