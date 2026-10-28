-- ==============================================================================
-- 101-adjust-all-archive-creators-to-4-6-vt.sql
-- Menyesuaikan jumlah video seluruh kreator di Thick & Thin Media yang masih < 4 VT
-- (termasuk 0, 1, 2, dan 3 VT) menjadi variasi 4, 5, atau 6 VT secara organik/natural.
-- Target Video pada kartu campaign tetap dipertahankan sesuai instruksi user.
-- ==============================================================================

BEGIN;

-- 1. Siapkan data kreator target yang saat ini < 4 VT
CREATE TEMP TABLE tmp_target_creators AS
WITH current_status AS (
    SELECT 
        cc.id AS cc_id,
        cc.campaign_id,
        cc.username,
        COUNT(v.id) AS current_vt,
        COALESCE(MAX(v.urutan), 0) AS max_urutan,
        4 + (abs(hashtext(cc.username || cc.id::text)) % 3) AS target_vt
    FROM archive_campaign_creators cc
    LEFT JOIN archive_videos v ON v.campaign_creator_id = cc.id
    GROUP BY cc.id, cc.campaign_id, cc.username
)
SELECT 
    cc_id,
    campaign_id,
    username,
    current_vt,
    max_urutan,
    target_vt,
    (target_vt - current_vt) AS missing_vts
FROM current_status
WHERE current_vt < 4;

-- 2. Update kolom qty_vt di archive_campaign_creators
UPDATE archive_campaign_creators cc
SET qty_vt = t.target_vt
FROM tmp_target_creators t
WHERE cc.id = t.cc_id;

-- 3. Masukkan baris video placeholder (link kosong, approved) sesuai kekurangan kuota
INSERT INTO archive_videos (campaign_creator_id, urutan, link_video, link_draft, concept, vt_approval, created_at)
SELECT 
    t.cc_id,
    t.max_urutan + s.step AS urutan,
    '',
    NULL,
    NULL,
    'approved',
    NOW()
FROM tmp_target_creators t
CROSS JOIN LATERAL generate_series(1, t.missing_vts) AS s(step);

-- 4. Validasi hasil eksekusi
DO $$
DECLARE
    v_under_4 integer;
    v_total_creators integer;
    v_total_videos integer;
BEGIN
    SELECT COUNT(*) INTO v_under_4
    FROM (
        SELECT cc.id
        FROM archive_campaign_creators cc
        LEFT JOIN archive_videos v ON v.campaign_creator_id = cc.id
        GROUP BY cc.id
        HAVING COUNT(v.id) < 4
    ) sub;

    IF v_under_4 > 0 THEN
        RAISE EXCEPTION 'Guard gagal: masih terdapat % kreator dengan VT < 4', v_under_4;
    END IF;

    SELECT COUNT(*), COUNT(v.id) 
    INTO v_total_creators, v_total_videos
    FROM archive_campaign_creators cc
    LEFT JOIN archive_videos v ON v.campaign_creator_id = cc.id;

    RAISE NOTICE 'Sukses: Seluruh % kreator kini memiliki minimal 4-6 VT. Total video arsip: %', 
        v_total_creators, v_total_videos;
END $$;

COMMIT;
