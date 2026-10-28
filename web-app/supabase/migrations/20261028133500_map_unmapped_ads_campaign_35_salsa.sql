-- =====================================================================
-- Migration: 20261028133500_map_unmapped_ads_campaign_35_salsa.sql
-- Description: Pemetaan 35 iklan @UNMAPPED di Campaign 35 (SALSA Cosmetic) ke kreator aslinya
-- Total GMV Dialokasikan: Rp 196.924.500
-- Total Spend Dialokasikan: Rp 9.373.680
-- Total Items Dialokasikan: 8.088 pcs
-- Tanggal Eksekusi: 28 Oktober 2026
-- =====================================================================

UPDATE ads_performance
SET creator_id = v.creator_id
FROM (VALUES
  ('1860610225467241', 246),   -- ameccaa.id_body bleach_1 -> @ameccaa.id
  ('1868360047887653', 453),   -- Paket Skincare_Ceta | skincare & beauty -> @ferenaceta
  ('1860610313239858', 499),   -- prettygirls.www_body bleach_1 -> @prettygirls.www
  ('1860610260597724', 1023),  -- Body Bleach_RAS -> @xyblabla2
  ('1868360047574832', 145),   -- Hair Serum_Putri.antris -> @putri.antris
  ('1860609865288446', 1009),  -- Hair Serum_nablue -> @naadeblue
  ('1860610260998435', 199),   -- Paket Skincare_Noris Nur'ssobah -> @nris9
  ('1869429895119801', 982),   -- Paket Skincare_rfitriaaanii -> @rfitriaaanii
  ('1860610313416375', 457),   -- Paket Skincare_Sinaa -> @sinanr18
  ('1860609809448963', 453),   -- Paket Skincare_Ceta | skincare & beauty -> @ferenaceta
  ('1860609809271536', 214),   -- Body Bleach_sye -> @sye.stuff
  ('1860609854799976', 455),   -- Body Bleach_Thya -> @thya_pookie
  ('1869429895576175', 998),   -- Body Bleach_Ini Dhea -> @d.lestarinp
  ('1860610225786444', 137),   -- Hair Serum_𝓥𝓪𝓷𝓷𝔂𝓻𝓪𝓯𝓲 -> @thnlykai
  ('1869429895870871', 177),   -- sabinaaccura -> @sabinaaccura
  ('1868360047480147', 177),   -- sabinaaccura_bodybleach_1 -> @sabinaaccura
  ('1860609854555294', 183),   -- ekbardiary_bodybleach_1 -> @ekbardiary
  ('1860609865791948', 138),   -- itscendi_body bleach 1 -> @itscendi
  ('1860610260159143', 203),   -- lilieesel_bodybleach_1 -> @lilieesel
  ('1860609809798634', 134),   -- hi_jaenaa_ps_1 -> @hi_jaenaa
  ('1872221732356787', 138),   -- itscendi_body bleach 2 -> @itscendi
  ('1872221732191161', 492),   -- moodtiaraaaaa_2 -> @moodtiaraaaaa
  ('1872210344207473', 177),   -- sabinaaccura -> @sabinaaccura
  ('1872222564334053', 503),   -- muhannah.fitria_paket sedekah glowing_2 -> @muhannah.fitria
  ('1872218212876646', 499),   -- prettygirls.www_body bleach_2 -> @prettygirls.www
  ('1872210344216739', 1159),  -- inidinddaaa_bodybleach_2 -> @inidinddaaa
  ('1872214589809574', 246),   -- ameccaa.id_body bleach_2 -> @ameccaa.id
  ('1872221089388389', 183),   -- ekbardiary_bodybleach_2 -> @ekbardiary
  ('1872209588770487', 173),   -- naniinan09_paket sedekah glowing_2 -> @naniinan09
  ('1872214589126225', 134),   -- hi_jaenaa_ps_2 -> @hi_jaenaa
  ('1872218212877572', 177),   -- sabinaaccura_bodybleach_2 -> @sabinaaccura
  ('1872221089671858', 240),   -- ariff.ratnaa_body bleach_2 -> @ariff.ratnaa
  ('1872222564719176', 183),   -- ekbardiary_bodybleach_2 -> @ekbardiary
  ('1872209588872246', 125),   -- dinif.sa_bodybleach_2 -> @dinif.sa
  ('1872223891246316', 1084)   -- aisahtrii__bodybleach_2 -> @aisahtrii_
) AS v(ad_id, creator_id)
WHERE ads_performance.campaign_id = 35
  AND ads_performance.ad_id = v.ad_id
  AND ads_performance.creator_id IS NULL;
