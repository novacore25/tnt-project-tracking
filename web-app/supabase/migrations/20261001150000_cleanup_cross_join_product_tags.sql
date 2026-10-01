-- =====================================================================
-- 20261001150000 - Bersihkan tag product_id palsu hasil cross-join
--
-- MASALAH
--   362 video di organic_videos ter-tag 21 sampai 70 product_id. Satu
--   product_id yang sama dipakai sampai 328 video berbeda, dan 362 video itu
--   tersebar di 7 campaign brand yang berbeda (Sorae, MS Glow Beauty, KEMBANG
--   7 RUPA, PWS, USMILE, KIME, SYB). Satu video tidak mungkin-rtqjual 7 brand.
--
--   Buktinya bukanabutus: di tabel sales, yang punya order_id UNIQUE, video
--   yang sama hanya muncul dengan 0 sampai 2 product_id. Kalau video itu
--   benar-benar menyiapkan 25 produk, minimal ada order untuk salah satunya.
--
--   Sumbernya adalah file ekspor TikTok, bukan kode. syncUnmapped.ts hanya
--   melakukan UPDATE ... WHERE campaign_id IS NULL AND product_id = X, dan
--   importActions.ts sudah dedup per pasangan content_uid + product_id, jadi
--   keduanya tidak membuat baris silang.
--
-- ACUAN
--   organic_videos.tiktok_campaign_id berasal dari ekspor TikTok, dan
--   campaigns.tiktok_campaign_ids adalah array id TikTok milik campaign itu.
--   Verifikasi 1 Okt 2026: 329 dari 362 video menghasilkan tepat 1 campaign.
--   Video itu yang diproses. Sisanya dibiarkan utuh karena tidak ada bukti.
--
--   Baris TIDAK dihapus bila:
--     - campaign_id-nya sudah sama dengan campaign hasil resolusi
--     - product_id-nya ada di sales untuk content_uid yang sama (order nyata)
--     - videonya tidak punya satu pun baris di campaign hasil resolusi, supaya
--       tidak ada video yang kehilangan seluruh barisnya
--
-- AMAN
--   - Satu transaksi. Gagal berarti tidak ada yang berubah.
--   - Backup ke _backup_organic_videos_20261001, sengaja tidak di-drop
--     supaya bisa dipulihkan manual.
--   - Unique index organic_videos_content_product_key tetap berlaku karena
--     yang dihapus adalah tag palsu, bukan baris duplikat.
--   - Total views dan likes per video unik tidak berubah sama sekali, karena
--     video yang sama tetap ada. Yang hilang hanya tag yang tidak pernah
--     dimiliki video itu, sehingga video tidak lagi terhitung di campaign
--     yang bukan miliknya.
--
-- ROLLBACK
--   Lihat docs/sql/26-rollback-tag-palsu.sql
-- =====================================================================

\set ON_ERROR_STOP on

BEGIN;

-- ---------------------------------------------------------------------
-- 0. Backup
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS _backup_organic_videos_20261001 AS
SELECT ov.*
FROM organic_videos ov
WHERE ov.content_uid IN (
  SELECT content_uid FROM organic_videos
  GROUP BY content_uid HAVING count(DISTINCT product_id) > 20
);

\echo '--- backup ---'
SELECT count(*) AS baris_backup FROM _backup_organic_videos_20261001;

-- ---------------------------------------------------------------------
-- 1. Video cross-join yang tiktok_campaign_id-nya resolve ke 1 campaign
--
--    WAJIB ada JOIN ke _g di sini. Tanpa itu, subquery di bawah membaca
--    SELURUH organic_videos dan hasilnya 26.122 baris, bukan 362. Cleanup
--    lalu ikut menghapus tag dari video yang tdramanya cuma punya 1
--    product. KerETA ini: dry run 25ecek-tag-palsu.sql sempat menunjukkan
--    26.122 video dan 12.767 baris sebelum scope-nya diperbaiki.
-- ---------------------------------------------------------------------
CREATE TEMP TABLE _g ON COMMIT DROP AS
SELECT content_uid
FROM organic_videos
GROUP BY content_uid
HAVING count(DISTINCT product_id) > 20;

