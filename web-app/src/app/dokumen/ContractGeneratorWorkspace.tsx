"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
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
  Phone,
  Mail,
  MapPin,
  Clock,
  ShieldCheck,
  Check,
  Search,
  Save,
  PlusCircle,
  X,
} from "lucide-react";
import Link from "next/link";
import { CreatorContractPdfDocument, CreatorContractData } from "@/components/contract/CreatorContractPdfDocument";
import { syncContractCreatorProfileDataAction } from "@/app/actions/creatorActions";
import { fetchCampaignCreatorsForDocumentsAction } from "@/app/actions/campaignPageActions";

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

function formatDateIndo(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const monthNames = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];
  return `${d.getDate()} ${monthNames[d.getMonth()]} ${d.getFullYear()}`;
}

function formatHariTanggalIndo(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const monthNames = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];
  const dayName = dayNames[d.getDay()];
  const dateNum = d.getDate();
  const monthName = monthNames[d.getMonth()];
  const year = d.getFullYear();

  return `${dayName} ${dateNum} (${terbilang(dateNum)}) ${monthName} tahun ${year} (${terbilang(year)})`;
}

function getRomanMonth(m: number): string {
  const romans = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
  return romans[m] || "X";
}

function getInitials(name: string): string {
  if (!name) return "TNT";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface ContractGeneratorWorkspaceProps {
  campaigns: any[];
  creators: any[];
  selectedCampaignId: number | null;
  onSelectCampaign: (id: number) => void;
  campaignBrandName: string;
  defaultUserName: string;
  onCreatorUpdated?: () => void;
}

export default function ContractGeneratorWorkspace({
  campaigns,
  creators,
  selectedCampaignId,
  onSelectCampaign,
  campaignBrandName,
  defaultUserName,
  onCreatorUpdated,
}: ContractGeneratorWorkspaceProps) {
  // PILIHAN KONTRAK / TEMPLATE DOKUMEN
  const [selectedDocType, setSelectedDocType] = useState<string>("kontrak_creator");

  // SELEKSI KREATOR UNTUK FORM AUTO-FILL
  const [selectedCcId, setSelectedCcId] = useState<number | null>(null);
  const [selectedCreator, setSelectedCreator] = useState<any | null>(null);

  // SEARCH AUTOCOMPLETE STATE (Pencarian username interaktif)
  const [searchQuery, setSearchQuery] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const [serverSearchResults, setServerSearchResults] = useState<any[]>([]);
  const [isSearchingServer, setIsSearchingServer] = useState(false);

  // Auto-fill form jika kreator dipilih (prioritas selectedCreator, fallback creators array)
  const currentCreator = useMemo(() => {
    if (selectedCreator) return selectedCreator;
    if (!selectedCcId) return null;
    return creators.find((c) => c.cc_id === selectedCcId) || null;
  }, [selectedCreator, selectedCcId, creators]);

  // Reset pencarian & seleksi kreator ketika campaign berganti
  useEffect(() => {
    setSelectedCcId(null);
    setSelectedCreator(null);
    setSearchQuery("");
    setServerSearchResults([]);
    setIsSearchingServer(false);
  }, [selectedCampaignId]);

  // DATE HELPERS
  const today = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  // Next week
  const nextWeek = new Date();
  nextWeek.setDate(today.getDate() + 7);
  const nextWeekStr = `${nextWeek.getFullYear()}-${pad(nextWeek.getMonth() + 1)}-${pad(nextWeek.getDate())}`;

  // Next month
  const nextMonth = new Date();
  nextMonth.setMonth(today.getMonth() + 1);
  const nextMonthStr = `${nextMonth.getFullYear()}-${pad(nextMonth.getMonth() + 1)}-${pad(nextMonth.getDate())}`;

  const curYear = today.getFullYear();
  const curMonthIndex = today.getMonth();
  const curRomanMonth = getRomanMonth(curMonthIndex);
  const initialDrafter = getInitials(defaultUserName || "Safira");

  // FORM STATE - FIELD DATA KONTRAK
  const [inisialDrafter, setInisialDrafter] = useState(initialDrafter);
  const [nomorKontrak, setNomorKontrak] = useState(`001/JC-TNT/${initialDrafter}/${curRomanMonth}/${curYear}`);
  const [rawTanggalKontrak, setRawTanggalKontrak] = useState(todayStr);
  const [kotaPenandatangan, setKotaPenandatangan] = useState("Tangerang");

  // Pihak Pertama (PT TNT KREATIF DIGITAL)
  const [namaPerusahaan, setNamaPerusahaan] = useState("PT TNT KREATIF DIGITAL");
  const [alamatPerusahaan, setAlamatPerusahaan] = useState(
    "Jalan Kavling Perkebunan Raya, RT 006 / RW 013, Panunggangan Barat, Kecamatan Cibodas, Kota Tangerang, Banten 15139"
  );
  const [namaDirekturTNT, setNamaDirekturTNT] = useState("Stevani");
  const [jabatanDirekturTNT, setJabatanDirekturTNT] = useState("Direktur");
  const [teleponPerusahaan, setTeleponPerusahaan] = useState("+62 85178230404");
  const [emailPerusahaan, setEmailPerusahaan] = useState("tntmediaaffiliate@gmail.com");
  const [namaPicTNT, setNamaPicTNT] = useState(defaultUserName || "Safira");
  const [jabatanPicTNT, setJabatanPicTNT] = useState("Project Manager");

  // Pihak Kedua (Kreator)
  const [namaKreator, setNamaKreator] = useState("");
  const [usernameTikTok, setUsernameTikTok] = useState("");
  const [tiktokUid, setTiktokUid] = useState("");
  const [nikKtp, setNikKtp] = useState("");
  const [alamatKreator, setAlamatKreator] = useState("");
  const [tempatLahir, setTempatLahir] = useState("");
  const [tanggalLahir, setTanggalLahir] = useState("");
  const [teleponKreator, setTeleponKreator] = useState("");
  const [emailKreator, setEmailKreator] = useState("");
  const [npwpKreator, setNpwpKreator] = useState("");

  // Rekening Bank Pembayaran
  const [namaBank, setNamaBank] = useState("");
  const [nomorRekening, setNomorRekening] = useState("");
  const [atasNamaRekening, setAtasNamaRekening] = useState("");

  // Deliverables & Scope (Lampiran I)
  const [jenisCampaign, setJenisCampaign] = useState("Fee");
  const [qtyVt, setQtyVt] = useState<number>(4);
  const [qtyPhotoSlide, setQtyPhotoSlide] = useState<number>(0);
  const [qtyLive, setQtyLive] = useState<number>(0);
  const [durasiKonten, setDurasiKonten] = useState("30 - 60");
  const [durasiKontenTerbilang, setDurasiKontenTerbilang] = useState("tiga puluh sampai enam puluh");
  const [hashtag, setHashtag] = useState("");
  const [rawDraftDate, setRawDraftDate] = useState(todayStr);
  const [rawPostingStart, setRawPostingStart] = useState(todayStr);
  const [rawPostingEnd, setRawPostingEnd] = useState(nextWeekStr);
  const [biayaHonor, setBiayaHonor] = useState<number>(200000);
  const [feePerVtManual, setFeePerVtManual] = useState<number>(0);
  const [batasWaktuRevisi, setBatasWaktuRevisi] = useState("2 (dua)");
  const [jangkaWaktuTayang, setJangkaWaktuTayang] = useState("60 (enam puluh)");
  const [skemaPembayaran, setSkemaPembayaran] = useState(
    "H+14 dari selesai Campaign sampai dengan H+21 dari selesai Campaign"
  );
  const [ketentuanPembayaran, setKetentuanPembayaran] = useState(
    "Honor PIHAK KEDUA akan dibayarkan oleh PIHAK PERTAMA 100% maksimal H+14 setelah upload video ke 4"
  );
  const [rawKontrakMulai, setRawKontrakMulai] = useState(todayStr);
  const [rawKontrakBerakhir, setRawKontrakBerakhir] = useState(nextMonthStr);
  const [catatanTambahan, setCatatanTambahan] = useState("");
  const [customClauses, setCustomClauses] = useState("");

  // SINKRONISASI KE PROFIL KREATOR DI DATABASE
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{ success?: boolean; message?: string } | null>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Real-time server-side lookup dengan debounce agar akurat ke seluruh kreator di database
  useEffect(() => {
    const cleanQ = searchQuery.trim().replace(/^@+/, "");
    if (!cleanQ || !selectedCampaignId) {
      setServerSearchResults([]);
      setIsSearchingServer(false);
      return;
    }

    // Jika searchQuery sama dengan kreator yang sedang aktif dipilih, tidak perlu cari ulang
    if (
      selectedCreator &&
      (cleanQ.toLowerCase() === (selectedCreator.username || "").toLowerCase() ||
        `@${cleanQ.toLowerCase()}` === `@${(selectedCreator.username || "").toLowerCase()}`)
    ) {
      return;
    }

    setIsSearchingServer(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetchCampaignCreatorsForDocumentsAction({
          campaignId: selectedCampaignId,
          search: cleanQ,
          approvalFilter: "all",
        });
        if (res.success && res.data) {
          setServerSearchResults(res.data);
        } else {
          setServerSearchResults([]);
        }
      } catch (err) {
        console.error("Gagal mencari kreator di server:", err);
        setServerSearchResults([]);
      } finally {
        setIsSearchingServer(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [searchQuery, selectedCampaignId, selectedCreator]);

  // Filter creator recommendations based on searchQuery (prioritas server, fallback lokal)
  const filteredCreators = useMemo(() => {
    const cleanQ = searchQuery.trim().replace(/^@+/, "").toLowerCase();
    if (!cleanQ) return creators.slice(0, 10);
    if (serverSearchResults.length > 0) return serverSearchResults;
    return creators.filter((c: any) => {
      const u = (c.username || "").toLowerCase();
      const n = (c.nama_lengkap || c.nama_asli || "").toLowerCase();
      return u.includes(cleanQ) || n.includes(cleanQ);
    });
  }, [creators, searchQuery, serverSearchResults]);

  // Mengisi form secara otomatis dari data profil kreator
  const applyCreatorData = (c: any) => {
    if (!c) return;
    const uName = (c.username || "").replace(/^@+/, "");
    const realName = c.nama_lengkap || c.nama_asli || c.nama_ktp || uName;
    const phone = c.contact_nomor || c.no_whatsapp || c.pic_nomor_wa || "";
    const nik = c.nik_ktp || "";
    const alamat = c.alamat_ktp || c.alamat_domisili || "";
    const bName = c.bank_name || "";
    const bNum = c.account_number || "";
    const bHolder = c.account_holder || realName;
    const rate = Number(c.price) || 0;
    const vt = Number(c.qty_vt) || 1;
    const ttUid = c.tiktok_uid || "";
    const email = c.email || "";
    const npwp = c.npwp || "";
    const tLahir = c.tempat_lahir || "";
    const tgLahir = c.tanggal_lahir ? String(c.tanggal_lahir).split("T")[0] : "";

    setNamaKreator(realName);
    setUsernameTikTok(uName);
    setTeleponKreator(phone);
    setNikKtp(nik);
    setAlamatKreator(alamat);
    setTiktokUid(ttUid);
    setEmailKreator(email);
    setNpwpKreator(npwp);
    setTempatLahir(tLahir);
    setTanggalLahir(tgLahir);
    setNamaBank(bName);
    setNomorRekening(bNum);
    setAtasNamaRekening(bHolder);
    if (rate > 0) setBiayaHonor(rate);
    if (vt > 0) setQtyVt(vt);

    const seqStr = String(c.cc_id || 1).padStart(3, "0");
    const romanMonth = getRomanMonth(today.getMonth());
    setNomorKontrak(`${seqStr}/JC-TNT/${inisialDrafter || "TNT"}/${romanMonth}/${curYear}`);
    if (selectedCampaign?.nama) {
      setHashtag(`#${selectedCampaign.nama.replace(/\s+/g, "")}`);
    }
    setKetentuanPembayaran(
      `Honor PIHAK KEDUA akan dibayarkan oleh PIHAK PERTAMA 100% maksimal H+14 setelah upload video ke ${vt}`
    );
  };

  // Handler saat user memilih kreator dari dropdown rekomendasi
  const handleSelectCreator = (c: any) => {
    setSelectedCcId(c.cc_id);
    setSelectedCreator(c);
    applyCreatorData(c);
    setSearchQuery(`@${c.username}`);
    setIsDropdownOpen(false);
  };

  // Sync state ketika currentCreator berubah jika terpilih di luar autocomplete
  useEffect(() => {
    if (currentCreator) {
      applyCreatorData(currentCreator);
    }
  }, [currentCreator]);

  // Handle tombol Simpan / Sinkronkan ke Profil Kreator
  const handleSyncToProfile = async () => {
    if (!currentCreator?.creator_id) {
      setSyncStatus({
        success: false,
        message: "Pilih kreator dari database terlebih dahulu sebelum menyimpan ke profil.",
      });
      return;
    }

    setIsSyncing(true);
    setSyncStatus(null);
    try {
      const res = await syncContractCreatorProfileDataAction({
        creatorId: currentCreator.creator_id,
        namaLengkap: namaKreator,
        tiktokUid,
        nikKtp,
        alamatKtp: alamatKreator,
        tempatLahir,
        tanggalLahir,
        noWhatsapp: teleponKreator,
        email: emailKreator,
        npwp: npwpKreator,
        namaBank,
        nomorRekening,
        atasNamaRekening,
      });

      if (res.success) {
        setSyncStatus({ success: true, message: "Data profil kreator berhasil diperbarui ke database!" });
        if (onCreatorUpdated) onCreatorUpdated();
      } else {
        setSyncStatus({ success: false, message: res.error || "Gagal memperbarui profil." });
      }
    } catch (err: any) {
      setSyncStatus({ success: false, message: err.message || "Terjadi kesalahan sistem." });
    } finally {
      setIsSyncing(false);
    }
  };

  // Auto write-back otomatis ke profil kreator saat dokumen diunduh
  const handleAutoWriteBack = async () => {
    if (!currentCreator?.creator_id) return;
    try {
      await syncContractCreatorProfileDataAction({
        creatorId: currentCreator.creator_id,
        namaLengkap: namaKreator,
        tiktokUid,
        nikKtp,
        alamatKtp: alamatKreator,
        tempatLahir,
        tanggalLahir,
        noWhatsapp: teleponKreator,
        email: emailKreator,
        npwp: npwpKreator,
        namaBank,
        nomorRekening,
        atasNamaRekening,
      });
      if (onCreatorUpdated) onCreatorUpdated();
    } catch (err) {
      console.error("Auto write-back background error:", err);
    }
  };

  // Selected Campaign Object
  const selectedCampaign = useMemo(() => {
    return campaigns.find((c) => c.id === selectedCampaignId) || null;
  }, [campaigns, selectedCampaignId]);

  // Calculated strings for PDF
  const hariTanggalPerjanjian = useMemo(() => {
    return formatHariTanggalIndo(rawTanggalKontrak);
  }, [rawTanggalKontrak]);

  const tanggalKota = useMemo(() => {
    const formattedD = formatDateIndo(rawTanggalKontrak);
    return `${kotaPenandatangan || "Tangerang"}, ${formattedD}`;
  }, [kotaPenandatangan, rawTanggalKontrak]);

  const tempatTanggalLahirStr = useMemo(() => {
    if (!tempatLahir && !tanggalLahir) return "";
    if (tempatLahir && !tanggalLahir) return tempatLahir;
    if (!tempatLahir && tanggalLahir) return formatDateIndo(tanggalLahir);
    return `${tempatLahir}, ${formatDateIndo(tanggalLahir)}`;
  }, [tempatLahir, tanggalLahir]);

  const periodeTayangStr = useMemo(() => {
    if (!rawPostingStart && !rawPostingEnd) return "Sesuai timeline yang disepakati";
    return `${formatDateIndo(rawPostingStart)} - ${formatDateIndo(rawPostingEnd)}`;
  }, [rawPostingStart, rawPostingEnd]);

  const tanggalMulaiStr = useMemo(() => formatDateIndo(rawKontrakMulai), [rawKontrakMulai]);
  const tanggalBerakhirStr = useMemo(() => formatDateIndo(rawKontrakBerakhir), [rawKontrakBerakhir]);

  // DATA DOKUMEN UNTUK LIVE PREVIEW PDF
  const contractPdfData: CreatorContractData = useMemo(() => {
    const honorNum = Number(biayaHonor) || 0;
    const terbilangStr = honorNum > 0 ? `${terbilang(honorNum).trim()} rupiah` : "nol rupiah";

    let rekeningStr = "";
    if (namaBank && nomorRekening) {
      rekeningStr = `${namaBank} - ${nomorRekening} a.n. ${atasNamaRekening || namaKreator}`;
    }

    const d = new Date(rawTanggalKontrak);
    const dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    const hariPerjanjian = !isNaN(d.getTime()) ? dayNames[d.getDay()] : "____";
    const tanggalPerjanjian = formatDateIndo(rawTanggalKontrak) || "____";

    const draftStr = rawDraftDate ? formatDateIndo(rawDraftDate) : "__ ______ ____";
    const postingRangeStr =
      rawPostingStart && rawPostingEnd
        ? `${formatDateIndo(rawPostingStart)} - ${formatDateIndo(rawPostingEnd)}`
        : "__ ______ ____";

    const calculatedFeePerVt =
      feePerVtManual > 0
        ? feePerVtManual
        : Number(qtyVt) > 0
        ? Math.round(honorNum / Number(qtyVt))
        : honorNum;

    return {
      nomorKontrak,
      hariPerjanjian,
      tanggalPerjanjian,
      hariTanggalPerjanjian,
      tanggalKota,
      tempatPerjanjian: kotaPenandatangan || "Tangerang",

      // Pihak Pertama (TNT)
      namaPerusahaan,
      alamatPerusahaan,
      namaDirekturTNT: namaDirekturTNT || "Stevani",
      jabatanDirekturTNT: jabatanDirekturTNT || "Direktur",
      namaPicTNT,
      jabatanPicTNT,
      teleponPerusahaan,
      emailPerusahaan,

      // Pihak Kedua (Kreator)
      namaKreator: namaKreator || "Nama Content Creator",
      usernameTikTok: usernameTikTok || "username",
      tiktokUid,
      nikKtp,
      tempatTanggalLahir: tempatTanggalLahirStr,
      alamatKreator: alamatKreator || "Alamat domisili lengkap",
      teleponKreator: teleponKreator || "-",
      emailKreator,
      npwpKreator,

      // Rekening
      namaBank,
      nomorRekening,
      atasNamaRekening,
      rekeningKreator: rekeningStr,

      // Detail Kerjasama & Lampiran I
      namaCampaign: selectedCampaign?.nama || "Campaign TNT",
      namaBrand: campaignBrandName || "Brand Partner",
      jenisCampaign,
      qtyVt: Number(qtyVt) || 1,
      qtyPhotoSlide: Number(qtyPhotoSlide) || 0,
      qtyLive: Number(qtyLive) || 0,
      durasiKonten: durasiKonten || "30 - 60",
      durasiKontenTerbilang: durasiKontenTerbilang || "tiga puluh sampai enam puluh",
      hashtag: hashtag || (selectedCampaign?.nama ? `#${selectedCampaign.nama.replace(/\s+/g, "")}` : "-"),
      jadwalDraft: draftStr,
      jadwalPosting: postingRangeStr,
      batasWaktuRevisi: batasWaktuRevisi || "2 (dua)",
      jangkaWaktuTayang: jangkaWaktuTayang || "60 (enam puluh)",
      periodeTayang: periodeTayangStr,
      biayaHonor: honorNum,
      terbilangHonor: terbilangStr,
      feePerVt: calculatedFeePerVt,
      skemaPembayaran,
      ketentuanPembayaran,
      tanggalMulai: tanggalMulaiStr,
      tanggalBerakhir: tanggalBerakhirStr,
      catatanTambahan: catatanTambahan || customClauses,
      customClauses,
    };
  }, [
    nomorKontrak,
    rawTanggalKontrak,
    hariTanggalPerjanjian,
    tanggalKota,
    kotaPenandatangan,
    namaPerusahaan,
    alamatPerusahaan,
    namaDirekturTNT,
    jabatanDirekturTNT,
    teleponPerusahaan,
    emailPerusahaan,
    namaPicTNT,
    jabatanPicTNT,
    namaKreator,
    usernameTikTok,
    tiktokUid,
    nikKtp,
    tempatTanggalLahirStr,
    alamatKreator,
    teleponKreator,
    emailKreator,
    npwpKreator,
    namaBank,
    nomorRekening,
    atasNamaRekening,
    selectedCampaign,
    campaignBrandName,
    jenisCampaign,
    qtyVt,
    qtyPhotoSlide,
    qtyLive,
    durasiKonten,
    durasiKontenTerbilang,
    hashtag,
    rawDraftDate,
    rawPostingStart,
    rawPostingEnd,
    batasWaktuRevisi,
    jangkaWaktuTayang,
    periodeTayangStr,
    biayaHonor,
    feePerVtManual,
    skemaPembayaran,
    ketentuanPembayaran,
    tanggalMulaiStr,
    tanggalBerakhirStr,
    catatanTambahan,
    customClauses,
  ]);

  const outputFileName = `Perjanjian_Join_Campaign_${(usernameTikTok || "kreator").replace(/[@\s]/g, "")}_${(selectedCampaign?.nama || "Campaign").replace(/[\s/]/g, "_")}.pdf`;

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
              <option value="kontrak_creator">Perjanjian Kerja Sama Join Campaign (Revisi Terbaru)</option>
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

          {/* AUTOCOMPLETE / KETIK USERNAME KREATOR */}
          <div className="md:col-span-4 space-y-1 relative" ref={searchContainerRef}>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              Cari Username Kreator
              <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-semibold lowercase">
                auto-fill
              </span>
            </label>

            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onFocus={() => setIsDropdownOpen(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsDropdownOpen(true);
                  if (!e.target.value.trim()) {
                    setSelectedCcId(null);
                    setSelectedCreator(null);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && filteredCreators.length > 0) {
                    e.preventDefault();
                    handleSelectCreator(filteredCreators[0]);
                  }
                }}
                placeholder="Ketik username kreator (@...)"
                className="w-full pl-9 pr-9 py-2.5 bg-emerald-50/50 border border-emerald-300 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none transition-all"
              />
              <Search className="w-4 h-4 text-emerald-600 absolute left-3 top-3 pointer-events-none" />

              <div className="absolute right-2.5 top-2.5 flex items-center gap-1">
                {isSearchingServer && (
                  <RefreshCw className="w-4 h-4 text-emerald-600 animate-spin" />
                )}
                {searchQuery && !isSearchingServer && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setSelectedCcId(null);
                      setSelectedCreator(null);
                      setIsDropdownOpen(false);
                    }}
                    className="text-slate-400 hover:text-slate-600 p-0.5"
                    title="Hapus pencarian"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* DROPDOWN REKOMENDASI HASIL PENCARIAN */}
            {isDropdownOpen && (
              <div className="absolute z-50 left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl max-h-72 overflow-y-auto divide-y divide-slate-100">
                {isSearchingServer ? (
                  <div className="p-4 text-center flex items-center justify-center gap-2 text-xs text-slate-500 font-medium">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                    Mencari @{searchQuery.trim().replace(/^@+/, "")} di database campaign...
                  </div>
                ) : filteredCreators.length > 0 ? (
                  filteredCreators.map((c: any) => (
                    <button
                      key={c.cc_id}
                      type="button"
                      onClick={() => handleSelectCreator(c)}
                      className="w-full text-left px-3.5 py-2.5 hover:bg-emerald-50/70 transition-colors flex items-center justify-between group cursor-pointer"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="text-xs font-bold text-slate-900 group-hover:text-emerald-700 flex items-center gap-1.5 flex-wrap">
                          <span>@{c.username}</span>
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-wider ${
                              c.approval === "approved"
                                ? "bg-emerald-100 text-emerald-700"
                                : c.approval === "pending"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {c.approval || "listed"}
                          </span>
                          <span className="text-[10px] font-normal text-slate-400 truncate">
                            • {c.nama_lengkap || c.nama_asli || "Tanpa Nama"}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Fee: Rp {Number(c.price || 0).toLocaleString("id-ID")} • {c.qty_vt || 1} VT
                        </div>
                      </div>
                      <span className="text-[10px] font-semibold text-emerald-600 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        Pilih
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="p-4 text-center space-y-2">
                    <p className="text-xs text-slate-500 font-medium">
                      Username &ldquo;<span className="font-semibold text-slate-800">{searchQuery}</span>&rdquo; tidak ditemukan di campaign ini.
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Silakan tambahkan kreator di menu{" "}
                      <Link
                        href={`/campaigns/${selectedCampaignId}/listing`}
                        target="_blank"
                        className="text-blue-600 hover:underline font-semibold inline-flex items-center gap-0.5"
                      >
                        Listing Campaign
                        <ExternalLink className="w-2.5 h-2.5" />
                      </Link>{" "}
                      atau di{" "}
                      <Link
                        href="/creator-pool"
                        target="_blank"
                        className="text-blue-600 hover:underline font-semibold inline-flex items-center gap-0.5"
                      >
                        Creator Pool
                        <ExternalLink className="w-2.5 h-2.5" />
                      </Link>
                      .
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. SPLIT LAYOUT: FORM DI KIRI, LIVE PREVIEW DI KANAN */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* PANEL KIRI: FORM PENGISIAN DATA */}
        <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-6 max-h-[840px] overflow-y-auto">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Formulir Data Dokumen Kontrak
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Pilih tanggal langsung lewat kalender. Data otomatis tersinkron ke dokumen di kanan.
              </p>
            </div>
          </div>

          {/* SECTION 1: PIHAK KEDUA (KREATOR) - Sesuai mockup user */}
          <div className="space-y-4 p-4 rounded-xl bg-slate-50/60 border border-slate-200/60">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-4 h-4 text-emerald-600" />
                PIHAK KEDUA (KREATOR)
              </h3>
              <div className="flex items-center gap-2">
                {selectedCcId ? (
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Check className="w-3 h-3" /> Auto-filled
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                    Ketik Manual
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-3 text-xs">
              {/* Nama Lengkap & Username TikTok */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700">Nama Lengkap (Sesuai KTP) *</label>
                  <input
                    type="text"
                    value={namaKreator}
                    onChange={(e) => setNamaKreator(e.target.value)}
                    placeholder="Contoh: Tuniroh"
                    className="w-full mt-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-semibold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700">Username TikTok *</label>
                  <input
                    type="text"
                    value={usernameTikTok}
                    onChange={(e) => setUsernameTikTok(e.target.value)}
                    placeholder="@username"
                    className="w-full mt-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none"
                  />
                </div>
              </div>

              {/* TikTok UID & NIK */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700">TikTok UID (Opsional)</label>
                  <input
                    type="text"
                    value={tiktokUid}
                    onChange={(e) => setTiktokUid(e.target.value)}
                    placeholder="Contoh: 70823948271892"
                    className="w-full mt-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700">NIK (16 Digit)</label>
                  <input
                    type="text"
                    value={nikKtp}
                    onChange={(e) => setNikKtp(e.target.value)}
                    placeholder="3201xxxxxxxxxxxx"
                    maxLength={16}
                    className="w-full mt-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none"
                  />
                </div>
              </div>

              {/* Alamat Sesuai KTP */}
              <div>
                <label className="font-semibold text-slate-700 flex items-center justify-between">
                  <span>Alamat Sesuai KTP / Domisili Lengkap</span>
                  <span className="text-[10px] text-slate-400 font-normal">Disarankan lengkap RT/RW, Kec, Kota</span>
                </label>
                <textarea
                  rows={2}
                  value={alamatKreator}
                  onChange={(e) => setAlamatKreator(e.target.value)}
                  placeholder="Jl. Merpati No. 12, RT 01/02, Kel. Sukamaju, Kec. Cilodong, Kota Depok, Jawa Barat"
                  className="w-full mt-1 p-2.5 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none"
                />
              </div>

              {/* Tempat/Tanggal Lahir & WhatsApp */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700">Tanggal Lahir (KTP)</label>
                  <input
                    type="date"
                    value={tanggalLahir}
                    onChange={(e) => setTanggalLahir(e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700">Nomor WhatsApp *</label>
                  <input
                    type="text"
                    value={teleponKreator}
                    onChange={(e) => setTeleponKreator(e.target.value)}
                    placeholder="0812xxxxxxxx"
                    className="w-full mt-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none"
                  />
                </div>
              </div>

              {/* Tempat Lahir (Ketik) */}
              <div>
                <label className="font-semibold text-slate-700">Kota / Tempat Lahir (Opsional)</label>
                <input
                  type="text"
                  value={tempatLahir}
                  onChange={(e) => setTempatLahir(e.target.value)}
                  placeholder="Contoh: Jakarta / Bandung"
                  className="w-full mt-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none"
                />
              </div>

              {/* Email & NPWP */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700">Alamat Email</label>
                  <input
                    type="email"
                    value={emailKreator}
                    onChange={(e) => setEmailKreator(e.target.value)}
                    placeholder="kreator@gmail.com"
                    className="w-full mt-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700">NPWP (Opsional)</label>
                  <input
                    type="text"
                    value={npwpKreator}
                    onChange={(e) => setNpwpKreator(e.target.value)}
                    placeholder="00.000.000.0-000.000"
                    className="w-full mt-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none"
                  />
                </div>
              </div>

              {/* Sub-Card: Rekening Bank Pembayaran */}
              <div className="p-3 bg-white rounded-lg border border-slate-200/80 space-y-2 mt-2">
                <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                  Rekening Bank Pembayaran
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600">Bank / E-Wallet</label>
                    <input
                      type="text"
                      value={namaBank}
                      onChange={(e) => setNamaBank(e.target.value)}
                      placeholder="BCA / Mandiri / ShopeePay"
                      className="w-full mt-1 px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded text-slate-900 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600">Nomor Rekening</label>
                    <input
                      type="text"
                      value={nomorRekening}
                      onChange={(e) => setNomorRekening(e.target.value)}
                      placeholder="123456789"
                      className="w-full mt-1 px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded text-slate-900 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600">Atas Nama Rekening</label>
                    <input
                      type="text"
                      value={atasNamaRekening}
                      onChange={(e) => setAtasNamaRekening(e.target.value)}
                      placeholder="Nama pemilik buku tabungan"
                      className="w-full mt-1 px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded text-slate-900 text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* SINKRONISASI KE PROFIL DATABASE BUTTON */}
              {currentCreator?.creator_id && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleSyncToProfile}
                    disabled={isSyncing}
                    className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                  >
                    {isSyncing ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Menyimpan ke Database Profil Kreator...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" />
                        <span>Simpan &amp; Hubungkan Perubahan ke Profil Kreator</span>
                      </>
                    )}
                  </button>

                  {syncStatus && (
                    <div
                      className={`mt-2 p-2 rounded text-[11px] font-medium flex items-center gap-1.5 ${
                        syncStatus.success
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-rose-100 text-rose-800"
                      }`}
                    >
                      {syncStatus.success ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      )}
                      <span>{syncStatus.message}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* SECTION 2: PIHAK PERTAMA (PT TNT KREATIF DIGITAL) */}
          <div className="space-y-4 p-4 rounded-xl bg-slate-50/60 border border-slate-200/60">
            <h3 className="text-xs font-bold text-indigo-800 uppercase tracking-wider flex items-center gap-1.5">
              <Building className="w-4 h-4 text-indigo-600" />
              PIHAK PERTAMA (PT TNT KREATIF DIGITAL)
            </h3>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700">Nama Direktur TNT *</label>
                <input
                  type="text"
                  value={namaDirekturTNT}
                  onChange={(e) => setNamaDirekturTNT(e.target.value)}
                  placeholder="Stevani"
                  className="w-full mt-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-semibold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700">Jabatan Perwakilan</label>
                <input
                  type="text"
                  value={jabatanDirekturTNT}
                  onChange={(e) => setJabatanDirekturTNT(e.target.value)}
                  placeholder="Direktur"
                  className="w-full mt-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700">Nama Drafter / PIC TNT</label>
                <input
                  type="text"
                  value={namaPicTNT}
                  onChange={(e) => {
                    const newName = e.target.value;
                    setNamaPicTNT(newName);
                    const newInit = getInitials(newName);
                    setInisialDrafter(newInit);
                    const seqMatch = nomorKontrak.match(/^(\d{3})\/JC-TNT/);
                    const seq = seqMatch ? seqMatch[1] : "001";
                    setNomorKontrak(`${seq}/JC-TNT/${newInit}/${curRomanMonth}/${curYear}`);
                  }}
                  placeholder="Safira"
                  className="w-full mt-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700">Inisial Nama Drafter</label>
                <input
                  type="text"
                  maxLength={5}
                  value={inisialDrafter}
                  onChange={(e) => {
                    const newInit = e.target.value.toUpperCase();
                    setInisialDrafter(newInit);
                    const seqMatch = nomorKontrak.match(/^(\d{3})\/JC-TNT/);
                    const seq = seqMatch ? seqMatch[1] : "001";
                    setNomorKontrak(`${seq}/JC-TNT/${newInit || "TNT"}/${curRomanMonth}/${curYear}`);
                  }}
                  placeholder="SF"
                  className="w-full mt-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono font-bold uppercase focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none"
                />
              </div>

              <div className="col-span-2">
                <label className="font-semibold text-slate-700">Nama Entitas Perusahaan</label>
                <input
                  type="text"
                  value={namaPerusahaan}
                  onChange={(e) => setNamaPerusahaan(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none"
                />
              </div>
              <div className="col-span-2">
                <label className="font-semibold text-slate-700">Alamat Kantor Resmi</label>
                <input
                  type="text"
                  value={alamatPerusahaan}
                  onChange={(e) => setAlamatPerusahaan(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none"
                />
              </div>
            </div>
          </div>

          {/* SECTION 3: LEGALITAS & TANGGAL KONTRAK */}
          <div className="space-y-4 p-4 rounded-xl bg-slate-50/60 border border-slate-200/60">
            <h3 className="text-xs font-bold text-blue-800 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-blue-600" />
              LEGALITAS SURAT &amp; TANGGAL KONTRAK
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700">Nomor Surat Kontrak</label>
                <input
                  type="text"
                  value={nomorKontrak}
                  onChange={(e) => setNomorKontrak(e.target.value)}
                  placeholder="001/JC-TNT/SF/X/2026"
                  className="w-full mt-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono font-semibold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Format baku: [No]/JC-TNT/[Inisial Drafter]/[Bulan Romawi]/[Tahun]
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700">Pilih Tanggal Kontrak</label>
                  <input
                    type="date"
                    value={rawTanggalKontrak}
                    onChange={(e) => setRawTanggalKontrak(e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700">Kota Penandatanganan</label>
                  <input
                    type="text"
                    value={kotaPenandatangan}
                    onChange={(e) => setKotaPenandatangan(e.target.value)}
                    placeholder="Tangerang"
                    className="w-full mt-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none"
                  />
                </div>
              </div>

              <div className="p-2.5 bg-blue-50/60 rounded-lg border border-blue-200/70 text-[11px] text-blue-900 space-y-1">
                <div className="font-semibold">Format Otomatis di Pembuka Perjanjian:</div>
                <div className="italic text-slate-700">
                  &ldquo;Pada hari ini, <span className="font-bold">{formatHariTanggalIndo(rawTanggalKontrak).split(" ")[0]}</span>, tanggal <span className="font-bold">{formatDateIndo(rawTanggalKontrak)}</span>, bertempat di <span className="font-bold">{kotaPenandatangan || "Tangerang"}</span>...&rdquo;
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 4: DELIVERABLES, JADWAL & LAMPIRAN I */}
          <div className="space-y-4 p-4 rounded-xl bg-slate-50/60 border border-slate-200/60">
            <h3 className="text-xs font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-amber-600" />
              DETAIL DELIVERABLES &amp; LAMPIRAN I
            </h3>

            <div className="space-y-3 text-xs">
              {/* Jenis Campaign */}
              <div>
                <label className="font-semibold text-slate-700">Jenis Campaign (Lampiran I)</label>
                <select
                  value={jenisCampaign}
                  onChange={(e) => setJenisCampaign(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-semibold focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 outline-none cursor-pointer"
                >
                  <option value="Fee">Fee (Berbayar Penuh)</option>
                  <option value="Barter">Barter (Produk / Jasa)</option>
                  <option value="Fee dan Barter">Fee dan Barter (Kombinasi)</option>
                </select>
              </div>

              {/* Rincian Deliverable: Video, Photo Slide, Live */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="font-semibold text-slate-700">Jumlah Video (VT)</label>
                  <input
                    type="number"
                    min={1}
                    value={qtyVt}
                    onChange={(e) => setQtyVt(Number(e.target.value))}
                    className="w-full mt-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-bold focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 outline-none"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700">Photo Slide</label>
                  <input
                    type="number"
                    min={0}
                    value={qtyPhotoSlide}
                    onChange={(e) => setQtyPhotoSlide(Number(e.target.value))}
                    className="w-full mt-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 outline-none"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700">Live (Sesi)</label>
                  <input
                    type="number"
                    min={0}
                    value={qtyLive}
                    onChange={(e) => setQtyLive(Number(e.target.value))}
                    className="w-full mt-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 outline-none"
                  />
                </div>
              </div>

              {/* Durasi Konten */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700">Durasi Konten (Detik)</label>
                  <input
                    type="text"
                    value={durasiKonten}
                    onChange={(e) => setDurasiKonten(e.target.value)}
                    placeholder="30 - 60"
                    className="w-full mt-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 outline-none"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700">Durasi Terbilang</label>
                  <input
                    type="text"
                    value={durasiKontenTerbilang}
                    onChange={(e) => setDurasiKontenTerbilang(e.target.value)}
                    placeholder="tiga puluh sampai enam puluh"
                    className="w-full mt-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 outline-none"
                  />
                </div>
              </div>

              {/* Hashtag Campaign */}
              <div>
                <label className="font-semibold text-slate-700">Hashtag Campaign</label>
                <input
                  type="text"
                  value={hashtag}
                  onChange={(e) => setHashtag(e.target.value)}
                  placeholder="#BrandPartner #CampaignName #TikTokShop"
                  className="w-full mt-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 outline-none"
                />
              </div>

              {/* Jadwal Draft & Jadwal Posting */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="font-semibold text-slate-700">Kirim Draft:</label>
                  <input
                    type="date"
                    value={rawDraftDate}
                    onChange={(e) => setRawDraftDate(e.target.value)}
                    className="w-full mt-1 px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 outline-none text-xs"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700">Mulai Posting:</label>
                  <input
                    type="date"
                    value={rawPostingStart}
                    onChange={(e) => setRawPostingStart(e.target.value)}
                    className="w-full mt-1 px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 outline-none text-xs"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700">Batas Posting:</label>
                  <input
                    type="date"
                    value={rawPostingEnd}
                    onChange={(e) => setRawPostingEnd(e.target.value)}
                    className="w-full mt-1 px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 outline-none text-xs"
                  />
                </div>
              </div>

              {/* Honorarium Total & Nilai per Deliverable */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700">Total Fee Campaign (Rp)</label>
                  <input
                    type="number"
                    step={10000}
                    value={biayaHonor}
                    onChange={(e) => setBiayaHonor(Number(e.target.value))}
                    className="w-full mt-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-bold focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 outline-none"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700">Fee per Deliverable (Rp, Opsional)</label>
                  <input
                    type="number"
                    step={10000}
                    value={feePerVtManual || ""}
                    onChange={(e) => setFeePerVtManual(Number(e.target.value))}
                    placeholder={`Otomatis: ${(Number(qtyVt) > 0 ? Math.round(biayaHonor / Number(qtyVt)) : biayaHonor).toLocaleString("id-ID")}`}
                    className="w-full mt-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 outline-none"
                  />
                </div>
              </div>

              {/* Skema Pembayaran */}
              <div>
                <label className="font-semibold text-slate-700">Skema Pembayaran (Lampiran I)</label>
                <input
                  type="text"
                  value={skemaPembayaran}
                  onChange={(e) => setSkemaPembayaran(e.target.value)}
                  placeholder="H+14 dari selesai Campaign sampai dengan H+21 dari selesai Campaign"
                  className="w-full mt-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 outline-none"
                />
              </div>

              {/* Batas Revisi & Jangka Tayang */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700">Batas Waktu Revisi</label>
                  <input
                    type="text"
                    value={batasWaktuRevisi}
                    onChange={(e) => setBatasWaktuRevisi(e.target.value)}
                    placeholder="2 (dua)"
                    className="w-full mt-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 outline-none"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700">Jangka Waktu Tayang (Hari)</label>
                  <input
                    type="text"
                    value={jangkaWaktuTayang}
                    onChange={(e) => setJangkaWaktuTayang(e.target.value)}
                    placeholder="60 (enam puluh)"
                    className="w-full mt-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 outline-none"
                  />
                </div>
              </div>

              {/* Masa Berlaku Kontrak */}
              <div>
                <label className="font-semibold text-slate-700 flex items-center justify-between">
                  <span>Periode Kontrak Keseluruhan (Lampiran I)</span>
                  <span className="text-[10px] text-slate-400 font-normal">Mulai s.d. Selesai</span>
                </label>
                <div className="grid grid-cols-2 gap-3 mt-1">
                  <div>
                    <span className="text-[10px] text-slate-500">Tanggal Mulai:</span>
                    <input
                      type="date"
                      value={rawKontrakMulai}
                      onChange={(e) => setRawKontrakMulai(e.target.value)}
                      className="w-full mt-0.5 px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 outline-none"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500">Tanggal Selesai:</span>
                    <input
                      type="date"
                      value={rawKontrakBerakhir}
                      onChange={(e) => setRawKontrakBerakhir(e.target.value)}
                      className="w-full mt-0.5 px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Catatan Tambahan Lampiran I */}
              <div>
                <label className="font-semibold text-slate-700">Catatan Tambahan (Lampiran I)</label>
                <textarea
                  rows={2}
                  value={catatanTambahan}
                  onChange={(e) => setCatatanTambahan(e.target.value)}
                  placeholder="Catatan teknis khusus untuk campaign ini..."
                  className="w-full mt-1 p-2.5 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 outline-none"
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
              onClick={handleAutoWriteBack}
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
          <div className="w-full h-[760px] rounded-xl overflow-hidden border border-slate-200 bg-slate-100 shadow-inner">
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
