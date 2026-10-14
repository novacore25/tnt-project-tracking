import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

// Helper konversi angka ke kata bahasa Indonesia
export function terbilangIndo(angka: number): string {
  const bilangan = [
    "", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan", "sepuluh", "sebelas",
  ];

  if (angka < 12) return bilangan[angka];
  if (angka < 20) return terbilangIndo(angka - 10) + " belas";
  if (angka < 100) return terbilangIndo(Math.floor(angka / 10)) + " puluh " + terbilangIndo(angka % 10);
  if (angka < 200) return "seratus " + terbilangIndo(angka - 100);
  if (angka < 1000) return terbilangIndo(Math.floor(angka / 100)) + " ratus " + terbilangIndo(angka % 100);
  if (angka < 2000) return "seribu " + terbilangIndo(angka - 1000);
  if (angka < 1000000) return terbilangIndo(Math.floor(angka / 1000)) + " ribu " + terbilangIndo(angka % 1000);
  if (angka < 1000000000) return terbilangIndo(Math.floor(angka / 1000000)) + " juta " + terbilangIndo(angka % 1000000);
  if (angka < 1000000000000) return terbilangIndo(Math.floor(angka / 1000000000)) + " miliar " + terbilangIndo(angka % 1000000000);
  return angka.toString();
}

// Konfigurasi margin & layout standar kertas A4 (595.28 x 841.89 pt)
const PADDING_HORIZONTAL = 54; // ~1.9 cm
const PADDING_TOP = 38;        // ~1.34 cm
const PADDING_BOTTOM = 42;     // ~1.48 cm

const styles = StyleSheet.create({
  page: {
    paddingTop: PADDING_TOP,
    paddingBottom: PADDING_BOTTOM,
    paddingLeft: PADDING_HORIZONTAL,
    paddingRight: PADDING_HORIZONTAL,
    fontFamily: "Times-Roman",
    fontSize: 10.5,
    color: "#000000",
    lineHeight: 1.38,
  },
  // FOOTER RESMI DI BAGIAN BAWAH SETIAP HALAMAN
  footerContainer: {
    position: "absolute",
    bottom: 22,
    left: PADDING_HORIZONTAL,
    right: PADDING_HORIZONTAL,
    borderTopWidth: 0.5,
    borderTopColor: "#cbd5e1",
    paddingTop: 4,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerLeftText: {
    fontFamily: "Times-Roman",
    fontSize: 8,
    color: "#64748b",
    textAlign: "left",
  },
  footerRightText: {
    fontFamily: "Times-Roman",
    fontSize: 8,
    color: "#64748b",
    textAlign: "right",
  },
  // JUDUL SURAT UTAMA
  titleContainer: {
    textAlign: "center",
    marginBottom: 16,
    alignItems: "center",
  },
  titleMain: {
    fontFamily: "Times-Bold",
    fontSize: 12.5,
    textAlign: "center",
    textTransform: "uppercase",
  },
  titleSub: {
    fontFamily: "Times-Bold",
    fontSize: 12.5,
    textAlign: "center",
    marginTop: 2,
  },
  titleNumber: {
    fontFamily: "Times-Roman",
    fontSize: 10.5,
    textAlign: "center",
    marginTop: 6,
  },
  // PARAGRAF & TEXT
  paragraphJustify: {
    fontFamily: "Times-Roman",
    fontSize: 10.5,
    textAlign: "justify",
    lineHeight: 1.38,
    marginBottom: 8,
  },
  bold: {
    fontFamily: "Times-Bold",
  },
  italic: {
    fontFamily: "Times-Italic",
  },
  // JUDUL PASAL
  pasalHeader: {
    marginTop: 14,
    marginBottom: 8,
    alignItems: "center",
  },
  pasalTitle: {
    fontFamily: "Times-Bold",
    fontSize: 11,
    textAlign: "center",
    textTransform: "uppercase",
  },
  pasalSubTitle: {
    fontFamily: "Times-Bold",
    fontSize: 11,
    textAlign: "center",
    textTransform: "uppercase",
    marginTop: 2,
  },
  // NUMBERED & BULLET LIST ITEMS
  listItem: {
    flexDirection: "row",
    marginBottom: 5,
    lineHeight: 1.38,
  },
  listNumber: {
    width: 20,
    fontFamily: "Times-Roman",
    fontSize: 10.5,
  },
  listText: {
    flex: 1,
    fontFamily: "Times-Roman",
    fontSize: 10.5,
    textAlign: "justify",
  },
  subListItem: {
    flexDirection: "row",
    marginBottom: 4,
    paddingLeft: 20,
    lineHeight: 1.38,
  },
  subListLetter: {
    width: 18,
    fontFamily: "Times-Roman",
    fontSize: 10.5,
  },
  subListText: {
    flex: 1,
    fontFamily: "Times-Roman",
    fontSize: 10.5,
    textAlign: "justify",
  },
  // DATA REKENING DI PASAL 6
  rekeningBlock: {
    marginVertical: 6,
    paddingLeft: 20,
  },
  rekeningRow: {
    flexDirection: "row",
    marginBottom: 3,
  },
  rekeningLabel: {
    width: 120,
    fontFamily: "Times-Roman",
    fontSize: 10.5,
  },
  rekeningColon: {
    width: 12,
    fontFamily: "Times-Roman",
    fontSize: 10.5,
    textAlign: "center",
  },
  rekeningVal: {
    flex: 1,
    fontFamily: "Times-Bold",
    fontSize: 10.5,
  },
  // TANDA TANGAN
  signContainer: {
    marginTop: 24,
    marginBottom: 10,
  },
  signRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  signColumn: {
    width: "45%",
    alignItems: "center",
    textAlign: "center",
  },
  signPartyLabel: {
    fontFamily: "Times-Bold",
    fontSize: 11,
    textAlign: "center",
    marginBottom: 60,
  },
  signName: {
    fontFamily: "Times-Bold",
    fontSize: 11,
    textAlign: "center",
    textDecoration: "underline",
  },
  signRole: {
    fontFamily: "Times-Roman",
    fontSize: 10.5,
    textAlign: "center",
    marginTop: 2,
  },
  // TABEL LAMPIRAN I
  tableContainer: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#000000",
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#f2f2f2",
    borderBottomWidth: 1,
    borderColor: "#000000",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#000000",
  },
  tableRowLast: {
    flexDirection: "row",
  },
  tableColHeader1: {
    width: "38%",
    borderRightWidth: 1,
    borderColor: "#000000",
    padding: 6,
    fontFamily: "Times-Bold",
    fontSize: 10.5,
  },
  tableColHeader2: {
    width: "62%",
    padding: 6,
    fontFamily: "Times-Bold",
    fontSize: 10.5,
  },
  tableCol1: {
    width: "38%",
    borderRightWidth: 1,
    borderColor: "#000000",
    padding: 5,
    paddingHorizontal: 7,
    fontFamily: "Times-Bold",
    fontSize: 10,
  },
  tableCol2: {
    width: "62%",
    padding: 5,
    paddingHorizontal: 7,
    fontFamily: "Times-Roman",
    fontSize: 10,
  },
  // LAMPIRAN HEADER
  lampiranHeaderContainer: {
    marginBottom: 12,
  },
  lampiranTitle: {
    fontFamily: "Times-Bold",
    fontSize: 12,
    textTransform: "uppercase",
  },
  lampiranSectionHeading: {
    fontFamily: "Times-Bold",
    fontSize: 11,
    marginTop: 8,
    marginBottom: 6,
  },
});

