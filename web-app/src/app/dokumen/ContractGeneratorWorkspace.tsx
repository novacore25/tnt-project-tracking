"use client";

import React, { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import {
  FileText,
  Download,
  Building,
  User,
  Calendar,
  CreditCard,
  Layers,
  Sparkles,
  CheckCircle2,
  RefreshCw,
  FolderKanban,
  AlertCircle,
  HelpCircle,
  ExternalLink,
  ChevronDown,
} from "lucide-react";
import { CreatorContractPdfDocument, CreatorContractData } from "@/components/contract/CreatorContractPdfDocument";

const PDFViewer = dynamic(
  () => import("@react-pdf/renderer").then((mod) => mod.PDFViewer),
  {
    ssr: false,
    loading: () => (
      <div className="h-[600px] flex items-center justify-center text-slate-400 font-semibold bg-slate-50">
        <RefreshCw className="w-6 h-6 animate-spin mr-2 text-blue-600" />
        Menyiapkan pratinjau dokumen PDF...
      </div>
    ),
  }
);

const PDFDownloadLink = dynamic(
  () => import("@react-pdf/renderer").then((mod) => mod.PDFDownloadLink),
  { ssr: false }
);

function terbilang(angka: number): string {
  const bilangan = [
    "", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan", "sepuluh", "sebelas",
  ];

  if (angka < 12) return bilangan[angka];
  if (angka < 20) return terbilang(angka - 10) + " belas";
  if (angka < 100) return terbilang(Math.floor(angka / 10)) + " puluh " + terbilang(angka % 10);
  if (angka < 200) return "seratus " + terbilang(angka - 100);
  if (angka < 1000) return terbilang(Math.floor(angka / 100)) + " ratus " + terbilang(angka % 100);
  if (angka < 2000) return "seribu " + terbilang(angka - 1000);
  if (angka < 1000000) return terbilang(Math.floor(angka / 1000)) + " ribu " + terbilang(angka % 1000);
  if (angka < 1000000000) return terbilang(Math.floor(angka / 1000000)) + " juta " + terbilang(angka % 1000000);
  if (angka < 1000000000000) return terbilang(Math.floor(angka / 1000000000)) + " miliar " + terbilang(angka % 1000000000);
  return angka.toString();
}

interface ContractGeneratorWorkspaceProps {
  campaigns: any[];
  creators: any[];
  selectedCampaignId: number | null;
  onSelectCampaign: (id: number) => void;
  campaignBrandName: string;
  defaultUserName: string;
}

export default function ContractGeneratorWorkspace({
  campaigns,
  creators,
  selectedCampaignId,
  onSelectCampaign,
  campaignBrandName,
  defaultUserName,
}: ContractGeneratorWorkspaceProps) {
  // PILIHAN KONTRAK / TEMPLATE DOKUMEN
  const [selectedDocType, setSelectedDocType] = useState<string>("kontrak_creator");

  // SELEKSI KREATOR UNTUK FORM AUTO-FILL
  const [selectedCcId, setSelectedCcId] = useState<number | null>(null);

  // Auto-fill form jika kreator dipilih
  const currentCreator = useMemo(() => {
    if (!selectedCcId) return null;
    return creators.find((c) => c.cc_id === selectedCcId) || null;
  }, [selectedCcId, creators]);

  // DATE HELPERS
  const today = new Date();
  const dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const monthNames = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];
  const curDayName = dayNames[today.getDay()];
  const curDateNum = today.getDate();
  const curMonthName = monthNames[today.getMonth()];
  const curYear = today.getFullYear();

  // FORM STATE - FIELD DATA KONTRAK
  const [nomorKontrak, setNomorKontrak] = useState(`095/PWS/VII/${curYear}`);
  const [hariTanggalPerjanjian, setHariTanggalPerjanjian] = useState(
    `${curDayName} ${curDateNum} (${terbilang(curDateNum)}) ${curMonthName} tahun ${curYear} (${terbilang(curYear)})`
  );
  const [tanggalKota, setTanggalKota] = useState(`Tangerang, ${curDateNum} ${curMonthName} ${curYear}`);

  // Pihak Pertama (TNT Media)
  const [namaPerusahaan, setNamaPerusahaan] = useState("TNT Media");
  const [alamatPerusahaan, setAlamatPerusahaan] = useState("Gading Serpong, Tangerang");
  const [teleponPerusahaan, setTeleponPerusahaan] = useState("+62 85178230404");
  const [emailPerusahaan, setEmailPerusahaan] = useState("tntmediaaffiliate@gmail.com");
  const [namaPicTNT, setNamaPicTNT] = useState(defaultUserName || "Safira");

  // Pihak Kedua (Kreator)
  const [namaKreator, setNamaKreator] = useState("");
  const [usernameTikTok, setUsernameTikTok] = useState("");
  const [rekeningKreator, setRekeningKreator] = useState("");
  const [alamatKreator, setAlamatKreator] = useState("");
  const [teleponKreator, setTeleponKreator] = useState("");

  // Deliverables & Scope
  const [qtyVt, setQtyVt] = useState<number>(4);
  const [periodeTayang, setPeriodeTayang] = useState(`${curDateNum} - ${curDateNum + 5} ${curMonthName} ${curYear}`);
  const [biayaHonor, setBiayaHonor] = useState<number>(200000);
  const [ketentuanPembayaran, setKetentuanPembayaran] = useState(
    "Honor PIHAK KEDUA akan dibayarkan oleh PIHAK PERTAMA 100% maksimal H+14 setelah upload video ke 4"
  );
  const [tanggalMulai, setTanggalMulai] = useState(`${curDateNum} ${curMonthName} ${curYear}`);
  const [tanggalBerakhir, setTanggalBerakhir] = useState(`${curDateNum} ${monthNames[(today.getMonth() + 1) % 12]} ${curYear}`);
  const [customClauses, setCustomClauses] = useState("");

  // Sync state ketika user memilih kreator dari dropdown
  React.useEffect(() => {
    if (currentCreator) {
      const uName = currentCreator.username || "";
      const realName = currentCreator.nama_lengkap || currentCreator.nama_asli || uName;
      const phone = currentCreator.no_whatsapp || currentCreator.contact_nomor || "";
      const rate = Number(currentCreator.price) || 0;
      const vt = Number(currentCreator.qty_vt) || 1;

      setNamaKreator(realName);
      setUsernameTikTok(uName);
      setTeleponKreator(phone);
      if (rate > 0) setBiayaHonor(rate);
      if (vt > 0) setQtyVt(vt);
      setNomorKontrak(`TNT/KTR/${curYear}/${String(today.getMonth() + 1).padStart(2, "0")}/${currentCreator.cc_id}`);
      setKetentuanPembayaran(
        `Honor PIHAK KEDUA akan dibayarkan oleh PIHAK PERTAMA 100% maksimal H+14 setelah upload video ke ${vt}`
      );
    }
  }, [currentCreator]);

  // Selected Campaign Object
  const selectedCampaign = useMemo(() => {
    return campaigns.find((c) => c.id === selectedCampaignId) || null;
  }, [campaigns, selectedCampaignId]);

  // DATA DOKUMEN UNTUK LIVE PREVIEW PDF
  const contractPdfData: CreatorContractData = useMemo(() => {
    const honorNum = Number(biayaHonor) || 0;
    const terbilangStr = honorNum > 0 ? `${terbilang(honorNum).trim()} rupiah` : "nol rupiah";

    return {
      nomorKontrak,
      hariTanggalPerjanjian,
      tanggalKota,
      namaPerusahaan,
      alamatPerusahaan,
      teleponPerusahaan,
      emailPerusahaan,
      namaPicTNT,
      namaKreator: namaKreator || "Nama Content Creator",
      usernameTikTok: usernameTikTok || "username",
      rekeningKreator: rekeningKreator || "Nomor Rekening / E-Wallet",
      alamatKreator: alamatKreator || "Alamat domisili lengkap",
      teleponKreator: teleponKreator || "-",
      namaCampaign: selectedCampaign?.nama || "Campaign TNT",
      namaBrand: campaignBrandName || "Brand Partner",
      qtyVt: Number(qtyVt) || 1,
      periodeTayang: periodeTayang || "Sesuai timeline yang disepakati",
      biayaHonor: honorNum,
      terbilangHonor: terbilangStr,
      ketentuanPembayaran,
      tanggalMulai,
      tanggalBerakhir,
      customClauses,
    };
  }, [
    nomorKontrak,
    hariTanggalPerjanjian,
    tanggalKota,
    namaPerusahaan,
    alamatPerusahaan,
    teleponPerusahaan,
    emailPerusahaan,
    namaPicTNT,
    namaKreator,
    usernameTikTok,
    rekeningKreator,
    alamatKreator,
    teleponKreator,
    selectedCampaign,
    campaignBrandName,
    qtyVt,
    periodeTayang,
    biayaHonor,
    ketentuanPembayaran,
    tanggalMulai,
    tanggalBerakhir,
    customClauses,
  ]);

  const outputFileName = `Kontrak_${(usernameTikTok || "kreator").replace(/[@\s]/g, "")}_${(selectedCampaign?.nama || "Campaign").replace(/[\s/]/g, "_")}.pdf`;

  return (
    <div className="space-y-6">
      {/* 1. SELEKTOR DOKUMEN & CAMPAIGN */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          {/* Pilih Jenis Dokumen */}
          <div className="md:col-span-4 space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-blue-600" />
              Pilih Jenis Dokumen
            </label>
            <select
              value={selectedDocType}
              onChange={(e) => setSelectedDocType(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition-all cursor-pointer"
            >
              <option value="kontrak_creator">Surat Perjanjian Kerjasama (SPK Kontrak Kreator)</option>
              <option value="surat_tugas" disabled>Surat Tugas PIC (Coming Soon)</option>
              <option value="nda_brand" disabled>Non-Disclosure Agreement (NDA) (Coming Soon)</option>
            </select>
          </div>

          {/* Pilih Campaign */}
          <div className="md:col-span-4 space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <FolderKanban className="w-3.5 h-3.5 text-blue-600" />
              Pilih Campaign Terkait
            </label>
            <select
              value={selectedCampaignId || ""}
              onChange={(e) => onSelectCampaign(Number(e.target.value))}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition-all cursor-pointer"
            >
              {campaigns.map((camp: any) => (
                <option key={camp.id} value={camp.id}>
                  {camp.nama} {camp.brands?.nama ? `(${camp.brands.nama})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Auto-fill Dari Kreator Terdaftar */}
          <div className="md:col-span-4 space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-emerald-600" />
              Isi Otomatis Dari Database Kreator
            </label>
            <select
              value={selectedCcId || ""}
              onChange={(e) => setSelectedCcId(e.target.value ? Number(e.target.value) : null)}
              className="w-full px-3 py-2.5 bg-emerald-50/50 border border-emerald-300 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none transition-all cursor-pointer"
            >
              <option value="">-- Isi Manual / Ketik Sendiri --</option>
              {creators.map((c: any) => (
                <option key={c.cc_id} value={c.cc_id}>
                  @{c.username} - {c.nama_lengkap || c.nama_asli || "Tanpa Nama"} (Rp {Number(c.price || 0).toLocaleString("id-ID")})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 2. SPLIT LAYOUT: FORM DI KIRI, LIVE PREVIEW DI KANAN */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* PANEL KIRI: FORM PENGISIAN DATA */}
        <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-6 max-h-[820px] overflow-y-auto">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Formulir Data Dokumen Kontrak
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Perubahan pada formulir langsung ter-update di live preview sebelah kanan.
              </p>
            </div>
          </div>

          {/* SECTION A: LEGALITAS SURAT & TANGGAL */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-blue-700 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> A. Legalitas Surat &amp; Tanggal
            </h3>

            <div className="space-y-2.5 text-xs">
              <div>
                <label className="font-semibold text-slate-600">Nomor Surat Kontrak</label>
                <input
                  type="text"
                  value={nomorKontrak}
                  onChange={(e) => setNomorKontrak(e.target.value)}
                  placeholder="095 / PWS / VII / 2026"
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-mono"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-600">Hari &amp; Tanggal Pembukaan Perjanjian</label>
                <input
                  type="text"
                  value={hariTanggalPerjanjian}
                  onChange={(e) => setHariTanggalPerjanjian(e.target.value)}
                  placeholder="Jumat 10 (sepuluh) Juli tahun 2026 (dua ribu dua puluh enam)"
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-600">Kota &amp; Tanggal Penandatanganan</label>
                <input
                  type="text"
                  value={tanggalKota}
                  onChange={(e) => setTanggalKota(e.target.value)}
                  placeholder="Tangerang, 10 Juli 2026"
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
                />
              </div>
            </div>
          </div>

          {/* SECTION B: PIHAK PERTAMA (TNT MEDIA) */}
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <h3 className="text-xs font-bold text-indigo-700 uppercase tracking-wider flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5" /> B. Pihak Pertama (TNT Media)
            </h3>

            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="col-span-2">
                <label className="font-semibold text-slate-600">Nama Perusahaan</label>
                <input
                  type="text"
                  value={namaPerusahaan}
                  onChange={(e) => setNamaPerusahaan(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
                />
              </div>
              <div className="col-span-2">
                <label className="font-semibold text-slate-600">Alamat Kantor</label>
                <input
                  type="text"
                  value={alamatPerusahaan}
                  onChange={(e) => setAlamatPerusahaan(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-600">Telepon Kantor</label>
                <input
                  type="text"
                  value={teleponPerusahaan}
                  onChange={(e) => setTeleponPerusahaan(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-600">Nama PIC Penandatangan</label>
                <input
                  type="text"
                  value={namaPicTNT}
                  onChange={(e) => setNamaPicTNT(e.target.value)}
                  placeholder="Safira"
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-semibold"
                />
              </div>
            </div>
          </div>

          {/* SECTION C: PIHAK KEDUA (CONTENT CREATOR) */}
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <h3 className="text-xs font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" /> C. Pihak Kedua (Content Creator)
            </h3>

            <div className="space-y-2.5 text-xs">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="font-semibold text-slate-600">Nama Lengkap Kreator</label>
                  <input
                    type="text"
                    value={namaKreator}
                    onChange={(e) => setNamaKreator(e.target.value)}
                    placeholder="Contoh: Tuniroh"
                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-semibold"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-600">Username TikTok</label>
                  <input
                    type="text"
                    value={usernameTikTok}
                    onChange={(e) => setUsernameTikTok(e.target.value)}
                    placeholder="@username"
                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-600">Rekening / E-Wallet Pembayaran</label>
                <input
                  type="text"
                  value={rekeningKreator}
                  onChange={(e) => setRekeningKreator(e.target.value)}
                  placeholder="Contoh: 085960229883 (Shopeepay) / BCA 12345678"
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-mono"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-600">Alamat Domisili Lengkap</label>
                <textarea
                  rows={2}
                  value={alamatKreator}
                  onChange={(e) => setAlamatKreator(e.target.value)}
                  placeholder="Alamat lengkap kreator pengiriman produk..."
                  className="w-full mt-1 p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-600">Telepon / WhatsApp</label>
                <input
                  type="text"
                  value={teleponKreator}
                  onChange={(e) => setTeleponKreator(e.target.value)}
                  placeholder="0812xxxx"
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
                />
              </div>
            </div>
          </div>

          {/* SECTION D: DELIVERABLES, HONOR & JADWAL */}
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <h3 className="text-xs font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5" /> D. Deliverables &amp; Honorarium
            </h3>

            <div className="space-y-2.5 text-xs">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="font-semibold text-slate-600">Jumlah Video (VT)</label>
                  <input
                    type="number"
                    min={1}
                    value={qtyVt}
                    onChange={(e) => setQtyVt(Number(e.target.value))}
                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-bold"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-600">Honorarium / Fee (Rp)</label>
                  <input
                    type="number"
                    step={10000}
                    value={biayaHonor}
                    onChange={(e) => setBiayaHonor(Number(e.target.value))}
                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-600">Periode Unggah Video</label>
                <input
                  type="text"
                  value={periodeTayang}
                  onChange={(e) => setPeriodeTayang(e.target.value)}
                  placeholder="10 - 15 Juli 2026"
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-600">Ketentuan Pembayaran (Pasal 5)</label>
                <textarea
                  rows={2}
                  value={ketentuanPembayaran}
                  onChange={(e) => setKetentuanPembayaran(e.target.value)}
                  className="w-full mt-1 p-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="font-semibold text-slate-600">Tanggal Mulai Kontrak</label>
                  <input
                    type="text"
                    value={tanggalMulai}
                    onChange={(e) => setTanggalMulai(e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-600">Tanggal Berakhir Kontrak</label>
                  <input
                    type="text"
                    value={tanggalBerakhir}
                    onChange={(e) => setTanggalBerakhir(e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-600">Pasal Tambahan Khusus (Opsional)</label>
                <textarea
                  rows={2}
                  value={customClauses}
                  onChange={(e) => setCustomClauses(e.target.value)}
                  placeholder="Klausul penalti khusus, batasan khusus brand, dsb..."
                  className="w-full mt-1 p-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
                />
              </div>
            </div>
          </div>
        </div>

        {/* PANEL KANAN: LIVE PREVIEW & DOWNLOAD BUTTON */}
        <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Live Pratinjau Dokumen Kontrak
              </h2>
            </div>

            <PDFDownloadLink
              document={<CreatorContractPdfDocument data={contractPdfData} />}
              fileName={outputFileName}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition-all cursor-pointer"
            >
              {({ loading }) => (
                <>
                  <Download className="w-4 h-4" />
                  <span>{loading ? "Menyiapkan PDF..." : "Unduh Dokumen PDF"}</span>
                </>
              )}
            </PDFDownloadLink>
          </div>

          {/* VIEWER CONTAINER */}
          <div className="w-full h-[730px] rounded-xl overflow-hidden border border-slate-200 bg-slate-100 shadow-inner">
            <PDFViewer width="100%" height="100%" className="border-0">
              <CreatorContractPdfDocument data={contractPdfData} />
            </PDFViewer>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
            <span>
              Format: A4 Standard • 100% Client-Side Render (Beban Server 0%)
            </span>
            <span className="font-mono text-slate-500">
              {outputFileName}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
