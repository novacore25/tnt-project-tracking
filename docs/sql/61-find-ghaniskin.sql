\pset pager off
\x on

-- 1. Cari campaign dan brand Ghaniskin
SELECT c.id, c.nama, c.status, c.brand_id, b.nama as brand_nama
FROM campaigns c
LEFT JOIN brands b ON c.brand_id = b.id
WHERE c.nama ILIKE '%ghani%' OR b.nama ILIKE '%ghani%';

-- 2. Cek semua campaign Ghaniskin
\x off
SELECT id, nama, brand_id, status FROM campaigns WHERE nama ILIKE '%ghani%';
SELECT id, nama FROM brands WHERE nama ILIKE '%ghani%';