export interface CreatorContractData {
  nomorKontrak: string;
  hariPerjanjian?: string; // e.g. "Senin"
  tanggalPerjanjian?: string; // e.g. "14 Oktober 2026"
  hariTanggalPerjanjian?: string; // legacy fallback
  tanggalKota?: string; // e.g. "Tangerang, 14 Oktober 2026"
  tempatPerjanjian?: string; // default "Tangerang"

  // Pihak Pertama (PT TNT KREATIF DIGITAL)
  namaPerusahaan?: string; // default "PT TNT KREATIF DIGITAL"
  alamatPerusahaan?: string; // default "Jalan Kavling Perkebunan Raya, RT 006 / RW 013, Panunggangan Barat, Kecamatan Cibodas, Kota Tangerang, Banten 15139"
  namaDirekturTNT?: string; // default "Stevani"
  jabatanDirekturTNT?: string; // default "Direktur"
  namaPicTNT?: string; // Drafter / PIC name
  jabatanPicTNT?: string;
  teleponPerusahaan?: string;
  emailPerusahaan?: string;

  // Pihak Kedua (Kreator)
  namaKreator: string;
  usernameTikTok: string;
  tiktokUid?: string;
  nikKtp?: string;
  alamatKreator: string;
  teleponKreator: string;
  emailKreator?: string;
  tempatTanggalLahir?: string;
  npwpKreator?: string;

  // Rekening Bank (Pasal 6 & Lampiran I)
  namaBank?: string;
  nomorRekening?: string;
  atasNamaRekening?: string;
  rekeningKreator?: string;

  // Detail Campaign & Deliverables (Lampiran I)
  namaCampaign: string;
  namaBrand: string;
  jenisCampaign?: string; // "Fee" | "Barter" | "Fee dan Barter"
  periodeTayang?: string;
  tanggalMulai?: string;
  tanggalBerakhir?: string;
  biayaHonor: number;
  terbilangHonor?: string;
  feePerVt?: number;
  skemaPembayaran?: string;
  ketentuanPembayaran?: string;

  qtyVt: number;
  qtyPhotoSlide?: number;
  qtyLive?: number;
  durasiKonten?: string;
  durasiKontenTerbilang?: string;
  hashtag?: string;
  jadwalDraft?: string;
  jadwalPosting?: string;
  batasWaktuRevisi?: string;
  jangkaWaktuTayang?: string;
  catatanTambahan?: string;
  customClauses?: string;
}

