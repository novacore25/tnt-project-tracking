-- ==============================================================================
-- 98-add-empty-videos-goat-creators.sql
-- Menambahkan baris video placeholder (link kosong) untuk 6 kreator arsip:
-- 1. Wardah 4 (265):
--    - @pilaaa.66: 5 VT
--    - @katanyakezia: 7 VT
--    - @naatt167: 4 VT
--    - @alansecond7: 8 VT
-- 2. OMG 3 (261):
--    - @kikiromli89: 5 VT
-- 3. Light+ (279):
--    - @goat: 2 VT
-- ==============================================================================

BEGIN;

-- Update qty_vt di archive_campaign_creators
UPDATE archive_campaign_creators SET qty_vt = 5 WHERE id = 68519; -- pilaaa.66 (Wardah 4)
UPDATE archive_campaign_creators SET qty_vt = 7 WHERE id = 68518; -- katanyakezia (Wardah 4)
UPDATE archive_campaign_creators SET qty_vt = 4 WHERE id = 68520; -- naatt167 (Wardah 4)
UPDATE archive_campaign_creators SET qty_vt = 8 WHERE id = 68521; -- alansecond7 (Wardah 4)
UPDATE archive_campaign_creators SET qty_vt = 5 WHERE id = 64891; -- kikiromli89 (OMG 3)
UPDATE archive_campaign_creators SET qty_vt = 2 WHERE id = 67538; -- goat (Light+)

-- Insert ke archive_videos dengan link_video = '' (dikosongkan sementara menunggu rekap tim)
-- pilaaa.66 (5 VT)
INSERT INTO archive_videos (campaign_creator_id, urutan, link_video, link_draft, concept, vt_approval, created_at)
VALUES 
  (68519, 1, '', NULL, NULL, 'approved', NOW()),
  (68519, 2, '', NULL, NULL, 'approved', NOW()),
  (68519, 3, '', NULL, NULL, 'approved', NOW()),
  (68519, 4, '', NULL, NULL, 'approved', NOW()),
  (68519, 5, '', NULL, NULL, 'approved', NOW());

-- katanyakezia (7 VT)
INSERT INTO archive_videos (campaign_creator_id, urutan, link_video, link_draft, concept, vt_approval, created_at)
VALUES 
  (68518, 1, '', NULL, NULL, 'approved', NOW()),
  (68518, 2, '', NULL, NULL, 'approved', NOW()),
  (68518, 3, '', NULL, NULL, 'approved', NOW()),
  (68518, 4, '', NULL, NULL, 'approved', NOW()),
  (68518, 5, '', NULL, NULL, 'approved', NOW()),
  (68518, 6, '', NULL, NULL, 'approved', NOW()),
  (68518, 7, '', NULL, NULL, 'approved', NOW());

-- naatt167 (4 VT)
INSERT INTO archive_videos (campaign_creator_id, urutan, link_video, link_draft, concept, vt_approval, created_at)
VALUES 
  (68520, 1, '', NULL, NULL, 'approved', NOW()),
  (68520, 2, '', NULL, NULL, 'approved', NOW()),
  (68520, 3, '', NULL, NULL, 'approved', NOW()),
  (68520, 4, '', NULL, NULL, 'approved', NOW());

-- alansecond7 (8 VT)
INSERT INTO archive_videos (campaign_creator_id, urutan, link_video, link_draft, concept, vt_approval, created_at)
VALUES 
  (68521, 1, '', NULL, NULL, 'approved', NOW()),
  (68521, 2, '', NULL, NULL, 'approved', NOW()),
  (68521, 3, '', NULL, NULL, 'approved', NOW()),
  (68521, 4, '', NULL, NULL, 'approved', NOW()),
  (68521, 5, '', NULL, NULL, 'approved', NOW()),
  (68521, 6, '', NULL, NULL, 'approved', NOW()),
  (68521, 7, '', NULL, NULL, 'approved', NOW()),
  (68521, 8, '', NULL, NULL, 'approved', NOW());

-- kikiromli89 (5 VT)
INSERT INTO archive_videos (campaign_creator_id, urutan, link_video, link_draft, concept, vt_approval, created_at)
VALUES 
  (64891, 1, '', NULL, NULL, 'approved', NOW()),
  (64891, 2, '', NULL, NULL, 'approved', NOW()),
  (64891, 3, '', NULL, NULL, 'approved', NOW()),
  (64891, 4, '', NULL, NULL, 'approved', NOW()),
  (64891, 5, '', NULL, NULL, 'approved', NOW());

-- goat (2 VT)
INSERT INTO archive_videos (campaign_creator_id, urutan, link_video, link_draft, concept, vt_approval, created_at)
VALUES 
  (67538, 1, '', NULL, NULL, 'approved', NOW()),
  (67538, 2, '', NULL, NULL, 'approved', NOW());

COMMIT;
