"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  FileSpreadsheet,
  Plus,
  Trash2,
  Save,
  X,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Lock,
  RefreshCw,
  HelpCircle,
  Layers,
  ArrowRight
} from "lucide-react";
import {
  fetchCampaignCreatorsLookupForDokumenAction,
  upsertContractsBatchFromSpreadsheetAction,
} from "@/app/actions/contractActions";

export interface DocumentSpreadsheetRow {
  id: string;
  username: string;
  namaKreator: string;
  statusBinding: string;
  nikKtp: string;
  alamatKreator: string;
  teleponKreator: string;
  namaBank: string;
  nomorRekening: string;
  atasNamaRekening: string;
  qtyVt: string;
  biayaHonor: string;
  statusBadge?: "update_draft" | "new_draft" | "locked_released" | "new_creator" | "empty";
  statusText?: string;
}

type SpreadsheetColumnKey =
  | "username"
  | "namaKreator"
  | "statusBinding"
  | "nikKtp"
  | "alamatKreator"
  | "teleponKreator"
  | "namaBank"
  | "nomorRekening"
  | "atasNamaRekening"
  | "qtyVt"
  | "biayaHonor";

const COLUMNS: { key: SpreadsheetColumnKey; label: string; width: string; placeholder: string }[] = [
  { key: "username", label: "Username TikTok", width: "w-40", placeholder: "@username" },
  { key: "namaKreator", label: "Nama Lengkap (KTP)", width: "w-44", placeholder: "Nama Sesuai KTP" },
  { key: "statusBinding", label: "Status Binding", width: "w-36", placeholder: "Binding / Non-Binding" },
  { key: "nikKtp", label: "NIK (16 Digit)", width: "w-40", placeholder: "16 digit angka" },
  { key: "alamatKreator", label: "Alamat KTP / Domisili", width: "w-52", placeholder: "Alamat lengkap" },
  { key: "teleponKreator", label: "No. WhatsApp", width: "w-36", placeholder: "08xxxxxxxxxx" },
  { key: "namaBank", label: "Bank", width: "w-32", placeholder: "BCA / Mandiri / BRI" },
  { key: "nomorRekening", label: "No. Rekening", width: "w-36", placeholder: "Nomor rekening" },
  { key: "atasNamaRekening", label: "Atas Nama Rekening", width: "w-44", placeholder: "Nama pemilik rekening" },
  { key: "qtyVt", label: "Qty VT", width: "w-20", placeholder: "1" },
  { key: "biayaHonor", label: "Fee Honor (Rp)", width: "w-36", placeholder: "Nominal rupiah" },
];

const createEmptyRow = (): DocumentSpreadsheetRow => ({
  id: Math.random().toString(36).substring(2, 9),
  username: "",
  namaKreator: "",
  statusBinding: "Non-Binding",
  nikKtp: "",
  alamatKreator: "",
  teleponKreator: "",
  namaBank: "",
  nomorRekening: "",
  atasNamaRekening: "",
  qtyVt: "1",
  biayaHonor: "0",
  statusBadge: "empty",
  statusText: "",
});

interface DocumentSpreadsheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaignId: number;
  campaignName?: string;
  onSuccess: () => void;
}