export function CreatorContractPdfDocument({ data }: { data: CreatorContractData }) {
  const cleanUname = (data.usernameTikTok || "").replace(/^@+/, "");
  const honorNum = Number(data.biayaHonor) || 0;
  const honorFormatted = honorNum.toLocaleString("id-ID");
  const honorTerbilangStr = data.terbilangHonor || (honorNum > 0 ? `${terbilangIndo(honorNum).trim()} rupiah` : "nol rupiah");

  const qtyVtNum = Number(data.qtyVt) || 1;
  const feePerVtNum = data.feePerVt || (qtyVtNum > 0 ? Math.round(honorNum / qtyVtNum) : honorNum);
  const feePerVtFormatted = feePerVtNum.toLocaleString("id-ID");

  const namaDirektur = data.namaDirekturTNT || "Stevani";
  const namaPerusahaan = data.namaPerusahaan || "PT TNT KREATIF DIGITAL";
  const alamatPerusahaan =
    data.alamatPerusahaan ||
    "Jalan Kavling Perkebunan Raya, RT 006 / RW 013, Panunggangan Barat, Kecamatan Cibodas, Kota Tangerang, Banten 15139";
  const kotaPerjanjian = data.tempatPerjanjian || "Tangerang";

  // Tanggal & Hari Perjanjian
  const hariStr = data.hariPerjanjian || "____";
  const tanggalStr = data.tanggalPerjanjian || "____";

  const bankName = data.namaBank || "____________";
  const bankAccount = data.nomorRekening || "____________";
  const bankHolder = data.atasNamaRekening || data.namaKreator || "____________";

  const jenisCampaignStr = data.jenisCampaign || "Fee";
  const durasiKontenStr = data.durasiKonten || "30 - 60";
  const durasiTerbilang = data.durasiKontenTerbilang || "tiga puluh sampai enam puluh";
  const hashtagStr = data.hashtag || (data.namaCampaign ? `#${data.namaCampaign.replace(/\s+/g, "")}` : "____, ____, _____");
  const draftScheduleStr = data.jadwalDraft || "__ ______ ____";
  const postScheduleStr = data.jadwalPosting || "__ ______ ____";
  const revisiStr = data.batasWaktuRevisi || "2 (dua)";
  const tayangStr = data.jangkaWaktuTayang || "60 (enam puluh)";
  const skemaBayarStr =
    data.skemaPembayaran ||
    "H+14 dari selesai Campaign sampai dengan H+21 dari selesai Campaign";
  const periodeCampaignStr =
    data.periodeTayang ||
    (data.tanggalMulai && data.tanggalBerakhir
      ? `${data.tanggalMulai} sampai dengan ${data.tanggalBerakhir}`
      : "________ sampai dengan ________");

  // Reusable footer untuk setiap halaman
  const renderFooter = () => (
    <View style={styles.footerContainer} fixed>
      <Text style={styles.footerLeftText}>
        PT TNT KREATIF DIGITAL — Perjanjian Kerja Sama Join Campaign
      </Text>
      <Text
        style={styles.footerRightText}
        render={({ pageNumber, totalPages }) => `Halaman ${pageNumber} dari ${totalPages}`}
      />
    </View>
  );

  return (
    <Document>
      {/* ========================================================
          HALAMAN 1: JUDUL, NOMOR, IDENTITAS PARA PIHAK, PREAMBLE
      ======================================================== */}
      <Page size="A4" style={styles.page}>
        <View style={styles.titleContainer}>
          <Text style={styles.titleMain}>PERJANJIAN KERJA SAMA JOIN CAMPAIGN</Text>
          <Text style={styles.titleSub}>ANTARA PT TNT KREATIF DIGITAL</Text>
          <Text style={styles.titleSub}>DENGAN</Text>
          <Text style={styles.titleSub}>
            {data.namaKreator ? data.namaKreator.toUpperCase() : "_____________"}
          </Text>
          <Text style={styles.titleNumber}>Nomor: {data.nomorKontrak}</Text>
        </View>

        <Text style={styles.paragraphJustify}>
          Pada hari ini, <Text style={styles.bold}>{hariStr}</Text>, tanggal{" "}
          <Text style={styles.bold}>{tanggalStr}</Text>, bertempat di {kotaPerjanjian}, telah dibuat dan
          ditandatangani Perjanjian Kerja Sama Join Campaign ini (&ldquo;Perjanjian&rdquo;) oleh dan antara:
        </Text>

        {/* PIHAK 1 */}
        <View style={styles.listItem}>
          <Text style={styles.listNumber}>1.</Text>
          <Text style={styles.listText}>
            <Text style={styles.bold}>{namaPerusahaan}</Text>, berkedudukan di {alamatPerusahaan}, dalam hal
            ini diwakili oleh <Text style={styles.bold}>{namaDirektur}</Text> selaku Direktur yang berwenang
            bertindak untuk dan atas nama {namaPerusahaan}, untuk selanjutnya disebut &ldquo;
            <Text style={styles.bold}>TNT</Text>&rdquo;.
          </Text>
        </View>

        {/* PIHAK 2 */}
        <View style={styles.listItem}>
          <Text style={styles.listNumber}>2.</Text>
          <Text style={styles.listText}>
            <Text style={styles.bold}>{data.namaKreator || "_____________"}</Text>, pemegang Kartu Tanda
            Penduduk Nomor <Text style={styles.bold}>{data.nikKtp || "__________________"}</Text>, beralamat
            di {data.alamatKreator || "______________"}, pemilik akun TikTok{" "}
            <Text style={styles.bold}>@{cleanUname || "_______"}</Text>, nomor telepon (WhatsApp){" "}
            <Text style={styles.bold}>{data.teleponKreator || "_____"}</Text> dan email{" "}
            <Text style={styles.bold}>{data.emailKreator || "______"}</Text>, untuk selanjutnya disebut &ldquo;
            <Text style={styles.bold}>KREATOR</Text>&rdquo;.
          </Text>
        </View>

        <Text style={[styles.paragraphJustify, { marginTop: 4 }]}>
          TNT dan KREATOR secara bersama-sama disebut &ldquo;<Text style={styles.bold}>PARA PIHAK</Text>&rdquo;.
        </Text>

        <Text style={[styles.paragraphJustify, { marginTop: 4 }]}>
          PARA PIHAK terlebih dahulu menerangkan hal-hal berikut:
        </Text>

        <View style={styles.subListItem}>
          <Text style={styles.subListLetter}>a.</Text>
          <Text style={styles.subListText}>
            TNT merupakan agensi TikTok Go yang menjalankan Campaign pemasaran melalui Konten KREATOR untuk
            Brand.
          </Text>
        </View>
        <View style={styles.subListItem}>
          <Text style={styles.subListLetter}>b.</Text>
          <Text style={styles.subListText}>
            TNT menerima penugasan dari Brand untuk menjalankan Campaign yang diuraikan dalam Lampiran I.
          </Text>
        </View>
        <View style={styles.subListItem}>
          <Text style={styles.subListLetter}>c.</Text>
          <Text style={styles.subListText}>
            KREATOR menyatakan bersedia mengikuti Campaign tersebut setelah menerima dan memahami Brief.
          </Text>
        </View>

        <Text style={[styles.paragraphJustify, { marginTop: 6 }]}>
          Berdasarkan hal-hal tersebut, PARA PIHAK sepakat menuangkan kerja sama ini ke dalam Perjanjian dengan
          syarat dan ketentuan sebagai berikut:
        </Text>

        {renderFooter()}
      </Page>

      {/* ========================================================
          HALAMAN 2: PASAL 1 (DEFINISI) & PASAL 2 (RUANG LINGKUP)
      ======================================================== */}
      <Page size="A4" style={styles.page}>
        <View style={styles.pasalHeader}>
          <Text style={styles.pasalTitle}>PASAL 1</Text>
          <Text style={styles.pasalSubTitle}>DEFINISI</Text>
        </View>

        <View style={styles.listItem}>
          <Text style={styles.listNumber}>1.</Text>
          <Text style={styles.listText}>
            <Text style={styles.bold}>Brand</Text> adalah pemilik produk atau jasa yang dipromosikan dalam
            Campaign, yang namanya tercantum dalam Lampiran I. Brand bukan pihak dalam Perjanjian ini; TNT
            bertindak atas penugasan Brand dan hak Brand dalam Perjanjian ini dijalankan melalui TNT.
          </Text>
        </View>

        <View style={styles.listItem}>
          <Text style={styles.listNumber}>2.</Text>
          <Text style={styles.listText}>
            <Text style={styles.bold}>Campaign</Text> adalah kegiatan promosi produk atau jasa Brand melalui
            Konten yang dibuat KREATOR, sebagaimana diatur dalam Lampiran I.
          </Text>
        </View>

        <View style={styles.listItem}>
          <Text style={styles.listNumber}>3.</Text>
          <Text style={styles.listText}>
            <Text style={styles.bold}>Brief</Text> adalah arahan tertulis dari TNT atau Brand mengenai
            pelaksanaan Campaign, termasuk perubahannya yang disampaikan secara tertulis.
          </Text>
        </View>

        <View style={styles.listItem}>
          <Text style={styles.listNumber}>4.</Text>
          <Text style={styles.listText}>
            <Text style={styles.bold}>Deliverable</Text> adalah Konten yang wajib dibuat dan diunggah KREATOR,
            baik berupa video (VT), photo slide, siaran langsung (live), maupun format lain yang disepakati.
          </Text>
        </View>

        <View style={styles.listItem}>
          <Text style={styles.listNumber}>5.</Text>
          <Text style={styles.listText}>
            <Text style={styles.bold}>Konten</Text> adalah seluruh hasil karya KREATOR untuk Campaign.
          </Text>
        </View>

        <View style={styles.listItem}>
          <Text style={styles.listNumber}>6.</Text>
          <Text style={styles.listText}>
            <Text style={styles.bold}>Fee</Text> adalah imbalan berupa uang.
          </Text>
        </View>

        <View style={styles.listItem}>
          <Text style={styles.listNumber}>7.</Text>
          <Text style={styles.listText}>
            <Text style={styles.bold}>Hari</Text> adalah hari kalender.
          </Text>
        </View>

        <View style={styles.listItem}>
          <Text style={styles.listNumber}>8.</Text>
          <Text style={styles.listText}>
            <Text style={styles.bold}>Hari Kerja</Text> adalah hari Senin sampai Jumat selain hari libur
            nasional.
          </Text>
        </View>

        <View style={styles.pasalHeader}>
          <Text style={styles.pasalTitle}>PASAL 2</Text>
          <Text style={styles.pasalSubTitle}>RUANG LINGKUP DAN STATUS KREATOR</Text>
        </View>

        <View style={styles.listItem}>
          <Text style={styles.listNumber}>1.</Text>
          <Text style={styles.listText}>
            Perjanjian ini menjadi dasar bagi satu atau lebih Campaign, yang mana setiap Campaign dituangkan dalam
            Lampiran I tersendiri yang disetujui PARA PIHAK secara tertulis, termasuk melalui pesan pada saluran
            komunikasi resmi, tanpa perlu perjanjian baru.
          </Text>
        </View>

        <View style={styles.listItem}>
          <Text style={styles.listNumber}>2.</Text>
          <Text style={styles.listText}>
            PARA PIHAK sepakat bahwa komunikasi dan pemberitahuan dalam Perjanjian ini dilakukan melalui
            WhatsApp pada nomor yang tercantum dalam Perjanjian ini dan dianggap diterima pada saat pesan
            terkirim.
          </Text>
        </View>

        <View style={styles.listItem}>
          <Text style={styles.listNumber}>3.</Text>
          <Text style={styles.listText}>
            Apabila terdapat perbedaan mengenai pelaksanaan suatu Campaign, Perjanjian ini yang berlaku untuk
            Campaign yang bersangkutan.
          </Text>
        </View>

        {renderFooter()}
      </Page>

      {/* ========================================================
          HALAMAN 3: PASAL 3 (BRIEF & KEWAJIBAN) & PASAL 4 (TIMELINE)
      ======================================================== */}
      <Page size="A4" style={styles.page}>
        <View style={styles.pasalHeader}>
          <Text style={styles.pasalTitle}>PASAL 3</Text>
          <Text style={styles.pasalSubTitle}>BRIEF, DELIVERABLE, DAN KEWAJIBAN PARA PIHAK</Text>
        </View>

        <View style={styles.listItem}>
          <Text style={styles.listNumber}>1.</Text>
          <Text style={styles.listText}>
            TNT menyampaikan Brief secara terperinci kepada KREATOR pada hari pelaksanaan Campaign dan
            mengirimkan sampel produk ke alamat KREATOR.
          </Text>
        </View>

        <View style={styles.listItem}>
          <Text style={styles.listNumber}>2.</Text>
          <Text style={styles.listText}>
            Brief dapat berubah sewaktu-waktu sesuai permintaan Brand, termasuk penambahan Deliverable secara
            material, jumlah VT, durasi Konten, hashtag, dan jadwal visit.
          </Text>
        </View>

        <View style={styles.listItem}>
          <Text style={styles.listNumber}>3.</Text>
          <Text style={styles.listText}>
            Jadwal visit dapat berubah menyesuaikan jadwal Brand, yang mana perubahan jadwal oleh KREATOR diajukan
            secara tertulis paling lambat 3 (tiga) Hari Kerja sebelum jadwal visit dan berlaku setelah disetujui
            TNT.
          </Text>
        </View>

        <View style={styles.listItem}>
          <Text style={styles.listNumber}>4.</Text>
          <Text style={styles.listText}>
            KREATOR wajib menggunakan script dan hashtag dari TNT, mengirim draft sebelum mengunggah, mengunggah
            seluruh Deliverable sesuai jadwal, serta bersedia merevisi Konten yang tidak sesuai Brief.
          </Text>
        </View>

        <View style={styles.listItem}>
          <Text style={styles.listNumber}>5.</Text>
          <Text style={styles.listText}>
            Seluruh Konten wajib tetap tayang di akun KREATOR.
          </Text>
        </View>

        <View style={styles.listItem}>
          <Text style={styles.listNumber}>6.</Text>
          <Text style={styles.listText}>
            TNT wajib membayar Fee sesuai waktu dan ketentuan dalam Pasal 6.
          </Text>
        </View>

        <View style={styles.pasalHeader}>
          <Text style={styles.pasalTitle}>PASAL 4</Text>
          <Text style={styles.pasalSubTitle}>TIMELINE DAN KETERLAMBATAN</Text>
        </View>

        <View style={styles.listItem}>
          <Text style={styles.listNumber}>1.</Text>
          <Text style={styles.listText}>
            Jadwal pengiriman draft, pemberian feedback, revisi, dan posting ditetapkan dalam Lampiran I.
          </Text>
        </View>

        <View style={styles.listItem}>
          <Text style={styles.listNumber}>2.</Text>
          <Text style={styles.listText}>
            KREATOR wajib mengirim draft dan mengunggah Konten sesuai jadwal tersebut. Apabila berhalangan,
            KREATOR wajib memberitahu TNT secara tertulis sebelum batas waktu terlewati, disertai alasan dan
            usulan jadwal baru.
          </Text>
        </View>

        <View style={styles.listItem}>
          <Text style={styles.listNumber}>3.</Text>
          <Text style={styles.listText}>
            Apabila KREATOR terlambat mengirim draft atau mengunggah tanpa pemberitahuan terlebih dahulu, TNT
            dapat memberikan tambahan waktu paling lama 2 (dua) Hari Kerja dengan tetap berlaku Pasal 13.
          </Text>
        </View>

        <View style={styles.listItem}>
          <Text style={styles.listNumber}>4.</Text>
          <Text style={styles.listText}>
            Apabila sampai tambahan waktu berakhir KREATOR belum mengirim draft atau mengunggah, Deliverable
            tersebut dianggap tidak terpenuhi dan berlaku Pasal 8 serta Pasal 13.
          </Text>
        </View>

        {renderFooter()}
      </Page>

      {/* ========================================================
          HALAMAN 4: PASAL 5 (KONTROL KONTEN) & PASAL 6 (PEMBAYARAN)
      ======================================================== */}
      <Page size="A4" style={styles.page}>
        <View style={styles.pasalHeader}>
          <Text style={styles.pasalTitle}>PASAL 5</Text>
          <Text style={styles.pasalSubTitle}>KONTROL KONTEN</Text>
        </View>

        <View style={styles.listItem}>
          <Text style={styles.listNumber}>1.</Text>
          <Text style={styles.listText}>
            Seluruh Konten wajib dikirim dalam bentuk draft kepada TNT untuk ditinjau sebelum diunggah. Apabila
            Lampiran I mensyaratkan persetujuan Brand, Konten hanya boleh diunggah setelah TNT menyampaikan
            persetujuan Brand secara tertulis.
          </Text>
        </View>

        <View style={styles.listItem}>
          <Text style={styles.listNumber}>2.</Text>
          <Text style={styles.listText}>
            TNT memberikan feedback paling lambat dalam batas waktu pada Lampiran I sejak draft diterima, dan
            KREATOR menyelesaikan revisi paling lambat dalam batas waktu pada Lampiran I sejak feedback diterima.
          </Text>
        </View>

        <View style={styles.listItem}>
          <Text style={styles.listNumber}>3.</Text>
          <Text style={styles.listText}>
            Jumlah revisi tanpa tambahan biaya ditetapkan dalam Lampiran I, yang mana revisi atas Konten yang tidak
            sesuai Brief, memuat klaim yang tidak sesuai materi resmi, atau melanggar ketentuan Perjanjian ini
            tidak dihitung dalam jumlah tersebut.
          </Text>
        </View>

        <View style={styles.listItem}>
          <Text style={styles.listNumber}>4.</Text>
          <Text style={styles.listText}>
            Apabila Konten ditolak setelah seluruh revisi karena tidak sesuai Brief, Deliverable dianggap belum
            terpenuhi.
          </Text>
        </View>

        <View style={styles.listItem}>
          <Text style={styles.listNumber}>5.</Text>
          <Text style={styles.listText}>
            KREATOR tidak boleh mengunggah Konten yang belum disetujui.
          </Text>
        </View>

        <View style={styles.listItem}>
          <Text style={styles.listNumber}>6.</Text>
          <Text style={styles.listText}>
            KREATOR wajib mengunggah seluruh Deliverable yang telah disetujui sesuai jadwal dan wajib melakukan
            revisi apabila Konten tidak sesuai Brief, termasuk hashtag dan caption, sesuai jumlah revisi pada
            Lampiran I.
          </Text>
        </View>

        <View style={styles.pasalHeader}>
          <Text style={styles.pasalTitle}>PASAL 6</Text>
          <Text style={styles.pasalSubTitle}>PEMBAYARAN</Text>
        </View>

        <View style={styles.listItem}>
          <Text style={styles.listNumber}>1.</Text>
          <Text style={styles.listText}>
            Pembayaran dilakukan pada H+14 setelah Campaign selesai dan paling lambat H+21 sejak Campaign
            selesai, dengan syarat seluruh Deliverable telah diunggah dan disetujui, serta data pembayaran dan
            laporan insight (jika diwajibkan) telah diterima TNT.
          </Text>
        </View>

        <View style={styles.listItem}>
          <Text style={styles.listNumber}>2.</Text>
          <Text style={styles.listText}>
            Pembayaran ditransfer ke rekening atas nama KREATOR sebagai berikut:
          </Text>
        </View>

        <View style={styles.rekeningBlock}>
          <View style={styles.rekeningRow}>
            <Text style={styles.rekeningLabel}>Nama</Text>
            <Text style={styles.rekeningColon}>:</Text>
            <Text style={styles.rekeningVal}>{bankHolder}</Text>
          </View>
          <View style={styles.rekeningRow}>
            <Text style={styles.rekeningLabel}>Bank</Text>
            <Text style={styles.rekeningColon}>:</Text>
            <Text style={styles.rekeningVal}>{bankName}</Text>
          </View>
          <View style={styles.rekeningRow}>
            <Text style={styles.rekeningLabel}>Nomor Rekening</Text>
            <Text style={styles.rekeningColon}>:</Text>
            <Text style={styles.rekeningVal}>{bankAccount}</Text>
          </View>
        </View>

        {renderFooter()}
      </Page>

      {/* ========================================================
          HALAMAN 5: PASAL 7 (JAMINAN) & PASAL 8 (WANPRESTASI AYAT 1-3)
      ======================================================== */}
      <Page size="A4" style={styles.page}>
        <View style={styles.pasalHeader}>
          <Text style={styles.pasalTitle}>PASAL 7</Text>
          <Text style={styles.pasalSubTitle}>JAMINAN KREATOR</Text>
        </View>

        <View style={styles.listItem}>
          <Text style={styles.listNumber}>1.</Text>
          <Text style={styles.listText}>KREATOR menjamin bahwa:</Text>
        </View>

        <View style={styles.subListItem}>
          <Text style={styles.subListLetter}>a.</Text>
          <Text style={styles.subListText}>
            Konten adalah karya orisinal KREATOR dan tidak melanggar hak cipta, merek, hak atas gambar, atau hak
            pihak ketiga lainnya, dan setiap orang yang tampil dalam Konten telah memberikan persetujuan;
          </Text>
        </View>
        <View style={styles.subListItem}>
          <Text style={styles.subListLetter}>b.</Text>
          <Text style={styles.subListText}>
            KREATOR segera memberitahu TNT apabila akun dibatasi atau ditangguhkan; dan
          </Text>
        </View>
        <View style={styles.subListItem}>
          <Text style={styles.subListLetter}>c.</Text>
          <Text style={styles.subListText}>
            KREATOR cakap melakukan perbuatan hukum dan berwenang menandatangani Perjanjian ini.
          </Text>
        </View>

        <View style={[styles.listItem, { marginTop: 4 }]}>
          <Text style={styles.listNumber}>2.</Text>
          <Text style={styles.listText}>
            Apabila jaminan tersebut tidak benar, TNT berhak menghentikan keikutsertaan KREATOR dalam Campaign dan
            menerapkan Pasal 8 serta Pasal 13.
          </Text>
        </View>

        <View style={styles.pasalHeader}>
          <Text style={styles.pasalTitle}>PASAL 8</Text>
          <Text style={styles.pasalSubTitle}>PEMBATALAN DAN WANPRESTASI</Text>
        </View>

        <View style={styles.listItem}>
          <Text style={styles.listNumber}>1.</Text>
          <Text style={styles.listText}>KREATOR dinyatakan wanprestasi apabila:</Text>
        </View>

        <View style={styles.subListItem}>
          <Text style={styles.subListLetter}>a.</Text>
          <Text style={styles.subListText}>
            Membatalkan keikutsertaan secara sepihak tanpa alasan yang dapat dipertanggungjawabkan;
          </Text>
        </View>
        <View style={styles.subListItem}>
          <Text style={styles.subListLetter}>b.</Text>
          <Text style={styles.subListText}>
            Tidak mengirim draft atau mengunggah sampai batas waktu yang ditentukan;
          </Text>
        </View>
        <View style={styles.subListItem}>
          <Text style={styles.subListLetter}>c.</Text>
          <Text style={styles.subListText}>
            Konten tetap tidak sesuai brief setelah seluruh revisi;
          </Text>
        </View>
        <View style={styles.subListItem}>
          <Text style={styles.subListLetter}>d.</Text>
          <Text style={styles.subListText}>
            Mengunggah konten tanpa persetujuan atau menghapus konten tanpa persetujuan;
          </Text>
        </View>
        <View style={styles.subListItem}>
          <Text style={styles.subListLetter}>e.</Text>
          <Text style={styles.subListText}>
            Melanggar ketentuan lain dalam perjanjian ini, termasuk melakukan kecurangan berupa penggunaan boost
            atau ads selain dari TNT; atau
          </Text>
        </View>
        <View style={styles.subListItem}>
          <Text style={styles.subListLetter}>f.</Text>
          <Text style={styles.subListText}>
            Tidak menanggapi komunikasi TNT selama 14 (empat belas) hari kerja berturut-turut saat campaign
            berlangsung.
          </Text>
        </View>

        <View style={[styles.listItem, { marginTop: 4 }]}>
          <Text style={styles.listNumber}>2.</Text>
          <Text style={styles.listText}>Akibat wanprestasi KREATOR:</Text>
        </View>
        <View style={styles.subListItem}>
          <Text style={styles.subListLetter}>a.</Text>
          <Text style={styles.subListText}>
            berlaku ketentuan pengurangan Fee sebagaimana Pasal 13; dan
          </Text>
        </View>
        <View style={styles.subListItem}>
          <Text style={styles.subListLetter}>b.</Text>
          <Text style={styles.subListText}>
            TNT dapat membatalkan Perjanjian dan/atau tidak mengikutsertakan KREATOR pada batch Campaign berikutnya
            sampai kewajibannya dipenuhi.
          </Text>
        </View>

        <View style={[styles.listItem, { marginTop: 4 }]}>
          <Text style={styles.listNumber}>3.</Text>
          <Text style={styles.listText}>
            TNT dapat menuntut ganti rugi atas kerugian nyata yang dapat dibuktikan akibat wanprestasi KREATOR.
          </Text>
        </View>

        {renderFooter()}
      </Page>

      {/* ========================================================
          HALAMAN 6: PASAL 8 (AYAT 4-5), PASAL 9 & PASAL 10 (AYAT 1-3 AWAL)
      ======================================================== */}
      <Page size="A4" style={styles.page}>
        <View style={styles.listItem}>
          <Text style={styles.listNumber}>4.</Text>
          <Text style={styles.listText}>
            Apabila TNT terlambat membayar Fee dan tidak membayarnya dalam 14 (empat belas) Hari sejak teguran
            tertulis dari KREATOR, TNT dinyatakan wanprestasi dan KREATOR berhak menagih Fee yang terutang.
          </Text>
        </View>

        <View style={styles.listItem}>
          <Text style={styles.listNumber}>5.</Text>
          <Text style={styles.listText}>
            Wanprestasi dinyatakan setelah teguran tertulis dengan waktu perbaikan 3 (tiga) Hari Kerja, kecuali
            untuk pelanggaran yang tidak dapat diperbaiki, termasuk pelanggaran Pasal 10 ayat 2 dan ayat 3.
          </Text>
        </View>

        <View style={styles.pasalHeader}>
          <Text style={styles.pasalTitle}>PASAL 9</Text>
          <Text style={styles.pasalSubTitle}>TAKEDOWN KONTEN</Text>
        </View>

        <View style={styles.listItem}>
          <Text style={styles.listNumber}>1.</Text>
          <Text style={styles.listText}>
            KREATOR dilarang menghapus, mengarsipkan, atau menyembunyikan Konten.
          </Text>
        </View>

        <View style={styles.listItem}>
          <Text style={styles.listNumber}>2.</Text>
          <Text style={styles.listText}>
            TNT atau Brand dapat meminta takedown secara tertulis apabila Konten melanggar hukum, memuat informasi
            produk yang keliru, atau melanggar hak pihak ketiga.
          </Text>
        </View>

        <View style={styles.listItem}>
          <Text style={styles.listNumber}>3.</Text>
          <Text style={styles.listText}>
            KREATOR wajib melaksanakan permintaan takedown sebagaimana ayat 2 Pasal ini paling lambat 6 (enam) jam
            sejak permintaan diterima dan mengirimkan bukti tangkapan layar.
          </Text>
        </View>

        <View style={styles.listItem}>
          <Text style={styles.listNumber}>4.</Text>
          <Text style={styles.listText}>
            Takedown atas permintaan TNT atau Brand yang bukan karena kesalahan KREATOR tidak mengurangi Fee.
          </Text>
        </View>

        <View style={styles.listItem}>
          <Text style={styles.listNumber}>5.</Text>
          <Text style={styles.listText}>
            Takedown tanpa persetujuan atau tidak dilaksanakannya permintaan takedown tepat waktu berlaku ketentuan
            Pasal 13.
          </Text>
        </View>

        <View style={styles.pasalHeader}>
          <Text style={styles.pasalTitle}>PASAL 10</Text>
          <Text style={styles.pasalSubTitle}>KERAHASIAAN DAN ETIKA BERKOMUNIKASI</Text>
        </View>

        <View style={styles.listItem}>
          <Text style={styles.listNumber}>1.</Text>
          <Text style={styles.listText}>
            PARA PIHAK wajib menjaga kerahasiaan Brief, nilai Fee, materi Brand yang belum dipublikasikan, dan isi
            Perjanjian ini, kecuali diwajibkan oleh aparat penegak hukum.
          </Text>
        </View>

        <View style={styles.listItem}>
          <Text style={styles.listNumber}>2.</Text>
          <Text style={styles.listText}>
            KREATOR dilarang mengungkapkan, menyebarluaskan, atau memberikan informasi apa pun mengenai TNT dan
            karyawan TNT, termasuk informasi internal, data, dokumen, maupun hal lain yang berkaitan dengan
            kegiatan operasional TNT, kepada pihak mana pun tanpa persetujuan tertulis terlebih dahulu dari TNT.
          </Text>
        </View>

        <View style={styles.listItem}>
          <Text style={styles.listNumber}>3.</Text>
          <Text style={styles.listText}>
            KREATOR dilarang menyebarkan data pribadi karyawan, pengurus, atau pihak lain yang berhubungan dengan
            TNT (<Text style={styles.italic}>doxing</Text>), serta dilarang membuat, mengunggah, atau
            menyebarkan pernyataan, konten, komentar, maupun sindiran, termasuk melalui akun lain atau akun anonim
            dan termasuk tanpa menyebut nama secara langsung,
          </Text>
        </View>

        {renderFooter()}
      </Page>

      {/* ========================================================
          HALAMAN 7: PASAL 10 (LANJUTAN AYAT 3), PASAL 11 & PASAL 12 (AYAT 1-4)
      ======================================================== */}
      <Page size="A4" style={styles.page}>
        <Text style={[styles.paragraphJustify, { marginTop: 4 }]}>
          yang merendahkan, mencemarkan nama baik, atau merugikan reputasi TNT, karyawan TNT, atau Brand, baik
          selama maupun setelah berakhirnya Perjanjian; pelanggaran atas ketentuan ini merupakan wanprestasi
          berat yang tidak memerlukan teguran dan masa perbaikan, sehingga TNT berhak mengakhiri Perjanjian
          seketika, mengurangi hingga menghanguskan seluruh Fee yang belum dibayarkan berdasarkan Pasal 13,
          menuntut ganti rugi, serta menempuh upaya hukum perdata dan/atau pidana sesuai peraturan
          perundang-undangan, antara lain Undang-Undang tentang Pelindungan Data Pribadi dan Undang-Undang
          tentang Informasi dan Transaksi Elektronik.
        </Text>

        <View style={styles.pasalHeader}>
          <Text style={styles.pasalTitle}>PASAL 11</Text>
          <Text style={styles.pasalSubTitle}>
            KEADAAN MEMAKSA (<Text style={styles.italic}>FORCE MAJEURE</Text>)
          </Text>
        </View>

        <View style={styles.listItem}>
          <Text style={styles.listNumber}>1.</Text>
          <Text style={styles.listText}>
            Keadaan memaksa adalah peristiwa di luar kendali PARA PIHAK yang menghalangi pelaksanaan kewajiban,
            seperti bencana alam, kebakaran, perang, kerusuhan, wabah, kebijakan pemerintah, atau pemblokiran dan
            gangguan besar pada platform TikTok.
          </Text>
        </View>

        <View style={styles.listItem}>
          <Text style={styles.listNumber}>2.</Text>
          <Text style={styles.listText}>
            Pihak yang terkena wajib memberitahu pihak lainnya secara tertulis dalam 3 (tiga) Hari Kerja disertai
            bukti, dan jadwal pelaksanaan disesuaikan selama keadaan tersebut berlangsung.
          </Text>
        </View>

        <View style={styles.listItem}>
          <Text style={styles.listNumber}>3.</Text>
          <Text style={styles.listText}>
            Apabila keadaan memaksa berlangsung lebih dari 30 (tiga puluh) Hari, PARA PIHAK bermusyawarah.
          </Text>
        </View>

        <View style={styles.pasalHeader}>
          <Text style={styles.pasalTitle}>PASAL 12</Text>
          <Text style={styles.pasalSubTitle}>PENYELESAIAN PERSELISIHAN DAN KETENTUAN LAIN</Text>
        </View>

        <View style={styles.listItem}>
          <Text style={styles.listNumber}>1.</Text>
          <Text style={styles.listText}>
            Perselisihan diselesaikan melalui musyawarah selama 30 (tiga puluh) Hari sejak pemberitahuan tertulis.
            Apabila tidak tercapai kesepakatan, perselisihan diselesaikan melalui Pengadilan Negeri Tangerang.
          </Text>
        </View>

        <View style={styles.listItem}>
          <Text style={styles.listNumber}>2.</Text>
          <Text style={styles.listText}>
            Perubahan Perjanjian sah apabila dibuat tertulis dan disetujui PARA PIHAK.
          </Text>
        </View>

        <View style={styles.listItem}>
          <Text style={styles.listNumber}>3.</Text>
          <Text style={styles.listText}>
            Lampiran I dan Lampiran II merupakan bagian yang tidak terpisahkan dari Perjanjian ini.
          </Text>
        </View>

        <View style={styles.listItem}>
          <Text style={styles.listNumber}>4.</Text>
          <Text style={styles.listText}>
            Perjanjian dibuat dalam dua rangkap atau dalam bentuk dokumen elektronik dengan kekuatan hukum yang
            sama.
          </Text>
        </View>

        {renderFooter()}
      </Page>

      {/* ========================================================
          HALAMAN 8: PASAL 12 (AYAT 5-7), PASAL 13, PENUTUP & TANDA TANGAN
      ======================================================== */}
      <Page size="A4" style={styles.page}>
        <View style={styles.listItem}>
          <Text style={styles.listNumber}>5.</Text>
          <Text style={styles.listText}>
            KREATOR menyatakan telah membaca dan memahami seluruh isi Perjanjian dan menandatanganinya atas
            kehendak sendiri tanpa paksaan.
          </Text>
        </View>

        <View style={styles.listItem}>
          <Text style={styles.listNumber}>6.</Text>
          <Text style={styles.listText}>
            KREATOR wajib mengikuti Brief dan ketentuan Do and Don&rsquo;t dalam Lampiran II, serta tidak mengubah
            konsep Brief, Deliverable, atau informasi produk.
          </Text>
        </View>

        <View style={styles.listItem}>
          <Text style={styles.listNumber}>7.</Text>
          <Text style={styles.listText}>
            KREATOR wajib hadir pada visit sesuai jadwal.
          </Text>
        </View>

        <View style={styles.pasalHeader}>
          <Text style={styles.pasalTitle}>PASAL 13</Text>
          <Text style={styles.pasalSubTitle}>PENGURANGAN FEE</Text>
        </View>

        <View style={styles.listItem}>
          <Text style={styles.listNumber}>1.</Text>
          <Text style={styles.listText}>
            Apabila KREATOR tidak memenuhi ketentuan Perjanjian ini, termasuk Brief, Lampiran I, dan Lampiran II,
            TNT berhak mengurangi Fee Campaign terkait hingga seluruhnya.
          </Text>
        </View>

        <View style={styles.listItem}>
          <Text style={styles.listNumber}>2.</Text>
          <Text style={styles.listText}>
            Besarnya pengurangan ditetapkan TNT secara proporsional dengan tingkat pelanggaran serta dampaknya
            terhadap Campaign dan Brand, dan diberitahukan secara tertulis kepada KREATOR beserta alasannya sebelum
            pembayaran dilakukan. Keterlambatan yang masih dalam tambahan waktu sebagaimana Pasal 4 ayat 3 dapat
            dikenai pengurangan sampai dengan 50% (lima puluh persen) dari Fee Deliverable terkait.
          </Text>
        </View>

        <View style={styles.listItem}>
          <Text style={styles.listNumber}>3.</Text>
          <Text style={styles.listText}>
            Pengurangan Fee tidak menghapus hak TNT menuntut ganti rugi sebagaimana Pasal 8 ayat 3 dan tidak
            berlaku apabila tidak terpenuhinya kewajiban disebabkan oleh keadaan memaksa atau bukan karena
            kesalahan KREATOR.
          </Text>
        </View>

        <Text style={[styles.paragraphJustify, { marginTop: 12 }]}>
          Demikian Perjanjian ini disepakati dan ditandatangani oleh PARA PIHAK pada tanggal sebagaimana disebut
          di awal Perjanjian.
        </Text>

        {/* TANDA TANGAN SECTION */}
        <View style={styles.signContainer}>
          <View style={styles.signRow}>
            <View style={styles.signColumn}>
              <Text style={styles.signPartyLabel}>{namaPerusahaan}</Text>
              <Text style={styles.signName}>{namaDirektur}</Text>
              <Text style={styles.signRole}>{data.jabatanDirekturTNT || "Direktur"}</Text>
            </View>

            <View style={styles.signColumn}>
              <Text style={styles.signPartyLabel}>KREATOR</Text>
              <Text style={styles.signName}>{data.namaKreator || "___________"}</Text>
              <Text style={styles.signRole}>Kreator</Text>
            </View>
          </View>
        </View>

        {renderFooter()}
      </Page>

      {/* ========================================================
          HALAMAN 9: LAMPIRAN I (KETENTUAN CAMPAIGN & DELIVERABLES)
      ======================================================== */}
      <Page size="A4" style={styles.page}>
        <View style={styles.lampiranHeaderContainer}>
          <Text style={styles.lampiranTitle}>LAMPIRAN I</Text>
        </View>

        <View style={styles.tableContainer}>
          {/* Header Tabel */}
          <View style={styles.tableHeaderRow}>
            <Text style={styles.tableColHeader1}>Ketentuan</Text>
            <Text style={styles.tableColHeader2}>Isi</Text>
          </View>

          {/* Baris 1: Brand */}
          <View style={styles.tableRow}>
            <Text style={styles.tableCol1}>Brand</Text>
            <Text style={styles.tableCol2}>{data.namaBrand || "-"}</Text>
          </View>

          {/* Baris 2: Jenis Campaign */}
          <View style={styles.tableRow}>
            <Text style={styles.tableCol1}>Jenis Campaign</Text>
            <Text style={styles.tableCol2}>{jenisCampaignStr}</Text>
          </View>

          {/* Baris 3: Periode Campaign */}
          <View style={styles.tableRow}>
            <Text style={styles.tableCol1}>
              Periode Campaign s/d tanggal selesai Campaign
            </Text>
            <Text style={styles.tableCol2}>{periodeCampaignStr}</Text>
          </View>

          {/* Baris 4: Fee Campaign */}
          <View style={styles.tableRow}>
            <Text style={styles.tableCol1}>Fee Campaign / nilai per Deliverable</Text>
            <Text style={styles.tableCol2}>
              Rp {honorFormatted} ({honorTerbilangStr}) atau Rp {feePerVtFormatted} per Deliverable
            </Text>
          </View>

          {/* Baris 5: Skema Pembayaran */}
          <View style={styles.tableRow}>
            <Text style={styles.tableCol1}>Skema pembayaran</Text>
            <Text style={styles.tableCol2}>{skemaBayarStr}</Text>
          </View>

          {/* Baris 6: Jumlah dan jenis Deliverable */}
          <View style={styles.tableRow}>
            <Text style={styles.tableCol1}>Jumlah dan jenis Deliverable</Text>
            <Text style={styles.tableCol2}>
              {qtyVtNum} video
              {data.qtyPhotoSlide ? `, ${data.qtyPhotoSlide} photo slide` : ""}
              {data.qtyLive ? `, ${data.qtyLive} live` : ""}
            </Text>
          </View>

          {/* Baris 7: Jumlah VT yang harus diunggah */}
          <View style={styles.tableRow}>
            <Text style={styles.tableCol1}>Jumlah VT yang harus diunggah</Text>
            <Text style={styles.tableCol2}>
              {qtyVtNum} ({terbilangIndo(qtyVtNum)}) VT
            </Text>
          </View>

          {/* Baris 8: Durasi Konten */}
          <View style={styles.tableRow}>
            <Text style={styles.tableCol1}>Durasi Konten</Text>
            <Text style={styles.tableCol2}>
              {durasiKontenStr} ({durasiTerbilang}) detik
            </Text>
          </View>

          {/* Baris 9: Hashtag */}
          <View style={styles.tableRow}>
            <Text style={styles.tableCol1}>Hashtag</Text>
            <Text style={styles.tableCol2}>{hashtagStr}</Text>
          </View>

          {/* Baris 10: Jadwal draft dan posting */}
          <View style={styles.tableRow}>
            <Text style={styles.tableCol1}>Jadwal draft dan jadwal posting</Text>
            <Text style={styles.tableCol2}>
              Draft: {draftScheduleStr}; posting: {postScheduleStr}
            </Text>
          </View>

          {/* Baris 11: Jumlah dan batas waktu revisi */}
          <View style={styles.tableRow}>
            <Text style={styles.tableCol1}>Jumlah dan batas waktu revisi KREATOR</Text>
            <Text style={styles.tableCol2}>
              Maksimal 2 (dua) kali; {revisiStr} Hari sejak feedback diterima
            </Text>
          </View>

          {/* Baris 12: Jangka waktu tayang */}
          <View style={styles.tableRow}>
            <Text style={styles.tableCol1}>Jangka waktu tayang Konten</Text>
            <Text style={styles.tableCol2}>{tayangStr} Hari sejak diunggah</Text>
          </View>

          {/* Baris 13: Catatan tambahan */}
          <View style={styles.tableRowLast}>
            <Text style={styles.tableCol1}>Catatan tambahan</Text>
            <Text style={styles.tableCol2}>
              {data.catatanTambahan || data.customClauses || "-"}
            </Text>
          </View>
        </View>

        {renderFooter()}
      </Page>

      {/* ========================================================
          HALAMAN 10: LAMPIRAN II (DO AND DON'T KREATOR CAMPAIGN)
      ======================================================== */}
      <Page size="A4" style={styles.page}>
        <View style={styles.lampiranHeaderContainer}>
          <Text style={styles.lampiranTitle}>
            LAMPIRAN II — DO AND DON’T KREATOR CAMPAIGN
          </Text>
        </View>

        <Text style={styles.lampiranSectionHeading}>Do</Text>

        <View style={styles.listItem}>
          <Text style={styles.listNumber}>1.</Text>
          <Text style={styles.listText}>
            Membaca dan memahami Brief Campaign sebelum menyatakan kesediaan mengikuti Campaign.
          </Text>
        </View>
        <View style={styles.listItem}>
          <Text style={styles.listNumber}>2.</Text>
          <Text style={styles.listText}>
            Mengikuti seluruh Deliverable yang telah disepakati, termasuk jumlah video, photo slide atau live,
            durasi, hashtag, dan call to action.
          </Text>
        </View>
        <View style={styles.listItem}>
          <Text style={styles.listNumber}>3.</Text>
          <Text style={styles.listText}>
            Melakukan visit sesuai jadwal yang telah ditentukan.
          </Text>
        </View>
        <View style={styles.listItem}>
          <Text style={styles.listNumber}>4.</Text>
          <Text style={styles.listText}>
            Mengirimkan draft sesuai timeline dan melakukan revisi sesuai arahan TNT atau Brand.
          </Text>
        </View>
        <View style={styles.listItem}>
          <Text style={styles.listNumber}>5.</Text>
          <Text style={styles.listText}>
            Mengunggah Konten sesuai deadline yang telah disepakati.
          </Text>
        </View>
        <View style={styles.listItem}>
          <Text style={styles.listNumber}>6.</Text>
          <Text style={styles.listText}>
            Memastikan Konten yang diunggah sesuai dengan Brief dan hasil persetujuan apabila Campaign
            mensyaratkan persetujuan.
          </Text>
        </View>
        <View style={styles.listItem}>
          <Text style={styles.listNumber}>7.</Text>
          <Text style={styles.listText}>
            Menyampaikan informasi produk atau Brand sesuai materi resmi yang diberikan.
          </Text>
        </View>
        <View style={styles.listItem}>
          <Text style={styles.listNumber}>8.</Text>
          <Text style={styles.listText}>
            Memberikan insight atau data performa Konten apabila diminta.
          </Text>
        </View>
        <View style={styles.listItem}>
          <Text style={styles.listNumber}>9.</Text>
          <Text style={styles.listText}>
            Menjaga Konten Campaign tetap tayang sesuai ketentuan Campaign.
          </Text>
        </View>

        <Text style={[styles.lampiranSectionHeading, { marginTop: 10 }]}>Don’t</Text>

        <View style={styles.listItem}>
          <Text style={styles.listNumber}>1.</Text>
          <Text style={styles.listText}>
            Tidak membatalkan Campaign secara sepihak setelah menyatakan kesediaan tanpa alasan yang dapat
            dipertanggungjawabkan.
          </Text>
        </View>
        <View style={styles.listItem}>
          <Text style={styles.listNumber}>2.</Text>
          <Text style={styles.listText}>
            Tidak terlambat mengirim draft atau posting tanpa konfirmasi terlebih dahulu.
          </Text>
        </View>
        <View style={styles.listItem}>
          <Text style={styles.listNumber}>3.</Text>
          <Text style={styles.listText}>
            Tidak mengubah konsep, Deliverable, atau informasi produk secara sepihak.
          </Text>
        </View>
        <View style={styles.listItem}>
          <Text style={styles.listNumber}>4.</Text>
          <Text style={styles.listText}>
            Tidak memposting Konten yang belum mendapat persetujuan apabila persetujuan diwajibkan.
          </Text>
        </View>
        <View style={styles.listItem}>
          <Text style={styles.listNumber}>5.</Text>
          <Text style={styles.listText}>
            Tidak menghapus atau melakukan takedown Konten Campaign tanpa persetujuan TNT atau Brand.
          </Text>
        </View>
        <View style={styles.listItem}>
          <Text style={styles.listNumber}>6.</Text>
          <Text style={styles.listText}>
            Tidak membuat klaim produk yang berlebihan, menyesatkan, atau tidak sesuai dengan Brief.
          </Text>
        </View>
        <View style={styles.listItem}>
          <Text style={styles.listNumber}>7.</Text>
          <Text style={styles.listText}>
            Tidak menggunakan followers, engagement, atau data performa palsu, maupun boost atau ads selain dari
            TNT.
          </Text>
        </View>
        <View style={styles.listItem}>
          <Text style={styles.listNumber}>8.</Text>
          <Text style={styles.listText}>
            Tidak membuat Konten yang mengandung SARA, pornografi, judi online, atau aktivitas ilegal lainnya.
          </Text>
        </View>
        <View style={styles.listItem}>
          <Text style={styles.listNumber}>9.</Text>
          <Text style={styles.listText}>
            Tidak mengabaikan komunikasi dari TNT selama Campaign masih berlangsung.
          </Text>
        </View>
        <View style={styles.listItem}>
          <Text style={styles.listNumber}>10.</Text>
          <Text style={styles.listText}>
            Tidak menggunakan produk, voucher, atau benefit Campaign di luar ketentuan yang telah diberikan.
          </Text>
        </View>
        <View style={styles.listItem}>
          <Text style={styles.listNumber}>11.</Text>
          <Text style={styles.listText}>
            Tidak menyebarkan data pribadi karyawan atau pihak yang berhubungan dengan TNT (doxing), dan tidak
            membuat atau menyebarkan pernyataan, konten, maupun sindiran yang merendahkan atau mencemarkan nama
            baik TNT, karyawan TNT, atau Brand (Pasal 10 ayat 3).
          </Text>
        </View>

        {renderFooter()}
      </Page>
    </Document>
  );
}
