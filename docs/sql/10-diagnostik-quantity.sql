-- =====================================================================
-- 10 — DIAGNOSIS: kenapa quantity auto-sync tidak sama dengan Excel
-- Read-only.
--
-- Konteks: script 09 menemukan 7.039 baris auto-sync yang punya kembaran
-- di Excel (order_id sama, product_id sama), tapi total quantity-nya
-- berbeda: auto-sync 7.457 unit, Excel 26.532 unit.
-- Kalau dihapus, 7.457 unit hilang sementara GMV tetap sama.
-- =====================================================================
\pset pager off
\t on

\echo '=== 1. Berapa pasangan yang quantity-nya berbeda? ==='
WITH excel_rows AS (
  SELECT split_part(order_id,'_',1) AS ok,
         product_id,
         quantity,
         gmv
  FROM sales
  WHERE attribution_type IS DISTINCT FROM 'TAP'
    AND order_id ~ '^[0-9]+_[0-9]+_[0-9]+_[0-9]+$'
)
SELECT
  count(*)                                                             AS pasangan,
  count(*) FILTER (WHERE t.quantity = e.quantity)                       AS qty_sama,
  count(*) FILTER (WHERE t.quantity <> e.quantity)                      AS qty_berbeda,
  count(*) FILTER (WHERE e.quantity > t.quantity)                       AS excel_lebih_besar,
  count(*) FILTER (WHERE e.quantity < t.quantity)                       AS excel_lebih_kecil,
  sum(t.quantity)                                                       AS qty_tap,
  sum(e.quantity)                                                       AS qty_excel,
  sum(t.quantity) - sum(e.quantity)                                     AS selisih_qty
FROM sales t
JOIN excel_rows e
  ON e.ok = split_part(t.order_id,'_',1)
 AND e.product_id = t.product_id
WHERE t.attribution_type = 'TAP';

\echo ''
\echo '=== 2. Distribusi selisih quantity ==='
WITH excel_rows AS (
  SELECT split_part(order_id,'_',1) AS ok, product_id, quantity
  FROM sales
  WHERE attribution_type IS DISTINCT FROM 'TAP'
    AND order_id ~ '^[0-9]+_[0-9]+_[0-9]+_[0-9]+$'
)
SELECT
  (e.quantity - t.quantity) AS selisih,
  count(*) AS jumlah,
  min(t.quantity) AS qty_tap,
  min(e.quantity) AS qty_excel
FROM sales t
JOIN excel_rows e
  ON e.ok = split_part(t.order_id,'_',1)
 AND e.product_id = t.product_id
WHERE t.attribution_type = 'TAP'
GROUP BY 1 ORDER BY jumlah DESC, 1;

\echo ''
\echo '=== 3. GMV per pasangan: apakah ikut berbeda? ==='
WITH excel_rows AS (
  SELECT split_part(order_id,'_',1) AS ok, product_id, quantity, gmv
  FROM sales
  WHERE attribution_type IS DISTINCT FROM 'TAP'
    AND order_id ~ '^[0-9]+_[0-9]+_[0-9]+_[0-9]+$'
)
SELECT
  (e.gmv - t.gmv) AS selisih_gmv,
  count(*) AS jumlah,
  sum(t.gmv) AS gmv_tap,
  sum(e.gmv) AS gmv_excel
FROM sales t
JOIN excel_rows e
  ON e.ok = split_part(t.order_id,'_',1)
 AND e.product_id = t.product_id
WHERE t.attribution_type = 'TAP'
GROUP BY 1 ORDER BY jumlah DESC, 1 LIMIT 15;

\echo ''
\echo '=== 4. Contoh 10 pasangan yang quantity berbeda ==='
WITH excel_rows AS (
  SELECT split_part(order_id,'_',1) AS ok, product_id, quantity, gmv, order_id
  FROM sales
  WHERE attribution_type IS DISTINCT FROM 'TAP'
    AND order_id ~ '^[0-9]+_[0-9]+_[0-9]+_[0-9]+$'
)
SELECT
  t.order_id              AS tap_order,
  t.quantity              AS qty_tap,
  t.gmv                   AS gmv_tap,
  e.quantity              AS qty_excel,
  e.gmv                   AS gmv_excel,
  (e.quantity - t.quantity) AS beda_qty,
  (e.gmv - t.gmv)           AS beda_gmv,
  t.tanggal               AS tgl_tap,
  e.tanggal               AS tgl_excel
FROM sales t
JOIN excel_rows e
  ON e.ok = split_part(t.order_id,'_',1)
 AND e.product_id = t.product_id
WHERE t.attribution_type = 'TAP'
  AND t.quantity <> e.quantity
ORDER BY abs(e.quantity - t.quantity) DESC
LIMIT 10;

\echo ''
\echo '=== 5. Total kumulatif seluruh tabel (acuan) ==='
SELECT count(*) AS baris,
       sum(quantity) AS qty,
       sum(gmv) AS gmv,
       count(*) FILTER (WHERE attribution_type = 'TAP') AS baris_tap,
       sum(quantity) FILTER (WHERE attribution_type = 'TAP') AS qty_tap
FROM sales;
