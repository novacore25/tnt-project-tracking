"use client";

import React, { useState, useMemo, useRef } from "react";
import {
  Search,
  CheckCircle2,
  Lock,
  Clock,
  Printer,
  Edit,
  Trash2,
  Save,
  RefreshCw,
  Table as TableIcon,
  AlertCircle,
  Wand2,
  FileSpreadsheet,
  Download
} from "lucide-react";
import * as XLSX from "xlsx";
import {
  releaseContractAction,
  deleteContractAction,
  batchUpdateContractsAction,
} from "@/app/actions/contractActions";

interface ContractTableViewProps {
  contracts: any[];
  onRefresh: () => void;
  onEditContract: (contract: any) => void;
  onPreviewContract: (contract: any) => void;
  campaignId?: number;
}

type EditableContractColumn =
  | "namaKreator"
  | "nikKtp"
  | "alamatKreator"
  | "teleponKreator"
  | "statusBinding"
  | "namaBank"
  | "nomorRekening"
  | "atasNamaRekening"
  | "qtyVt"
  | "biayaHonor";

export default function ContractTableView({
  contracts,
  onRefresh,
  onEditContract,
  onPreviewContract,
  campaignId,
}: ContractTableViewProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // State untuk perbaris yang diedit / di-paste
  const [editedRows, setEditedRows] = useState<{ [id: number]: any }>({});
  const [isSavingBatch, setIsSavingBatch] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [toastMsg, setToastMsg] = useState<{ success: boolean; text: string } | null>(null);

  const showToast = (success: boolean, text: string) => {
    setToastMsg({ success, text });
    setTimeout(() => setToastMsg(null), 4000);
  };

  const filteredList = useMemo(() => {
    return contracts.filter((c: any) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (!search.trim()) return true;
      const s = search.toLowerCase();
      const num = (c.nomor_kontrak || "").toLowerCase();
      const u = (c.creator_username || "").toLowerCase();
      const n = (c.creator_nama || "").toLowerCase();
      const cmp = (c.campaign_nama || "").toLowerCase();
      return num.includes(s) || u.includes(s) || n.includes(s) || cmp.includes(s);
    });
  }, [contracts, statusFilter, search]);

  const handleCellChange = (id: number, field: EditableContractColumn, value: any) => {
    setEditedRows((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] || {}),
        [field]: value,
      },
    }));
  };

  // MULTI-CELL & MULTI-ROW EXCEL PASTE HANDLER (Persis seperti Spreadsheet Import Kreator)
  const handlePaste = (
    e: React.ClipboardEvent<HTMLInputElement>,
    startRowIdx: number,
    startColName: EditableContractColumn
  ) => {
    const text = e.clipboardData.getData("text/plain");
    if (!text || (!text.includes("\t") && !text.includes("\n"))) {
      return; // Single value standard paste
    }
    e.preventDefault();

    // Parse Excel TSV format
    const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
    const parsedGrid = lines.map((l) => l.split("\t"));

    const columnOrder: EditableContractColumn[] = [
      "namaKreator",
      "statusBinding",
      "nikKtp",
      "alamatKreator",
      "teleponKreator",
      "namaBank",
      "nomorRekening",
      "atasNamaRekening",
      "qtyVt",
      "biayaHonor",
    ];

    const startColIdx = columnOrder.indexOf(startColName);
    if (startColIdx === -1) return;

    setEditedRows((prev) => {
      const nextEdited = { ...prev };

      for (let r = 0; r < parsedGrid.length; r++) {
        const targetRowIdx = startRowIdx + r;
        if (targetRowIdx >= filteredList.length) break;

        const rowItem = filteredList[targetRowIdx];
        if (rowItem.status === "released") continue; // Lewati jika sudah dirilis resmi / terkunci

        const currentEdit = { ...(nextEdited[rowItem.id] || {}) };
        const pasteCells = parsedGrid[r];

        for (let c = 0; c < pasteCells.length; c++) {
          const targetColIdx = startColIdx + c;
          if (targetColIdx >= columnOrder.length) break;

          const colKey = columnOrder[targetColIdx];
          let cellVal = pasteCells[c].trim();

          if (colKey === "nikKtp") {
            cellVal = cellVal.replace(/\D/g, "").slice(0, 16);
          } else if (colKey === "biayaHonor" || colKey === "qtyVt") {
            cellVal = cellVal.replace(/[^\d]/g, "");
          } else if (colKey === "statusBinding") {
            cellVal =
              cellVal.toLowerCase().includes("binding") &&
              !cellVal.toLowerCase().includes("non")
                ? "KREATOR Binding"
                : "KREATOR Non-Binding";
          }

          currentEdit[colKey] = cellVal;
        }

        nextEdited[rowItem.id] = currentEdit;
      }

      return nextEdited;
    });

    showToast(true, `Berhasil paste ${parsedGrid.length} baris dari Excel.`);
  };

  const handleSaveExcelBatch = async () => {
    const ids = Object.keys(editedRows).map(Number);
    if (ids.length === 0) {
      showToast(true, "Tidak ada perubahan yang perlu disimpan.");
      return;
    }

    setIsSavingBatch(true);
    try {
      const payload = ids.map((id) => ({
        id,
        ...editedRows[id],
      }));
      const res = await batchUpdateContractsAction(payload);
      if (res.success) {
        showToast(true, res.message || "Seluruh data kontrak berhasil disimpan!");
        setEditedRows({});
        onRefresh();
      } else {
        showToast(false, res.error || "Gagal menyimpan perubahan.");
      }
    } catch (err: any) {
      showToast(false, err.message || "Terjadi kesalahan.");
    } finally {
      setIsSavingBatch(false);
    }
  };

  const handleRelease = async (c: any) => {
    if (
      !confirm(
        `Rilis resmi kontrak untuk @${c.creator_username}?\nNomor urut resmi global berikutnya akan otomatis terkunci.`
      )
    ) {
      return;
    }
    setActionLoadingId(c.id);
    try {
      const res = await releaseContractAction(c.id);
      if (res.success) {
        showToast(true, res.message || "Dokumen berhasil dirilis.");
        onRefresh();
      } else {
        showToast(false, res.error || "Gagal merilis dokumen.");
      }
    } catch (err: any) {
      showToast(false, err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDelete = async (c: any) => {
    if (!confirm(`Hapus draft kontrak untuk @${c.creator_username}?`)) {
      return;
    }
    setActionLoadingId(c.id);
    try {
      const res = await deleteContractAction(c.id);
      if (res.success) {
        showToast(true, "Draft dokumen berhasil dihapus.");
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

  // EXPORT KE EXCEL
  const handleExportExcel = () => {
    if (filteredList.length === 0) {
      alert("Tidak ada data untuk diekspor.");
      return;
    }

    const exportData = filteredList.map((c: any, idx: number) => {
      const d = c.contract_data || {};
      const edit = editedRows[c.id] || {};
      return {
        No: idx + 1,
        "Nomor Kontrak": c.nomor_kontrak || "[DRAFT]",
        Status: c.status === "released" ? "Dirilis Resmi" : "Draft",
        Username: `@${c.creator_username}`,
        "Nama Lengkap (KTP)": edit.namaKreator ?? (d.namaKreator || c.creator_nama || ""),
        "Status Binding": (edit.statusBinding ?? (c.status_binding || d.statusBinding || "Non-Binding")).replace("KREATOR ", ""),
        "NIK KTP": edit.nikKtp ?? (d.nikKtp || ""),
        Alamat: edit.alamatKreator ?? (d.alamatKreator || ""),
        "No WhatsApp": edit.teleponKreator ?? (d.teleponKreator || ""),
        Bank: edit.namaBank ?? (d.namaBank || ""),
        "Nomor Rekening": edit.nomorRekening ?? (d.nomorRekening || ""),
        "Atas Nama": edit.atasNamaRekening ?? (d.atasNamaRekening || ""),
        "Qty VT": edit.qtyVt ?? (d.qtyVt || 1),
        "Fee Kontrak (Rp)": edit.biayaHonor ?? (d.biayaHonor || 0),
        "Dibuat Oleh": c.created_by_name || "-",
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Dokumen Kontrak");
    XLSX.writeFile(workbook, `Rekap_Dokumen_Kontrak_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const changedCount = Object.keys(editedRows).length;

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
          <button onClick={() => setToastMsg(null)} className="text-slate-400 hover:text-slate-600">
            &times;
          </button>
        </div>
      )}

      {/* TOOLBAR UTAMA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nomor dokumen, username, atau nama..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none"
          >
            <option value="all">Semua Status</option>
            <option value="draft">Draft (Bisa Edit / Paste)</option>
            <option value="released">Dirilis Resmi (Terkunci)</option>
          </select>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {changedCount > 0 && (
            <button
              type="button"
              onClick={handleSaveExcelBatch}
              disabled={isSavingBatch}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 animate-pulse cursor-pointer disabled:opacity-50"
            >
              {isSavingBatch ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>Simpan {changedCount} Perubahan Tabel</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleExportExcel}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>Export Excel</span>
          </button>

          <button
            type="button"
            onClick={onRefresh}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 cursor-pointer"
            title="Refresh Data & Auto-Sync Approved"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* SPREADSHEET MINI-EXCEL GRID */}
      <div className="bg-white rounded-xl border border-slate-300 shadow-sm overflow-hidden flex flex-col">
        <div className="px-4 py-2.5 bg-slate-100/90 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span className="font-bold text-slate-800">
              Tabel Spreadsheet Kontrak Kreator (Auto-Fill &amp; Support Multi-Cell Paste)
            </span>
          </div>
          <span className="text-[11px] text-slate-500 font-normal">
            💡 Tips: Anda bisa meng-copy baris dari Excel lalu langsung <b>Ctrl+V</b> di sel mana saja.
          </span>
        </div>

        <div className="overflow-x-auto max-h-[660px]">
          <table className="w-full border-collapse text-xs" style={{ tableLayout: "fixed" }}>
            <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-[11px] border-b border-slate-300 sticky top-0 z-10 shadow-xs">
              <tr>
                <th className="w-12 px-2 py-2 text-center border-b border-r border-slate-300 bg-slate-100">No</th>
                <th className="w-44 px-3 py-2 text-left border-b border-r border-slate-300 bg-slate-100">Nomor Kontrak</th>
                <th className="w-28 px-3 py-2 text-left border-b border-r border-slate-300 bg-slate-100">Status</th>
                <th className="w-36 px-3 py-2 text-left border-b border-r border-slate-300 bg-slate-100">Username</th>
                <th className="w-48 px-3 py-2 text-left border-b border-r border-slate-300 bg-slate-100">Nama Lengkap (KTP)</th>
                <th className="w-32 px-3 py-2 text-left border-b border-r border-slate-300 bg-slate-100">Status Binding</th>
                <th className="w-36 px-3 py-2 text-left border-b border-r border-slate-300 bg-slate-100">NIK (16 Digit)</th>
                <th className="w-56 px-3 py-2 text-left border-b border-r border-slate-300 bg-slate-100">Alamat KTP / Domisili</th>
                <th className="w-32 px-3 py-2 text-left border-b border-r border-slate-300 bg-slate-100">WhatsApp</th>
                <th className="w-28 px-3 py-2 text-left border-b border-r border-slate-300 bg-slate-100">Bank</th>
                <th className="w-36 px-3 py-2 text-left border-b border-r border-slate-300 bg-slate-100">No. Rekening</th>
                <th className="w-44 px-3 py-2 text-left border-b border-r border-slate-300 bg-slate-100">Atas Nama Rekening</th>
                <th className="w-20 px-3 py-2 text-center border-b border-r border-slate-300 bg-slate-100">Qty VT</th>
                <th className="w-32 px-3 py-2 text-left border-b border-r border-slate-300 bg-slate-100">Fee Honor (Rp)</th>
                <th className="w-32 px-3 py-2 text-left border-b border-r border-slate-300 bg-slate-100">PIC Pembuat</th>
                <th className="w-32 px-3 py-2 text-right border-b border-slate-300 bg-slate-100 sticky right-0 z-20">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={16} className="p-8 text-center text-slate-400 font-medium bg-white">
                    Belum ada kreator berstatus Approved di campaign ini. Saat kreator di-approve di listing, draft otomatis muncul di sini.
                  </td>
                </tr>
              ) : (
                filteredList.map((c: any, idx: number) => {
                  const d = c.contract_data || {};
                  const isDraft = c.status === "draft";
                  const editData = editedRows[c.id] || {};

                  const curNama = editData.namaKreator !== undefined ? editData.namaKreator : (d.namaKreator || c.creator_nama || "");
                  const curBinding = editData.statusBinding !== undefined ? editData.statusBinding : (c.status_binding || d.statusBinding || "KREATOR Non-Binding");
                  const curNik = editData.nikKtp !== undefined ? editData.nikKtp : (d.nikKtp || "");
                  const curAlamat = editData.alamatKreator !== undefined ? editData.alamatKreator : (d.alamatKreator || "");
                  const curWa = editData.teleponKreator !== undefined ? editData.teleponKreator : (d.teleponKreator || "");
                  const curBank = editData.namaBank !== undefined ? editData.namaBank : (d.namaBank || "");
                  const curRek = editData.nomorRekening !== undefined ? editData.nomorRekening : (d.nomorRekening || "");
                  const curHolder = editData.atasNamaRekening !== undefined ? editData.atasNamaRekening : (d.atasNamaRekening || curNama);
                  const curVt = editData.qtyVt !== undefined ? editData.qtyVt : (d.qtyVt || 1);
                  const curHonor = editData.biayaHonor !== undefined ? editData.biayaHonor : (d.biayaHonor || 0);

                  const isRowChanged = Boolean(editedRows[c.id]);

                  return (
                    <tr
                      key={c.id}
                      className={`hover:bg-blue-50/40 transition-colors ${
                        isRowChanged
                          ? "bg-amber-50/70"
                          : !isDraft
                          ? "bg-emerald-50/25"
                          : "bg-white"
                      }`}
                    >
                      {/* NO */}
                      <td className="px-2 py-1 text-center font-mono text-slate-400 border-b border-r border-slate-300 bg-slate-50">
                        {idx + 1}
                      </td>

                      {/* NOMOR KONTRAK */}
                      <td className="px-3 py-1 font-mono font-bold border-b border-r border-slate-300">
                        {isDraft ? (
                          <span className="text-amber-700 bg-amber-100/70 border border-amber-300 px-1.5 py-0.5 rounded text-[10px] truncate block">
                            {c.nomor_kontrak || "[DRAFT AUTO]"}
                          </span>
                        ) : (
                          <span className="text-emerald-800 bg-emerald-100/80 border border-emerald-300 px-2 py-0.5 rounded text-[11px] truncate block">
                            {c.nomor_kontrak}
                          </span>
                        )}
                      </td>

                      {/* STATUS */}
                      <td className="px-3 py-1 border-b border-r border-slate-300">
                        {isDraft ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                            <Clock className="w-3 h-3" /> Draft
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-3 h-3" /> Dirilis Resmi
                          </span>
                        )}
                      </td>

                      {/* USERNAME */}
                      <td className="px-3 py-1 font-bold text-slate-800 border-b border-r border-slate-300 bg-slate-50/60 truncate">
                        @{c.creator_username}
                      </td>

                      {/* NAMA KREATOR (KTP) */}
                      <td className="p-0 border-b border-r border-slate-300">
                        {isDraft ? (
                          <input
                            type="text"
                            value={curNama}
                            onChange={(e) => handleCellChange(c.id, "namaKreator", e.target.value)}
                            onPaste={(e) => handlePaste(e, idx, "namaKreator")}
                            placeholder="Nama Sesuai KTP"
                            className="w-full h-full min-h-[36px] px-2.5 py-1 outline-none text-xs text-slate-800 focus:bg-blue-50 font-medium placeholder-slate-300"
                          />
                        ) : (
                          <div className="px-3 py-1 text-xs text-slate-700 truncate">{curNama}</div>
                        )}
                      </td>

                      {/* STATUS BINDING */}
                      <td className="p-0 border-b border-r border-slate-300">
                        {isDraft ? (
                          <select
                            value={curBinding}
                            onChange={(e) => handleCellChange(c.id, "statusBinding", e.target.value)}
                            className="w-full h-full min-h-[36px] px-2 py-1 outline-none text-xs text-slate-800 bg-transparent cursor-pointer font-semibold"
                          >
                            <option value="KREATOR Non-Binding">Non-Binding</option>
                            <option value="KREATOR Binding">Binding</option>
                          </select>
                        ) : (
                          <div className="px-3 py-1 text-[11px] font-semibold text-slate-700">
                            {curBinding.replace("KREATOR ", "")}
                          </div>
                        )}
                      </td>

                      {/* NIK KTP */}
                      <td className="p-0 border-b border-r border-slate-300 font-mono">
                        {isDraft ? (
                          <input
                            type="text"
                            maxLength={16}
                            value={curNik}
                            onChange={(e) => handleCellChange(c.id, "nikKtp", e.target.value)}
                            onPaste={(e) => handlePaste(e, idx, "nikKtp")}
                            placeholder="16 digit"
                            className="w-full h-full min-h-[36px] px-2.5 py-1 outline-none text-xs text-slate-800 focus:bg-blue-50 font-mono placeholder-slate-300"
                          />
                        ) : (
                          <div className="px-3 py-1 text-xs text-slate-700 font-mono">{curNik || "-"}</div>
                        )}
                      </td>

                      {/* ALAMAT KTP */}
                      <td className="p-0 border-b border-r border-slate-300">
                        {isDraft ? (
                          <input
                            type="text"
                            value={curAlamat}
                            onChange={(e) => handleCellChange(c.id, "alamatKreator", e.target.value)}
                            onPaste={(e) => handlePaste(e, idx, "alamatKreator")}
                            placeholder="Domisili / KTP"
                            className="w-full h-full min-h-[36px] px-2.5 py-1 outline-none text-xs text-slate-800 focus:bg-blue-50 placeholder-slate-300"
                          />
                        ) : (
                          <div className="px-3 py-1 text-xs text-slate-700 truncate" title={curAlamat}>
                            {curAlamat || "-"}
                          </div>
                        )}
                      </td>

                      {/* WHATSAPP */}
                      <td className="p-0 border-b border-r border-slate-300 font-mono">
                        {isDraft ? (
                          <input
                            type="text"
                            value={curWa}
                            onChange={(e) => handleCellChange(c.id, "teleponKreator", e.target.value)}
                            onPaste={(e) => handlePaste(e, idx, "teleponKreator")}
                            placeholder="0812xxx"
                            className="w-full h-full min-h-[36px] px-2.5 py-1 outline-none text-xs text-slate-800 focus:bg-blue-50 font-mono placeholder-slate-300"
                          />
                        ) : (
                          <div className="px-3 py-1 text-xs text-slate-700 font-mono">{curWa || "-"}</div>
                        )}
                      </td>

                      {/* BANK */}
                      <td className="p-0 border-b border-r border-slate-300">
                        {isDraft ? (
                          <input
                            type="text"
                            value={curBank}
                            onChange={(e) => handleCellChange(c.id, "namaBank", e.target.value)}
                            onPaste={(e) => handlePaste(e, idx, "namaBank")}
                            placeholder="BCA/Mandiri"
                            className="w-full h-full min-h-[36px] px-2.5 py-1 outline-none text-xs text-slate-800 focus:bg-blue-50 uppercase placeholder-slate-300"
                          />
                        ) : (
                          <div className="px-3 py-1 text-xs text-slate-700 uppercase font-semibold">
                            {curBank || "-"}
                          </div>
                        )}
                      </td>

                      {/* NO REKENING */}
                      <td className="p-0 border-b border-r border-slate-300 font-mono">
                        {isDraft ? (
                          <input
                            type="text"
                            value={curRek}
                            onChange={(e) => handleCellChange(c.id, "nomorRekening", e.target.value)}
                            onPaste={(e) => handlePaste(e, idx, "nomorRekening")}
                            placeholder="Nomor rek"
                            className="w-full h-full min-h-[36px] px-2.5 py-1 outline-none text-xs text-slate-800 focus:bg-blue-50 font-mono placeholder-slate-300"
                          />
                        ) : (
                          <div className="px-3 py-1 text-xs text-slate-700 font-mono">{curRek || "-"}</div>
                        )}
                      </td>

                      {/* ATAS NAMA */}
                      <td className="p-0 border-b border-r border-slate-300">
                        {isDraft ? (
                          <input
                            type="text"
                            value={curHolder}
                            onChange={(e) => handleCellChange(c.id, "atasNamaRekening", e.target.value)}
                            onPaste={(e) => handlePaste(e, idx, "atasNamaRekening")}
                            placeholder="Nama pemilik rek"
                            className="w-full h-full min-h-[36px] px-2.5 py-1 outline-none text-xs text-slate-800 focus:bg-blue-50 placeholder-slate-300"
                          />
                        ) : (
                          <div className="px-3 py-1 text-xs text-slate-700 truncate">{curHolder || "-"}</div>
                        )}
                      </td>

                      {/* QTY VT */}
                      <td className="p-0 border-b border-r border-slate-300 text-center">
                        {isDraft ? (
                          <input
                            type="number"
                            min={1}
                            value={curVt}
                            onChange={(e) => handleCellChange(c.id, "qtyVt", e.target.value)}
                            onPaste={(e) => handlePaste(e, idx, "qtyVt")}
                            className="w-full h-full min-h-[36px] px-2 py-1 outline-none text-xs text-slate-800 focus:bg-blue-50 text-center font-bold"
                          />
                        ) : (
                          <div className="px-2 py-1 text-xs font-bold text-slate-700">{curVt}</div>
                        )}
                      </td>

                      {/* FEE HONOR */}
                      <td className="p-0 border-b border-r border-slate-300 font-mono">
                        {isDraft ? (
                          <input
                            type="text"
                            value={curHonor}
                            onChange={(e) => handleCellChange(c.id, "biayaHonor", e.target.value)}
                            onPaste={(e) => handlePaste(e, idx, "biayaHonor")}
                            placeholder="0"
                            className="w-full h-full min-h-[36px] px-2.5 py-1 outline-none text-xs text-slate-800 focus:bg-blue-50 font-mono font-bold"
                          />
                        ) : (
                          <div className="px-3 py-1 text-xs font-mono font-bold text-slate-800">
                            Rp {Number(curHonor).toLocaleString("id-ID")}
                          </div>
                        )}
                      </td>

                      {/* PIC PEMBUAT */}
                      <td className="px-3 py-1 text-xs border-b border-r border-slate-300 whitespace-nowrap bg-slate-50/50">
                        <div className="font-semibold text-slate-800">{c.created_by_name || "PIC TNT"}</div>
                        <div className="text-[10px] text-slate-400">
                          {c.created_at ? new Date(c.created_at).toLocaleDateString("id-ID") : "-"}
                        </div>
                      </td>

                      {/* AKSI (STICKY RIGHT) */}
                      <td className="px-3 py-1 text-right border-b border-slate-300 sticky right-0 bg-white/95 backdrop-blur-xs shadow-xs z-10 whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {/* PREVIEW & PRINT */}
                          <button
                            type="button"
                            onClick={() => onPreviewContract(c)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="Pratinjau & Cetak PDF"
                          >
                            <Printer className="w-4 h-4" />
                          </button>

                          {/* EDIT GENERATOR FORM */}
                          {isDraft && (
                            <button
                              type="button"
                              onClick={() => onEditContract(c)}
                              className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                              title="Buka Formulir Lengkap"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          )}

                          {/* RILIS RESMI DOKUMEN */}
                          {isDraft && (
                            <button
                              type="button"
                              onClick={() => handleRelease(c)}
                              disabled={actionLoadingId === c.id}
                              className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold flex items-center gap-1 shadow-xs transition-all cursor-pointer disabled:opacity-50"
                              title="Rilis Resmi & Kunci Nomor Urut Terakhir + 1"
                            >
                              {actionLoadingId === c.id ? (
                                <RefreshCw className="w-3 h-3 animate-spin" />
                              ) : (
                                <Lock className="w-3 h-3" />
                              )}
                              <span>Rilis</span>
                            </button>
                          )}

                          {/* HAPUS DRAFT */}
                          {isDraft && (
                            <button
                              type="button"
                              onClick={() => handleDelete(c)}
                              disabled={actionLoadingId === c.id}
                              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                              title="Hapus Draft"
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
    </div>
  );
}
