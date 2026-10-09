"use client";

import React, { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/Dialog";
import { FileText, Download, Edit3, Eye, Loader2, CheckCircle2, User, Building } from "lucide-react";
import { CreatorContractPdfDocument, CreatorContractData } from "./CreatorContractPdfDocument";

// Dynamic import PDFViewer and pdf download helper to avoid Next.js SSR hydration mismatch
const PDFViewer = dynamic(
  () => import("@react-pdf/renderer").then((mod) => mod.PDFViewer),
  { ssr: false, loading: () => <div className="h-[450px] flex items-center justify-center text-slate-400 font-semibold"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Menyiapkan PDF viewer...</div> }
);

const PDFDownloadLink = dynamic(
  () => import("@react-pdf/renderer").then((mod) => mod.PDFDownloadLink),
  { ssr: false }
);

function terbilang(angka: number): string {
  const bilangan = [
    "", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh", "Sebelas"
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

interface ContractModalProps {
  isOpen: boolean;
  onClose: () => void;
  creatorData: {
    ccId: number;
    username: string;
    namaLengkap?: string;
    noWhatsapp?: string;
    ratecard: number;
    qtyVt: number;
    qtyLive: number;
  };
  campaignData: {
    id: number;
    nama: string;
    brandName?: string;
  };
  userName?: string;
}

export default function CreatorContractModal({
  isOpen,
  onClose,
  creatorData,
  campaignData,
  userName = "PIC TNT Kreatif"
}: ContractModalProps) {
  const [activeTab, setActiveTab] = useState<"preview" | "form">("preview");

  // Editable Form State
  const [namaPihakPertama, setNamaPihakPertama] = useState(userName);
  const [jabatanPihakPertama, setJabatanPihakPertama] = useState("Campaign Specialist");
  const [perusahaanPihakPertama, setPerusahaanPihakPertama] = useState("PT TNT Kreatif Nusantara");
  const [namaKreator, setNamaKreator] = useState(creatorData.namaLengkap || "");
  const [noWhatsapp, setNoWhatsapp] = useState(creatorData.noWhatsapp || "");
  const [nikKtp, setNikKtp] = useState("");
  const [customClauses, setCustomClauses] = useState(
    "1. Video wajib ditayangkan selambat-lambatnya 7 (tujuh) hari kerja setelah konsep disetujui.\n2. Konten tidak boleh dihapus atau di-private minimal selama 60 hari sejak penayangan."
  );

  const contractData: CreatorContractData = useMemo(() => {
    const today = new Date();
    const dateStr = today.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
    const contractNo = `TNT/KTR/${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, "0")}/${creatorData.ccId}`;

    const rateVal = creatorData.ratecard || 0;
    const terbilangStr = rateVal > 0 ? `${terbilang(rateVal).trim()} Rupiah` : "Nol Rupiah";

    return {
      nomorKontrak: contractNo,
      tanggalKontrak: dateStr,
      namaPihakPertama,
      jabatanPihakPertama,
      perusahaanPihakPertama,
      namaKreator: namaKreator || creatorData.username,
      usernameTikTok: creatorData.username,
      noWhatsapp,
      nikKtp,
      namaCampaign: campaignData.nama,
      namaBrand: campaignData.brandName || "Brand Partner",
      qtyVt: creatorData.qtyVt || 1,
      qtyLive: creatorData.qtyLive || 0,
      ratecard: rateVal,
      terbilangRatecard: terbilangStr,
      customClauses,
    };
  }, [
    creatorData,
    campaignData,
    namaPihakPertama,
    jabatanPihakPertama,
    perusahaanPihakPertama,
    namaKreator,
    noWhatsapp,
    nikKtp,
    customClauses
  ]);

  const fileName = `Kontrak_${creatorData.username.replace("@", "")}_${campaignData.nama.replace(/\s+/g, "_")}.pdf`;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-6">
        <DialogHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
          <div>
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              Generator Dokumen Kontrak Kreator
            </DialogTitle>
            <p className="text-xs text-slate-500 mt-0.5">
              @{creatorData.username} • {campaignData.nama}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600">
              <button
                type="button"
                onClick={() => setActiveTab("preview")}
                className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 ${
                  activeTab === "preview" ? "bg-white text-indigo-700 shadow-xs font-bold" : "hover:text-slate-900"
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                Live Preview
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("form")}
                className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 ${
                  activeTab === "form" ? "bg-white text-indigo-700 shadow-xs font-bold" : "hover:text-slate-900"
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                Sesuaikan Klausul
              </button>
            </div>
          </div>
        </DialogHeader>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto py-4 min-h-[450px]">
          {activeTab === "preview" ? (
            <div className="w-full h-[500px] rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
              <PDFViewer width="100%" height="100%" className="border-0">
                <CreatorContractPdfDocument data={contractData} />
              </PDFViewer>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                  <h4 className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
                    <Building className="w-4 h-4 text-indigo-600" /> Pihak Pertama (TNT Agency)
                  </h4>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500">Nama Perusahaan</label>
                    <input
                      type="text"
                      value={perusahaanPihakPertama}
                      onChange={(e) => setPerusahaanPihakPertama(e.target.value)}
                      className="w-full text-xs input mt-0.5"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500">Nama PIC Perwakilan</label>
                    <input
                      type="text"
                      value={namaPihakPertama}
                      onChange={(e) => setNamaPihakPertama(e.target.value)}
                      className="w-full text-xs input mt-0.5"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500">Jabatan Perwakilan</label>
                    <input
                      type="text"
                      value={jabatanPihakPertama}
                      onChange={(e) => setJabatanPihakPertama(e.target.value)}
                      className="w-full text-xs input mt-0.5"
                    />
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                  <h4 className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
                    <User className="w-4 h-4 text-emerald-600" /> Pihak Kedua (Kreator)
                  </h4>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500">Nama Lengkap (Sesuai KTP)</label>
                    <input
                      type="text"
                      value={namaKreator}
                      onChange={(e) => setNamaKreator(e.target.value)}
                      placeholder="Masukkan nama lengkap jika ada"
                      className="w-full text-xs input mt-0.5"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500">Nomor WhatsApp</label>
                    <input
                      type="text"
                      value={noWhatsapp}
                      onChange={(e) => setNoWhatsapp(e.target.value)}
                      placeholder="0812xxxx"
                      className="w-full text-xs input mt-0.5"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500">NIK / Nomor KTP (Opsional)</label>
                    <input
                      type="text"
                      value={nikKtp}
                      onChange={(e) => setNikKtp(e.target.value)}
                      placeholder="3201xxxx"
                      className="w-full text-xs input mt-0.5"
                    />
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                <h4 className="text-xs font-bold text-slate-700 uppercase">
                  Pasal Tambahan / Ketentuan Khusus (Opsional)
                </h4>
                <textarea
                  rows={4}
                  value={customClauses}
                  onChange={(e) => setCustomClauses(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                  placeholder="Ketik poin-poin klausul tambahan khusus jika ada..."
                />
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            Kompilasi PDF berjalan instan di browser user (0% beban server).
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all"
            >
              Tutup
            </button>

            <PDFDownloadLink
              document={<CreatorContractPdfDocument data={contractData} />}
              fileName={fileName}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-all cursor-pointer"
            >
              {({ loading }) => (
                <>
                  {loading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Memproses PDF...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5" />
                      <span>Download PDF Kontrak</span>
                    </>
                  )}
                </>
              )}
            </PDFDownloadLink>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
