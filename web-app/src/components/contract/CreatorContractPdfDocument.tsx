import React from "react";
import { Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer";

// Register standard fonts (Helvetica is built-in in PDF, but we style cleanly)
const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 48,
    paddingHorizontal: 40,
    fontSize: 9.5,
    fontFamily: "Helvetica",
    color: "#1e293b",
    lineHeight: 1.45,
  },
  header: {
    borderBottomWidth: 1.5,
    borderBottomColor: "#0f172a",
    paddingBottom: 10,
    marginBottom: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  logoTNT: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#0f172a",
    letterSpacing: 0.5,
  },
  subLogo: {
    fontSize: 7.5,
    color: "#64748b",
    marginTop: 2,
  },
  headerDocNum: {
    fontSize: 8.5,
    color: "#475569",
    textAlign: "right",
  },
  titleBlock: {
    textAlign: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 12.5,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: "#0f172a",
  },
  docCode: {
    fontSize: 8.5,
    color: "#64748b",
    marginTop: 3,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#0f172a",
    marginTop: 8,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  paragraph: {
    fontSize: 9,
    textAlign: "justify",
    marginBottom: 6,
    color: "#334155",
  },
  table: {
    marginVertical: 6,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 3,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    minHeight: 18,
    alignItems: "center",
  },
  tableRowLast: {
    flexDirection: "row",
    minHeight: 18,
    alignItems: "center",
  },
  tableColLabel: {
    width: "35%",
    backgroundColor: "#f8fafc",
    paddingVertical: 3,
    paddingHorizontal: 6,
    fontSize: 8.5,
    fontWeight: "bold",
    color: "#475569",
    borderRightWidth: 1,
    borderRightColor: "#e2e8f0",
  },
  tableColValue: {
    width: "65%",
    paddingVertical: 3,
    paddingHorizontal: 6,
    fontSize: 8.5,
    color: "#0f172a",
  },
  clauseTitle: {
    fontSize: 9.5,
    fontWeight: "bold",
    marginTop: 8,
    marginBottom: 3,
    color: "#0f172a",
  },
  signatureContainer: {
    marginTop: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  signBox: {
    width: "44%",
    textAlign: "center",
  },
  signTitle: {
    fontSize: 9,
    fontWeight: "bold",
    marginBottom: 45,
    color: "#0f172a",
  },
  signLine: {
    borderTopWidth: 1,
    borderTopColor: "#94a3b8",
    paddingTop: 3,
  },
  signName: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#0f172a",
  },
  signRole: {
    fontSize: 7.5,
    color: "#64748b",
  },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 40,
    right: 40,
    textAlign: "center",
    fontSize: 7.5,
    color: "#94a3b8",
    borderTopWidth: 0.5,
    borderTopColor: "#e2e8f0",
    paddingTop: 4,
  },
});

export interface CreatorContractData {
  nomorKontrak: string;
  tanggalKontrak: string;
  namaPihakPertama: string;
  jabatanPihakPertama: string;
  perusahaanPihakPertama: string;
  namaKreator: string;
  usernameTikTok: string;
  noWhatsapp: string;
  nikKtp?: string;
  namaCampaign: string;
  namaBrand: string;
  qtyVt: number;
  qtyLive: number;
  ratecard: number;
  terbilangRatecard: string;
  customClauses?: string;
}