CREATE TEMP TABLE _vid_campaign ON COMMIT DROP AS
SELECT content_uid, min(campaign_id) AS keep_campaign_id
FROM (
  SELECT DISTINCT ov.content_uid, c.id AS campaign_id
  FROM organic_videos ov
  JOIN _g g ON g.content_uid = ov.content_uid
  JOIN campaigns c ON ov.tiktok_campaign_id = ANY(c.tiktok_campaign_ids)
  WHERE ov.tiktok_campaign_id IS NOT NULL AND ov.tiktok_campaign_id <> ''
) x
GROUP BY content_uid
HAVING count(DISTINCT campaign_id) = 1;

-- Guard scope: kalau _vid_campaign lebih besar dari _g, berarti filter
-- hilang dan seluruh tabel akan ikut dibersihkan. Batalkan.
DO $$
DECLARE n_crossjoin int; n_resolve int;
BEGIN
  SELECT count(*) INTO n_crossjoin FROM _g;
  SELECT count(*) INTO n_resolve   FROM _vid_campaign;

  IF n_resolve > n_crossjoin THEN
    RAISE EXCEPTION 'Batal: % video ter-resolve tapi hanya % video cross-join. Scope salah.', n_resolve, n_crossjoin;
  END IF;
  IF n_resolve > 500 THEN
    RAISE EXCEPTION 'Batal: % video melebihi batas 500. Cross-join terverifikasi cuma 362.', n_resolve;
  END IF;
  RAISE NOTICE 'Scope OK: % video cross-join, % ter-resolve ke 1 campaign', n_crossjoin, n_resolve;
END $$;

-- ---------------------------------------------------------------------
-- 2. Hanya video yang punya baris di campaign hasil resolusi.
--    Tanpa syarat ini, video yang tidak punya baris "// keep" akan kehilangan
--    semua barisnya dan ikut hilang dari laporan.
-- ---------------------------------------------------------------------
CREATE TEMP TABLE _safe ON COMMIT DROP AS
SELECT v.content_uid, v.keep_campaign_id
FROM _vid_campaign v
WHERE EXISTS (
  SELECT 1 FROM organic_videos ov
  WHERE ov.content_uid = v.content_uid AND ov.campaign_id = v.keep_campaign_id
);

\echo '--- cakupan ---'
SELECT
  (SELECT count(*) FROM _backup_organic_videos_20261001) AS video_crossjoin,
  (SELECT count(*) FROM _vid_campaign)                  AS resolve_1_campaign,
  (SELECT count(*) FROM _safe)                          AS video_akan_dirapikan,
  (SELECT count(*) FROM _backup_organic_videos_20261001)
    - (SELECT count(*) FROM _safe)                       AS video_dibiarkan_utuh;

-- ---------------------------------------------------------------------
-- 3. Kumpulkan baris yang akan dihapus, sebelum dihapus, supaya bisa dicek
-- ---------------------------------------------------------------------
CREATE TEMP TABLE _hapus ON COMMIT DROP AS
SELECT ov.id
FROM organic_videos ov
JOIN _safe s ON s.content_uid = ov.content_uid
WHERE ov.campaign_id IS DISTINCT FROM s.keep_campaign_id
  AND NOT EXISTS (
    SELECT 1 FROM sales sl
    WHERE sl.content_uid = ov.content_uid AND sl.product_id = ov.product_id
  );

\echo '--- yang akan dihapus ---'
SELECT
  (SELECT count(*) FROM _hapus)                                                        AS baris_dihapus,
  (SELECT count(DISTINCT content_uid) FROM organic_videos ov
     JOIN _hapus h ON h.id = ov.id)                                                    AS video_ikut_berkurang,
  (SELECT count(*) FROM organic_videos ov
     JOIN _hapus h ON h.id = ov.id
     JOIN _safe s ON s.content_uid = ov.content_uid)                                   AS baris_dihapus_yang_sudah_null_campaign;

