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
  Layers,
  ArrowRight,
  User,
  CreditCard,
  Building,
  Calendar,
  Check
} from "lucide-react";
import {
  fetchCampaignCreatorsLookupForDokumenAction,
  upsertContractsBatchFromSpreadsheetAction,
} from "@/app/actions/contractActions";

export interface DocumentSpreadsheetRow {
  id: string;
  // GROUP 1: PIHAK KEDUA (KREATOR)
  username: string;
  namaKreator: string;
  statusBinding: string;
  tiktokUid: string;
  nikKtp: string;
  alamatKreator: string;
  tanggalLahir: string;
  tempatLahir: string;
  teleponKreator: string;
  emailKreator: string;
  npwpKreator: string;

  // GROUP 2: REKENING BANK PEMBAYARAN
  namaBank: string;
  nomorRekening: string;
  atasNamaRekening: string;

  // GROUP 3: DETAIL DELIVERABLES & LAMPIRAN I
  namaBrand: string;
  jenisCampaign: string;
  qtyVt: string;
  qtyPhotoSlide: string;
  qtyLive: string;
  durasiKonten: string;
  durasiKontenTerbilang: string;
  hashtagCampaign: string;
  tanggalKirimDraft: string;
  tanggalMulaiPosting: string;
  tanggalBatasPosting: string;
  biayaHonor: string;
  feePerDeliverable: string;
  skemaPembayaran: string;
  batasWaktuRevisi: string;
  jangkaWaktuTayang: string;
  rawKontrakMulai: string;
  rawKontrakBerakhir: string;
  catatanTambahan: string;

  // GROUP 4: PIHAK PERTAMA & LEGALITAS
  namaDirekturTNT: string;
  jabatanDirekturTNT: string;
  namaPicTNT: string;
  inisialPicTNT: string;
  namaSignerTNT: string;
  jabatanSignerTNT: string;
  namaPerusahaan: string;
  alamatPerusahaan: string;
  nomorKontrak: string;
  tanggalPerjanjian: string;
  tempatPerjanjian: string;

  statusBadge?: "update_draft" | "new_draft" | "locked_released" | "new_creator" | "empty";
  statusText?: string;
}

type SpreadsheetColumnKey = keyof Omit<DocumentSpreadsheetRow, "id" | "statusBadge" | "statusText">;

interface ColumnDef {
  key: SpreadsheetColumnKey;
  label: string;
  category: "kreator" | "rekening" | "deliverables" | "legalitas";
  width: string;
  type?: "text" | "dropdown";
  options?: string[];
  placeholder?: string;
}

