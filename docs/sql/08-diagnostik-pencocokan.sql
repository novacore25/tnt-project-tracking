-- =====================================================================
-- 08 — DIAGNOSIS: kenapa pencocokan duplikat gagal
-- Read-only. Tidak mengubah data.
-- =====================================================================
\pset pager off
\t on

\echo '=== 1. Berapa baris Excel yang lolos filter pola underscore? ==='
\echo '   (filter versi 06 memakai LIKE ''%!_!%'' ESCAPE ''!'')'
SELECT
  count(*) FILTER (WHERE attribution_type IS DISTINCT FROM 'TAP')                    AS non_tap_total,
  count(*) FILTER (WHERE attribution_type IS DISTINCT FROM 'TAP'
                     AND order_id LIKE '%!_!%' ESCAPE '!')                            AS non_tap_lolos_pola,
  count(*) FILTER (WHERE attribution_type IS DISTINCT FROM 'TAP'
                     AND order_id ~ '^[0-9]+_[0-9]+_[0-9]+_[0-9]+$')                 AS non_tap_4_segmen
FROM sales;

\echo ''
\echo '=== 2. Pola order_id per sumber (sebenarnya) ==='
SELECT attribution_type,
       CASE
         WHEN order_id ~ '^[0-9]+$'                    THEN '1 segmen (OrderID saja)'
         WHEN order_id ~ '^[0-9]+_[0-9]+$'            THEN '2 segmen'
         WHEN order_id ~ '^[0-9]+_[0-9]+_[0-9]+$'      THEN '3 segmen'
         WHEN order_id ~ '^[0-9]+_[0-9]+_[0-9]+_[0-9]+$' THEN '4 segmen'
         ELSE 'lainnya'
       END AS pola,
       count(*) AS jumlah,
       min(length(order_id)) AS panjang_min,
       max(length(order_id)) AS panjang_maks
FROM sales
GROUP BY 1, 2 ORDER BY 1, 3 DESC;

\echo ''
\echo '=== 3. Untuk 8 order auto-sync, bandingkan dengan baris Excel-nya ==='
SELECT
  t.order_id                                             AS tap_order,
  t.product_id                                           AS tap_product,
  e.cnt_excel                                            AS jumlah_baris_excel,
  e.excel_order_id                                       AS excel_order_id,
  e.excel_product_id                                     AS excel_product,
  split_part(e.excel_order_id,'_',2)                     AS excel_seg2,
  split_part(e.excel_order_id,'_',3)                     AS excel_seg3,
  split_part(e.excel_order_id,'_',4)                     AS excel_seg4,
  CASE WHEN e.excel_product_id = t.product_id THEN 'SAMA' ELSE 'BEDA' END AS cocok_product
FROM sales t
LEFT JOIN LATERAL (
  SELECT count(*) OVER () AS cnt_excel, s2.order_id AS excel_order_id, s2.product_id AS excel_product_id
  FROM sales s2
  WHERE split_part(s2.order_id,'_',1) = split_part(t.order_id,'_',1)
    AND s2.attribution_type IS DISTINCT FROM 'TAP'
  ORDER BY s2.order_id
  LIMIT 1
) e ON true
WHERE t.attribution_type = 'TAP'
ORDER BY t.order_id
LIMIT 8;

\echo ''
\echo '=== 4. Ringkasan: pasangan auto-sync vs Excel ==='
WITH tap AS (
  SELECT order_id, product_id, split_part(order_id,'_',1) AS ok
  FROM sales WHERE attribution_type = 'TAP'
),
exc AS (
  SELECT split_part(order_id,'_',1) AS ok, product_id, order_id
  FROM sales WHERE attribution_type IS DISTINCT FROM 'TAP'
)
SELECT
  (SELECT count(*) FROM tap)                                             AS tap_total,
  (SELECT count(*) FROM tap t WHERE EXISTS (SELECT 1 FROM exc e WHERE e.ok=t.ok))  tap_punya_excel,
  (SELECT count(*) FROM tap t WHERE EXISTS
      (SELECT 1 FROM exc e WHERE e.ok=t.ok AND e.product_id=t.product_id)) tap_product_sama,
  (SELECT count(*) FROM tap t WHERE EXISTS
      (SELECT 1 FROM exc e WHERE e.ok=t.ok AND e.product_id IS DISTINCT FROM t.product_id)) tap_product_beda;

\echo ''
\echo '=== 5. Apakah product_id auto-sync = segmen mana di Excel? ==='
WITH tap AS (
  SELECT order_id, product_id, split_part(order_id,'_',1) AS ok
  FROM sales WHERE attribution_type = 'TAP'
),
exc AS (
  SELECT split_part(order_id,'_',1) AS ok,
         split_part(order_id,'_',2) AS s2,
         split_part(order_id,'_',3) AS s3,
         product_id
  FROM sales WHERE attribution_type IS DISTINCT FROM 'TAP'
)
SELECT
  count(*) FILTER (WHERE e.ok IS NOT NULL)                                        AS pasangan,
  count(*) FILTER (WHERE e.s2 = t.product_id)                                     AS cocok_dengan_seg2,
  count(*) FILTER (WHERE e.s3 = t.product_id)                                     AS cocok_dengan_seg3,
  count(*) FILTER (WHERE e.product_id = t.product_id)                             AS cocok_dengan_product_id,
  count(*) FILTER (WHERE e.s2 IS NULL)                                            AS excel_tanpa_seg2
FROM tap t LEFT JOIN exc e ON e.ok = t.ok;
