import React from "react";
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import { logoTntBase64 } from "./logoBase64";

// Margin spesifikasi:
// Margin Left & Right = 2.54 cm = 72 pt
// Gap Top ke Kop / Header = 1.25 cm = 35.43 pt (~35.5 pt)
// Gap dari Header ke Konten Isi = 1.0 cm = 28.35 pt (~28.5 pt)
// Margin Bottom = 2.54 cm = 72 pt (dengan footer di posisi bottom ~35 pt)
const MARGIN_LEFT_RIGHT = 72; // 2.54 cm
const GAP_TOP_HEADER = 35.5;  // 1.25 cm
const GAP_HEADER_CONTENT = 28.5; // 1.00 cm
const MARGIN_BOTTOM = 72;     // 2.54 cm

const styles = StyleSheet.create({
  page: {
    paddingTop: GAP_TOP_HEADER,
    paddingBottom: MARGIN_BOTTOM,
    paddingLeft: MARGIN_LEFT_RIGHT,
    paddingRight: MARGIN_LEFT_RIGHT,
    fontFamily: "Times-Roman",
    fontSize: 12,
    color: "#000000",
    lineHeight: 1.5,
  },
  // KOP / HEADER DI ATAS SETIAP HALAMAN
  headerContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: GAP_HEADER_CONTENT,
    borderBottomWidth: 0.5,
    borderBottomColor: "#94a3b8",
    paddingBottom: 8,
  },
  headerLogo: {
    width: 140,
    height: 38,
    objectFit: "contain",
    marginBottom: 3,
  },
  headerSubText: {
    fontFamily: "Times-Roman",
    fontSize: 10,
    textAlign: "center",
    color: "#000000",
    lineHeight: 1.2,
  },
  headerEmail: {
    fontFamily: "Times-Roman",
    fontSize: 10,
    textAlign: "center",
    color: "#0056b3",
    lineHeight: 1.2,
  },
  // FOOTER RESMI DI BAGIAN BAWAH SETIAP HALAMAN
  footerContainer: {
    position: "absolute",
    bottom: 35, // 1.25 cm dari tepi bawah kertas
    left: MARGIN_LEFT_RIGHT,
    right: MARGIN_LEFT_RIGHT,
    borderTopWidth: 0.5,
    borderTopColor: "#94a3b8",
    paddingTop: 5,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerLeftText: {
    fontFamily: "Times-Roman",
    fontSize: 9,
    color: "#475569",
    textAlign: "left",
  },
  footerRightText: {
    fontFamily: "Times-Roman",
    fontSize: 9,
    color: "#475569",
    textAlign: "right",
  },
  // JUDUL SURAT
  docTitleContainer: {
    textAlign: "center",
    marginBottom: 14,
  },
  docTitle: {
    fontFamily: "Times-Bold",
    fontSize: 12,
    textDecoration: "underline",
    textAlign: "center",
    textTransform: "uppercase",
  },
  docNumber: {
    fontFamily: "Times-Roman",
    fontSize: 12,
    textAlign: "center",
    marginTop: 2,
  },
  // PARAGRAF & TEXT
  paragraphJustify: {
    fontFamily: "Times-Roman",
    fontSize: 12,
    textAlign: "justify",
    lineHeight: 1.5,
    marginBottom: 8,
  },
  bold: {
    fontFamily: "Times-Bold",
  },
  italic: {
    fontFamily: "Times-Italic",
  },
  // TABEL IDENTITAS PIHAK
  partyTable: {
    marginVertical: 4,
    marginBottom: 8,
  },
  partyRow: {
    flexDirection: "row",
    lineHeight: 1.4,
    marginBottom: 2,
  },
  partyLabel: {
    width: "36%",
    fontFamily: "Times-Roman",
    fontSize: 12,
  },
  partyColon: {
    width: "4%",
    fontFamily: "Times-Roman",
    fontSize: 12,
    textAlign: "center",
  },
  partyValue: {
    width: "60%",
    fontFamily: "Times-Roman",
    fontSize: 12,
  },
  // PASAL
  pasalContainer: {
    marginTop: 14,
    marginBottom: 6,
    textAlign: "center",
  },
  pasalNumber: {
    fontFamily: "Times-Bold",
    fontSize: 12,
    textAlign: "center",
    textTransform: "uppercase",
  },
  pasalTitle: {
    fontFamily: "Times-Bold",
    fontSize: 12,
    textAlign: "center",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  // AYAT DENGAN NUMBERING
  numberedItem: {
    flexDirection: "row",
    marginBottom: 4,
    lineHeight: 1.5,
  },
  itemNumber: {
    width: 24,
    fontFamily: "Times-Roman",
    fontSize: 12,
  },
  itemText: {
    flex: 1,
    fontFamily: "Times-Roman",
    fontSize: 12,
    textAlign: "justify",
  },
  // DEFINISI TABEL DI PASAL 1
  defRow: {
    flexDirection: "row",
    marginBottom: 2,
    lineHeight: 1.4,
  },
  defNumber: {
    width: 24,
    fontFamily: "Times-Roman",
    fontSize: 12,
  },
  defTerm: {
    width: 140,
    fontFamily: "Times-Roman",
    fontSize: 12,
  },
  defColon: {
    width: 14,
    fontFamily: "Times-Roman",
    fontSize: 12,
  },
  defDesc: {
    flex: 1,
    fontFamily: "Times-Roman",
    fontSize: 12,
  },
  // TANDA TANGAN
  signSection: {
    marginTop: 20,
    marginBottom: 10,
  },
  signCityDate: {
    fontFamily: "Times-Roman",
    fontSize: 12,
    marginBottom: 8,
  },
  signRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  signColumn: {
    width: "45%",
    textAlign: "center",
  },
  signPartyLabel: {
    fontFamily: "Times-Bold",
    fontSize: 12,
    textAlign: "center",
    marginBottom: 55,
  },
  signName: {
    fontFamily: "Times-Bold",
    fontSize: 12,
    textAlign: "center",
    textDecoration: "underline",
  },
  signRole: {
    fontFamily: "Times-Roman",
    fontSize: 12,
    textAlign: "center",
    marginTop: 2,
  },
});

export interface CreatorContractData {
  nomorKontrak: string;
  hariTanggalPerjanjian: string; // e.g. "Jumat 10 (sepuluh) Juli tahun 2026 (dua ribu dua puluh enam)"
  tanggalKota: string; // e.g. "Tangerang, 10 Juli 2026"
  // Pihak Pertama (TNT Media)
  namaPerusahaan: string;
  alamatPerusahaan: string;
  teleponPerusahaan: string;
  emailPerusahaan: string;
  namaPicTNT: string;
  // Pihak Kedua (Kreator)
  namaKreator: string;
  usernameTikTok: string;
  tiktokUid?: string;
  nikKtp?: string;
  tempatTanggalLahir?: string;
  alamatKreator: string;
  teleponKreator: string;
  emailKreator?: string;
  npwpKreator?: string;
  namaBank?: string;
  nomorRekening?: string;
  atasNamaRekening?: string;
  rekeningKreator: string;
  // Detail Kerjasama
  namaCampaign: string;
  namaBrand: string;
  qtyVt: number;
  periodeTayang: string; // e.g. "10 - 15 Juli 2026"
  biayaHonor: number;
  terbilangHonor: string; // e.g. "dua ratus ribu rupiah"
  ketentuanPembayaran: string; // e.g. "Honor PIHAK KEDUA akan dibayarkan oleh PIHAK PERTAMA 100% maksimal H+14 setelah upload video ke 4"
  tanggalMulai: string;
  tanggalBerakhir: string;
  customClauses?: string;
}

export function CreatorContractPdfDocument({ data }: { data: CreatorContractData }) {
  const cleanUname = (data.usernameTikTok || "").replace("@", "");
  const honorFormatted = Number(data.biayaHonor || 0).toLocaleString("id-ID");

  const rekeningDisplay = data.rekeningKreator || (
    data.namaBank && data.nomorRekening
      ? `${data.namaBank} - ${data.nomorRekening} a.n. ${data.atasNamaRekening || data.namaKreator}`
      : "-"
  );

  return (
    <Document>
      {/* ========================================================
          HALAMAN 1: KOP, IDENTITAS PARA PIHAK, PASAL 1 & PASAL 2
      ======================================================== */}
      <Page size="A4" style={styles.page}>
        {/* KOP / HEADER DI ATAS HALAMAN 1 (GAP TOP 1.25 cm, GAP KE ISI 1 cm) */}
        <View style={styles.headerContainer}>
          <Image src={logoTntBase64} style={styles.headerLogo} />
          <Text style={styles.headerSubText}>Official TikTok MCN &amp; Affiliate Partner</Text>
          <Text style={styles.headerEmail}>email: {data.emailPerusahaan || "tntmediaaffiliate@gmail.com"}</Text>
        </View>

        {/* JUDUL SURAT & NOMOR */}
        <View style={styles.docTitleContainer}>
          <Text style={styles.docTitle}>KONTRAK KERJASAMA</Text>
          <Text style={styles.docNumber}>Nomor: {data.nomorKontrak}</Text>
        </View>

        {/* PEMBUKA */}
        <Text style={styles.paragraphJustify}>
          Pada hari ini, {data.hariTanggalPerjanjian}, telah diadakan perjanjian kerjasama yang ditandai dengan penandatanganan surat perjanjian, antara:
        </Text>

        {/* PIHAK PERTAMA */}
        <View style={styles.partyTable}>
          <View style={styles.partyRow}>
            <Text style={styles.partyLabel}>Nama Perusahaan</Text>
            <Text style={styles.partyColon}>:</Text>
            <Text style={[styles.partyValue, styles.bold]}>{data.namaPerusahaan}</Text>
          </View>
          <View style={styles.partyRow}>
            <Text style={styles.partyLabel}>Alamat</Text>
            <Text style={styles.partyColon}>:</Text>
            <Text style={styles.partyValue}>{data.alamatPerusahaan}</Text>
          </View>
          <View style={styles.partyRow}>
            <Text style={styles.partyLabel}>Telepon</Text>
            <Text style={styles.partyColon}>:</Text>
            <Text style={styles.partyValue}>{data.teleponPerusahaan}</Text>
          </View>
        </View>
        <Text style={styles.paragraphJustify}>
          Dalam hal ini bertindak atas nama <Text style={styles.bold}>&ldquo;TNT MEDIA&rdquo;</Text> yang selanjutnya disebut sebagai <Text style={styles.bold}>PIHAK PERTAMA</Text>.
        </Text>

        {/* PIHAK KEDUA */}
        <View style={styles.partyTable}>
          <View style={styles.partyRow}>
            <Text style={styles.partyLabel}>Nama Content Creator</Text>
            <Text style={styles.partyColon}>:</Text>
            <Text style={[styles.partyValue, styles.bold]}>{data.namaKreator} (@{cleanUname})</Text>
          </View>
          {data.nikKtp && (
            <View style={styles.partyRow}>
              <Text style={styles.partyLabel}>NIK (KTP)</Text>
              <Text style={styles.partyColon}>:</Text>
              <Text style={styles.partyValue}>{data.nikKtp}</Text>
            </View>
          )}
          {data.tempatTanggalLahir && (
            <View style={styles.partyRow}>
              <Text style={styles.partyLabel}>Tempat, Tanggal Lahir</Text>
              <Text style={styles.partyColon}>:</Text>
              <Text style={styles.partyValue}>{data.tempatTanggalLahir}</Text>
            </View>
          )}
          <View style={styles.partyRow}>
            <Text style={styles.partyLabel}>Rekening Bank</Text>
            <Text style={styles.partyColon}>:</Text>
            <Text style={styles.partyValue}>{rekeningDisplay}</Text>
          </View>
          <View style={styles.partyRow}>
            <Text style={styles.partyLabel}>Alamat Sesuai KTP / Domisili</Text>
            <Text style={styles.partyColon}>:</Text>
            <Text style={styles.partyValue}>{data.alamatKreator || "-"}</Text>
          </View>
          <View style={styles.partyRow}>
            <Text style={styles.partyLabel}>Telepon / WhatsApp</Text>
            <Text style={styles.partyColon}>:</Text>
            <Text style={styles.partyValue}>{data.teleponKreator || "-"}</Text>
          </View>
          {data.emailKreator && (
            <View style={styles.partyRow}>
              <Text style={styles.partyLabel}>Alamat Email</Text>
              <Text style={styles.partyColon}>:</Text>
              <Text style={styles.partyValue}>{data.emailKreator}</Text>
            </View>
          )}
          {data.npwpKreator && (
            <View style={styles.partyRow}>
              <Text style={styles.partyLabel}>NPWP</Text>
              <Text style={styles.partyColon}>:</Text>
              <Text style={styles.partyValue}>{data.npwpKreator}</Text>
            </View>
          )}
        </View>
        <Text style={styles.paragraphJustify}>
          Dalam hal ini bertindak atas nama diri pribadi yang selanjutnya disebut sebagai <Text style={styles.bold}>PIHAK KEDUA</Text>.
        </Text>

        {/* KESEPAKATAN PARA PIHAK */}
        <Text style={styles.paragraphJustify}>
          <Text style={styles.bold}>PIHAK PERTAMA</Text> dan <Text style={styles.bold}>PIHAK KEDUA</Text> secara bersamaan selanjutnya disebut sebagai <Text style={styles.bold}>PARA PIHAK</Text>. <Text style={styles.bold}>PARA PIHAK</Text> bersepakat untuk mengadakan ikatan perjanjian kerjasama dimana syarat dan ketentuannya diatur dalam 9 (<Text style={styles.italic}>sembilan</Text>) pasal berikut dibawah ini:
        </Text>

        {/* PASAL 1 */}
        <View style={styles.pasalContainer}>
          <Text style={styles.pasalNumber}>PASAL 1</Text>
          <Text style={styles.pasalTitle}>DEFINISI/ISTILAH</Text>
        </View>

        <View style={{ marginBottom: 6 }}>
          <View style={styles.defRow}>
            <Text style={styles.defNumber}>1.</Text>
            <Text style={styles.defTerm}>Content Creator</Text>
            <Text style={styles.defColon}>:</Text>
            <Text style={styles.defDesc}>Pembuat konten video</Text>
          </View>
          <View style={styles.defRow}>
            <Text style={styles.defNumber}>2.</Text>
            <Text style={styles.defTerm}>Viewers</Text>
            <Text style={styles.defColon}>:</Text>
            <Text style={styles.defDesc}>Penonton</Text>
          </View>
          <View style={styles.defRow}>
            <Text style={styles.defNumber}>3.</Text>
            <Text style={styles.defTerm}>Script</Text>
            <Text style={styles.defColon}>:</Text>
            <Text style={styles.defDesc}>Naskah</Text>
          </View>
          <View style={styles.defRow}>
            <Text style={styles.defNumber}>4.</Text>
            <Text style={styles.defTerm}>Draft Video</Text>
            <Text style={styles.defColon}>:</Text>
            <Text style={styles.defDesc}>Mengirim video pra-upload</Text>
          </View>
          <View style={styles.defRow}>
            <Text style={styles.defNumber}>5.</Text>
            <Text style={styles.defTerm}>Keranjang Kuning</Text>
            <Text style={styles.defColon}>:</Text>
            <Text style={styles.defDesc}>Keranjang kuning dalam platform Tiktok</Text>
          </View>
          <View style={styles.defRow}>
            <Text style={styles.defNumber}>6.</Text>
            <Text style={styles.defTerm}>Brief</Text>
            <Text style={styles.defColon}>:</Text>
            <Text style={styles.defDesc}>Panduan/catatan untuk membuat video</Text>
          </View>
          <View style={styles.defRow}>
            <Text style={styles.defNumber}>7.</Text>
            <Text style={styles.defTerm}>Boost/ads</Text>
            <Text style={styles.defColon}>:</Text>
            <Text style={styles.defDesc}>Iklan yang ada di Tiktok</Text>
          </View>
        </View>

        {/* PASAL 2 */}
        <View style={styles.pasalContainer}>
          <Text style={styles.pasalNumber}>PASAL 2</Text>
          <Text style={styles.pasalTitle}>STATUS</Text>
        </View>
        <Text style={styles.paragraphJustify}>
          <Text style={styles.bold}>PIHAK PERTAMA</Text> menyetujui untuk bekerja sama dengan <Text style={styles.bold}>PIHAK KEDUA</Text>, yang dalam hal ini <Text style={styles.bold}>PIHAK KEDUA</Text> ditetapkan sebagai Content Creator oleh <Text style={styles.bold}>PIHAK PERTAMA</Text> untuk melaksanakan jasa pembuatan konten yang diminta oleh <Text style={styles.bold}>PIHAK PERTAMA</Text> untuk memasarkan {data.namaBrand} ({data.namaCampaign}).
        </Text>

        {/* FOOTER HALAMAN 1 */}
        <View style={styles.footerContainer} fixed>
          <Text style={styles.footerLeftText}>
            PT TNT Digital Kreatif - Official TikTok Agency Partner
          </Text>
          <Text
            style={styles.footerRightText}
            render={({ pageNumber, totalPages }) => `Halaman ${pageNumber}/${totalPages}`}
          />
        </View>
      </Page>

      {/* ========================================================
          HALAMAN 2: PASAL 3 (HAK & KEWAJIBAN), PASAL 4, 5, 6
      ======================================================== */}
      <Page size="A4" style={styles.page}>
        {/* KOP DI HALAMAN 2 */}
        <View style={styles.headerContainer}>
          <Image src={logoTntBase64} style={styles.headerLogo} />
          <Text style={styles.headerSubText}>Official TikTok MCN &amp; Affiliate Partner</Text>
          <Text style={styles.headerEmail}>email: {data.emailPerusahaan || "tntmediaaffiliate@gmail.com"}</Text>
        </View>

        {/* PASAL 3 */}
        <View style={styles.pasalContainer}>
          <Text style={styles.pasalNumber}>PASAL 3</Text>
          <Text style={styles.pasalTitle}>HAK DAN KEWAJIBAN</Text>
        </View>

        {/* 3.1 HAK-HAK PIHAK PERTAMA */}
        <Text style={[styles.bold, { marginBottom: 3 }]}>3.1 Hak-hak PIHAK PERTAMA :</Text>
        <View style={styles.numberedItem}>
          <Text style={styles.itemNumber}>1.</Text>
          <Text style={styles.itemText}>
            <Text style={styles.bold}>PIHAK PERTAMA</Text> berhak untuk meminta <Text style={styles.bold}>PIHAK KEDUA</Text> melakukan revisi apabila draft video tidak sesuai dengan brief.
          </Text>
        </View>
        <View style={styles.numberedItem}>
          <Text style={styles.itemNumber}>2.</Text>
          <Text style={styles.itemText}>
            <Text style={styles.bold}>PIHAK PERTAMA</Text> berhak memotong 50% (<Text style={styles.italic}>lima puluh persen</Text>) dari honor <Text style={styles.bold}>PIHAK KEDUA</Text> apabila <Text style={styles.bold}>PIHAK KEDUA</Text> tidak mengirimkan draft/mengupload video sesuai timeline yang disepakati.
          </Text>
        </View>
        <View style={styles.numberedItem}>
          <Text style={styles.itemNumber}>3.</Text>
          <Text style={styles.itemText}>
            <Text style={styles.bold}>PIHAK PERTAMA</Text> berhak untuk membatalkan kontrak ini apabila <Text style={styles.bold}>PIHAK KEDUA</Text> tidak menjalankan kewajibannya dan/atau melakukan cheating (menggunakan boost/ads selain dari <Text style={styles.bold}>PIHAK PERTAMA</Text>).
          </Text>
        </View>

        {/* 3.2 KEWAJIBAN PIHAK PERTAMA */}
        <Text style={[styles.bold, { marginTop: 6, marginBottom: 3 }]}>3.2 Kewajiban PIHAK PERTAMA :</Text>
        <View style={styles.numberedItem}>
          <Text style={styles.itemNumber}>1.</Text>
          <Text style={styles.itemText}>
            <Text style={styles.bold}>PIHAK PERTAMA</Text> wajib memberikan brief video kepada <Text style={styles.bold}>PIHAK KEDUA</Text> sebelum kontrak ini ditandatangani.
          </Text>
        </View>
        <View style={styles.numberedItem}>
          <Text style={styles.itemNumber}>2.</Text>
          <Text style={styles.itemText}>
            <Text style={styles.bold}>PIHAK PERTAMA</Text> wajib mengirimkan sample produk kepada <Text style={styles.bold}>PIHAK KEDUA</Text> sesuai alamat yang tertera pada kontrak ini.
          </Text>
        </View>
        <View style={styles.numberedItem}>
          <Text style={styles.itemNumber}>3.</Text>
          <Text style={styles.itemText}>
            <Text style={styles.bold}>PIHAK PERTAMA</Text> wajib membayarkan honor kepada <Text style={styles.bold}>PIHAK KEDUA</Text> sesuai waktu dan ketentuan yang ada pada kontrak ini.
          </Text>
        </View>

        {/* 3.3 HAK-HAK PIHAK KEDUA */}
        <Text style={[styles.bold, { marginTop: 6, marginBottom: 3 }]}>3.3 Hak-hak PIHAK KEDUA :</Text>
        <View style={styles.numberedItem}>
          <Text style={styles.itemNumber}>1.</Text>
          <Text style={styles.itemText}>
            <Text style={styles.bold}>PIHAK KEDUA</Text> berhak untuk mendapatkan brief dari <Text style={styles.bold}>PIHAK PERTAMA</Text>.
          </Text>
        </View>
        <View style={styles.numberedItem}>
          <Text style={styles.itemNumber}>2.</Text>
          <Text style={styles.itemText}>
            <Text style={styles.bold}>PIHAK KEDUA</Text> berhak untuk mendapatkan honor tepat waktu dari <Text style={styles.bold}>PIHAK PERTAMA</Text>.
          </Text>
        </View>

        {/* 3.4 KEWAJIBAN PIHAK KEDUA */}
        <Text style={[styles.bold, { marginTop: 6, marginBottom: 3 }]}>3.4 Kewajiban PIHAK KEDUA :</Text>
        <View style={styles.numberedItem}>
          <Text style={styles.itemNumber}>1.</Text>
          <Text style={styles.itemText}>
            <Text style={styles.bold}>PIHAK KEDUA</Text> wajib mengupload video {data.qtyVt} pada {data.periodeTayang} pada platform media sosial &ldquo;TikTok&rdquo;.
          </Text>
        </View>
        <View style={styles.numberedItem}>
          <Text style={styles.itemNumber}>2.</Text>
          <Text style={styles.itemText}>
            <Text style={styles.bold}>PIHAK KEDUA</Text> wajib menggunakan script dan hashtag yang telah diberikan oleh <Text style={styles.bold}>PIHAK PERTAMA</Text> dalam membuat dan mengupload video.
          </Text>
        </View>
        <View style={styles.numberedItem}>
          <Text style={styles.itemNumber}>3.</Text>
          <Text style={styles.itemText}>
            <Text style={styles.bold}>PIHAK KEDUA</Text> wajib memberikan draft video kepada <Text style={styles.bold}>PIHAK PERTAMA</Text> sebelum mengupload video tersebut.
          </Text>
        </View>
        <View style={styles.numberedItem}>
          <Text style={styles.itemNumber}>4.</Text>
          <Text style={styles.itemText}>
            <Text style={styles.bold}>PIHAK KEDUA</Text> wajib untuk melakukan revisi sebanyak maksimal 2 (<Text style={styles.italic}>dua</Text>) kali apabila video draft tidak sesuai dengan brief yang telah diberikan (Hashtag, Caption, dll.).
          </Text>
        </View>
        <View style={styles.numberedItem}>
          <Text style={styles.itemNumber}>5.</Text>
          <Text style={styles.itemText}>
            <Text style={styles.bold}>PIHAK KEDUA</Text> tidak boleh menghapus video yang sudah diupload.
          </Text>
        </View>

        {/* PASAL 4 */}
        <View style={styles.pasalContainer}>
          <Text style={styles.pasalNumber}>PASAL 4</Text>
          <Text style={styles.pasalTitle}>BIAYA</Text>
        </View>
        <Text style={styles.paragraphJustify}>
          <Text style={styles.bold}>PIHAK KEDUA</Text> akan mendapatkan honor dari <Text style={styles.bold}>PIHAK PERTAMA</Text> sebesar Rp. {honorFormatted} ({data.terbilangHonor}).
        </Text>

        {/* PASAL 5 */}
        <View style={styles.pasalContainer}>
          <Text style={styles.pasalNumber}>PASAL 5</Text>
          <Text style={styles.pasalTitle}>TATA CARA PEMBAYARAN</Text>
        </View>
        <Text style={styles.paragraphJustify}>
          <Text style={styles.bold}>PIHAK PERTAMA</Text> hanya akan membayarkan honor <Text style={styles.bold}>PIHAK KEDUA</Text> melalui nomor rekening yang telah terdaftar pada kontrak ini. {data.ketentuanPembayaran}.
        </Text>

        {/* PASAL 6 */}
        <View style={styles.pasalContainer}>
          <Text style={styles.pasalNumber}>PASAL 6</Text>
          <Text style={styles.pasalTitle}>MASA BERAKHIRNYA KONTRAK</Text>
        </View>
        <Text style={styles.paragraphJustify}>
          Kontrak ini akan berlaku mulai tanggal {data.tanggalMulai} dan akan berakhir pada tanggal {data.tanggalBerakhir}, kecuali diberikan perpanjangan secara tertulis oleh kedua belah pihak atau diakhiri lebih awal sesuai dengan ketentuan yang terdapat dalam perjanjian ini.
        </Text>

        {/* FOOTER HALAMAN 2 */}
        <View style={styles.footerContainer} fixed>
          <Text style={styles.footerLeftText}>
            PT TNT Digital Kreatif - Official TikTok Agency Partner
          </Text>
          <Text
            style={styles.footerRightText}
            render={({ pageNumber, totalPages }) => `Halaman ${pageNumber}/${totalPages}`}
          />
        </View>
      </Page>

      {/* ========================================================
          HALAMAN 3: PASAL 7, 8, 9 & LEMBAR TANDA TANGAN
      ======================================================== */}
      <Page size="A4" style={styles.page}>
        {/* KOP DI HALAMAN 3 */}
        <View style={styles.headerContainer}>
          <Image src={logoTntBase64} style={styles.headerLogo} />
          <Text style={styles.headerSubText}>Official TikTok MCN &amp; Affiliate Partner</Text>
          <Text style={styles.headerEmail}>email: {data.emailPerusahaan || "tntmediaaffiliate@gmail.com"}</Text>
        </View>

        {/* PASAL 7 */}
        <View style={styles.pasalContainer}>
          <Text style={styles.pasalNumber}>PASAL 7</Text>
          <Text style={styles.pasalTitle}>KEADAAN KAHAR (FORCE MAJEURE)</Text>
        </View>
        <Text style={styles.paragraphJustify}>
          Dalam hal terjadi kejadian atau keadaan yang di luar kendali wajar salah satu pihak yang mengakibatkan keterlambatan atau kegagalan dalam pelaksanaan kewajiban di bawah perjanjian ini, termasuk tetapi tidak terbatas pada gempa bumi, banjir, kebakaran, badai, huru-hara sipil, perang, tindakan pemerintah, atau kejadian serupa, maka pihak yang terkena dampak force majeure tersebut akan memberitahukan secara tertulis kepada pihak lainnya dalam waktu maksimal 7 hari setelah kejadian tersebut terjadi.
        </Text>

        {/* PASAL 8 */}
        <View style={styles.pasalContainer}>
          <Text style={styles.pasalNumber}>PASAL 8</Text>
          <Text style={styles.pasalTitle}>PENYELESAIAN SENGKETA</Text>
        </View>
        <Text style={styles.paragraphJustify}>
          Setiap perselisihan, pertikaian, atau klaim yang timbul dari atau berkaitan dengan kontrak ini, termasuk pelanggaran akan diselesaikan melalui mediasi terlebih dahulu. Jika mediasi tidak berhasil dalam menyelesaikan sengketa dalam waktu yang wajar, maka sengketa tersebut akan dirujuk ke pengadilan yang berwenang untuk penyelesaian sesuai dengan hukum yang berlaku di Indonesia.
        </Text>

        {/* PASAL TAMBAHAN / KLAUSUL KHUSUS (JIKA ADA) */}
        {data.customClauses && data.customClauses.trim() !== "" && (
          <View>
            <View style={styles.pasalContainer}>
              <Text style={styles.pasalNumber}>PASAL TAMBAHAN</Text>
              <Text style={styles.pasalTitle}>KETENTUAN KHUSUS</Text>
            </View>
            <Text style={styles.paragraphJustify}>{data.customClauses}</Text>
          </View>
        )}

        {/* PASAL 9 */}
        <View style={styles.pasalContainer}>
          <Text style={styles.pasalNumber}>PASAL 9</Text>
          <Text style={styles.pasalTitle}>PENUTUP</Text>
        </View>
        <Text style={styles.paragraphJustify}>
          Kontrak ini dibuat, disetujui, dan ditandatangani oleh <Text style={styles.bold}>PARA PIHAK</Text> secara sadar. Kontrak ini mulai berlaku sejak ditandatangani oleh <Text style={styles.bold}>PARA PIHAK</Text>. Apabila ada hal-hal lain yang belum diatur dalam kontrak ini, <Text style={styles.bold}>PARA PIHAK</Text> dapat berdiskusi untuk merevisi kontrak.
        </Text>

        {/* SIGNATURE SECTION */}
        <View style={styles.signSection}>
          <Text style={styles.signCityDate}>{data.tanggalKota}</Text>
          <View style={styles.signRow}>
            <View style={styles.signColumn}>
              <Text style={styles.signPartyLabel}>PIHAK PERTAMA</Text>
              <Text style={styles.signName}>{data.namaPicTNT || "Safira"}</Text>
              <Text style={styles.signRole}>{data.namaPerusahaan}</Text>
            </View>

            <View style={styles.signColumn}>
              <Text style={styles.signPartyLabel}>PIHAK KEDUA</Text>
              <Text style={styles.signName}>{data.namaKreator || "Content Creator"}</Text>
              <Text style={styles.signRole}>@{cleanUname}</Text>
            </View>
          </View>
        </View>

        {/* FOOTER HALAMAN 3 */}
        <View style={styles.footerContainer} fixed>
          <Text style={styles.footerLeftText}>
            PT TNT Digital Kreatif - Official TikTok Agency Partner
          </Text>
          <Text
            style={styles.footerRightText}
            render={({ pageNumber, totalPages }) => `Halaman ${pageNumber}/${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}