const ALL_COLUMNS: ColumnDef[] = [
  // --- PIHAK KEDUA (KREATOR) ---
  { key: "username", label: "Username TikTok *", category: "kreator", width: "w-44", placeholder: "@username" },
  { key: "namaKreator", label: "Nama Lengkap (KTP) *", category: "kreator", width: "w-48", placeholder: "Nama KTP" },
  {
    key: "statusBinding",
    label: "Status Binding *",
    category: "kreator",
    width: "w-44",
    type: "dropdown",
    options: ["KREATOR Non-Binding", "KREATOR Binding"],
  },
  { key: "tiktokUid", label: "TikTok UID", category: "kreator", width: "w-40", placeholder: "Contoh: 708239..." },
  { key: "nikKtp", label: "NIK (16 Digit)", category: "kreator", width: "w-44", placeholder: "3201xxxxxxxxxxxx" },
  { key: "alamatKreator", label: "Alamat KTP / Domisili Lengkap", category: "kreator", width: "w-64", placeholder: "Jl. Merpati..." },
  { key: "tanggalLahir", label: "Tanggal Lahir (KTP)", category: "kreator", width: "w-36", placeholder: "dd/mm/yyyy" },
  { key: "tempatLahir", label: "Kota / Tempat Lahir", category: "kreator", width: "w-40", placeholder: "Jakarta / Bandung" },
  { key: "teleponKreator", label: "Nomor WhatsApp *", category: "kreator", width: "w-40", placeholder: "08xxxxxxxxxx" },
  { key: "emailKreator", label: "Alamat Email", category: "kreator", width: "w-44", placeholder: "kreator@gmail.com" },
  { key: "npwpKreator", label: "NPWP (Opsional)", category: "kreator", width: "w-40", placeholder: "00.000.000.0-000.000" },

  // --- REKENING BANK PEMBAYARAN ---
  { key: "namaBank", label: "Bank / E-Wallet", category: "rekening", width: "w-36", placeholder: "BCA / Mandiri" },
  { key: "nomorRekening", label: "Nomor Rekening", category: "rekening", width: "w-40", placeholder: "123456789" },
  { key: "atasNamaRekening", label: "Atas Nama Rekening", category: "rekening", width: "w-48", placeholder: "Nama buku tabungan" },

  // --- DETAIL DELIVERABLES & LAMPIRAN I ---
  { key: "namaBrand", label: "Nama Brand di Dokumen", category: "deliverables", width: "w-40", placeholder: "Nama Brand" },
  {
    key: "jenisCampaign",
    label: "Jenis Campaign",
    category: "deliverables",
    width: "w-44",
    type: "dropdown",
    options: ["Fee (Berbayar Penuh)", "Barter", "Fee dan Barter"],
  },
  { key: "qtyVt", label: "Jumlah Video (VT)", category: "deliverables", width: "w-28", placeholder: "4" },
  { key: "qtyPhotoSlide", label: "Photo Slide", category: "deliverables", width: "w-28", placeholder: "0" },
  { key: "qtyLive", label: "Live (Sesi)", category: "deliverables", width: "w-28", placeholder: "0" },
  { key: "durasiKonten", label: "Durasi Konten (Detik)", category: "deliverables", width: "w-36", placeholder: "30 - 60" },
  { key: "durasiKontenTerbilang", label: "Durasi Terbilang", category: "deliverables", width: "w-48", placeholder: "tiga puluh sampai..." },
  { key: "hashtagCampaign", label: "Hashtag Campaign", category: "deliverables", width: "w-52", placeholder: "#BrandPartner" },
  { key: "tanggalKirimDraft", label: "Kirim Draft", category: "deliverables", width: "w-36", placeholder: "dd/mm/yyyy" },
  { key: "tanggalMulaiPosting", label: "Mulai Posting", category: "deliverables", width: "w-36", placeholder: "dd/mm/yyyy" },
  { key: "tanggalBatasPosting", label: "Batas Posting", category: "deliverables", width: "w-36", placeholder: "dd/mm/yyyy" },
  { key: "biayaHonor", label: "Total Fee Campaign (Rp)", category: "deliverables", width: "w-44", placeholder: "200000" },
  { key: "feePerDeliverable", label: "Fee per Deliverable", category: "deliverables", width: "w-40", placeholder: "Otomatis" },
  { key: "skemaPembayaran", label: "Skema Pembayaran", category: "deliverables", width: "w-64", placeholder: "H+14 dari selesai..." },
  { key: "batasWaktuRevisi", label: "Batas Waktu Revisi", category: "deliverables", width: "w-36", placeholder: "2 (dua)" },
  { key: "jangkaWaktuTayang", label: "Jangka Waktu Tayang (Hari)", category: "deliverables", width: "w-44", placeholder: "60 (enam puluh)" },
  { key: "rawKontrakMulai", label: "Periode Kontrak Mulai", category: "deliverables", width: "w-36", placeholder: "dd/mm/yyyy" },
  { key: "rawKontrakBerakhir", label: "Periode Kontrak Selesai", category: "deliverables", width: "w-36", placeholder: "dd/mm/yyyy" },
  { key: "catatanTambahan", label: "Catatan Tambahan (Lampiran I)", category: "deliverables", width: "w-64", placeholder: "Catatan teknis..." },

  // --- PIHAK PERTAMA (TNT) & LEGALITAS ---
  { key: "namaDirekturTNT", label: "Nama Direktur TNT", category: "legalitas", width: "w-36", placeholder: "Stevani" },
  { key: "jabatanDirekturTNT", label: "Jabatan Perwakilan", category: "legalitas", width: "w-36", placeholder: "Direktur" },
  { key: "namaPicTNT", label: "Nama Drafter / PIC TNT", category: "legalitas", width: "w-44", placeholder: "Nama PIC" },
  { key: "inisialPicTNT", label: "Inisial Nama Drafter", category: "legalitas", width: "w-32", placeholder: "HN" },
  { key: "namaSignerTNT", label: "Penandatangan Akhir TNT", category: "legalitas", width: "w-44", placeholder: "Ruben Arianto" },
  { key: "jabatanSignerTNT", label: "Jabatan Penandatangan", category: "legalitas", width: "w-40", placeholder: "Manajer Umum" },
  { key: "namaPerusahaan", label: "Nama Entitas Perusahaan", category: "legalitas", width: "w-48", placeholder: "PT TNT KREATIF DIGITAL" },
  { key: "alamatPerusahaan", label: "Alamat Kantor Resmi", category: "legalitas", width: "w-64", placeholder: "Jl. Kavling Perkebunan..." },
  { key: "nomorKontrak", label: "Nomor Surat Kontrak", category: "legalitas", width: "w-48", placeholder: "001/JC-TNT/..." },
  { key: "tanggalPerjanjian", label: "Pilih Tanggal Kontrak", category: "legalitas", width: "w-36", placeholder: "dd/mm/yyyy" },
  { key: "tempatPerjanjian", label: "Kota Penandatanganan", category: "legalitas", width: "w-36", placeholder: "Tangerang" },
];

