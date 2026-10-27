-- ==============================================================================
-- 100-set-1vt-for-zero-vt-creators-6-campaigns.sql
-- Menambahkan 1 VT placeholder (link kosong) untuk semua kreator yang masih 0 VT
-- khusus pada 6 campaign GOAT: Wardah 1, 2, 3, 4, OMG 3, Light+ (133 kreator).
-- ==============================================================================

BEGIN;

-- 1. Buat tabel temporary penampung target 133 kreator yang 0 VT
CREATE TEMP TABLE tmp_target_creators AS
SELECT cc.id, cc.campaign_id, cc.username
FROM archive_campaign_creators cc
LEFT JOIN (
  SELECT campaign_creator_id, COUNT(*) as vids 
  FROM archive_videos 
  GROUP BY campaign_creator_id
) v ON v.campaign_creator_id = cc.id
WHERE (v.vids IS NULL OR v.vids = 0) 
  AND cc.campaign_id IN (261, 262, 263, 264, 265, 279);

-- 2. Update qty_vt agar minimal 1 di archive_campaign_creators
UPDATE archive_campaign_creators cc
SET qty_vt = GREATEST(COALESCE(cc.qty_vt, 0), 1)
FROM tmp_target_creators t
WHERE cc.id = t.id;

-- 3. Insert 1 baris video placeholder (link kosong) per kreator
INSERT INTO archive_videos (campaign_creator_id, urutan, link_video, link_draft, concept, vt_approval, created_at)
SELECT 
  t.id, 
  1, 
  '', 
  NULL, 
  NULL, 
  'approved', 
  NOW()
FROM tmp_target_creators t;

COMMIT;
