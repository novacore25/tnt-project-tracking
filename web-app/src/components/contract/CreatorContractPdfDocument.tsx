import React from "react";
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingBottom: 36,
    paddingHorizontal: 40,
    fontSize: 8.5,
    fontFamily: "Helvetica",
    color: "#1e293b",
    lineHeight: 1.4,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1.5,
    borderBottomColor: "#0f172a",
    paddingBottom: 8,
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  logoImg: {
    width: 60,
    height: 24,
    objectFit: "contain",
  },
  agencyTitle: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#0f172a",
  },
  agencySub: {
    fontSize: 7,
    color: "#64748b",
  },
  headerRight: {
    textAlign: "right",
  },
  headerDocNum: {
    fontSize: 7.5,
    color: "#475569",
    textAlign: "right",
  },
  titleBlock: {
    textAlign: "center",
    marginBottom: 10,
  },
  title: {
    fontSize: 11,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: "#0f172a",
  },
  nomorSurat: {
    fontSize: 8,
    color: "#334155",
    marginTop: 2,
    fontWeight: "bold",
  },
  pembuka: {
    fontSize: 8,
    textAlign: "justify",
    marginBottom: 6,
    color: "#334155",
  },
  sectionParty: {
    fontSize: 8.5,
    fontWeight: "bold",
    color: "#0f172a",
    marginTop: 3,
    marginBottom: 2,
  },
  table: {
    marginVertical: 3,
    borderWidth: 0.8,
    borderColor: "#cbd5e1",
    borderRadius: 2,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.8,
    borderBottomColor: "#e2e8f0",
    minHeight: 14,
    alignItems: "center",
  },
  tableRowLast: {
    flexDirection: "row",
    minHeight: 14,
    alignItems: "center",
  },
  tableColLabel: {
    width: "32%",
    backgroundColor: "#f8fafc",
    paddingVertical: 2,
    paddingHorizontal: 6,
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#475569",
    borderRightWidth: 0.8,
    borderRightColor: "#e2e8f0",
  },
  tableColValue: {
    width: "68%",
    paddingVertical: 2,
    paddingHorizontal: 6,
    fontSize: 7.5,
    color: "#0f172a",
  },
  clauseHeader: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#0f172a",
    marginTop: 6,
    marginBottom: 2,
    textTransform: "uppercase",
  },
  subClause: {
    fontSize: 7.8,
    fontWeight: "bold",
    color: "#1e293b",
    marginTop: 3,
    marginBottom: 1,
  },
  bulletPoint: {
    fontSize: 7.5,
    color: "#334155",
    textAlign: "justify",
    marginBottom: 2,
    paddingLeft: 6,
  },
  paragraph: {
    fontSize: 7.8,
    color: "#334155",
    textAlign: "justify",
    marginBottom: 3,
  },
  signatureContainer: {
    marginTop: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  signBox: {
    width: "42%",
    textAlign: "center",
  },
  signRole: {
    fontSize: 7.5,
    fontWeight: "bold",
    marginBottom: 32,
    color: "#0f172a",
  },
  signLine: {
    borderTopWidth: 0.8,
    borderTopColor: "#94a3b8",
    paddingTop: 2,
  },
  signName: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#0f172a",
  },
  signSub: {
    fontSize: 7,
    color: "#64748b",
  },
  footer: {
    position: "absolute",
    bottom: 14,
    left: 40,
    right: 40,
    textAlign: "center",
    fontSize: 6.8,
    color: "#94a3b8",
    borderTopWidth: 0.5,
    borderTopColor: "#e2e8f0",
    paddingTop: 3,
  },
});

export interface CreatorContractData {
  nomorKontrak: string;
  hariTanggalPerjanjian: string; // e.g. "Jumat 10 (sepuluh) Juli tahun 2026"
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
  rekeningKreator: string;
  alamatKreator: string;
  teleponKreator: string;
  // Detail Kerjasama
  namaCampaign: string;
  namaBrand: string;
  qtyVt: number;
  periodeTayang: string; // e.g. "10 - 15 Juli 2026"
  biayaHonor: number;
  terbilangHonor: string; // e.g. "dua ratus ribu rupiah"
  ketentuanPembayaran: string; // e.g. "100% maksimal H+14 setelah upload video ke 4"
  tanggalMulai: string;
  tanggalBerakhir: string;
  customClauses?: string;
}