export function CreatorContractPdfDocument({ data }: { data: CreatorContractData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header / Kop */}
        <View style={styles.header}>
          <View>
            <Text style={styles.logoTNT}>TNT KREATIF NUSANTARA</Text>
            <Text style={styles.subLogo}>Agency & Multi-Channel Network (MCN) Management</Text>
          </View>
          <View>
            <Text style={styles.headerDocNum}>No: {data.nomorKontrak}</Text>
            <Text style={styles.headerDocNum}>Tgl: {data.tanggalKontrak}</Text>
          </View>
        </View>

        {/* Title */}
        <View style={styles.titleBlock}>
          <Text style={styles.title}>SURAT PERJANJIAN KERJASAMA KREATOR</Text>
          <Text style={styles.docCode}>CAMPAIGN: {data.namaCampaign.toUpperCase()}</Text>
        </View>

        {/* Pembuka */}
        <Text style={styles.paragraph}>
          Pada hari ini, bertempat di kantor TNT Kreatif Nusantara, telah dibuat dan disepakati perjanjian kerjasama pembuatan dan penayangan konten media sosial oleh dan antara pihak-pihak di bawah ini:
        </Text>

        {/* Pihak Pertama */}
        <Text style={styles.sectionTitle}>I. PIHAK PERTAMA (AGENCY)</Text>
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={styles.tableColLabel}>Nama Instansi / Perusahaan</Text>
            <Text style={styles.tableColValue}>{data.perusahaanPihakPertama}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableColLabel}>Nama Perwakilan</Text>
            <Text style={styles.tableColValue}>{data.namaPihakPertama}</Text>
          </View>
          <View style={styles.tableRowLast}>
            <Text style={styles.tableColLabel}>Jabatan</Text>
            <Text style={styles.tableColValue}>{data.jabatanPihakPertama}</Text>
          </View>
        </View>

        {/* Pihak Kedua */}
        <Text style={styles.sectionTitle}>II. PIHAK KEDUA (KREATOR)</Text>
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={styles.tableColLabel}>Nama Lengkap Kreator</Text>
            <Text style={styles.tableColValue}>{data.namaKreator || "-"}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableColLabel}>Username TikTok</Text>
            <Text style={styles.tableColValue}>@{data.usernameTikTok.replace("@", "")}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableColLabel}>Nomor WhatsApp</Text>
            <Text style={styles.tableColValue}>{data.noWhatsapp || "-"}</Text>
          </View>
          <View style={styles.tableRowLast}>
            <Text style={styles.tableColLabel}>NIK / KTP</Text>
            <Text style={styles.tableColValue}>{data.nikKtp || "-"}</Text>
          </View>
        </View>

        {/* Ruang Lingkup Pekerjaan */}
        <Text style={styles.clauseTitle}>PASAL 1 — RUANG LINGKUP PEKERJAAN (SCOPE OF WORK)</Text>
        <Text style={styles.paragraph}>
          PIHAK KEDUA setuju untuk memproduksi dan mengunggah konten promosi untuk brand {data.namaBrand} dalam campaign {data.namaCampaign} dengan rincian:
        </Text>
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={styles.tableColLabel}>Jumlah Video TikTok (VT)</Text>
            <Text style={styles.tableColValue}>{data.qtyVt} Video Tayang (Approved Concept)</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableColLabel}>Jumlah Sesi Live Streaming</Text>
            <Text style={styles.tableColValue}>{data.qtyLive} Sesi Live</Text>
          </View>
          <View style={styles.tableRowLast}>
            <Text style={styles.tableColLabel}>Ketentuan Konten</Text>
            <Text style={styles.tableColValue}>Menautkan keranjang kuning produk resmi dan menyertakan tagar campaign.</Text>
          </View>
        </View>

        {/* Nilai Imbalan */}
        <Text style={styles.clauseTitle}>PASAL 2 — NILAI IMBALAN & KETENTUAN PEMBAYARAN</Text>
        <Text style={styles.paragraph}>
          Atas penyelesaian seluruh pekerjaan di atas, PIHAK PERTAMA akan membayarkan imbalan jasa (Rate Card) sebesar:
        </Text>
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={styles.tableColLabel}>Total Imbalan (Net)</Text>
            <Text style={styles.tableColValue}>Rp {data.ratecard.toLocaleString("id-ID")}</Text>
          </View>
          <View style={styles.tableRowLast}>
            <Text style={styles.tableColLabel}>Terbilang</Text>
            <Text style={styles.tableColValue}>{data.terbilangRatecard}</Text>
          </View>
        </View>

        {/* Klausul Tambahan jika ada */}
        {data.customClauses && data.customClauses.trim().length > 0 ? (
          <View>
            <Text style={styles.clauseTitle}>PASAL 3 — KETENTUAN KHUSUS / TAMBAHAN</Text>
            <Text style={styles.paragraph}>{data.customClauses}</Text>
          </View>
        ) : null}

        {/* Tanda Tangan */}
        <View style={styles.signatureContainer}>
          <View style={styles.signBox}>
            <Text style={styles.signTitle}>PIHAK PERTAMA,</Text>
            <View style={styles.signLine}>
              <Text style={styles.signName}>{data.namaPihakPertama}</Text>
              <Text style={styles.signRole}>{data.perusahaanPihakPertama}</Text>
            </View>
          </View>

          <View style={styles.signBox}>
            <Text style={styles.signTitle}>PIHAK KEDUA,</Text>
            <View style={styles.signLine}>
              <Text style={styles.signName}>{data.namaKreator || `@${data.usernameTikTok}`}</Text>
              <Text style={styles.signRole}>Kreator Content</Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          Dokumen ini digenerate secara otomatis dan sah melalui TNT Project Tracking System
        </Text>
      </Page>
    </Document>
  );
}
