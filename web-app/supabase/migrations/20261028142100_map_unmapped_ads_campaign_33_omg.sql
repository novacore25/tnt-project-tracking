-- =====================================================================
-- Migration: 20261028142100_map_unmapped_ads_campaign_33_omg.sql
-- Description: Pemetaan 33 iklan @UNMAPPED di Campaign 33 (OMG Makeup) ke kreator aslinya
-- Total GMV Dialokasikan: Rp 224.460.000
-- Total Spend Dialokasikan: Rp 6.731.820
-- Total Items Dialokasikan: 5.706 pcs
-- Tanggal Eksekusi: 28 Oktober 2026
-- =====================================================================

UPDATE ads_performance
SET creator_id = v.creator_id
FROM (VALUES
  ('1863499260814755', 208),  -- iniziraajuga_omgmakeup_1 -> @iniziraajuga
  ('1863499260593142', 969),  -- syaashi_1 -> @syaashi
  ('1863499360408162', 134),  -- Jaenaaa_1 -> @hi_jaenaa
  ('1858169117369333', 196),  -- Nur tya | Pejuangkulitsehat_1 -> @nurnnyas
  ('1858169376454445', 971),  -- Riaaaa_1 -> @gadisaries97
  ('1861342436835735', 967),  -- mooncakey_1 -> @stuffbydiy
  ('1863499625467342', 1084), -- 𝒂𝒊𝒔𝒚𝒂 _1 -> @aisahtrii_
  ('1858169315413959', 1039), -- evani si sawo matang_1 -> @itsmeevaniii
  ('1872209588900987', 1108), -- choconad22_omgmakeup_2 -> @choconad22
  ('1863499621775872', 1084), -- 𝒂𝒊𝒔𝒚𝒂 _1 -> @aisahtrii_
  ('1858169350394126', 982),  -- rfitriaaanii_1 -> @rfitriaaanii
  ('1863499530659433', 998),  -- Ini Dhea_1 -> @d.lestarinp
  ('1872210009776101', 1080), -- ncaaaaaaa24__omgmakup_2 -> @ncaaaaaaa24_
  ('1861342436197998', 663),  -- appuccii_omg makeup_1 -> @appuccii
  ('1863499379659672', 199),  -- Noris_1 -> @nris9
  ('1872221089305495', 967),  -- stuffbydiy_omgmakeup_2 -> @stuffbydiy
  ('1863499480933631', 624),  -- M I A_1 -> @mia07024
  ('1872209981504267', 998),  -- d.lestarinp_omgmakeup_2 -> @d.lestarinp
  ('1861342399204942', 1112), -- egaarmwt_omg makeup_1 -> @egaarmwt
  ('1863499530725738', 977),  -- arfatus.sh_omgmakeup_1 -> @arfatus.sh
  ('1858169220985323', 1045), -- may_1 -> @xkaalina
  ('1863499360525554', 1112), -- egaarmwt_omg makeup_1 -> @egaarmwt
  ('1872210344591716', 455),  -- thya_pookie_omgmakeup_2 -> @thya_pookie
  ('1863499621103408', 145),  -- putri.antris_omg makeup_1 -> @putri.antris
  ('1872218212307709', 208),  -- iniziraajuga_omgmakeup_3 -> @iniziraajuga
  ('1872214589529326', 208),  -- iniziraajuga_omgmakeup_2 -> @iniziraajuga
  ('1863499625515263', 1041), -- afi2828_omgmakeup_1 -> @afi2828
  ('1858169350191694', 138),  -- itscendi_omg makeup_1 -> @itscendi
  ('1858169220240463', 447),  -- queenhannisss_omgmakeup_1 -> @queenhannisss
  ('1858169117448925', 208),  -- iniziraajuga_omgmakeup_2 -> @iniziraajuga
  ('1863499379642952', 980),  -- sillviaaagr_omg makeup_1 -> @sillviaaagr
  ('1858169047256874', 1050), -- Bu Dewan_1 -> @liayulianti1278
  ('1858169047199855', 455)   -- thya_pookie_omgmakeup_1 -> @thya_pookie
) AS v(ad_id, creator_id)
WHERE ads_performance.campaign_id = 33
  AND ads_performance.ad_id = v.ad_id
  AND ads_performance.creator_id IS NULL;
