-- Migration: 20261029123000_cleanup_unapproved_videos_c141.sql
-- Menghapus 6 baris video auto-populated untuk kreator @syafiudiiin (cc_id: 60114) di Campaign 141 (THE FACE)
-- yang berstatus 'not_approved'.

BEGIN;

DELETE FROM videos
WHERE campaign_creator_id = 60114;

COMMIT;
