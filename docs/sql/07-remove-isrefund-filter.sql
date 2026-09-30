-- =====================================================================
-- 07 — HAPUS FILTER is_refund DARI VIEW
-- Tanggal: 30 Sep 2026   (Jalankan SETELAH 06)
--
-- CARA KERJA: script ini TIDAK menulis ulang definisi view. Ia membaca
-- definisi yang benar-benar tersimpan di pg_views, menghapus hanya
-- predicate `is_refund = false`, lalu mengeksekusi ulang hasilnya.
-- Jadi kolom, urutan, dan aggregate lain dijamin tidak berubah.
-- (Versi lama di 03 menulis definisi tangan — berisiko kolom berubah.)
--
-- ATURAN BISNIS: semua order dihitung, termasuk refund dan cancelled.
--
-- PENGAMAN: kalau view tidak punya filter is_refund, atau hasil modifikasi
-- tidak bisa dieksekusi, seluruh transaksi dibatalkan.
-- =====================================================================

\pset pager off
\t on

BEGIN;

-- ① Inventaris: view mana saja yang memfilter is_refund
\echo '=== VIEW YANG MEMFILTER is_refund ==='
SELECT viewname
FROM pg_views
WHERE schemaname = 'public'
  AND definition ~* 'is_refund\s*=\s*false'
ORDER BY viewname;

-- ② Angka SEBELUM
CREATE TEMP TABLE _v_sebelum AS
SELECT
  (SELECT count(*) FROM vw_campaign_summary)                          AS campaign,
  (SELECT COALESCE(sum(total_gmv_achievement),0) FROM vw_campaign_summary) AS gmv_achievement,
  (SELECT COALESCE(sum(total_gmv),0) FROM vw_campaign_summary)        AS total_gmv,
  (SELECT COALESCE(sum(organic_sales),0) FROM daily_performance)      AS organic,
  (SELECT COALESCE(sum(vsa_sales),0) FROM daily_performance)          AS vsa;

\echo ''
\echo '=== SEBELUM ==='
SELECT * FROM _v_sebelum;

-- ③ Hapus filter dari semua view yang memakainya
DO $$
DECLARE
  r        RECORD;
  v_def    TEXT;
  v_baru   TEXT;
  v_total  INT := 0;
BEGIN
  FOR r IN
    SELECT viewname, definition
    FROM pg_views
    WHERE schemaname = 'public'
      AND definition ~* 'is_refund\s*=\s*false'
    ORDER BY viewname
  LOOP
    -- Hapus "WHERE is_refund = false" (bukan WHERE pertama kalau ada AND)
    v_baru := regexp_replace(
      r.definition,
      '\mWHERE\s+is_refund\s*=\s*false\M',
      'WHERE true',
      'gi'
    );

    -- Hapus "AND is_refund = false" (di JOIN atau WHERE gabungan)
    v_baru := regexp_replace(
      v_baru,
      '\s*\MAND\s+is_refund\s*=\s*false\M',
      '',
      'gi'
    );

    IF v_baru IS NOT DISTINCT FROM r.definition THEN
      RAISE EXCEPTION 'GAGAL: definisi % tidak berubah, filter mungkin beda dari yang dicari', r.viewname;
    END IF;

    EXECUTE v_baru;
    v_total := v_total + 1;
    RAISE NOTICE 'View % diperbarui', r.viewname;
  END LOOP;

  IF v_total = 0 THEN
    RAISE EXCEPTION 'GAGAL: tidak ada view yang diperbarui';
  END IF;

  RAISE NOTICE 'Total view diperbarui: %', v_total;
END $$;

-- ④ GUARD
DO $$
DECLARE
  v_sisa INT;
BEGIN
  -- Tidak boleh ada view yang masih memfilter is_refund
  SELECT count(*) INTO v_sisa
  FROM pg_views
  WHERE schemaname = 'public' AND definition ~* 'is_refund\s*=\s*false';

  IF v_sisa > 0 THEN
    RAISE EXCEPTION 'GAGAL: masih ada % view yang memfilter is_refund', v_sisa;
  END IF;

  -- View harus tetap bisa dibaca
  PERFORM 1 FROM vw_campaign_summary LIMIT 1;
  PERFORM 1 FROM daily_performance LIMIT 1;

  RAISE NOTICE 'SEMUA GUARD LOLOS';
END $$;

\echo ''
\echo '=== SESUDAH ==='
SELECT
  (SELECT count(*) FROM vw_campaign_summary)                          AS campaign,
  (SELECT COALESCE(sum(total_gmv_achievement),0) FROM vw_campaign_summary) AS gmv_achievement,
  (SELECT COALESCE(sum(total_gmv),0) FROM vw_campaign_summary)        AS total_gmv,
  (SELECT COALESCE(sum(organic_sales),0) FROM daily_performance)      AS organic,
  (SELECT COALESCE(sum(vsa_sales),0) FROM daily_performance)          AS vsa;

\echo ''
\echo '=== CEK: GMV view harus SEKARANG >= angka sebelumnya ==='
SELECT
  (SELECT COALESCE(sum(organic_sales),0) FROM daily_performance) AS organic_skrg,
  (SELECT organic FROM _v_sebelum)                              AS organic_sblm,
  (SELECT COALESCE(sum(organic_sales),0) FROM daily_performance) >= (SELECT organic FROM _v_sebelum)
    AS organic_naik;

COMMIT;
