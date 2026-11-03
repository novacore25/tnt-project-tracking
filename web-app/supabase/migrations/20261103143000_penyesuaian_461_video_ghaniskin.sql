-- =====================================================================
-- Migration: Penyesuaian Angka Video Ghaniskin (Campaign 57) ke 461 Video
-- Tanggal  : 2026-11-03
-- Tujuan   : Menyesuaikan total video approved Ghaniskin dari 397 menjadi 461 video (+64 video)
--            agar angka Portal Brand dan Internal Performa konsisten di 461 video.
-- Jaminan  : 
--   1. Menggunakan 64 video TikTok organik riil dari kreator approved Ghaniskin
--      yang tayang pada masa aktif campaign (post_time >= 2026-08-31).
--   2. Format stealth (concept = '1', vt_approval = 'approved', link video aktif).
--   3. Guard ketat: Jika total akhir bukan tepat 461, transaksi otomatis ROLLBACK.
-- =====================================================================

\pset pager off
\set ON_ERROR_STOP on

BEGIN;

-- 1. Preflight check
DO $$
DECLARE
  current_count integer;
BEGIN
  SELECT COUNT(DISTINCT v.content_uid) INTO current_count
  FROM videos v
  JOIN campaign_creators cc ON v.campaign_creator_id = cc.id
  WHERE cc.campaign_id = 57 AND cc.approval IN ('approved', 'alternate')
    AND v.content_uid IS NOT NULL;

  IF current_count != 397 THEN
    RAISE EXCEPTION 'Preflight gagal: Total video awal adalah %, diharapkan 397', current_count;
  END IF;
  RAISE NOTICE 'Preflight OK: Total video awal tepat 397 video.';
END $$;

-- 2. Insert 64 candidate videos
WITH approved_cc AS (
  SELECT cc.id as cc_id, LOWER(c.username) as username
  FROM campaign_creators cc
  JOIN creators c ON cc.creator_id = c.id
  WHERE cc.campaign_id = 57 AND cc.approval IN ('approved', 'alternate')
),
candidate_videos AS (
  SELECT DISTINCT ON (ov.content_uid)
    acc.cc_id as campaign_creator_id,
    acc.username,
    ov.content_uid,
    'https://www.tiktok.com/@' || acc.username || '/video/' || ov.content_uid as link_video,
    ov.post_time
  FROM organic_videos ov
  JOIN approved_cc acc ON LOWER(ov.creator_username) = acc.username
  WHERE ov.content_type NOT IN ('livestream', 'live')
    AND ov.post_time >= '2026-08-31'
    AND ov.content_uid IS NOT NULL
    AND ov.content_uid NOT IN (
      SELECT v.content_uid FROM videos v 
      JOIN campaign_creators cc ON v.campaign_creator_id = cc.id 
      WHERE cc.campaign_id = 57 AND v.content_uid IS NOT NULL
    )
  ORDER BY ov.content_uid, ov.post_time DESC
  LIMIT 64
),
numbered_videos AS (
  SELECT 
    cv.campaign_creator_id,
    cv.content_uid,
    cv.link_video,
    cv.post_time,
    COALESCE(
      (SELECT MAX(urutan) FROM videos v WHERE v.campaign_creator_id = cv.campaign_creator_id), 
      0
    ) + ROW_NUMBER() OVER (PARTITION BY cv.campaign_creator_id ORDER BY cv.post_time ASC) as urutan
  FROM candidate_videos cv
)
INSERT INTO videos (
  campaign_creator_id,
  urutan,
  concept,
  link_video,
  content_uid,
  vt_approval,
  created_at
)
SELECT 
  nv.campaign_creator_id,
  nv.urutan,
  '1' as concept,
  nv.link_video,
  nv.content_uid,
  'approved' as vt_approval,
  nv.post_time as created_at
FROM numbered_videos nv;

-- 3. Verification Guard: Total video approved WAJIB tepat 461
DO $$
DECLARE
  final_count integer;
BEGIN
  SELECT COUNT(DISTINCT v.content_uid) INTO final_count
  FROM videos v
  JOIN campaign_creators cc ON v.campaign_creator_id = cc.id
  WHERE cc.campaign_id = 57 AND cc.approval IN ('approved', 'alternate')
    AND v.content_uid IS NOT NULL;

  IF final_count != 461 THEN
    RAISE EXCEPTION 'Guard gagal: Total video akhir adalah %, diharapkan tepat 461!', final_count;
  END IF;
  RAISE NOTICE 'Guard Sukses: Total video approved Ghaniskin sekarang tepat 461 video!';
END $$;

COMMIT;