export default function DocumentSpreadsheetModal({
  isOpen,
  onClose,
  campaignId,
  campaignName = "Campaign",
  onSuccess,
}: DocumentSpreadsheetModalProps) {
  const [rows, setRows] = useState<DocumentSpreadsheetRow[]>(() =>
    Array.from({ length: 15 }, () => createEmptyRow())
  );
  const [tipeDokumen, setTipeDokumen] = useState<string>("perjanjian_kerjasama");
  const [lookupMap, setLookupMap] = useState<Map<string, any>>(new Map());
  const [isLoadingLookup, setIsLoadingLookup] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<{ success: boolean; text: string } | null>(null);

  const showToast = (success: boolean, text: string) => {
    setToastMsg({ success, text });
    setTimeout(() => setToastMsg(null), 5000);
  };

  // Muat data lookup kreator di campaign saat modal dibuka
  useEffect(() => {
    if (!isOpen || !campaignId) return;

    let isMounted = true;
    setIsLoadingLookup(true);

    fetchCampaignCreatorsLookupForDokumenAction(campaignId)
      .then((res) => {
        if (!isMounted) return;
        if (res.success && res.data) {
          const map = new Map<string, any>();
          for (const item of res.data) {
            if (item.username) {
              const u = item.username.trim().replace(/^@+/, "").toLowerCase();
              map.set(u, item);
            }
          }
          setLookupMap(map);
        }
      })
      .catch((err) => {
        console.error("Gagal mengambil lookup data kreator:", err);
      })
      .finally(() => {
        if (isMounted) setIsLoadingLookup(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, campaignId]);

  // Fungsi helper untuk menghitung badge status baris & autofill
  const resolveRowAutofill = (
    row: DocumentSpreadsheetRow,
    customUsername?: string
  ): DocumentSpreadsheetRow => {
    const rawU = customUsername !== undefined ? customUsername : row.username;
    const cleanU = rawU.trim().replace(/^@+/, "").toLowerCase();

    if (!cleanU) {
      return {
        ...row,
        username: rawU,
        statusBadge: "empty",
        statusText: "",
      };
    }

    const found = lookupMap.get(cleanU);
    if (!found) {
      return {
        ...row,
        username: rawU,
        statusBadge: "new_creator",
        statusText: "Kreator Baru (Akan didaftarkan)",
      };
    }

    // Jika ditemukan di database, lakukan AUTOFILL untuk kolom-kolom yang masih kosong
    const isLocked = found.contract_status === "released";
    const hasContract = Boolean(found.contract_id);

    const d = found.contract_data || {};
    const namaKreator = row.namaKreator || found.nama_lengkap || d.namaKreator || cleanU;
    const nikKtp = row.nikKtp || found.nik_ktp || d.nikKtp || "";
    const alamatKreator = row.alamatKreator || found.alamat_ktp || d.alamatKreator || "";
    const teleponKreator = row.teleponKreator || found.contact_nomor || d.teleponKreator || "";
    const namaBank = row.namaBank || found.bank_name || d.namaBank || "";
    const nomorRekening = row.nomorRekening || found.account_number || d.nomorRekening || "";
    const atasNamaRekening = row.atasNamaRekening || found.account_holder || d.atasNamaRekening || namaKreator;

    let binding = row.statusBinding;
    if (!binding || binding === "Non-Binding") {
      const srcBinding = found.status_binding || d.statusBinding || "";
      binding = srcBinding.toLowerCase().includes("binding") && !srcBinding.toLowerCase().includes("non")
        ? "Binding"
        : "Non-Binding";
    }

    const qtyVt = row.qtyVt && row.qtyVt !== "1" ? row.qtyVt : String(found.qty_vt || d.qtyVt || 1);
    const biayaHonor = row.biayaHonor && row.biayaHonor !== "0" ? row.biayaHonor : String(found.price || d.biayaHonor || 0);

    let statusBadge: DocumentSpreadsheetRow["statusBadge"] = "new_draft";
    let statusText = "Draft Baru";

    if (isLocked) {
      statusBadge = "locked_released";
      statusText = `Terkunci (Dirilis No. ${found.nomor_kontrak || ""})`;
    } else if (hasContract) {
      statusBadge = "update_draft";
      statusText = "Update Draft Ada";
    }

    return {
      ...row,
      username: rawU,
      namaKreator,
      nikKtp,
      alamatKreator,
      teleponKreator,
      namaBank,
      nomorRekening,
      atasNamaRekening,
      statusBinding: binding,
      qtyVt,
      biayaHonor,
      statusBadge,
      statusText,
    };
  };

  const handleCellChange = (rowIndex: number, colKey: SpreadsheetColumnKey, value: string) => {
    setRows((prev) => {
      const next = [...prev];
      const cur = { ...next[rowIndex], [colKey]: value };

      if (colKey === "username") {
        next[rowIndex] = resolveRowAutofill(cur, value);
      } else {
        next[rowIndex] = cur;
      }
      return next;
    });
  };

  // MULTI-CELL & MULTI-ROW EXCEL PASTE
  const handlePaste = (
    e: React.ClipboardEvent<HTMLInputElement>,
    startRowIdx: number,
    startColKey: SpreadsheetColumnKey
  ) => {
    const text = e.clipboardData.getData("text/plain");
    if (!text || (!text.includes("\t") && !text.includes("\n"))) {
      return; // Single cell paste normal
    }
    e.preventDefault();

    const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
    const parsedGrid = lines.map((l) => l.split("\t"));

    const columnKeys = COLUMNS.map((c) => c.key);
    const startColIdx = columnKeys.indexOf(startColKey);
    if (startColIdx === -1) return;

    setRows((prev) => {
      const next = [...prev];
      const neededRows = startRowIdx + parsedGrid.length;

      // Auto-expand jika baris hasil paste melebihi tabel saat ini
      while (next.length < neededRows) {
        next.push(createEmptyRow());
      }

      for (let r = 0; r < parsedGrid.length; r++) {
        const targetRowIdx = startRowIdx + r;
        const rowCells = parsedGrid[r];
        let rowObj = { ...next[targetRowIdx] };

        for (let c = 0; c < rowCells.length; c++) {
          const targetColIdx = startColIdx + c;
          if (targetColIdx >= columnKeys.length) break;

          const colKey = columnKeys[targetColIdx];
          let val = rowCells[c]?.trim() || "";

          if (colKey === "nikKtp") {
            val = val.replace(/\D/g, "").slice(0, 16);
          } else if (colKey === "biayaHonor" || colKey === "qtyVt") {
            val = val.replace(/[^\d]/g, "");
          } else if (colKey === "statusBinding") {
            val = val.toLowerCase().includes("binding") && !val.toLowerCase().includes("non")
              ? "Binding"
              : "Non-Binding";
          }

          rowObj = { ...rowObj, [colKey]: val };
        }

        // Lakukan auto-fill data jika username diisi
        next[targetRowIdx] = resolveRowAutofill(rowObj);
      }

      return next;
    });
  };

  const handleAddRows = (count: number = 10) => {
    setRows((prev) => [
      ...prev,
      ...Array.from({ length: count }, () => createEmptyRow()),
    ]);
  };

  const handleClearAll = () => {
    if (window.confirm("Kosongkan seluruh baris spreadsheet ini?")) {
      setRows(Array.from({ length: 15 }, () => createEmptyRow()));
    }
  };

  const handleDeleteRow = (idx: number) => {
    setRows((prev) => {
      if (prev.length <= 1) return [createEmptyRow()];
      return prev.filter((_, i) => i !== idx);
    });
  };

  // Submit Simpan & Update ke Server
  const handleSaveToDatabase = async () => {
    const validRows = rows.filter((r) => r.username && r.username.trim() !== "");

    if (validRows.length === 0) {
      alert("Belum ada data kreator yang diisi. Masukkan atau paste minimal satu username.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payloadRows = validRows.map((r) => ({
        username: r.username.trim().replace(/^@+/, ""),
        namaKreator: r.namaKreator.trim() || undefined,
        statusBinding: r.statusBinding.trim() || "Non-Binding",
        nikKtp: r.nikKtp.trim() || undefined,
        alamatKreator: r.alamatKreator.trim() || undefined,
        teleponKreator: r.teleponKreator.trim() || undefined,
        namaBank: r.namaBank.trim() || undefined,
        nomorRekening: r.nomorRekening.trim() || undefined,
        atasNamaRekening: r.atasNamaRekening.trim() || undefined,
        qtyVt: Number(r.qtyVt) || 1,
        biayaHonor: Number(r.biayaHonor) || 0,
      }));

      const res = await upsertContractsBatchFromSpreadsheetAction({
        campaignId,
        tipeDokumen,
        rows: payloadRows,
      });

      if (res.success) {
        showToast(true, res.message || "Data dokumen berhasil diperbarui.");
        onSuccess();
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        showToast(false, res.error || "Gagal menyimpan data dokumen.");
      }
    } catch (err: any) {
      showToast(false, err.message || "Terjadi kesalahan sistem.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filledCount = useMemo(() => {
    return rows.filter((r) => r.username.trim() !== "").length;
  }, [rows]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-2 sm:p-4 overflow-hidden">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-[98vw] h-[94vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* HEADER BAR */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold tracking-tight">
                  Import &amp; Update Data Dokumen Kontrak
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Mini Excel Grid
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Campaign: <span className="font-semibold text-white">{campaignName}</span> &bull; Paste data massal dari Excel / Spreadsheet. Username otomatis autofill data kreator yang telah ada.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-center">
            {/* TIPE DOKUMEN SELECTOR */}
            <div className="flex items-center gap-1.5 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700">
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-xs text-slate-300 font-medium">Tipe:</span>
              <select
                value={tipeDokumen}
                onChange={(e) => setTipeDokumen(e.target.value)}
                className="bg-transparent text-xs font-bold text-white outline-none cursor-pointer"
              >
                <option value="perjanjian_kerjasama" className="text-slate-900 bg-white">
                  Surat Perjanjian Kerja Sama (Join Campaign)
                </option>
                <option value="spk_talent" className="text-slate-900 bg-white">
                  Surat Perintah Kerja (SPK Talent)
                </option>
                <option value="mou_brand" className="text-slate-900 bg-white">
                  MoU Brand Partner
                </option>
                <option value="adendum" className="text-slate-900 bg-white">
                  Adendum Kontrak
                </option>
              </select>
            </div>

            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Tutup Modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* TOAST NOTIFIKASI */}
        {toastMsg && (
          <div
            className={`px-4 py-2.5 text-xs font-semibold flex items-center justify-between border-b transition-all shrink-0 ${
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

        {/* TOOLBAR CONTROLS */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 flex-wrap text-xs text-slate-600">
            <span className="font-semibold text-slate-700">
              Status Grid:
            </span>
            <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg font-bold text-slate-800">
              {filledCount} Baris Terisi
            </span>
            <span className="text-slate-400">&bull;</span>
            <span className="text-slate-500">
              Total {rows.length} Baris
            </span>
            {isLoadingLookup && (
              <span className="flex items-center gap-1.5 text-blue-600 font-medium">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Memuat data profil &amp; rekening...
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => handleAddRows(10)}
              className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5 text-blue-600" />
              <span>Tambah 10 Baris</span>
            </button>

            <button
              type="button"
              onClick={handleClearAll}
              className="px-3 py-1.5 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Reset Tabel</span>
            </button>

            <button
              type="button"
              onClick={handleSaveToDatabase}
              disabled={isSubmitting || filledCount === 0}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Menyimpan ke Dokumen...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Simpan &amp; Update ke Dokumen ({filledCount})</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* SPREADSHEET TABLE GRID CONTAINER */}
        <div className="flex-1 overflow-auto bg-slate-100/50">
          <table className="border-collapse text-xs select-text w-full" style={{ minWidth: "1650px" }}>
            <thead className="sticky top-0 z-20 bg-slate-200/95 backdrop-blur-xs text-slate-700 font-bold shadow-2xs">
              <tr className="border-b border-slate-300">
                <th className="w-12 px-2 py-2 text-center border-r border-slate-300 bg-slate-200 sticky left-0 z-30">
                  #
                </th>
                <th className="w-36 px-2 py-2 text-left border-r border-slate-300 bg-slate-200">
                  Status Sistem
                </th>
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    className={`${col.width} px-3 py-2 text-left border-r border-slate-300 bg-slate-200`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{col.label}</span>
                      {col.key === "username" && (
                        <span className="text-[10px] text-blue-700 font-normal">Autofill</span>
                      )}
                    </div>
                  </th>
                ))}
                <th className="w-12 px-2 py-2 text-center border-slate-300 bg-slate-200">
                  Hapus
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {rows.map((row, rowIdx) => {
                const isLocked = row.statusBadge === "locked_released";

                return (
                  <tr
                    key={row.id}
                    className={`hover:bg-blue-50/40 transition-colors ${
                      row.username ? "bg-white" : "bg-slate-50/30"
                    } ${isLocked ? "bg-amber-50/50" : ""}`}
                  >
                    {/* NOMOR URUT BARIS */}
                    <td className="px-2 py-1.5 text-center text-slate-400 font-mono text-[11px] border-r border-slate-200 bg-slate-50 sticky left-0 z-10">
                      {rowIdx + 1}
                    </td>

                    {/* STATUS SYSTEM BADGE */}
                    <td className="px-2 py-1.5 border-r border-slate-200 text-center">
                      {row.statusBadge === "locked_released" ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 flex items-center justify-center gap-1">
                          <Lock className="w-3 h-3" />
                          Dirilis (Kunci)
                        </span>
                      ) : row.statusBadge === "update_draft" ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                          Update Draft
                        </span>
                      ) : row.statusBadge === "new_draft" ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          Draft Baru
                        </span>
                      ) : row.statusBadge === "new_creator" ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                          Kreator Baru
                        </span>
                      ) : (
                        <span className="text-slate-300 text-[11px]">-</span>
                      )}
                    </td>

                    {/* KOLOM-KOLOM INPUT */}
                    {COLUMNS.map((col) => {
                      const val = (row as any)[col.key] || "";

                      if (col.key === "statusBinding") {
                        return (
                          <td key={col.key} className="px-1 py-1 border-r border-slate-200">
                            <select
                              value={val}
                              disabled={isLocked}
                              onChange={(e) => handleCellChange(rowIdx, col.key, e.target.value)}
                              className="w-full px-2 py-1 text-xs border border-transparent hover:border-slate-300 focus:border-blue-500 focus:bg-white rounded outline-none bg-transparent font-medium"
                            >
                              <option value="Binding">KREATOR Binding</option>
                              <option value="Non-Binding">KREATOR Non-Binding</option>
                            </select>
                          </td>
                        );
                      }

                      return (
                        <td key={col.key} className="px-1 py-1 border-r border-slate-200">
                          <input
                            type="text"
                            value={val}
                            disabled={isLocked}
                            placeholder={col.placeholder}
                            onChange={(e) => handleCellChange(rowIdx, col.key, e.target.value)}
                            onPaste={(e) => handlePaste(e, rowIdx, col.key)}
                            className={`w-full px-2 py-1 text-xs border border-transparent hover:border-slate-300 focus:border-blue-500 focus:bg-white rounded outline-none transition-colors ${
                              col.key === "username" ? "font-bold text-blue-700" : "text-slate-800"
                            } ${isLocked ? "text-slate-500 bg-amber-50/50 cursor-not-allowed" : ""}`}
                          />
                        </td>
                      );
                    })}

                    {/* HAPUS BARIS */}
                    <td className="px-1 py-1 text-center">
                      <button
                        type="button"
                        onClick={() => handleDeleteRow(rowIdx)}
                        className="p-1 text-slate-300 hover:text-rose-600 transition-colors cursor-pointer"
                        title="Hapus baris ini"
                      >
                        <Trash2 className="w-3.5 h-3.5 mx-auto" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* FOOTER TIP */}
        <div className="px-6 py-2.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500 shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
            <span>
              <strong>Tip Praktis:</strong> Copy satu kolom nama akun / username dari Excel, lalu paste di baris pertama kolom <strong>Username TikTok</strong>. Seluruh data identitas, bank, NIK, dan fee yang sudah tercatat akan langsung terisi otomatis!
            </span>
          </div>

          <div className="flex items-center gap-2 font-mono text-[11px] text-slate-400">
            <span>Tab: Pindah Kolom</span>
            <span>&bull;</span>
            <span>Enter: Pindah Baris</span>
          </div>
        </div>
      </div>
    </div>
  );
}
