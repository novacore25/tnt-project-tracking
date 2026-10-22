"use client";

import React from "react";
import dynamic from "next/dynamic";
import { X, Download, Printer, FileText, CheckCircle2 } from "lucide-react";
import { CreatorContractPdfDocument, CreatorContractData } from "@/components/contract/CreatorContractPdfDocument";

const PDFViewer = dynamic(
  () => import("@react-pdf/renderer").then((mod) => mod.PDFViewer),
  {
    ssr: false,
    loading: () => (
      <div className="h-[600px] flex items-center justify-center text-slate-400 font-semibold bg-slate-50">
        Menyiapkan pratinjau dokumen PDF...
      </div>
    ),
  }
);

const PDFDownloadLink = dynamic(
  () => import("@react-pdf/renderer").then((mod) => mod.PDFDownloadLink),
  { ssr: false }
);

interface ContractPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  contract: any | null;
}

export default function ContractPreviewModal({
  isOpen,
  onClose,
  contract,
}: ContractPreviewModalProps) {
  if (!isOpen || !contract) return null;

  const data: CreatorContractData = contract.contract_data || {};
  const isReleased = contract.status === "released";
  const docNumber = contract.nomor_kontrak || data.nomorKontrak || "DRAFT";
  const fileName = `Kontrak_${(contract.creator_username || data.usernameTikTok || "kreator").replace(/[^a-zA-Z0-9_-]/g, "_")}_${docNumber.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-2 sm:p-4 overflow-hidden">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* HEADER */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">
                  Pratinjau Dokumen Kontrak &amp; Cetak PDF
                </h3>
                {isReleased ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Dirilis Resmi
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Draft
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 font-mono mt-0.5">
                Nomor: {docNumber} &bull; @{contract.creator_username || data.usernameTikTok}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <PDFDownloadLink
              document={<CreatorContractPdfDocument data={data} />}
              fileName={fileName}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              {({ loading }) => (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>{loading ? "Menyiapkan PDF..." : "Download PDF"}</span>
                </>
              )}
            </PDFDownloadLink>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Tutup Pratinjau"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PDF VIEWER BODY */}
        <div className="flex-1 bg-slate-200 overflow-hidden relative">
          <PDFViewer width="100%" height="100%" className="border-none w-full h-full">
            <CreatorContractPdfDocument data={data} />
          </PDFViewer>
        </div>
      </div>
    </div>
  );
}
