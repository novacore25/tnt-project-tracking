-- =====================================================================
-- Migration: 20261028141500_map_unmapped_ads_campaign_36_salsa_baby.sql
-- Description: Pemetaan 36 iklan @UNMAPPED di Campaign 36 (SALSA Mom & Baby) ke kreator aslinya
-- Total GMV Dialokasikan: Rp 66.148.526
-- Total Spend Dialokasikan: Rp 27.246.123
-- Total Items Dialokasikan: 1.434 pcs
-- Tanggal Eksekusi: 28 Oktober 2026
-- =====================================================================

UPDATE ads_performance
SET creator_id = v.creator_id
FROM (VALUES
  ('1860610565287234', 1434), -- Fresh Oli Telon_Lalitha usra -> @Usrabinaya
  ('1862506176799937', 866),  -- aboutmy_littlegirl_Telon_2 -> @aboutmy_littlegirl
  ('1861341595682289', 1423), -- runqueenn - runqueenn_Telon_3 -> @runqueenn
  ('1860610325519745', 1423), -- Fresh Oli Telon_runqueenshop_2 -> @runqueenn
  ('1863777595074642', 1565), -- Dunia Bunda / Dunia Bunda_2 -> @duniabunda.id
  ('1862506277635173', 1423), -- runqueenn_Telon_2 -> @runqueenn
  ('1863777595074674', 1515), -- ikapujip_Telon_2 -> @ikapujip
  ('1860610889390338', 1464), -- Rash Cream_lidyaaa𐙚 / _2 -> @lidyafebriy
  ('1860610565294418', 1463), -- Sunscreen_BABY ONE ONE (baby care) / _2 -> @babyoneone
  ('1860610702543009', 697),  -- Sunscreen_Nani / _2 -> @naniichan__
  ('1860610696017361', 1428), -- Rash Cream_Hola Bibam_2 -> @hola.bibam
  ('1863777595073893', 1469), -- bellakhairunnisa7_Telon_2 -> @bellakhairunnisa7
  ('1860610565294434', 1472), -- Sunscreen_Mom Hiro / _2 -> @Momhiroki
  ('1860610565294453', 1420), -- Sunscreen_ShaNoona_2 -> @Biinbiinstore
  ('1860610565294450', 1420), -- Sunscreen_ShaNoona -> @Biinbiinstore
  ('1862506277635154', 819),  -- Umiwahyuni04_Telon_2 -> @umiwahyuni04
  ('1861341595682273', 1434), -- Usrabinaya - Usrabinaya_Telon_2 -> @Usrabinaya
  ('1863777595074658', 1507), -- ohhayum_Telon_3 -> @ohhayum
  ('1862506176799969', 1456), -- amikay.13_Telon_2 -> @amikay.13
  ('1863777595073906', 1524), -- baby.cyrania_Telon_2 -> @baby.cyrania
  ('1861341595682241', 384),  -- heinia_ - heinia__Telon_2 -> @heinia_
  ('1862506176799953', 1462), -- heysoom_Telon_2 -> @heysoom
  ('1861341531970753', 1452), -- rahmahdilaw - rahmahdilaw_Telon_2 -> @rahmahdilaw
  ('1863777595074626', 1423), -- runqueenn_Telon_5 -> @runqueenn
  ('1862506158670977', 1453), -- Ailinmomezlyn_Telon_2 -> @Ailinmomezlyn
  ('1862506176799985', 864),  -- Yasmin_aludra_Telo_1 / _2 -> @yasmin_aludra
  ('1861341595682257', 1429), -- bunaandshanum - bunaandshanum_telon_2 -> @bunaandshanum
  ('1860610889390354', 1451)  -- Rash Cream_a p r i l / _2 -> @aprillaardd
) AS v(ad_id, creator_id)
WHERE ads_performance.campaign_id = 36
  AND ads_performance.ad_id = v.ad_id
  AND ads_performance.creator_id IS NULL;
