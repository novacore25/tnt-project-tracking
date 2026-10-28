-- ==============================================================================
-- 103-sync-omg2-ads-performance.sql
-- Menyelaraskan nominal Ads Performance OMG 2 (Campaign ID 260) dengan file
-- OMG_2_FullData_2026-10-27.xlsx update terbaru:
-- Total Ads: $107.876,54 USD @ Rp 16.000 = Rp 1.726.024.650,00
-- ==============================================================================

BEGIN;

-- 1. Buat temporary table penampung data ads baru dari Excel
CREATE TEMP TABLE tmp_omg2_ads (
    tanggal date,
    ad_id text,
    ad_name text,
    campaign_ads_name text,
    creator_username text,
    cost_usd numeric(18,4),
    gross_revenue_usd numeric(18,4),
    kurs numeric(18,2)
);

INSERT INTO tmp_omg2_ads (tanggal, ad_id, ad_name, campaign_ads_name, creator_username, cost_usd, gross_revenue_usd, kurs) VALUES
('2024-05-31', 'OTHER_AD_OMG_2_1', 'OMG 2 - Video Shopping Ads', 'OMG ADS', 'aesthex_i', 0.0, 14574.389375, 16000.0),
('2024-05-31', 'OTHER_AD_OMG_2_2', 'OMG 2 - Video Shopping Ads', 'OMG ADS', 'user_apaaja8', 0.0, 10754.895937500001, 16000.0),
('2024-05-31', 'OTHER_AD_OMG_2_3', 'OMG 2 - Video Shopping Ads', 'OMG ADS', 'selvidjong', 0.0, 10307.549687499999, 16000.0),
('2024-05-31', 'OTHER_AD_OMG_2_4', 'OMG 2 - Video Shopping Ads', 'OMG ADS', 'beliicia', 0.0, 8944.143, 16000.0),
('2024-05-31', 'OTHER_AD_OMG_2_5', 'OMG 2 - Video Shopping Ads', 'OMG ADS', 'ammiay', 0.0, 2911.1298125000003, 16000.0),
('2024-05-31', 'OTHER_AD_OMG_2_6', 'OMG 2 - Video Shopping Ads', 'OMG ADS', 'byderara', 0.0, 2454.5308125, 16000.0),
('2024-05-31', 'OTHER_AD_OMG_2_7', 'OMG 2 - Video Shopping Ads', 'OMG ADS', 'peachyhartsssss', 0.0, 2194.115625, 16000.0),
('2024-05-31', 'OTHER_AD_OMG_2_8', 'OMG 2 - Video Shopping Ads', 'OMG ADS', 'gadisaries97', 0.0, 1506.8064375, 16000.0),
('2024-05-31', 'OTHER_AD_OMG_2_9', 'OMG 2 - Video Shopping Ads', 'OMG ADS', 'dratcyunnn', 0.0, 1370.4600000000003, 16000.0),
('2024-05-31', 'OTHER_AD_OMG_2_10', 'OMG 2 - Video Shopping Ads', 'OMG ADS', '__strhyr', 0.0, 1136.7720000000002, 16000.0),
('2024-05-31', 'OTHER_AD_OMG_2_11', 'OMG 2 - Video Shopping Ads', 'OMG ADS', 'mei_arifin180899', 0.0, 787.3019375, 16000.0),
('2024-05-31', 'OTHER_AD_OMG_2_12', 'OMG 2 - Video Shopping Ads', 'OMG ADS', 'hettylamria', 0.0, 752.1548125000002, 16000.0),
('2024-05-31', 'OTHER_AD_OMG_2_13', 'OMG 2 - Video Shopping Ads', 'OMG ADS', 'wulandarisabda', 0.0, 687.0597499999999, 16000.0),
('2024-05-31', 'OTHER_AD_OMG_2_14', 'OMG 2 - Video Shopping Ads', 'OMG ADS', 'shinndiii_', 0.0, 675.2988125, 16000.0),
('2024-05-31', 'OTHER_AD_OMG_2_15', 'OMG 2 - Video Shopping Ads', 'OMG ADS', 'mmyllcaaww', 0.0, 628.3249375, 16000.0),
('2024-05-31', 'OTHER_AD_OMG_2_16', 'OMG 2 - Video Shopping Ads', 'OMG ADS', 'merchindaputri_', 0.0, 517.190375, 16000.0),
('2024-05-31', 'OTHER_AD_OMG_2_17', 'OMG 2 - Video Shopping Ads', 'OMG ADS', 'mey_akina05', 0.0, 388.46193750000003, 16000.0),
('2024-05-31', 'OTHER_AD_OMG_2_18', 'OMG 2 - Video Shopping Ads', 'OMG ADS', 'mia07024', 0.0, 383.111625, 16000.0),
('2024-05-31', 'OTHER_AD_OMG_2_19', 'OMG 2 - Video Shopping Ads', 'OMG ADS', 'kikii.99', 0.0, 11211.068749999999, 16000.0),
('2024-05-31', 'OTHER_AD_OMG_2_20', 'OMG 2 - Video Shopping Ads', 'OMG ADS', 'listhaisty14', 0.0, 8272.996875, 16000.0),
('2024-05-31', 'OTHER_AD_OMG_2_21', 'OMG 2 - Video Shopping Ads', 'OMG ADS', 'matcha.milk7', 0.0, 7928.884375, 16000.0),
('2024-05-31', 'OTHER_AD_OMG_2_22', 'OMG 2 - Video Shopping Ads', 'OMG ADS', 'meikoputra', 0.0, 6880.11, 16000.0),
('2024-05-31', 'OTHER_AD_OMG_2_23', 'OMG 2 - Video Shopping Ads', 'OMG ADS', 'mell.nt', 0.0, 2239.330625, 16000.0),
('2024-05-31', 'OTHER_AD_OMG_2_24', 'OMG 2 - Video Shopping Ads', 'OMG ADS', 'mey_akina05', 0.0, 1888.1006249999998, 16000.0),
('2024-05-31', 'OTHER_AD_OMG_2_25', 'OMG 2 - Video Shopping Ads', 'OMG ADS', 'mithahabiba', 0.0, 1687.78125, 16000.0),
('2024-05-31', 'OTHER_AD_OMG_2_26', 'OMG 2 - Video Shopping Ads', 'OMG ADS', 'mla_zhra18', 0.0, 1159.0818749999999, 16000.0),
('2024-05-31', 'OTHER_AD_OMG_2_27', 'OMG 2 - Video Shopping Ads', 'OMG ADS', 'ninasara75', 0.0, 1054.2, 16000.0),
('2024-05-31', 'OTHER_AD_OMG_2_28', 'OMG 2 - Video Shopping Ads', 'OMG ADS', 'nurulaini280902', 0.0, 874.44, 16000.0),
('2024-05-31', 'OTHER_AD_OMG_2_29', 'OMG 2 - Video Shopping Ads', 'OMG ADS', 'okwinatris1', 0.0, 605.6168749999999, 16000.0),
('2024-05-31', 'OTHER_AD_OMG_2_30', 'OMG 2 - Video Shopping Ads', 'OMG ADS', 'onlynasj', 0.0, 578.580625, 16000.0),
('2024-05-31', 'OTHER_AD_OMG_2_31', 'OMG 2 - Video Shopping Ads', 'OMG ADS', 'onlyone.naaa', 0.0, 528.5074999999999, 16000.0),
('2024-05-31', 'OTHER_AD_OMG_2_32', 'OMG 2 - Video Shopping Ads', 'OMG ADS', 'raffasya.syafiq3', 0.0, 519.4606249999999, 16000.0),
('2024-05-31', 'OTHER_AD_OMG_2_33', 'OMG 2 - Video Shopping Ads', 'OMG ADS', 'ranty2929', 0.0, 483.326875, 16000.0),
('2024-05-31', 'OTHER_AD_OMG_2_34', 'OMG 2 - Video Shopping Ads', 'OMG ADS', 'reviewbywiii', 0.0, 397.83875, 16000.0),
('2024-05-31', 'OTHER_AD_OMG_2_35', 'OMG 2 - Video Shopping Ads', 'OMG ADS', 'riabela6', 0.0, 298.81687500000004, 16000.0),
('2024-05-31', 'OTHER_AD_OMG_2_36', 'OMG 2 - Video Shopping Ads', 'OMG ADS', 'riyamuna_', 0.0, 294.70125, 16000.0);