-- ---------------------------------------------------------------------
-- 4. Sanity: dua hal yang harus benar sebelum DELETE
--    a) setiap video yang dirapikan tetap punya >= 1 baris
--    b) TIDAK ADA baris milik video yang punya <= 20 product_id ikut terhapus
-- ---------------------------------------------------------------------
DO $$
DECLARE VIDEO_HABIS text; VIDEO_TERLALU_SEHAT int;
BEGIN
  SELECT string_agg(x.content_uid, ', ')
  INTO VIDEO_HABIS
  FROM (
    SELECT s.content_uid
    FROM _safe s
    WHERE NOT EXISTS (
      SELECT 1 FROM organic_videos ov
      WHERE ov.content_uid = s.content_uid
        AND (
          ov.campaign_id IS NOT DISTINCT FROM s.keep_campaign_id
          OR EXISTS (
            SELECT 1 FROM sales sl
            WHERE sl.content_uid = ov.content_uid AND sl.product_id = ov.product_id
          )
        )
    )
  ) x;

  IF VIDEO_HABIS IS NOT NULL THEN
    RAISE EXCEPTION 'Batal: % video akan kehilangan semua barisnya', left(VIDEO_HABIS, 200);
  END IF;

  -- b) video dengan 20 product_id atau kurang adalah video normal, tidak
  --    boleh tersentuh sama sekali
  SELECT count(*) INTO VIDEO_TERLALU_SEHAT
  FROM (
    SELECT DISTINCT ov.content_uid
    FROM organic_videos ov
    JOIN _hapus h ON h.id = ov.id
    JOIN _safe s ON s.content_uid = ov.content_uid
    WHERE NOT EXISTS (
      SELECT 1 FROM _g gg WHERE gg.content_uid = ov.content_uid
    )
  ) z;

  IF VIDEO_TERLALU_SEHAT > 0 THEN
    RAISE EXCEPTION 'Batal: % baris dari video non-cross-join ikut masuk daftar hapus', VIDEO_TERLALU_SEHAT;
  END IF;

  RAISE NOTICE 'Sanity OK: tidak ada video kehilangan semua baris, tidak ada baris non-cross-join ikut terhapus';
END $$;

-- ---------------------------------------------------------------------
-- 5. Hapus
-- ---------------------------------------------------------------------
DELETE FROM organic_videos ov
USING _hapus h
WHERE ov.id = h.id;

\echo '--- selesai hapus ---'
SELECT
  (SELECT count(*) FROM organic_videos)                              AS total_baris,
  (SELECT count(DISTINCT content_uid) FROM organic_videos)           AS video_unik,
  (SELECT count(*) FROM _safe)                                        AS video_dirapikan;

COMMIT;

-- ---------------------------------------------------------------------
-- 6. Verifikasi setelah commit
-- ---------------------------------------------------------------------
\echo ''
\echo '=== HASIL AKHIR ==='
SELECT
  (SELECT count(*) FROM organic_videos) AS total_baris,
  (SELECT count(DISTINCT content_uid) FROM organic_videos) AS video_unik,
  (SELECT COALESCE(sum(video_views),0) FROM organic_videos) AS views_per_baris,
  (SELECT COALESCE(sum(mx),0) FROM (SELECT MAX(video_views) mx FROM organic_videos GROUP BY content_uid) t) AS views_per_video,
  (SELECT COALESCE(sum(mx),0) FROM (SELECT MAX(video_likes) mx FROM organic_videos GROUP BY content_uid) u) AS likes_per_video;

\echo ''
\echo '=== Sisa video yang masih punya >20 product_id ==='
SELECT count(*) AS kelompok, COALESCE(max(jml),0) AS maks_product
FROM (
  SELECT count(DISTINCT product_id) AS jml
  FROM organic_videos GROUP BY content_uid HAVING count(DISTINCT product_id) > 20
) x;