const createEmptyRow = (defaultBrand: string = ""): DocumentSpreadsheetRow => {
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  const nextMonthStr = nextMonth.toISOString().split("T")[0];

  return {
    id: Math.random().toString(36).substring(2, 9),
    username: "",
    namaKreator: "",
    statusBinding: "KREATOR Non-Binding",
    tiktokUid: "",
    nikKtp: "",
    alamatKreator: "",
    tanggalLahir: "",
    tempatLahir: "",
    teleponKreator: "",
    emailKreator: "",
    npwpKreator: "",

    namaBank: "",
    nomorRekening: "",
    atasNamaRekening: "",

    namaBrand: defaultBrand,
    jenisCampaign: "Fee (Berbayar Penuh)",
    qtyVt: "4",
    qtyPhotoSlide: "0",
    qtyLive: "0",
    durasiKonten: "30 - 60",
    durasiKontenTerbilang: "tiga puluh sampai enam puluh",
    hashtagCampaign: "#BrandPartner #TikTokShop",
    tanggalKirimDraft: todayStr,
    tanggalMulaiPosting: todayStr,
    tanggalBatasPosting: nextMonthStr,
    biayaHonor: "0",
    feePerDeliverable: "0",
    skemaPembayaran: "H+14 dari selesai Campaign sampai dengan H+21 dari selesai Campaign",
    batasWaktuRevisi: "2 (dua)",
    jangkaWaktuTayang: "60 (enam puluh)",
    rawKontrakMulai: todayStr,
    rawKontrakBerakhir: nextMonthStr,
    catatanTambahan: "",

    namaDirekturTNT: "Stevani",
    jabatanDirekturTNT: "Direktur",
    namaPicTNT: "Safira",
    inisialPicTNT: "SF",
    namaSignerTNT: "Ruben Arianto",
    jabatanSignerTNT: "Manajer Umum",
    namaPerusahaan: "PT TNT KREATIF DIGITAL",
    alamatPerusahaan: "Jalan Kavling Perkebunan Raya, RT 006 / RW 013, Panunggangan Barat, Kecamatan Cibodas, Kota Tangerang, Banten 15139",
    nomorKontrak: "",
    tanggalPerjanjian: todayStr,
    tempatPerjanjian: "Tangerang",

    statusBadge: "empty",
    statusText: "",
  };
};