-- 2. Hapus baris lama ads untuk OMG 2 (campaign_id = 260)
DELETE FROM archive_ads_performance WHERE campaign_id = 260;

-- 3. Insert baris baru ads dari tmp_omg2_ads
INSERT INTO archive_ads_performance (
    campaign_id,
    creator_id,
    creator_username,
    campaign_ads_name,
    ad_id,
    ad_name,
    cost_usd,
    gross_revenue_usd,
    kurs,
    tanggal,
    created_at
)
SELECT 
    260,
    NULL,
    t.creator_username,
    t.campaign_ads_name,
    t.ad_id,
    t.ad_name,
    t.cost_usd,
    t.gross_revenue_usd,
    t.kurs,
    t.tanggal,
    NOW()
FROM tmp_omg2_ads t;

-- 4. Validasi Guard
DO $$
DECLARE
    v_count integer;
    v_rev_usd numeric;
    v_rev_idr numeric;
BEGIN
    SELECT COUNT(*), SUM(gross_revenue_usd), SUM(gross_revenue_usd * kurs)
    INTO v_count, v_rev_usd, v_rev_idr
    FROM archive_ads_performance
    WHERE campaign_id = 260;

    IF v_count != 36 THEN
        RAISE EXCEPTION 'Guard gagal: row count adalah %, diharapkan 36', v_count;
    END IF;

    IF v_rev_usd < 107870 OR v_rev_usd > 107880 THEN
        RAISE EXCEPTION 'Guard gagal: total rev USD adalah %, diharapkan ~107876.54', v_rev_usd;
    END IF;

    RAISE NOTICE 'Sukses: % baris Ads OMG 2 tersimpan dengan Gross Revenue: $% USD (Rp % IDR)',
        v_count, v_rev_usd, v_rev_idr;
END $$;

COMMIT;
