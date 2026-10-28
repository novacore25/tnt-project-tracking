-- =====================================================================
-- Migration: 20261028142000_map_unmapped_ads_campaign_45_qahira.sql
-- Description: Pemetaan 34 iklan @UNMAPPED di Campaign 45 (QAHIRA) ke kreator aslinya
-- Total GMV Dialokasikan: Rp 29.774.880
-- Total Spend Dialokasikan: Rp 12.330.540
-- Total Items Dialokasikan: 450 pcs
-- Tanggal Eksekusi: 28 Oktober 2026
-- =====================================================================

UPDATE ads_performance
SET creator_id = v.creator_id
FROM (VALUES
  ('1861342204709382', 711), -- Tukang_spill_2 -> @spillbarang124
  ('1858169345795699', 400), -- Racunhalal_2 -> @nurulaini280902
  ('1858168949609045', 711), -- Tukang_spill_2 -> @spillbarang124
  ('1861342981304214', 400), -- Racunhalal.by.nurul_2 -> @nurulaini280902
  ('1858169120826062', 711), -- Tukang_spill -> @spillbarang124
  ('1858169120826069', 400), -- Racunhalal -> @nurulaini280902
  ('1858168948476097', 739), -- Bang Fey_2 -> @.bang.fey
  ('1858169120826075', 711), -- Tukang_spill -> @spillbarang124
  ('1861342204627979', 687), -- duonisaa_Ibu Reviewer_2 -> @duonisaa_
  ('1858168947665424', 739), -- Bang Fey_2 -> @.bang.fey
  ('1858169120826065', 739), -- Bang Fey -> @.bang.fey
  ('1858169120826072', 693), -- Teuku Ridhwan -> @teungkuridhwan
  ('1861342518988267', 693), -- Teuku Ridhwan_2 -> @teungkuridhwan
  ('1861342981731287', 693), -- Teuku Ridhwan_2 -> @teungkuridhwan
  ('1858169120826063', 693), -- Teuku Ridhwan -> @teungkuridhwan
  ('1858169120826064', 400), -- Racunhalal.by.nurul -> @nurulaini280902
  ('1858169120826070', 687), -- duonisaa_Ibu Reviewer -> @duonisaa_
  ('1858169120826066', 739), -- Bang Fey -> @.bang.fey
  ('1858168947332465', 698), -- Dherenzshopp_2 -> @dherenzshop91
  ('1858169120826068', 669), -- indribilal25 -> @indribilal25
  ('1858169120826059', 680), -- riskadiana22_qahira_2 -> @riskadiana22
  ('1858169120826073', 698), -- Dherenzshopp -> @dherenzshop91
  ('1861342518324943', 691), -- bidan eka retno wati_2 -> @ekaretnowatii
  ('1858169120826057', 668), -- manis2_2 -> @manis_3521
  ('1858169120150877', 669), -- indribilal25_2 -> @indribilal25
  ('1858169120826076', 668), -- manis2 -> @manis_3521
  ('1858168948402537', 711), -- Tukang_spill_2 -> @spillbarang124
  ('1858169120826071', 691), -- bidan eka retno wati -> @ekaretnowatii
  ('1858169120826067', 668), -- manis2 -> @manis_3521
  ('1858169120826058', 806), -- wijayasehatapotek_qahira_1 -> @wijayasehatapotek
  ('1858169120826074', 711), -- Tukang_spill -> @spillbarang124
  ('1858168949589837', 668), -- manis2_2 -> @manis_3521
  ('1858169120826060', 775), -- nadiapurba53_qahira_1 -> @nadiapurba53
  ('1858169120826061', 759)  -- sistjojo1_qahira_1 -> @sistjojo1
) AS v(ad_id, creator_id)
WHERE ads_performance.campaign_id = 45
  AND ads_performance.ad_id = v.ad_id
  AND ads_performance.creator_id IS NULL;