interface DragFillState {
  active: boolean;
  startRowIdx: number;
  currentRowIdx: number;
  colKey: SpreadsheetColumnKey;
  value: string;
}

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
    Array.from({ length: 15 }, () => createEmptyRow(campaignName))
  );
  const [tipeDokumen, setTipeDokumen] = useState<string>("perjanjian_kerjasama");
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>("all");
  const [lookupMap, setLookupMap] = useState<Map<string, any>>(new Map());
  const [isLoadingLookup, setIsLoadingLookup] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<{ success: boolean; text: string } | null>(null);

  // Drag Fill State
  const [dragFill, setDragFill] = useState<DragFillState | null>(null);

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

  // Window mouseup listener untuk menyelesaikan drag fill
  useEffect(() => {
    const handleMouseUp = () => {
      if (dragFill && dragFill.active) {
        setDragFill(null);
      }
    };
    window.addEventListener("mouseup", handleMouseUp);
    return () => window.removeEventListener("mouseup", handleMouseUp);
  }, [dragFill]);

  // Handler Drag Fill Start
  const handleDragFillStart = (rowIdx: number, colKey: SpreadsheetColumnKey, value: string) => {
    setDragFill({
      active: true,
      startRowIdx: rowIdx,
      currentRowIdx: rowIdx,
      colKey,
      value: value || "",
    });
  };

  // Handler Drag Fill Enter Cell
  const handleDragFillEnter = (targetRowIdx: number) => {
    if (!dragFill || !dragFill.active) return;
    setDragFill({ ...dragFill, currentRowIdx: targetRowIdx });

    setRows((prev) => {
      const next = [...prev];
      const min = Math.min(dragFill.startRowIdx, targetRowIdx);
      const max = Math.max(dragFill.startRowIdx, targetRowIdx);

      for (let i = min; i <= max; i++) {
        const updatedRow = {
          ...next[i],
          [dragFill.colKey]: dragFill.value,
        };

        if (dragFill.colKey === "username") {
          next[i] = resolveRowAutofill(updatedRow, dragFill.value);
        } else {
          next[i] = updatedRow;
        }
      }
      return next;
    });
  };

  // Helper Autofill ketika username dimasukkan
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
        statusText: "Kreator Baru",
      };
    }

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
    if (!binding || binding === "KREATOR Non-Binding") {
      const srcBinding = found.status_binding || d.statusBinding || "";
      binding = srcBinding.toLowerCase().includes("binding") && !srcBinding.toLowerCase().includes("non")
        ? "KREATOR Binding"
        : "KREATOR Non-Binding";
    }

    const qtyVt = row.qtyVt && row.qtyVt !== "4" ? row.qtyVt : String(found.qty_vt || d.qtyVt || 4);
    const biayaHonor = row.biayaHonor && row.biayaHonor !== "0" ? row.biayaHonor : String(found.price || d.biayaHonor || 0);

    let statusBadge: DocumentSpreadsheetRow["statusBadge"] = "new_draft";
    let statusText = "Draft Baru";

    if (isLocked) {
      statusBadge = "locked_released";
      statusText = `Dirilis (No. ${found.nomor_kontrak || ""})`;
    } else if (hasContract) {
      statusBadge = "update_draft";
      statusText = "Update Draft";
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

  // MULTI-CELL & MULTI-ROW EXCEL TSV PASTE
  const handlePaste = (
    e: React.ClipboardEvent<HTMLInputElement>,
    startRowIdx: number,
    startColKey: SpreadsheetColumnKey
  ) => {
    const text = e.clipboardData.getData("text/plain");
    if (!text || (!text.includes("\t") && !text.includes("\n"))) {
      return;
    }
    e.preventDefault();

    const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
    const parsedGrid = lines.map((l) => l.split("\t"));

    const visibleCols = ALL_COLUMNS.filter(
      (c) => activeCategoryFilter === "all" || c.category === activeCategoryFilter
    );
    const columnKeys = visibleCols.map((c) => c.key);
    const startColIdx = columnKeys.indexOf(startColKey);
    if (startColIdx === -1) return;

    setRows((prev) => {
      const next = [...prev];
      const neededRows = startRowIdx + parsedGrid.length;

      while (next.length < neededRows) {
        next.push(createEmptyRow(campaignName));
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
          } else if (colKey === "biayaHonor" || colKey === "qtyVt" || colKey === "qtyLive" || colKey === "qtyPhotoSlide") {
            val = val.replace(/[^\d]/g, "");
          } else if (colKey === "statusBinding") {
            val = val.toLowerCase().includes("binding") && !val.toLowerCase().includes("non")
              ? "KREATOR Binding"
              : "KREATOR Non-Binding";
          }

          rowObj = { ...rowObj, [colKey]: val };
        }

        next[targetRowIdx] = resolveRowAutofill(rowObj);
      }

      return next;
    });
  };

  const handleAddRows = (count: number = 10) => {
    setRows((prev) => [
      ...prev,
      ...Array.from({ length: count }, () => createEmptyRow(campaignName)),
    ]);
  };

  const handleClearAll = () => {
    if (window.confirm("Kosongkan seluruh baris spreadsheet ini?")) {
      setRows(Array.from({ length: 15 }, () => createEmptyRow(campaignName)));
    }
  };

  const handleDeleteRow = (idx: number) => {
    setRows((prev) => {
      if (prev.length <= 1) return [createEmptyRow(campaignName)];
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
        statusBinding: r.statusBinding.trim() || "KREATOR Non-Binding",
        tiktokUid: r.tiktokUid.trim() || undefined,
        nikKtp: r.nikKtp.trim() || undefined,
        alamatKreator: r.alamatKreator.trim() || undefined,
        tanggalLahir: r.tanggalLahir.trim() || undefined,
        tempatLahir: r.tempatLahir.trim() || undefined,
        teleponKreator: r.teleponKreator.trim() || undefined,
        emailKreator: r.emailKreator.trim() || undefined,
        npwpKreator: r.npwpKreator.trim() || undefined,
        namaBank: r.namaBank.trim() || undefined,
        nomorRekening: r.nomorRekening.trim() || undefined,
        atasNamaRekening: r.atasNamaRekening.trim() || undefined,
        namaBrand: r.namaBrand.trim() || undefined,
        jenisCampaign: r.jenisCampaign.trim() || undefined,
        qtyVt: Number(r.qtyVt) || 1,
        qtyPhotoSlide: Number(r.qtyPhotoSlide) || 0,
        qtyLive: Number(r.qtyLive) || 0,
        durasiKonten: r.durasiKonten.trim() || undefined,
        durasiKontenTerbilang: r.durasiKontenTerbilang.trim() || undefined,
        hashtagCampaign: r.hashtagCampaign.trim() || undefined,
        tanggalKirimDraft: r.tanggalKirimDraft.trim() || undefined,
        tanggalMulaiPosting: r.tanggalMulaiPosting.trim() || undefined,
        tanggalBatasPosting: r.tanggalBatasPosting.trim() || undefined,
        biayaHonor: Number(r.biayaHonor) || 0,
        feePerDeliverable: Number(r.feePerDeliverable) || undefined,
        skemaPembayaran: r.skemaPembayaran.trim() || undefined,
        batasWaktuRevisi: r.batasWaktuRevisi.trim() || undefined,
        jangkaWaktuTayang: r.jangkaWaktuTayang.trim() || undefined,
        rawKontrakMulai: r.rawKontrakMulai.trim() || undefined,
        rawKontrakBerakhir: r.rawKontrakBerakhir.trim() || undefined,
        catatanTambahan: r.catatanTambahan.trim() || undefined,
        namaDirekturTNT: r.namaDirekturTNT.trim() || undefined,
        jabatanDirekturTNT: r.jabatanDirekturTNT.trim() || undefined,
        namaPicTNT: r.namaPicTNT.trim() || undefined,
        inisialPicTNT: r.inisialPicTNT.trim() || undefined,
        namaSignerTNT: r.namaSignerTNT.trim() || undefined,
        jabatanSignerTNT: r.jabatanSignerTNT.trim() || undefined,
        namaPerusahaan: r.namaPerusahaan.trim() || undefined,
        alamatPerusahaan: r.alamatPerusahaan.trim() || undefined,
        nomorKontrak: r.nomorKontrak.trim() || undefined,
        tanggalPerjanjian: r.tanggalPerjanjian.trim() || undefined,
        tempatPerjanjian: r.tempatPerjanjian.trim() || undefined,
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

  // Kolom yang sedang ditampilkan berdasarkan kategori
  const displayedColumns = useMemo(() => {
    if (activeCategoryFilter === "all") return ALL_COLUMNS;
    return ALL_COLUMNS.filter((c) => c.category === activeCategoryFilter);
  }, [activeCategoryFilter]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-2 sm:p-4 overflow-hidden select-none">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-[99vw] h-[95vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* HEADER BAR */}
        <div className="px-6 py-3.5 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight">
                  Mini Excel Spreadsheet Kontrak
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Auto-Fill &amp; Drag-to-Duplicate
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Campaign: <span className="font-semibold text-white">{campaignName}</span> &bull; Lengkap semua field pihak kedua, rekening, deliverables, dan legalitas TNT.
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
            <button onClick={() => setToastMsg(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
              &times;
            </button>
          </div>
        )}

        {/* TOOLBAR CONTROLS & CATEGORY PILLS */}
        <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* CATEGORY FILTER SWITCH */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold text-slate-600 mr-1">Tampilkan Kolom:</span>
            <button
              onClick={() => setActiveCategoryFilter("all")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeCategoryFilter === "all"
                  ? "bg-blue-600 text-white shadow-2xs"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              Semua Kolom ({ALL_COLUMNS.length})
            </button>
            <button
              onClick={() => setActiveCategoryFilter("kreator")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeCategoryFilter === "kreator"
                  ? "bg-emerald-600 text-white shadow-2xs font-bold"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>1. Pihak Kedua (Kreator)</span>
            </button>
            <button
              onClick={() => setActiveCategoryFilter("rekening")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeCategoryFilter === "rekening"
                  ? "bg-cyan-600 text-white shadow-2xs font-bold"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>2. Rekening Bank</span>
            </button>
            <button
              onClick={() => setActiveCategoryFilter("deliverables")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeCategoryFilter === "deliverables"
                  ? "bg-amber-600 text-white shadow-2xs font-bold"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>3. Deliverables &amp; Lampiran</span>
            </button>
            <button
              onClick={() => setActiveCategoryFilter("legalitas")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeCategoryFilter === "legalitas"
                  ? "bg-indigo-600 text-white shadow-2xs font-bold"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              <Building className="w-3.5 h-3.5" />
              <span>4. Pihak Pertama (TNT)</span>
            </button>
          </div>

          {/* ACTION BUTTONS */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-slate-700 bg-white border border-slate-200 px-2.5 py-1 rounded-lg">
              {filledCount} Terisi / {rows.length} Baris
            </span>

            <button
              type="button"
              onClick={() => handleAddRows(10)}
              className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5 text-blue-600" />
              <span>+10 Baris</span>
            </button>

            <button
              type="button"
              onClick={handleClearAll}
              className="px-3 py-1.5 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Reset</span>
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
                  <span>Menyimpan Dokumen...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Simpan &amp; Update Dokumen ({filledCount})</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* SPREADSHEET TABLE GRID CONTAINER */}
        <div className="flex-1 overflow-auto bg-slate-100/40 relative">
          <table className="border-collapse text-xs w-full" style={{ minWidth: "2900px" }}>
            <thead className="sticky top-0 z-20 bg-slate-200/95 backdrop-blur-xs text-slate-700 font-bold shadow-2xs">
              <tr className="border-b border-slate-300">
                {/* FROZEN # */}
                <th className="w-12 px-2 py-2 text-center border-r border-slate-300 bg-slate-200 sticky left-0 z-30">
                  #
                </th>
                {/* FROZEN STATUS SISTEM */}
                <th className="w-32 px-2 py-2 text-left border-r border-slate-300 bg-slate-200 sticky left-12 z-30">
                  Status
                </th>

                {/* DYNAMIC COLUMNS */}
                {displayedColumns.map((col) => (
                  <th
                    key={col.key}
                    className={`${col.width} px-3 py-2 text-left border-r border-slate-300 bg-slate-200`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate">{col.label}</span>
                      {col.key === "username" && (
                        <span className="text-[10px] text-blue-700 font-normal">Autofill</span>
                      )}
                      {col.type === "dropdown" && (
                        <span className="text-[10px] text-purple-700 font-normal">Dropdown</span>
                      )}
                    </div>
                  </th>
                ))}

                <th className="w-12 px-2 py-2 text-center border-slate-300 bg-slate-200">
                  Hapus
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200 select-none">
              {rows.map((row, rowIdx) => {
                const isLocked = row.statusBadge === "locked_released";

                return (
                  <tr
                    key={row.id}
                    className={`hover:bg-blue-50/40 transition-colors ${
                      row.username ? "bg-white" : "bg-slate-50/30"
                    } ${isLocked ? "bg-amber-50/50" : ""}`}
                  >
                    {/* FROZEN # */}
                    <td className="px-2 py-1 text-center text-slate-400 font-mono text-[11px] border-r border-slate-200 bg-slate-50 sticky left-0 z-10">
                      {rowIdx + 1}
                    </td>

                    {/* FROZEN STATUS BADGE */}
                    <td className="px-2 py-1 border-r border-slate-200 text-center sticky left-12 z-10 bg-white">
                      {row.statusBadge === "locked_released" ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 flex items-center justify-center gap-1">
                          <Lock className="w-3 h-3" />
                          Dirilis
                        </span>
                      ) : row.statusBadge === "update_draft" ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                          Update
                        </span>
                      ) : row.statusBadge === "new_draft" ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          Draft Baru
                        </span>
                      ) : row.statusBadge === "new_creator" ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                          Baru
                        </span>
                      ) : (
                        <span className="text-slate-300 text-[11px]">-</span>
                      )}
                    </td>

                    {/* DYNAMIC CELLS WITH DRAG-FILL HANDLE */}
                    {displayedColumns.map((col) => {
                      const val = (row as any)[col.key] || "";
                      const isDragActiveForCol = dragFill && dragFill.active && dragFill.colKey === col.key;
                      const isRowInDragRange =
                        isDragActiveForCol &&
                        rowIdx >= Math.min(dragFill.startRowIdx, dragFill.currentRowIdx) &&
                        rowIdx <= Math.max(dragFill.startRowIdx, dragFill.currentRowIdx);

                      return (
                        <td
                          key={col.key}
                          onMouseEnter={() => handleDragFillEnter(rowIdx)}
                          className={`relative p-0 border-r border-slate-200 group ${
                            isRowInDragRange ? "bg-blue-100/70 ring-1 ring-blue-500 inset" : ""
                          }`}
                        >
                          {col.type === "dropdown" ? (
                            <div className="relative w-full h-full flex items-center">
                              <select
                                value={val}
                                disabled={isLocked}
                                onChange={(e) => handleCellChange(rowIdx, col.key, e.target.value)}
                                className="w-full px-2 py-1.5 text-xs border-none outline-none bg-transparent font-medium cursor-pointer"
                              >
                                {col.options?.map((opt) => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                              </select>

                              {/* DRAG FILL HANDLE FOR DROPDOWN */}
                              {!isLocked && (
                                <div
                                  className="absolute right-0 bottom-0 w-2.5 h-2.5 bg-blue-600 cursor-crosshair opacity-0 group-hover:opacity-100 transition-opacity z-20 hover:scale-125"
                                  title="Tarik ke bawah / atas untuk duplikat nilai kolom ini ke baris lain"
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleDragFillStart(rowIdx, col.key, val);
                                  }}
                                />
                              )}
                            </div>
                          ) : (
                            <div className="relative w-full h-full flex items-center">
                              <input
                                type="text"
                                value={val}
                                disabled={isLocked}
                                placeholder={col.placeholder}
                                onChange={(e) => handleCellChange(rowIdx, col.key, e.target.value)}
                                onPaste={(e) => handlePaste(e, rowIdx, col.key)}
                                className={`w-full px-2 py-1.5 text-xs border border-transparent hover:border-slate-300 focus:border-blue-500 focus:bg-white outline-none transition-colors select-text ${
                                  col.key === "username" ? "font-bold text-blue-700" : "text-slate-800"
                                } ${isLocked ? "text-slate-500 bg-amber-50/50 cursor-not-allowed" : ""}`}
                              />

                              {/* DRAG FILL HANDLE FOR TEXT / NUM INPUT */}
                              {!isLocked && (
                                <div
                                  className="absolute right-0 bottom-0 w-2.5 h-2.5 bg-blue-600 cursor-crosshair opacity-0 group-hover:opacity-100 transition-opacity z-20 hover:scale-125"
                                  title="Tarik ke bawah / atas untuk duplikat nilai kolom ini ke baris lain"
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleDragFillStart(rowIdx, col.key, val);
                                  }}
                                />
                              )}
                            </div>
                          )}
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
              <strong>Fitur Drag Duplikat (Excel):</strong> Arahkan kursor ke pojok kanan bawah sel mana pun (termasuk dropdown status binding / fee / jenis campaign) hingga muncul kotak biru kecil, lalu klik &amp; tarik (drag) ke bawah untuk menduplikasi nilai ke baris-baris berikutnya secara instan!
            </span>
          </div>

          <div className="flex items-center gap-2 font-mono text-[11px] text-slate-400">
            <span>Kolom Terpilih: {displayedColumns.length}</span>
            <span>&bull;</span>
            <span>Total Kolom: {ALL_COLUMNS.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