export function CreatorContractPdfDocument({ data }: { data: CreatorContractData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* HEADER / KOP RESMI TNT */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <View>
              <Text style={styles.agencyTitle}>TNT MEDIA (Official TikTok MCN & Affiliate Partner)</Text>
              <Text style={styles.agencySub}>Email: {data.emailPerusahaan || "tntmediaaffiliate@gmail.com"}</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.headerDocNum}>Doc: SPK-CREATOR</Text>
            <Text style={styles.headerDocNum}>Status: Confidential</Text>
          </View>
        </View>

        {/* TITLE */}
        <View style={styles.titleBlock}>
          <Text style={styles.title}>KONTRAK KERJASAMA CONTENT CREATOR</Text>
          <Text style={styles.nomorSurat}>Nomor: {data.nomorKontrak}</Text>
        </View>

        {/* PEMBUKA */}
        <Text style={styles.pembuka}>
          Pada hari ini, {data.hariTanggalPerjanjian}, telah diadakan perjanjian kerjasama yang ditandai dengan penandatanganan surat perjanjian, antara:
        </Text>

        {/* DATA PARA PIHAK */}
        <Text style={styles.sectionParty}>PIHAK PERTAMA (TNT MEDIA)</Text>
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={styles.tableColLabel}>Nama Perusahaan</Text>
            <Text style={styles.tableColValue}>{data.namaPerusahaan}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableColLabel}>Alamat Kantor</Text>
            <Text style={styles.tableColValue}>{data.alamatPerusahaan}</Text>
          </View>
          <View style={styles.tableRowLast}>
            <Text style={styles.tableColLabel}>Telepon / Kontak</Text>
            <Text style={styles.tableColValue}>{data.teleponPerusahaan}</Text>
          </View>
        </View>
        <Text style={[styles.paragraph, { fontSize: 7.2, fontStyle: "italic", marginBottom: 4 }]}>
          Dalam hal ini bertindak atas nama &quot;TNT MEDIA&quot; yang selanjutnya disebut sebagai PIHAK PERTAMA.
        </Text>

        <Text style={styles.sectionParty}>PIHAK KEDUA (CONTENT CREATOR)</Text>
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={styles.tableColLabel}>Nama Content Creator</Text>
            <Text style={styles.tableColValue}>{data.namaKreator} (@{data.usernameTikTok.replace("@", "")})</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableColLabel}>Nomor Rekening</Text>
            <Text style={styles.tableColValue}>{data.rekeningKreator || "-"}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableColLabel}>Alamat Domisili</Text>
            <Text style={styles.tableColValue}>{data.alamatKreator || "-"}</Text>
          </View>
          <View style={styles.tableRowLast}>
            <Text style={styles.tableColLabel}>Telepon / WhatsApp</Text>
            <Text style={styles.tableColValue}>{data.teleponKreator || "-"}</Text>
          </View>
        </View>
        <Text style={[styles.paragraph, { fontSize: 7.2, fontStyle: "italic", marginBottom: 6 }]}>
          Dalam hal ini bertindak atas nama diri pribadi yang selanjutnya disebut sebagai PIHAK KEDUA.
        </Text>

        {/* PASAL 1 & 2 */}
        <Text style={styles.clauseHeader}>PASAL 1 — DEFINISI / ISTILAH</Text>
        <Text style={styles.bulletPoint}>
          • Content Creator: Pembuat konten video • Viewers: Penonton • Script: Naskah • Draft Video: Video pra-upload • Keranjang Kuning: Keranjang kuning TikTok • Brief: Panduan pembuatan video • Boost/Ads: Iklan TikTok.
        </Text>

        <Text style={styles.clauseHeader}>PASAL 2 — STATUS KERJASAMA</Text>
        <Text style={styles.paragraph}>
          PIHAK PERTAMA menyetujui untuk bekerja sama dengan PIHAK KEDUA, yang dalam hal ini PIHAK KEDUA ditetapkan sebagai Content Creator untuk melaksanakan jasa pembuatan konten yang diminta oleh PIHAK PERTAMA untuk memasarkan {data.namaBrand} ({data.namaCampaign}).
        </Text>

        {/* PASAL 3 */}
        <Text style={styles.clauseHeader}>PASAL 3 — HAK DAN KEWAJIBAN</Text>
        <Text style={styles.subClause}>3.1 Hak &amp; Kewajiban PIHAK PERTAMA:</Text>
        <Text style={styles.bulletPoint}>• Berhak meminta revisi draft video apabila tidak sesuai dengan brief.</Text>
        <Text style={styles.bulletPoint}>• Berhak memotong 50% honor apabila PIHAK KEDUA tidak mengirimkan draft/upload sesuai timeline yang disepakati.</Text>
        <Text style={styles.bulletPoint}>• Berhak membatalkan kontrak jika terjadi pelanggaran/cheating (boost selain dari PIHAK PERTAMA).</Text>
        <Text style={styles.bulletPoint}>• Wajib memberikan brief video, mengirim sample produk, dan membayarkan honor sesuai kesepakatan.</Text>

        <Text style={styles.subClause}>3.2 Hak &amp; Kewajiban PIHAK KEDUA:</Text>
        <Text style={styles.bulletPoint}>• Berhak menerima brief dan menerima pembayaran honor tepat waktu dari PIHAK PERTAMA.</Text>
        <Text style={styles.bulletPoint}>• Wajib mengupload {data.qtyVt} video pada periode {data.periodeTayang} pada platform TikTok.</Text>
        <Text style={styles.bulletPoint}>• Wajib menggunakan script &amp; hashtag resmi serta mengirim draft sebelum upload untuk approval (maksimal revisi 2 kali).</Text>
        <Text style={styles.bulletPoint}>• Tidak boleh menghapus atau me-private video yang sudah diunggah.</Text>

        {/* PASAL 4 & 5 */}
        <Text style={styles.clauseHeader}>PASAL 4 — BIAYA &amp; HONORARIUM</Text>
        <Text style={styles.paragraph}>
          PIHAK KEDUA akan mendapatkan honor dari PIHAK PERTAMA sebesar Rp. {Number(data.biayaHonor || 0).toLocaleString("id-ID")} ({data.terbilangHonor}).
        </Text>

        <Text style={styles.clauseHeader}>PASAL 5 — TATA CARA PEMBAYARAN</Text>
        <Text style={styles.paragraph}>
          PIHAK PERTAMA membayarkan honor melalui rekening terdaftar di kontrak ini. {data.ketentuanPembayaran}.
        </Text>

        {/* PASAL 6 - 9 */}
        <Text style={styles.clauseHeader}>PASAL 6 — MASA BERLAKU KONTRAK</Text>
        <Text style={styles.paragraph}>
          Kontrak ini berlaku mulai tanggal {data.tanggalMulai} dan berakhir pada tanggal {data.tanggalBerakhir}, kecuali diperpanjang secara tertulis.
        </Text>

        {data.customClauses && data.customClauses.trim() !== "" && (
          <View>
            <Text style={styles.clauseHeader}>PASAL TAMBAHAN / KETENTUAN KHUSUS</Text>
            <Text style={styles.paragraph}>{data.customClauses}</Text>
          </View>
        )}

        <Text style={styles.clauseHeader}>PASAL 7 — KEADAAN KAHAR &amp; PENYELESAIAN SENGKETA</Text>
        <Text style={styles.paragraph}>
          Keadaan force majeure dilaporkan tertulis maksimal 7 hari. Segala perselisihan diselesaikan melalui musyawarah/mediasi sebelum jalur hukum di Indonesia.
        </Text>

        {/* SIGNATURES */}
        <View style={styles.signatureContainer}>
          <View style={styles.signBox}>
            <Text style={{ fontSize: 7.5, color: "#64748b", marginBottom: 2 }}>{data.tanggalKota}</Text>
            <Text style={styles.signRole}>PIHAK PERTAMA</Text>
            <View style={styles.signLine}>
              <Text style={styles.signName}>{data.namaPicTNT || "Safira / PIC TNT"}</Text>
              <Text style={styles.signSub}>TNT Media</Text>
            </View>
          </View>

          <View style={styles.signBox}>
            <Text style={{ fontSize: 7.5, color: "#64748b", marginBottom: 2 }}>Menyetujui,</Text>
            <Text style={styles.signRole}>PIHAK KEDUA</Text>
            <View style={styles.signLine}>
              <Text style={styles.signName}>{data.namaKreator || "Content Creator"}</Text>
              <Text style={styles.signSub}>@{data.usernameTikTok.replace("@", "")}</Text>
            </View>
          </View>
        </View>

        {/* FOOTER */}
        <Text style={styles.footer}>
          TNT Media — Official TikTok MCN &amp; Affiliate Partner | Dokumen Resmi Perjanjian Kerjasama Content Creator
        </Text>
      </Page>
    </Document>
  );
}
