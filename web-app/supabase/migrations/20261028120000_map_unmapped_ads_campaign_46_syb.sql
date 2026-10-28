-- =====================================================================
-- Migration: 20261028120000_map_unmapped_ads_campaign_46_syb.sql
-- Description: Pemetaan 39 iklan @UNMAPPED di Campaign 46 (SYB) ke kreator aslinya
-- Total GMV Dialokasikan: Rp 58.026.240
-- Total Spend Dialokasikan: Rp 8.194.320 ($455.24 USD)
-- Tanggal Eksekusi: 28 Oktober 2026
-- =====================================================================

UPDATE ads_performance
SET creator_id = v.creator_id
FROM (VALUES
  ('1874455830218863', 189),   -- jeezythingz_2_PG -> @jeezythingz
  ('1870235278420626', 206),   -- infopromoaja_2 -> @infopromoaja
  ('1868772956765373', 242),   -- mamak_kao_1 -> @mamak_kao
  ('1874455829969293', 9597),  -- claclarmart_2_peelinggel -> @claclarmart
  ('1865788049393136', 172),   -- naylaazhrni_1 -> @naylaazhrni
  ('1868772889217492', 170),   -- ndaahq_1 -> @ndaahq
  ('1873355815837179', 5788),  -- self6958_2_toner_Toner -> @self6958
  ('1873355815837158', 16752), -- hannacuin_2_Toner_Toner -> @hannacuin_
  ('1867580611792148', 186),   -- zihanokta_1 -> @zihanokta
  ('1873355815837212', 339),   -- putriinabila89_2_Toner -> @putriinabila89
  ('1867580711612217', 341),   -- mawarindah_3 -> @mawarinddah
  ('1873355815838195', 341),   -- mawarinddah_2_Toner -> @mawarinddah
  ('1874455830156507', 347),   -- sintakurniawati.61_2_peelinggel -> @sintakurniawati.61
  ('1873355815838173', 242),   -- mamak_kao_2_Toner -> @mamak_kao
  ('1870235111171693', 341),   -- mawarinddah_2 -> @mawarinddah
  ('1873344895822412', 17133), -- octacagia_2_Toner -> @octacagia
  ('1869429245653103', 352),   -- hanisasarah18_1 -> @hanisasarah18
  ('1868772889639714', 16752), -- hannacuin_1_toner -> @hannacuin_
  ('1870235151735327', 347),   -- sintakurniawati.61_1_peelinggel -> @sintakurniawati.61
  ('1870235278451663', 5788),  -- self6958_1_toner -> @self6958
  ('1874455830031632', 464),   -- azahrahf_2_peelinggel -> @azahrahf
  ('1873355815837195', 341),   -- mawarindah_4_Toner -> @mawarinddah
  ('1867580761684263', 206),   -- infopromoaja_2 -> @infopromoaja
  ('1874455829907352', 159),   -- Byliyah_2_peelinggel -> @Byliyah
  ('1865787925659295', 206),   -- infopromoaja_4 -> @infopromoaja
  ('1869429167142877', 243),   -- dreamm.png_1 -> @dreamm.png
  ('1865788049630893', 199),   -- nris9_1 -> @nris9
  ('1867580711884647', 140),   -- nadastylee_1_toner -> @nadastylee
  ('1867580761118502', 337),   -- mamicipiii_1_peelinggel -> @mamicipiii
  ('1869429167586201', 206),   -- infopromoaja_3 -> @infopromoaja
  ('1873355815838203', 172),   -- naylaazhrni_2_Toner -> @naylaazhrni
  ('1867580611763447', 171),   -- Mell.nt_1_peelinggel -> @mell.nt
  ('1874455830281483', 199),   -- nris9_2_PG -> @nris9
  ('1868772956793638', 189),   -- jeezythingz_1 -> @jeezythingz
  ('1870235111102044', 248),   -- melani.makeup17_1 -> @melani.makeup17
  ('1865787925590064', 339),   -- putriinabila89 -> @putriinabila89
  ('1874455830094038', 1128),  -- zrar4a_2_peelinggel -> @zrar4a
  ('1874455830343923', 186),   -- zihanokta_2_PG -> @zihanokta
  ('1870235151978377', 186)    -- zihanokta_1 -> @zihanokta
) AS v(ad_id, creator_id)
WHERE ads_performance.campaign_id = 46
  AND ads_performance.ad_id = v.ad_id
  AND ads_performance.creator_id IS NULL;
