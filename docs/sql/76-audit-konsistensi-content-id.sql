-- =====================================================================
-- Audit konsistensi content_id (livestream room ID + video ID)
-- 6 Okt 2026
--
-- PEMICU: user skeptis, sistem tunjuk 547 livestream SYB tapi export
-- alltime-nya cuma 271. Khawatir 278 sisanya sebenarnya Video ID.
-- User juga minta: content_id WAJIB cocok dengan product_id yang
-- diset di campaign, dan kreatornya harus ada di campaign tersebut.
-- Kalau tidak cocok -> harus jadi unattributed / pending.
-- Kalau sudah approved -> jangan di-pendingin lagi.
--
-- HASIL (semua terverifikasi, read-only, tidak mengubah apa pun):
--   1. Kekhawatiran user TERBANTAR. 494 Video ID dari file Excel
--      semuanya ada di organic_videos dengan content_type='video'.
--      269 Livestream room ID semuanya content_type='livestream'.
--      Tidak ada tertukar sama sekali.
--
--   2. Selisih 278 itu campaign TikTok KEDUA:
--      7643606629893670677 = "SYB X TNT CREATOR FEST 2026"
--      7631140567631972112 = "TNT MEDIA x SYB"  (yang ada di file Excel live)
--      Keduanya shop SYB. Tidak ada campaign internal "SYB X TNT
--      CREATOR FEST 2026" - campaign 76/77/137 milik brand lain.
--
--   3. organic_videos campaign 46 = 100% konsisten:
--      20/20 produk terdaftar di skus, 147/147 kreator punya slot
--      di campaign_creators. 0 content_id nyasar.
--
--   4. TAPI ada kebocoran di tabel `videos`:
--      3.398 dari 45.845 baris punya content_uid yang isinya milik
--      campaign LAIN. SEMUA masih `pending` - belum ada yang approved,
--      jadi tidak ada yang perlu "dibongkar".
--      Terparah: campaign 76 KEMBANG 7 RUPA (1.258 baris) dan
--      77 USMILE (344) menunjuk konten MS Glow Beauty, padahal
--      produk MS Glow Beauty TIDAK ada di skus campaign 76/77/137.
--      SYB sendiri hanya 1 baris (video id 62072).
--
-- CARA RUN (Windows tanpa WSL):
--   docs\sql\76-audit-konsistensi-content-id.sql -> ssh vps "cat > /root/a.sql"
--   docker exec -i <db> psql -U postgres -d db_tnt_project_system \
--           -v ON_ERROR_STOP=1 < /root/a.sql
--
-- File ini READ-ONLY. Tidak ada UPDATE/DELETE.
-- Temp table t_live / t_vid diisi dari file Excel owner:
--   t_live = kolom "Livestream room ID"  (271 baris, campaign 46)
--   t_vid  = kolom "Video ID"            (494 baris, campaign 46 + 41)
-- =====================================================================

\pset pager off
\pset footer off

CREATE TEMP TABLE t_live(uid text);
-- INSERT INTO t_live(uid) VALUES ('...'),('...'), ...;   -- 271 room ID

CREATE TEMP TABLE t_vid(uid text);
-- INSERT INTO t_vid(uid) VALUES ('...'),('...'), ...;    -- 494 video ID

-- ---------------------------------------------------------------------
-- 1. BUKTI KETUKARAN TIDAK ADA: setiap ID dari Excel cocok tipenya
-- ---------------------------------------------------------------------
\echo '=== 1. tipe content_id dari Excel cocok dengan DB? ==='
SELECT 'EXCEL LIVE' AS sumber, count(*) AS total,
       count(*) FILTER (WHERE EXISTS (SELECT 1 FROM organic_videos o
         WHERE o.campaign_id=46 AND o.content_uid=u.uid
           AND lower(o.content_type)='livestream')) AS tipe_livestream,
       count(*) FILTER (WHERE EXISTS (SELECT 1 FROM organic_videos o
         WHERE o.campaign_id=46 AND o.content_uid=u.uid
           AND lower(o.content_type)='video')) AS tipe_video
FROM t_live u
UNION ALL
SELECT 'EXCEL VIDEO', count(*),
       count(*) FILTER (WHERE EXISTS (SELECT 1 FROM organic_videos o
         WHERE o.campaign_id=46 AND o.content_uid=u.uid
           AND lower(o.content_type)='livestream')),
       count(*) FILTER (WHERE EXISTS (SELECT 1 FROM organic_videos o
         WHERE o.campaign_id=46 AND o.content_uid=u.uid
           AND lower(o.content_type)='video'))
FROM t_vid u;

-- ---------------------------------------------------------------------
-- 2. SELISIHNYA DARI MANA
-- ---------------------------------------------------------------------
\echo ''
\echo '=== 2. pemecahan per tiktok_campaign_id + tipe ==='
\echo '--- 7643606629893670677 = "SYB X TNT CREATOR FEST 2026" ---'
\echo '--- 7631140567631972112 = "TNT MEDIA x SYB" (ada di file Excel) ---'
SELECT tiktok_campaign_id, lower(content_type) AS tipe,
       count(DISTINCT content_uid) AS uid
FROM organic_videos WHERE campaign_id=46
GROUP BY 1,2 ORDER BY 1,2;

