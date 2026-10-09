"use client";

import React, { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/Dialog";
import {
  FileText,
  Download,
  Edit3,
  Eye,
  Loader2,
  CheckCircle2,
  User,
  Building,
  Archive,
  AlertCircle,
  FolderKanban,
  Sparkles,
} from "lucide-react";
import { CreatorContractPdfDocument, CreatorContractData } from "@/components/contract/CreatorContractPdfDocument";
import JSZip from "jszip";
import { saveAs } from "file-saver";

const PDFViewer = dynamic(
  () => import("@react-pdf/renderer").then((mod) => mod.PDFViewer),
  {
    ssr: false,
    loading: () => (
      <div className="h-[450px] flex items-center justify-center text-slate-400 font-semibold">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Menyiapkan PDF viewer...
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
    "", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh", "Sebelas",
  ];

  if (angka < 12) return bilangan[angka];
  if (angka < 20) return terbilang(angka - 10) + " Belas";
  if (angka < 100) return terbilang(Math.floor(angka / 10)) + " Puluh " + terbilang(angka % 10);
  if (angka < 200) return "Seratus " + terbilang(angka - 100);
  if (angka < 1000) return terbilang(Math.floor(angka / 100)) + " Ratus " + terbilang(angka % 100);
  if (angka < 2000) return "Seribu " + terbilang(angka - 1000);
  if (angka < 1000000) return terbilang(Math.floor(angka / 1000)) + " Ribu " + terbilang(angka % 1000);
  if (angka < 1000000000) return terbilang(Math.floor(angka / 1000000)) + " Juta " + terbilang(angka % 1000000);
  if (angka < 1000000000000) return terbilang(Math.floor(angka / 1000000000)) + " Miliar " + terbilang(angka % 1000000000);
  return angka.toString();
}

interface ContractWorkspaceProps {
  creators: any[];
  selectedCcIds: Set<number>;
  selectedCampaign: any;
  campaignBrandName: string;
  userName: string;
  onClearSelection: () => void;
}

export default function ContractWorkspace({
  creators,
  selectedCcIds,
  selectedCampaign,
  campaignBrandName,
  userName,
  onClearSelection,
}: ContractWorkspaceProps) {
  // Pihak Pertama state
  const [namaPihakPertama, setNamaPihakPertama] = useState(userName || "PIC TNT Kreatif");
  const [jabatanPihakPertama, setJabatanPihakPertama] = useState("Campaign Specialist");
  const [perusahaanPihakPertama, setPerusahaanPihakPertama] = useState("PT TNT Kreatif Nusantara");

  // Format Nomor Kontrak Template
  const today = new Date();
  const yearStr = today.getFullYear();
  const monthStr = String(today.getMonth() + 1).padStart(2, "0");
  const [prefixNomor, setPrefixNomor] = useState(`TNT/KTR/${yearStr}/${monthStr}`);

  // Klausul Khusus
  const [customClauses, setCustomClauses] = useState(
    "1. Video wajib ditayangkan selambat-lambatnya 7 (tujuh) hari kerja setelah konsep disetujui.\n2. Konten tidak boleh dihapus atau di-private minimal selama 60 hari sejak penayangan publik."
  );

  // Target creators to generate
  const targetCreators = useMemo(() => {
    if (selectedCcIds.size > 0) {
      return creators.filter((c) => selectedCcIds.has(c.cc_id));
    }
    return creators;
  }, [creators, selectedCcIds]);

  // Preview active creator index
  const [previewIndex, setPreviewIndex] = useState(0);
  const activeCreator = targetCreators[previewIndex] || targetCreators[0] || null;

  // Bulk ZIP download state
  const [isZipping, setIsZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState<{ current: number; total: number } | null>(null);

  // Active creator contract data for live preview
  const activeContractData: CreatorContractData | null = useMemo(() => {
    if (!activeCreator) return null;
    const dateStr = today.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
    const contractNo = `${prefixNomor}/${activeCreator.cc_id}`;
    const rateVal = Number(activeCreator.price) || 0;
    const terbilangStr = rateVal > 0 ? `${terbilang(rateVal).trim()} Rupiah` : "Nol Rupiah";

    return {
      nomorKontrak: contractNo,
      tanggalKontrak: dateStr,
      namaPihakPertama,
      jabatanPihakPertama,
      perusahaanPihakPertama,
      namaKreator: activeCreator.nama_lengkap || activeCreator.nama_asli || activeCreator.username,
      usernameTikTok: activeCreator.username,
      noWhatsapp: activeCreator.no_whatsapp || activeCreator.contact_nomor || "-",
      nikKtp: "",
      namaCampaign: selectedCampaign?.nama || "Campaign TNT",
      namaBrand: campaignBrandName || "Brand Partner",
      qtyVt: Number(activeCreator.qty_vt) || 1,
      qtyLive: Number(activeCreator.qty_live) || 0,
      ratecard: rateVal,
      terbilangRatecard: terbilangStr,
      customClauses,
    };
  }, [
    activeCreator,
    selectedCampaign,
    campaignBrandName,
    namaPihakPertama,
    jabatanPihakPertama,
    perusahaanPihakPertama,
    prefixNomor,
    customClauses,
  ]);

  // Handle Bulk ZIP Generation (Client-Side)
  const handleDownloadAllZip = async () => {
    if (targetCreators.length === 0) return;
    setIsZipping(true);
    setZipProgress({ current: 0, total: targetCreators.length });

    try {
      // Dynamic import pdf function from react-pdf
      const { pdf } = await import("@react-pdf/renderer");
      const zip = new JSZip();
      const dateStr = today.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

      for (let i = 0; i < targetCreators.length; i++) {
        const c = targetCreators[i];
        setZipProgress({ current: i + 1, total: targetCreators.length });

        const rateVal = Number(c.price) || 0;
        const terbilangStr = rateVal > 0 ? `${terbilang(rateVal).trim()} Rupiah` : "Nol Rupiah";
        const cData: CreatorContractData = {
          nomorKontrak: `${prefixNomor}/${c.cc_id}`,
          tanggalKontrak: dateStr,
          namaPihakPertama,
          jabatanPihakPertama,
          perusahaanPihakPertama,
          namaKreator: c.nama_lengkap || c.nama_asli || c.username,
          usernameTikTok: c.username,
          noWhatsapp: c.no_whatsapp || c.contact_nomor || "-",
          nikKtp: "",
          namaCampaign: selectedCampaign?.nama || "Campaign TNT",
          namaBrand: campaignBrandName || "Brand Partner",
          qtyVt: Number(c.qty_vt) || 1,
          qtyLive: Number(c.qty_live) || 0,
          ratecard: rateVal,
          terbilangRatecard: terbilangStr,
          customClauses,
        };

        const blob = await pdf(<CreatorContractPdfDocument data={cData} />).toBlob();
        const safeUname = c.username.replace(/[@\\/]/g, "").trim();
        const fname = `Kontrak_${safeUname}_${c.cc_id}.pdf`;
        zip.file(fname, blob);
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const safeCamp = (selectedCampaign?.nama || "Campaign").replace(/[\s\\/]/g, "_");
      saveAs(zipBlob, `Bundle_Kontrak_${safeCamp}_${targetCreators.length}kreator.zip`);
    } catch (err) {
      console.error("Gagal membuat zip kontrak:", err);
      alert("Terjadi kesalahan saat memproses paket berkas kontrak.");
    } finally {
      setIsZipping(false);
      setZipProgress(null);
    }
  };

  if (!selectedCampaign) {
    return (
      <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center">
        <FolderKanban className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-800">Pilih Campaign Terlebih Dahulu</h3>
        <p className="text-xs text-slate-500 mt-1">
          Silakan tentukan kampanye di atas untuk mulai membuat dan mengunduh berkas kontrak.
        </p>
      </div>
    );
  }

  if (targetCreators.length === 0) {
    return (
      <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center">
        <AlertCircle className="w-12 h-12 text-amber-400 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-800">Tidak Ada Kreator yang Memenuhi Kriteria</h3>
        <p className="text-xs text-slate-500 mt-1">
          Tidak ditemukan kreator pada kampanye ini dengan filter yang dipilih.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* PANEL KIRI: PENGATURAN KONTRAK & FORM GENERATOR */}
      <div className="lg:col-span-5 space-y-5">
        {/* KARTU TARGET REKAP */}
        <div className="bg-gradient-to-br from-blue-900 to-indigo-900 text-white p-5 rounded-2xl shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-300" />
              <span className="text-xs font-bold tracking-wider uppercase text-blue-200">
                Batch Generator Status
              </span>
            </div>
            {selectedCcIds.size > 0 && (
              <button
                onClick={onClearSelection}
                className="text-[11px] underline text-blue-200 hover:text-white"
              >
                Reset Pilihan
              </button>
            )}
          </div>

          <div>
            <div className="text-2xl font-extrabold tracking-tight">
              {targetCreators.length} Dokumen Kontrak
            </div>
            <p className="text-xs text-blue-200/80 mt-1">
              {selectedCcIds.size > 0
                ? `Menghasilkan kontrak khusus untuk ${selectedCcIds.size} kreator terpilih.`
                : `Menghasilkan kontrak untuk seluruh ${targetCreators.length} kreator dalam filter saat ini.`}
            </p>
          </div>

          <div className="pt-2 border-t border-white/10 flex flex-col sm:flex-row gap-2">
            <button
              onClick={handleDownloadAllZip}
              disabled={isZipping || targetCreators.length === 0}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isZipping ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>
                    Mengemas ZIP ({zipProgress?.current}/{zipProgress?.total})...
                  </span>
                </>
              ) : (
                <>
                  <Archive className="w-4 h-4" />
                  <span>Unduh Semua PDF (.ZIP)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* PENGATURAN KONTRAK & PIHAK PERTAMA */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <Edit3 className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Konfigurasi Legalitas & Klausul
            </h3>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                Format Prefix Nomor Surat
              </label>
              <input
                type="text"
                value={prefixNomor}
                onChange={(e) => setPrefixNomor(e.target.value)}
                placeholder="TNT/KTR/2026/10"
                className="w-full text-xs mt-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-1 focus:ring-blue-500 font-mono text-slate-800"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Hasil akhir nomor: {prefixNomor}/[ID_Kreator]
              </span>
            </div>

            <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/60 space-y-2.5">
              <span className="text-[11px] font-bold text-slate-700 uppercase flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-blue-600" />
                Data Pihak Pertama (TNT Agency)
              </span>

              <div>
                <label className="text-[10px] font-medium text-slate-500">Nama Penandatangan</label>
                <input
                  type="text"
                  value={namaPihakPertama}
                  onChange={(e) => setNamaPihakPertama(e.target.value)}
                  className="w-full text-xs mt-0.5 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-medium text-slate-500">Jabatan</label>
                  <input
                    type="text"
                    value={jabatanPihakPertama}
                    onChange={(e) => setJabatanPihakPertama(e.target.value)}
                    className="w-full text-xs mt-0.5 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-slate-500">Perusahaan</label>
                  <input
                    type="text"
                    value={perusahaanPihakPertama}
                    onChange={(e) => setPerusahaanPihakPertama(e.target.value)}
                    className="w-full text-xs mt-0.5 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                Ketentuan & Klausul Khusus (Pasal Tambahan)
              </label>
              <textarea
                rows={4}
                value={customClauses}
                onChange={(e) => setCustomClauses(e.target.value)}
                placeholder="Poin-poin aturan tambahan khusus kampanye ini..."
                className="w-full text-xs mt-1 p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-1 focus:ring-blue-500 text-slate-800"
              />
            </div>
          </div>
        </div>
      </div>

      {/* PANEL KANAN: LIVE PREVIEW & SINGLE DOWNLOADER */}
      <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-indigo-600" />
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Pratinjau Lembar Kontrak (Live Preview)
            </h3>
          </div>

          {/* Selector Creator untuk Preview */}
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-slate-500 font-medium">Lihat Contoh:</label>
            <select
              value={previewIndex}
              onChange={(e) => setPreviewIndex(Number(e.target.value))}
              className="text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-semibold text-slate-700 outline-none focus:ring-1 focus:ring-blue-500"
            >
              {targetCreators.map((c, idx) => (
                <option key={c.cc_id} value={idx}>
                  @{c.username} ({c.nama_lengkap || c.nama_asli || "Tanpa Nama"})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* PDF VIEWER CONTAINER */}
        <div className="w-full h-[540px] rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
          {activeContractData ? (
            <PDFViewer width="100%" height="100%" className="border-0">
              <CreatorContractPdfDocument data={activeContractData} />
            </PDFViewer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400">
              Memuat pratinjau dokumen...
            </div>
          )}
        </div>

        {/* ACTION BAR FOOTER PREVIEW */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <span>
            Sedang menampilkan dokumen untuk: <strong className="text-slate-800">@{activeCreator?.username}</strong>
          </span>

          {activeContractData && (
            <PDFDownloadLink
              document={<CreatorContractPdfDocument data={activeContractData} />}
              fileName={`Kontrak_${activeCreator?.username.replace("@", "")}_${selectedCampaign?.nama.replace(/\s+/g, "_")}.pdf`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
            >
              {({ loading }) => (
                <>
                  {loading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  <span>Unduh Dokumen Ini (PDF)</span>
                </>
              )}
            </PDFDownloadLink>
          )}
        </div>
      </div>
    </div>
  );
}
