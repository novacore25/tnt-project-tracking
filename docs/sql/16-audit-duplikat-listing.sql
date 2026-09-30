-- ============================================================
-- Audit duplikat listing campaign
-- READ-ONLY. Tidak mengubah data apa pun.
--
-- Latar: tabel campaign_creators tidak punya UNIQUE(campaign_id, creator_id).
-- Aksi "Tarik ke Campaign" dulu tidak mengecek duplikat, sehingga satu kreator
-- bisa punya beberapa baris listing dalam campaign yang sama.
-- (Perlindungan sudah diperbaiki di sisi aplikasi, migration unique constraint
--  belum bisa dipasang sampai duplikat ini bersih.)
-- ============================================================

\echo '=== 1. Ringkasan: berapa pasangan duplikat ==='

SELECT count(*) AS pasangan_duplikat,
       coalesce(sum(cnt), 0) AS total_baris_duplikat,
       coalesce(sum(cnt - 1), 0) AS baris_yang_seharusnya_dihapus
FROM (
  SELECT campaign_id, creator_id, count(*) AS cnt
  FROM campaign_creators
  GROUP BY campaign_id, creator_id
  HAVING count(*) > 1
) d;

\echo ''
\echo '=== 2. 30 pasangan pertama untuk diperiksa ==='

SELECT c.nama AS campaign,
       cr.username AS kreator,
       cc.campaign_id,
       cc.creator_id,
       count(*) AS jumlah_baris
FROM campaign_creators cc
LEFT JOIN campaigns c ON c.id = cc.campaign_id
LEFT JOIN creators  cr ON cr.id = cc.creator_id
WHERE (cc.campaign_id, cc.creator_id) IN (
  SELECT campaign_id, creator_id
  FROM campaign_creators
  GROUP BY campaign_id, creator_id
  HAVING count(*) > 1
)
GROUP BY c.nama, cr.username, cc.campaign_id, cc.creator_id
ORDER BY jumlah_baris DESC, c.nama, cr.username
LIMIT 30;

\echo ''
\echo '=== 3. Rincian baris dari 30 pasangan teratas (untuk tentukan mana yang disimpan) ==='

SELECT cc.campaign_id,
       c.nama AS campaign,
       cr.username AS kreator,
       cc.id AS baris_id,
       cc.approval,
       cc.price AS rate_card,
       cc.qty_vt,
       cc.qty_live,
       cc.pic_assist,
       cc.added_by,
       cc.created_at
FROM campaign_creators cc
LEFT JOIN campaigns c ON c.id = cc.campaign_id
LEFT JOIN creators  cr ON cr.id = cc.creator_id
WHERE (cc.campaign_id, cc.creator_id) IN (
  SELECT campaign_id, creator_id
  FROM campaign_creators
  GROUP BY campaign_id, creator_id
  HAVING count(*) > 1
)
ORDER BY cc.campaign_id, cc.creator_id, cc.id
LIMIT 200;

\echo ''
\echo '=== 4. KreATOR yang listing-nya dobel (ringkas per kreator) ==='

SELECT cr.username AS kreator,
       count(DISTINCT cc.campaign_id) AS jumlah_campaign,
       count(*) AS total_baris
FROM campaign_creators cc
JOIN creators cr ON cr.id = cc.creator_id
WHERE (cc.campaign_id, cc.creator_id) IN (
  SELECT campaign_id, creator_id
  FROM campaign_creators
  GROUP BY campaign_id, creator_id
  HAVING count(*) > 1
)
GROUP BY cr.username
ORDER BY jumlah_baris DESC, cr.username
LIMIT 50;

\echo ''
\echo '--- Kalau baris "pasangan_duplikat" di bagian 1 = 0, migration unique constraint bisa langsung dijalankan ---'