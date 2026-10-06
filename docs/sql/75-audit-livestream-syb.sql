-- =====================================================================
-- Audit livestream SYB (campaign 46) vs export alltime TikTok Shop
-- 6 Okt 2026
--
-- KASUS: user skeptical, sistem tunjuk 547 livestream, file Excel
-- alltime miliknya cuma 271 room ID unik. Apakah sistem salah?
--
-- JAWABAN: TIDAK. Bedanya BUKAN data hilang atau import salah.
-- Export Excel user di-filter satu TikTok Campaign ID; sistem punya dua.
--
-- CARA RUN (Windows tanpa WSL, pakai pipeline file):
--   docs\sql\75-audit-livestream-syb.sql  ->  ssh vps "cat > /root/live.sql"
--   lalu: docker exec -i <db> psql -U postgres -d db_tnt_project_system \
--           -v ON_ERROR_STOP=1 < /root/live.sql
--
-- CATATAN: blok di bawah butuh temp table t_file berisi 271 room ID.
-- Room ID diambil dari file Excel user (kolom "Livestream room ID"),
-- 19 digit numerik semua. Kalau mau run ulang, generate ulang VALUES-nya
-- dari Excel - jangan pakai data lama, file user perbarui berkala.
-- =====================================================================

\pset pager off
\pset footer off

CREATE TEMP TABLE t_file(room text);
-- << ISI DENGAN 271 ROOM ID DARI FILE EXCEL USER >>
-- INSERT INTO t_file(room) VALUES ('...'),('...'), ...;

\echo '=== RINGKASAN AKHIR ==='
SELECT
  count(DISTINCT content_uid) FILTER (WHERE lower(content_type) = 'livestream') AS livestream_unik,
  count(DISTINCT content_uid) FILTER (
    WHERE lower(content_type)='livestream'
      AND tiktok_campaign_id='7631140567631972112') AS dari_campaign_di_excel,
  count(DISTINCT content_uid) FILTER (
    WHERE lower(content_type)='livestream'
      AND tiktok_campaign_id='7643606629893670677') AS dari_campaign_ke_dua
FROM organic_videos WHERE campaign_id = 46;

\echo ''
\echo '=== breakdown per tiktok_campaign_id (inti masalah) ==='
SELECT tiktok_campaign_id,
       count(DISTINCT content_uid) AS uid_live,
       min(post_time)::date AS tgl_awal,
       max(post_time)::date AS tgl_akhir,
       count(DISTINCT content_uid) FILTER (
         WHERE content_uid IN (SELECT room FROM t_file)) AS ada_di_excel_user
FROM organic_videos
WHERE campaign_id = 46 AND lower(content_type) = 'livestream'
GROUP BY 1 ORDER BY 2 DESC;

\echo ''
\echo '=== HANYA campaign 7631140567631972112: cocok / selisih ==='
WITH db AS (
  SELECT DISTINCT content_uid FROM organic_videos
  WHERE campaign_id = 46
    AND lower(content_type) = 'livestream'
    AND tiktok_campaign_id = '7631140567631972112'
)
SELECT
  (SELECT count(*) FROM db) AS di_db,
  (SELECT count(*) FROM t_file) AS di_excel,
  (SELECT count(*) FROM db WHERE content_uid IN (SELECT room FROM t_file)) AS cocok,
  (SELECT count(*) FROM db WHERE content_uid NOT IN (SELECT room FROM t_file)) AS hanya_di_db,
  (SELECT count(*) FROM t_file WHERE room NOT IN (SELECT content_uid FROM db)) AS hanya_di_excel;

\echo ''
\echo '=== room yang tercatat di DUA tiktok_campaign (risiko double count) ==='
SELECT count(*) AS jumlah_room_dobel FROM (
  SELECT content_uid FROM organic_videos
  WHERE campaign_id = 46 AND lower(content_type) = 'livestream'
  GROUP BY 1 HAVING count(DISTINCT tiktok_campaign_id) > 1
) d;

\echo ''
\echo '=== CASE content_type DI SELURUH DB (lihat catatan di bawah) ==='
SELECT content_type, count(*) AS baris, count(DISTINCT content_uid) AS uid
FROM organic_videos GROUP BY 1 ORDER BY 2 DESC;

\echo ''
\echo '=== apakah semua produk SYB terdaftar di skus untuk campaign 46? ==='
\echo '--- (auto-sync memetakan lewat product_id, BUKAN tiktok_campaign_ids) ---'
SELECT coalesce(campaign_id::text, 'NULL') AS camp, count(*) AS n_sku,
       count(DISTINCT product_id) AS produk
FROM skus
WHERE product_id IN (SELECT DISTINCT product_id FROM organic_videos WHERE campaign_id = 46)
GROUP BY 1 ORDER BY 2 DESC;

\echo ''
\echo '=== campaign yang punya tiktok_campaign_ids > 1 (pola normal) ==='
SELECT id, nama, status, tiktok_campaign_ids FROM campaigns
WHERE array_length(tiktok_campaign_ids, 1) > 1 ORDER BY id;