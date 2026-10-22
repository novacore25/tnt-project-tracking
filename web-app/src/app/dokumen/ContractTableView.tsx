"use client";

import React, { useState, useMemo } from "react";
import {
  Search,
  Filter,
  CheckCircle2,
  Lock,
  Clock,
  Printer,
  Edit,
  Trash2,
  Save,
  RefreshCw,
  PlusCircle,
  FileText,
  User,
  CreditCard,
  Building,
  Table as TableIcon,
  Check,
  AlertCircle,
  ChevronRight,
  Sparkles
} from "lucide-react";
import { releaseContractAction, deleteContractAction, batchUpdateContractsAction } from "@/app/actions/contractActions";

interface ContractTableViewProps {
  contracts: any[];
  onRefresh: () => void;
  onEditContract: (contract: any) => void;
  onPreviewContract: (contract: any) => void;
  campaignId?: number;
}

export default function ContractTableView({
  contracts,
  onRefresh,
  onEditContract,
  onPreviewContract,
  campaignId,
}: ContractTableViewProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isExcelMode, setIsExcelMode] = useState(false);

  // Excel state untuk editable rows
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

  const handleCellChange = (id: number, field: string, value: any) => {
    setEditedRows((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] || {}),
        [field]: value,
      },
    }));
  };

  const handleSaveExcelBatch = async () => {
    const ids = Object.keys(editedRows).map(Number);
    if (ids.length === 0) {
      showToast(true, "Tidak ada perubahan yang perlu disimpan.");
      setIsExcelMode(false);
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
        showToast(true, res.message || "Perubahan berhasil disimpan.");
        setEditedRows({});
        setIsExcelMode(false);
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
    if (!confirm(`Rilis resmi kontrak untuk @${c.creator_username}? Nomor urut akan otomatis terkunci.`)) {
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
    if (!confirm(`Hapus draft kontrak untuk @${c.creator_username}? Tindakan ini tidak dapat dibatalkan.`)) {
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

      {/* TOOLBAR FILTER & SEARCH */}
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
            <option value="draft">Draft (Belum Rilis)</option>
            <option value="released">Dirilis Resmi (Terkunci)</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          {isExcelMode ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setEditedRows({});
                  setIsExcelMode(false);
                }}
                className="px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveExcelBatch}
                disabled={isSavingBatch}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
              >
                {isSavingBatch ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                <span>Simpan Semua Perubahan Excel</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setIsExcelMode(true)}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
            >
              <TableIcon className="w-3.5 h-3.5 text-blue-400" />
              <span>Mode Mini-Excel (Quick Edit)</span>
            </button>
          )}

          <button
            type="button"
            onClick={onRefresh}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200"
            title="Refresh Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* TABEL LIST DOKUMEN / MINI-EXCEL */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto max-h-[650px]">
          <table className="w-full text-left text-xs text-slate-600 border-collapse">
            <thead className="bg-slate-50 text-slate-700 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200 sticky top-0 z-10 shadow-xs">
              <tr>
                <th className="p-3 w-12 text-center">No</th>
                <th className="p-3">Nomor Dokumen</th>
                <th className="p-3">Status</th>
                <th className="p-3">Kreator & Akun</th>
                <th className="p-3">Status Binding</th>
                <th className="p-3">NIK (KTP)</th>
                <th className="p-3">Alamat KTP</th>
                <th className="p-3">WhatsApp</th>
                <th className="p-3">Rekening Bank</th>
                <th className="p-3">SOW / VT</th>
                <th className="p-3">Fee Kontrak</th>
                <th className="p-3">Dibuat Oleh</th>
                <th className="p-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={13} className="p-8 text-center text-slate-400 font-medium">
                    Belum ada dokumen kontrak yang dibuat. Klik tombol &ldquo;Buat Dokumen Kontrak&rdquo; untuk memulai.
                  </td>
                </tr>
              ) : (
                filteredList.map((c: any, idx: number) => {
                  const data = c.contract_data || {};
                  const isDraft = c.status === "draft";
                  const editData = editedRows[c.id] || {};

                  const currentNama = editData.namaKreator !== undefined ? editData.namaKreator : (data.namaKreator || c.creator_nama || "");
                  const currentNik = editData.nikKtp !== undefined ? editData.nikKtp : (data.nikKtp || "");
                  const currentAlamat = editData.alamatKreator !== undefined ? editData.alamatKreator : (data.alamatKreator || "");
                  const currentWa = editData.teleponKreator !== undefined ? editData.teleponKreator : (data.teleponKreator || "");
                  const currentBinding = editData.statusBinding !== undefined ? editData.statusBinding : (c.status_binding || data.statusBinding || "KREATOR Non-Binding");
                  const currentBank = editData.namaBank !== undefined ? editData.namaBank : (data.namaBank || "");
                  const currentRek = editData.nomorRekening !== undefined ? editData.nomorRekening : (data.nomorRekening || "");
                  const currentHolder = editData.atasNamaRekening !== undefined ? editData.atasNamaRekening : (data.atasNamaRekening || currentNama);
                  const currentVt = editData.qtyVt !== undefined ? editData.qtyVt : (data.qtyVt || 1);
                  const currentHonor = editData.biayaHonor !== undefined ? editData.biayaHonor : (data.biayaHonor || 0);

                  return (
                    <tr
                      key={c.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        !isDraft ? "bg-emerald-50/20" : ""
                      }`}
                    >
                      <td className="p-3 text-center text-slate-400 font-mono">{idx + 1}</td>

                      {/* NOMOR DOKUMEN */}
                      <td className="p-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {isDraft ? (
                            <span className="text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded text-[10px]">
                              {c.nomor_kontrak || "[DRAFT AUTO]"}
                            </span>
                          ) : (
                            <span className="text-emerald-700 bg-emerald-50 border border-emerald-300 px-2 py-0.5 rounded font-mono">
                              {c.nomor_kontrak}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* STATUS */}
                      <td className="p-3 whitespace-nowrap">
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

                      {/* KREATOR */}
                      <td className="p-3 whitespace-nowrap">
                        <div className="font-bold text-slate-900">@{c.creator_username}</div>
                        {isExcelMode && isDraft ? (
                          <input
                            type="text"
                            value={currentNama}
                            onChange={(e) => handleCellChange(c.id, "namaKreator", e.target.value)}
                            placeholder="Nama Lengkap KTP"
                            className="mt-1 px-1.5 py-1 bg-white border border-blue-400 rounded text-xs text-slate-800 w-36 outline-none"
                          />
                        ) : (
                          <div className="text-[11px] text-slate-500">{currentNama}</div>
                        )}
                      </td>

                      {/* STATUS BINDING */}
                      <td className="p-3 whitespace-nowrap">
                        {isExcelMode && isDraft ? (
                          <select
                            value={currentBinding}
                            onChange={(e) => handleCellChange(c.id, "statusBinding", e.target.value)}
                            className="px-1.5 py-1 bg-white border border-blue-400 rounded text-[11px] font-semibold text-slate-800 outline-none"
                          >
                            <option value="KREATOR Non-Binding">Non-Binding</option>
                            <option value="KREATOR Binding">Binding</option>
                          </select>
                        ) : (
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              currentBinding.includes("Binding") && !currentBinding.includes("Non")
                                ? "bg-purple-100 text-purple-700"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {currentBinding.replace("KREATOR ", "")}
                          </span>
                        )}
                      </td>

                      {/* NIK */}
                      <td className="p-3 font-mono whitespace-nowrap">
                        {isExcelMode && isDraft ? (
                          <input
                            type="text"
                            maxLength={16}
                            value={currentNik}
                            onChange={(e) => handleCellChange(c.id, "nikKtp", e.target.value)}
                            placeholder="NIK 16 digit"
                            className="px-1.5 py-1 bg-white border border-blue-400 rounded text-xs text-slate-800 w-32 outline-none font-mono"
                          />
                        ) : (
                          currentNik || <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {/* ALAMAT */}
                      <td className="p-3 max-w-[200px]">
                        {isExcelMode && isDraft ? (
                          <input
                            type="text"
                            value={currentAlamat}
                            onChange={(e) => handleCellChange(c.id, "alamatKreator", e.target.value)}
                            placeholder="Alamat domisili"
                            className="px-1.5 py-1 bg-white border border-blue-400 rounded text-xs text-slate-800 w-44 outline-none"
                          />
                        ) : (
                          <span className="truncate block" title={currentAlamat}>
                            {currentAlamat || <span className="text-slate-300">-</span>}
                          </span>
                        )}
                      </td>

                      {/* WHATSAPP */}
                      <td className="p-3 font-mono whitespace-nowrap">
                        {isExcelMode && isDraft ? (
                          <input
                            type="text"
                            value={currentWa}
                            onChange={(e) => handleCellChange(c.id, "teleponKreator", e.target.value)}
                            placeholder="0812xxx"
                            className="px-1.5 py-1 bg-white border border-blue-400 rounded text-xs text-slate-800 w-28 outline-none font-mono"
                          />
                        ) : (
                          currentWa || <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {/* REKENING */}
                      <td className="p-3 whitespace-nowrap">
                        {isExcelMode && isDraft ? (
                          <div className="space-y-1">
                            <input
                              type="text"
                              value={currentBank}
                              onChange={(e) => handleCellChange(c.id, "namaBank", e.target.value)}
                              placeholder="Bank"
                              className="px-1.5 py-0.5 bg-white border border-blue-400 rounded text-[11px] text-slate-800 w-24 outline-none"
                            />
                            <input
                              type="text"
                              value={currentRek}
                              onChange={(e) => handleCellChange(c.id, "nomorRekening", e.target.value)}
                              placeholder="No Rekening"
                              className="px-1.5 py-0.5 bg-white border border-blue-400 rounded text-[11px] text-slate-800 w-28 outline-none font-mono block"
                            />
                          </div>
                        ) : currentBank && currentRek ? (
                          <div>
                            <span className="font-bold text-slate-800">{currentBank}</span>
                            <div className="text-[11px] font-mono text-slate-500">{currentRek}</div>
                          </div>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {/* SOW / VT */}
                      <td className="p-3 whitespace-nowrap">
                        {isExcelMode && isDraft ? (
                          <input
                            type="number"
                            min={1}
                            value={currentVt}
                            onChange={(e) => handleCellChange(c.id, "qtyVt", e.target.value)}
                            className="px-1.5 py-1 bg-white border border-blue-400 rounded text-xs text-slate-800 w-16 outline-none"
                          />
                        ) : (
                          <span className="font-semibold text-slate-800">{currentVt} VT</span>
                        )}
                      </td>

                      {/* FEE KONTRAK */}
                      <td className="p-3 whitespace-nowrap">
                        {isExcelMode && isDraft ? (
                          <input
                            type="number"
                            value={currentHonor}
                            onChange={(e) => handleCellChange(c.id, "biayaHonor", e.target.value)}
                            className="px-1.5 py-1 bg-white border border-blue-400 rounded text-xs text-slate-800 w-24 outline-none font-mono"
                          />
                        ) : (
                          <span className="font-bold text-slate-900 font-mono">
                            Rp {Number(currentHonor).toLocaleString("id-ID")}
                          </span>
                        )}
                      </td>

                      {/* CREATED BY */}
                      <td className="p-3 whitespace-nowrap">
                        <div className="text-slate-800 font-medium">{c.created_by_name || "PIC TNT"}</div>
                        <div className="text-[10px] text-slate-400">
                          {c.created_at ? new Date(c.created_at).toLocaleDateString("id-ID") : "-"}
                        </div>
                      </td>

                      {/* AKSI */}
                      <td className="p-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* PREVIEW & PRINT */}
                          <button
                            type="button"
                            onClick={() => onPreviewContract(c)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Pratinjau & Cetak PDF"
                          >
                            <Printer className="w-4 h-4" />
                          </button>

                          {/* EDIT (HANYA DRAFT) */}
                          {isDraft && (
                            <button
                              type="button"
                              onClick={() => onEditContract(c)}
                              className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                              title="Edit di Generator Lengkap"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          )}

                          {/* RILIS DOKUMEN (HANYA DRAFT) */}
                          {isDraft && (
                            <button
                              type="button"
                              onClick={() => handleRelease(c)}
                              disabled={actionLoadingId === c.id}
                              className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold flex items-center gap-1 shadow-2xs transition-all disabled:opacity-50"
                              title="Kunci nomor dan rilis resmi dokumen"
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
                              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-50"
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
