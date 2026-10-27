-- ==============================================================================
-- 99-add-auliaditap-videos-wardah1.sql
-- Menambahkan baris video placeholder (link kosong) untuk @auliaditap di Wardah 1:
-- 1. Update qty_vt = 12 di archive_campaign_creators (id: 65060)
-- 2. Insert 12 baris di archive_videos (urutan 1..12) dengan link_video = ''
-- ==============================================================================

BEGIN;

UPDATE archive_campaign_creators 
SET qty_vt = 12 
WHERE id = 65060; -- auliaditap (Wardah 1, Campaign 262)

INSERT INTO archive_videos (campaign_creator_id, urutan, link_video, link_draft, concept, vt_approval, created_at)
VALUES 
  (65060, 1, '', NULL, NULL, 'approved', NOW()),
  (65060, 2, '', NULL, NULL, 'approved', NOW()),
  (65060, 3, '', NULL, NULL, 'approved', NOW()),
  (65060, 4, '', NULL, NULL, 'approved', NOW()),
  (65060, 5, '', NULL, NULL, 'approved', NOW()),
  (65060, 6, '', NULL, NULL, 'approved', NOW()),
  (65060, 7, '', NULL, NULL, 'approved', NOW()),
  (65060, 8, '', NULL, NULL, 'approved', NOW()),
  (65060, 9, '', NULL, NULL, 'approved', NOW()),
  (65060, 10, '', NULL, NULL, 'approved', NOW()),
  (65060, 11, '', NULL, NULL, 'approved', NOW()),
  (65060, 12, '', NULL, NULL, 'approved', NOW());

COMMIT;
