"use client";

import React, { useState, useMemo } from "react";
import {
  Search,
  CheckCircle2,
  Lock,
  Clock,
  Printer,
  Edit,
  Trash2,
  RefreshCw,
  AlertCircle,
  FileSpreadsheet,
  Download,
  Layers,
  FileText,
  User,
  CreditCard,
  Building,
  Calendar,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import * as XLSX from "xlsx";
import {
  releaseContractAction,
  deleteContractAction,
} from "@/app/actions/contractActions";
import DocumentSpreadsheetModal from "./DocumentSpreadsheetModal";
import ContractPreviewModal from "./ContractPreviewModal";
import ReleaseContractModal from "./ReleaseContractModal";

interface ContractTableViewProps {
  contracts: any[];
  onRefresh: () => void;
  onEditContract: (contract: any) => void;
  onPreviewContract: (contract: any) => void;
  campaignId?: number;
  campaignName?: string;
}

const TIPE_DOKUMEN_OPTIONS = [
  { value: "all", label: "Semua Tipe Dokumen" },
  { value: "perjanjian_kerjasama", label: "Surat Perjanjian Kerja Sama (Join Campaign)" },
  { value: "spk_talent", label: "Surat Perintah Kerja (SPK Talent)" },
  { value: "mou_brand", label: "MoU Brand Partner" },
  { value: "adendum", label: "Adendum Kontrak" },
];

export default function ContractTableView({
  contracts,
  onRefresh,
  onEditContract,
  onPreviewContract,
  campaignId,
  campaignName,
}: ContractTableViewProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all"); // 'all' | 'draft' | 'released'
  const [tipeDokumenFilter, setTipeDokumenFilter] = useState<string>("all");
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [toastMsg, setToastMsg] = useState<{ success: boolean; text: string } | null>(null);

  // Modal State
  const [isSpreadsheetOpen, setIsSpreadsheetOpen] = useState(false);
  const [previewingContract, setPreviewingContract] = useState<any | null>(null);
  const [releasingContract, setReleasingContract] = useState<any | null>(null);

  const showToast = (success: boolean, text: string) => {
    setToastMsg({ success, text });
    setTimeout(() => setToastMsg(null), 5000);
  };

  const filteredList = useMemo(() => {
    return contracts.filter((c: any) => {
      // Filter Status (Draft vs Dirilis)
      if (statusFilter !== "all" && c.status !== statusFilter) return false;

      // Filter Tipe Dokumen
      if (tipeDokumenFilter !== "all") {
        const curType = c.tipe_dokumen || "perjanjian_kerjasama";
        if (curType !== tipeDokumenFilter) return false;
      }

      // Filter Search
      if (!search.trim()) return true;
      const s = search.toLowerCase();
      const num = (c.nomor_kontrak || "").toLowerCase();
      const u = (c.creator_username || "").toLowerCase();
      const n = (c.creator_nama || "").toLowerCase();
      const cmp = (c.campaign_nama || "").toLowerCase();
      const d = c.contract_data || {};
      const nik = (d.nikKtp || "").toLowerCase();
      const bank = (d.namaBank || "").toLowerCase();

      return (
        num.includes(s) ||
        u.includes(s) ||
        n.includes(s) ||
        cmp.includes(s) ||
        nik.includes(s) ||
        bank.includes(s)
      );
    });
  }, [contracts, statusFilter, tipeDokumenFilter, search]);

  // Hitung jumlah draft & released untuk badge filter
  const counts = useMemo(() => {
    let draft = 0;
    let released = 0;
    for (const c of contracts) {
      if (c.status === "released") released++;
      else draft++;
    }
    return { all: contracts.length, draft, released };
  }, [contracts]);

  // Handler Rilis Dokumen Resmi
  const handleReleaseContract = async (contract: any) => {
    if (contract.status === "released") {
      alert(`Dokumen ini sudah dirilis sebelumnya dengan nomor ${contract.nomor_kontrak}`);
      return;
    }

    const conf = window.confirm(
      `Apakah Anda yakin ingin MERILIS RESMI kontrak untuk @${contract.creator_username}?\n\nNomor urut resmi berikutnya akan otomatis ditetapkan dan dikunci secara global.`
    );
    if (!conf) return;

    setActionLoadingId(contract.id);
    try {
      const res = await releaseContractAction(contract.id);
      if (res.success) {
        showToast(true, res.message || "Dokumen berhasil dirilis resmi.");
        onRefresh();
      } else {
        showToast(false, res.error || "Gagal merilis dokumen.");
      }
    } catch (err: any) {
      showToast(false, err.message || "Terjadi kesalahan.");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handler Hapus Draft
  const handleDeleteContract = async (contract: any) => {
    if (contract.status === "released") {
      alert("Dokumen yang telah dirilis resmi tidak dapat dihapus!");
      return;
    }

    const conf = window.confirm(
      `Hapus draft dokumen kontrak untuk @${contract.creator_username}?`
    );
    if (!conf) return;

    setActionLoadingId(contract.id);
    try {
      const res = await deleteContractAction(contract.id);
      if (res.success) {
        showToast(true, res.message || "Draft berhasil dihapus.");
        onRefresh();
      } else {
        showToast(false, res.error || "Gagal menghapus.");
      }
    } catch (err: any) {
      showToast(false, err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Export ke Excel
  const handleExportExcel = () => {
    if (filteredList.length === 0) {
      alert("Tidak ada data untuk diekspor.");
      return;
    }

    const exportData = filteredList.map((c: any, idx: number) => {
      const d = c.contract_data || {};
      return {
        No: idx + 1,
        "Nomor Kontrak": c.nomor_kontrak || "[DRAFT]",
        Status: c.status === "released" ? "Dirilis Resmi" : "Draft",
        "Tipe Dokumen": c.tipe_dokumen || "perjanjian_kerjasama",
        Username: `@${c.creator_username}`,
        "Nama Lengkap (KTP)": d.namaKreator || c.creator_nama || "",
        "Status Binding": (c.status_binding || d.statusBinding || "Non-Binding").replace("KREATOR ", ""),
        "NIK KTP": d.nikKtp || "",
        Alamat: d.alamatKreator || "",
        "No WhatsApp": d.teleponKreator || "",
        Bank: d.namaBank || "",
        "Nomor Rekening": d.nomorRekening || "",
        "Atas Nama Rekening": d.atasNamaRekening || "",
        "Qty VT": d.qtyVt || 1,
        "Fee Kontrak (Rp)": d.biayaHonor || 0,
        "PIC Pembuat": c.created_by_name || "-",
        "PIC Rilis": c.released_by_name || "-",
        "Tanggal Rilis": c.released_at ? new Date(c.released_at).toLocaleDateString("id-ID") : "-",
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Daftar Dokumen");
    XLSX.writeFile(workbook, `Rekap_Dokumen_Kontrak_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  return (
    <div className="space-y-4">
      {/* TOAST ALERT */}
      {toastMsg && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center justify-between shadow-md transition-all ${
            toastMsg.success
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          <div className="flex items-center gap-2">
            {toastMsg.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{toastMsg.text}</span>
          </div>
          <button onClick={() => setToastMsg(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
            &times;
          </button>
        </div>
      )}

      {/* TOOLBAR UTAMA */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        {/* PENCARIAN & FILTER STATUS SWITCH */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1 flex-wrap">
          {/* SEARCH INPUT */}
          <div className="relative min-w-[240px] flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nomor kontrak, username, NIK..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
            />
          </div>

          {/* TIPE DOKUMEN SELECTOR */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
            <Layers className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={tipeDokumenFilter}
              onChange={(e) => setTipeDokumenFilter(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-700 outline-none cursor-pointer"
            >
              {TIPE_DOKUMEN_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* STATUS SWITCH FILTER (TABS) */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                statusFilter === "all"
                  ? "bg-white text-blue-700 shadow-2xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Semua ({counts.all})
            </button>
            <button
              onClick={() => setStatusFilter("draft")}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                statusFilter === "draft"
                  ? "bg-amber-500 text-white shadow-2xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Clock className="w-3 h-3" />
              Draft ({counts.draft})
            </button>
            <button
              onClick={() => setStatusFilter("released")}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                statusFilter === "released"
                  ? "bg-emerald-600 text-white shadow-2xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <CheckCircle2 className="w-3 h-3" />
              Dirilis ({counts.released})
            </button>
          </div>
        </div>

        {/* TOMBOL AKSI UTAMA */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* TOMBOL MINI-EXCEL IMPORT & UPDATE DATA */}
          {campaignId && (
            <button
              type="button"
              onClick={() => setIsSpreadsheetOpen(true)}
              className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/20 flex items-center gap-2 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Import &amp; Update Data (Excel)</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleExportExcel}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            <span>Export Excel</span>
          </button>

          <button
            type="button"
            onClick={onRefresh}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* DAFTAR DOKUMEN TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="w-12 px-4 py-3.5 text-center">#</th>
                <th className="px-4 py-3.5">Nomor Dokumen</th>
                <th className="px-4 py-3.5">Kreator &amp; Akun</th>
                <th className="px-4 py-3.5">Binding</th>
                <th className="px-4 py-3.5">Deliverables</th>
                <th className="px-4 py-3.5">Fee Honor</th>
                <th className="px-4 py-3.5">Data Rekening</th>
                <th className="px-4 py-3.5">Status &amp; PIC</th>
                <th className="px-4 py-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-14 text-center">
                    <div className="max-w-md mx-auto space-y-2">
                      <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                        <FileText className="w-6 h-6" />
                      </div>
                      <p className="font-semibold text-slate-700">
                        Tidak ada dokumen kontrak yang cocok
                      </p>
                      <p className="text-xs text-slate-400">
                        {statusFilter === "released"
                          ? "Belum ada dokumen yang dirilis resmi. Rilis draft untuk mendapatkan nomor urut resmi."
                          : "Saat kreator di-approve di listing, draft dokumen otomatis muncul di sini. Anda juga bisa mengimpor data via tombol Import Data (Excel)."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredList.map((c: any, idx: number) => {
                  const d = c.contract_data || {};
                  const isReleased = c.status === "released";
                  const namaKreator = d.namaKreator || c.creator_nama || c.creator_username;
                  const binding = (c.status_binding || d.statusBinding || "Non-Binding").replace("KREATOR ", "");
                  const isBinding = binding.toLowerCase().includes("binding") && !binding.toLowerCase().includes("non");
                  const honor = Number(d.biayaHonor || 0);
                  const bank = d.namaBank || "";
                  const rek = d.nomorRekening || "";
                  const holder = d.atasNamaRekening || "";
                  const hasRekening = Boolean(bank && rek);

                  return (
                    <tr
                      key={c.id}
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      {/* # */}
                      <td className="px-4 py-3.5 text-center text-slate-400 font-mono text-[11px]">
                        {idx + 1}
                      </td>

                      {/* NOMOR DOKUMEN & TIPE */}
                      <td className="px-4 py-3.5">
                        <div className="space-y-1">
                          {isReleased ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              <Lock className="w-3 h-3 text-blue-600 shrink-0" />
                              <span>{c.nomor_kontrak}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                              <Clock className="w-3 h-3 text-amber-600 shrink-0" />
                              <span>{c.nomor_kontrak || "[DRAFT KONTRAK]"}</span>
                            </span>
                          )}
                          <div className="flex items-center gap-1 text-[10px] text-slate-400">
                            <span>Perjanjian Kerja Sama (Join Campaign)</span>
                          </div>
                        </div>
                      </td>

                      {/* KREATOR & AKUN */}
                      <td className="px-4 py-3.5">
                        <div>
                          <div className="font-bold text-slate-900 flex items-center gap-1">
                            <span className="text-blue-600">@{c.creator_username}</span>
                          </div>
                          <div className="text-slate-600 font-medium text-[11px] mt-0.5">
                            {namaKreator}
                          </div>
                          {d.nikKtp && (
                            <div className="text-[10px] text-slate-400 font-mono">
                              NIK: {d.nikKtp}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* STATUS BINDING */}
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isBinding
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                              : "bg-slate-100 text-slate-600 border border-slate-200"
                          }`}
                        >
                          {isBinding ? "Binding" : "Non-Binding"}
                        </span>
                      </td>

                      {/* DELIVERABLES */}
                      <td className="px-4 py-3.5">
                        <div className="space-y-0.5">
                          <div className="font-semibold text-slate-700">
                            {d.qtyVt || 1} Video TikTok
                          </div>
                          {Number(d.qtyLive || 0) > 0 && (
                            <div className="text-[11px] text-slate-500">
                              {d.qtyLive} Livestream
                            </div>
                          )}
                        </div>
                      </td>

                      {/* FEE HONOR */}
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-slate-900">
                          {honor > 0 ? `Rp ${honor.toLocaleString("id-ID")}` : "Rp 0 (Barter/Free)"}
                        </div>
                        <div className="text-[10px] text-slate-400">Fee Honor</div>
                      </td>

                      {/* DATA REKENING */}
                      <td className="px-4 py-3.5">
                        {hasRekening ? (
                          <div className="space-y-0.5">
                            <div className="font-semibold text-slate-800">
                              {bank} - {rek}
                            </div>
                            <div className="text-[10px] text-slate-500 truncate max-w-[150px]">
                              a.n {holder}
                            </div>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                            <AlertCircle className="w-3 h-3" />
                            Belum Ada Rekening
                          </span>
                        )}
                      </td>

                      {/* STATUS & PIC */}
                      <td className="px-4 py-3.5">
                        <div className="space-y-0.5">
                          <div>
                            {isReleased ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                Dirilis Resmi
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                                Draft
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            Oleh: {c.created_by_name || "PIC TNT"}
                          </div>
                        </div>
                      </td>

                      {/* AKSI */}
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* TOMBOL CETAK / PDF */}
                          <button
                            type="button"
                            onClick={() => setPreviewingContract(c)}
                            className="p-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="Pratinjau & Cetak PDF"
                          >
                            <Printer className="w-4 h-4" />
                          </button>

                          {/* TOMBOL RILIS (HANYA BILA DRAFT) */}
                          {!isReleased && (
                            <button
                              type="button"
                              onClick={() => setReleasingContract(c)}
                              disabled={actionLoadingId === c.id}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold transition-all shadow-2xs flex items-center gap-1 cursor-pointer disabled:opacity-50"
                              title="Rilis Resmi & Kunci Nomor Dokumen"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Rilis</span>
                            </button>
                          )}

                          {/* TOMBOL EDIT DOKUMEN / FORM */}
                          {!isReleased && (
                            <button
                              type="button"
                              onClick={() => onEditContract(c)}
                              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                              title="Edit Form Dokumen"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          )}

                          {/* TOMBOL HAPUS DRAFT */}
                          {!isReleased && (
                            <button
                              type="button"
                              onClick={() => handleDeleteContract(c)}
                              disabled={actionLoadingId === c.id}
                              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                              title="Hapus Draft Dokumen"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SPREADSHEET MINI EXCEL MODAL */}
      {campaignId && (
        <DocumentSpreadsheetModal
          isOpen={isSpreadsheetOpen}
          onClose={() => setIsSpreadsheetOpen(false)}
          campaignId={campaignId}
          campaignName={campaignName}
          onSuccess={() => {
            onRefresh();
          }}
        />
      )}

      {/* MODAL CETAK & PREVIEW PDF */}
      <ContractPreviewModal
        isOpen={Boolean(previewingContract)}
        onClose={() => setPreviewingContract(null)}
        contract={previewingContract}
      />

      {/* MODAL VERIFIKASI DATA & RILIS DOKUMEN RESMI */}
      <ReleaseContractModal
        isOpen={Boolean(releasingContract)}
        onClose={() => setReleasingContract(null)}
        contract={releasingContract}
        onSuccess={() => {
          showToast(true, "Dokumen resmi berhasil dirilis!");
          onRefresh();
        }}
      />
    </div>
  );
}