\echo ''
\echo '=== 2b. campaign internal yang namanya sama? ==='
SELECT id, nama, status, tiktok_campaign_ids
FROM campaigns WHERE nama ILIKE '%SYB%' OR nama ILIKE '%FEST%'
ORDER BY id;

-- ---------------------------------------------------------------------
-- 3. KONSISTENSI organic_videos (aturan: produk & kreator harus campaign)
-- ---------------------------------------------------------------------
\echo ''
\echo '=== 3. organic_videos campaign 46: produk & kreator ==='
SELECT
  count(DISTINCT ov.content_uid) AS content_uid,
  count(DISTINCT ov.content_uid) FILTER (WHERE p.ada) AS produk_terdaftar,
  count(DISTINCT ov.content_uid) FILTER (WHERE k.ada) AS kreator_punya_slot,
  count(DISTINCT ov.content_uid) FILTER (WHERE p.ada AND k.ada) AS KEDUA_OK
FROM organic_videos ov
LEFT JOIN (SELECT DISTINCT product_id, true AS ada FROM skus WHERE campaign_id=46) p
       ON p.product_id = ov.product_id
LEFT JOIN (SELECT DISTINCT lower(c.username) AS un, true AS ada
           FROM campaign_creators cc JOIN creators c ON c.id=cc.creator_id
           WHERE cc.campaign_id=46) k
       ON k.un = lower(ov.creator_username)
WHERE ov.campaign_id=46;

-- ---------------------------------------------------------------------
-- 4. KEBOCORAN SILANG CAMPAIGN di tabel `videos` (INILAH YANG BOCOR)
-- ---------------------------------------------------------------------
\echo ''
\echo '=== 4. videos: content_uid yang isinya milik campaign lain ==='
WITH link AS (
  SELECT cc.campaign_id AS camp_slot, v.content_uid, v.vt_approval,
         o.campaign_id AS camp_isinya
  FROM videos v
  JOIN campaign_creators cc ON cc.id = v.campaign_creator_id
  JOIN organic_videos o ON o.content_uid = v.content_uid
  WHERE v.content_uid IS NOT NULL
)
SELECT count(*) AS total_baris,
       count(*) FILTER (WHERE camp_slot = camp_isinya) AS senada,
       count(*) FILTER (WHERE camp_slot <> camp_isinya) AS BOCOR,
       count(DISTINCT content_uid) FILTER (WHERE camp_slot <> camp_isinya) AS uid_bocor
FROM link;

\echo ''
\echo '=== 4b. PENTING: adakah yang bocor tapi SUDAH approved? ==='
\echo '--- kalau semua pending, tidak ada yang perlu "dibongkar" ---'
WITH link AS (
  SELECT cc.campaign_id AS camp_slot, v.content_uid, v.vt_approval,
         o.campaign_id AS camp_isinya
  FROM videos v
  JOIN campaign_creators cc ON cc.id = v.campaign_creator_id
  JOIN organic_videos o ON o.content_uid = v.content_uid
  WHERE v.content_uid IS NOT NULL
)
SELECT vt_approval, count(*) AS n, count(DISTINCT content_uid) AS uid
FROM link WHERE camp_slot <> camp_isinya GROUP BY 1 ORDER BY 2 DESC;

\echo ''
\echo '=== 4c. rincian per campaign ==='
WITH link AS (
  SELECT cc.campaign_id AS camp_slot, cs.nama AS nama_slot,
         o.campaign_id AS camp_isinya, co.nama AS nama_isinya,
         o.content_type, v.vt_approval
  FROM videos v
  JOIN campaign_creators cc ON cc.id = v.campaign_creator_id
  JOIN campaigns cs ON cs.id = cc.campaign_id
  JOIN organic_videos o ON o.content_uid = v.content_uid
  JOIN campaigns co ON co.id = o.campaign_id
  WHERE v.content_uid IS NOT NULL
)
SELECT camp_slot, nama_slot, camp_isinya, nama_isinya, content_type, vt_approval, count(*) AS n
FROM link WHERE camp_slot <> camp_isinya
GROUP BY 1,2,3,4,5,6 ORDER BY 7 DESC LIMIT 30;

-- ---------------------------------------------------------------------
-- 5. BUKTI produk campaign 76/77/137 memang tidak cocok
-- ---------------------------------------------------------------------
\echo ''
\echo '=== 5. campaign 76/77/137 vs produk MS Glow Beauty (harusnya 0) ==='
SELECT cp.campaign_id,
       count(*) AS n_sku,
       count(*) FILTER (WHERE cp.product_id IN (
         SELECT DISTINCT product_id FROM organic_videos WHERE campaign_id=41
       )) AS produk_MS_Glow_Beauty
FROM skus cp WHERE cp.campaign_id IN (76,77,137)
GROUP BY 1 ORDER BY 1;

-- ---------------------------------------------------------------------
-- 6. SYB sendiri: hanya 1 kebocoran
-- ---------------------------------------------------------------------
\echo ''
\echo '=== 6. kebocoran khusus campaign 46 ==='
SELECT o.campaign_id AS campaign_asal, c.nama, o.content_type, count(*) AS video
FROM videos v
JOIN campaign_creators cc ON cc.id = v.campaign_creator_id AND cc.campaign_id = 46
JOIN organic_videos o ON o.content_uid = v.content_uid
JOIN campaigns c ON c.id = o.campaign_id
WHERE o.campaign_id <> 46
GROUP BY 1,2,3 ORDER BY 4 DESC;