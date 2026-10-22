"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Building,
  Calendar,
  FileText,
  User,
  CreditCard,
  RefreshCw,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  getNextContractSequenceAction,
  releaseContractAction,
} from "@/app/actions/contractActions";

function getRomanMonth(m: number): string {
  const romans = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
  return romans[m] || "X";
}

function getInitials(name: string): string {
  if (!name) return "HN";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatHariTanggal(dateStr: string): { hari: string; tanggalStr: string; fullKalimat: string } {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return { hari: "", tanggalStr: dateStr || "", fullKalimat: "" };
    const hari = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"][d.getDay()];
    const bulan = [
      "Januari", "Februari", "Maret", "April", "Mei", "Juni",
      "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ][d.getMonth()];
    return {
      hari,
      tanggalStr: `${d.getDate()} ${bulan} ${d.getFullYear()}`,
      fullKalimat: `Pada hari ini, ${hari}, tanggal ${d.getDate()} ${bulan} ${d.getFullYear()}`,
    };
  } catch (e) {
    return { hari: "", tanggalStr: dateStr || "", fullKalimat: "" };
  }
}

interface ReleaseContractModalProps {
  isOpen: boolean;
  onClose: () => void;
  contract: any | null;
  onSuccess: () => void;
  currentUserName?: string;
}

export default function ReleaseContractModal({
  isOpen,
  onClose,
  contract,
  onSuccess,
  currentUserName = "Hibban Nazala",
}: ReleaseContractModalProps) {
  const d = contract?.contract_data || {};

  // Form Pihak Pertama (TNT)
  const [namaDirekturTNT, setNamaDirekturTNT] = useState(d.namaDirekturTNT || "Stevani");
  const [jabatanDirekturTNT, setJabatanDirekturTNT] = useState(d.jabatanDirekturTNT || "Direktur");
  const [namaPicTNT, setNamaPicTNT] = useState(d.namaPicTNT || currentUserName || "Hibban Nazala");
  const [inisialPicTNT, setInisialPicTNT] = useState(
    d.inisialPicTNT || getInitials(d.namaPicTNT || currentUserName || "Hibban Nazala")
  );
  const [namaSignerTNT, setNamaSignerTNT] = useState(d.namaSignerTNT || "Ruben Arianto");
  const [jabatanSignerTNT, setJabatanSignerTNT] = useState(d.jabatanSignerTNT || "Manajer Umum");
  const [namaPerusahaan, setNamaPerusahaan] = useState(d.namaPerusahaan || "PT TNT KREATIF DIGITAL");
  const [alamatPerusahaan, setAlamatPerusahaan] = useState(
    d.alamatPerusahaan ||
      "Jalan Kavling Perkebunan Raya, RT 006 / RW 013, Panunggangan Barat, Kecamatan Cibodas, Kota Tangerang, Banten 15139"
  );

  // Form Legalitas & Tanggal Surat
  const todayIso = new Date().toISOString().split("T")[0];
  const [tanggalKontrak, setTanggalKontrak] = useState(todayIso);
  const [tempatPerjanjian, setTempatPerjanjian] = useState(d.tempatPerjanjian || "Tangerang");

  // State Nomor Urut Resmi
  const [seqStr, setSeqStr] = useState<string>("001");
  const [isLoadingSeq, setIsLoadingSeq] = useState(false);

  // Koreksi & Kelengkapan Data Kreator
  const [showCreatorEdit, setShowCreatorEdit] = useState(false);
  const [namaKreator, setNamaKreator] = useState(d.namaKreator || contract?.creator_nama || "");
  const [nikKtp, setNikKtp] = useState(d.nikKtp || "");
  const [alamatKreator, setAlamatKreator] = useState(d.alamatKreator || "");
  const [teleponKreator, setTeleponKreator] = useState(d.teleponKreator || "");
  const [namaBank, setNamaBank] = useState(d.namaBank || "");
  const [nomorRekening, setNomorRekening] = useState(d.nomorRekening || "");
  const [atasNamaRekening, setAtasNamaRekening] = useState(d.atasNamaRekening || d.namaKreator || contract?.creator_nama || "");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sinkronkan state saat contract terbuka
  useEffect(() => {
    if (!isOpen || !contract) return;

    const data = contract.contract_data || {};
    setNamaDirekturTNT(data.namaDirekturTNT || "Stevani");
    setJabatanDirekturTNT(data.jabatanDirekturTNT || "Direktur");
    const initPic = data.namaPicTNT || currentUserName || "Hibban Nazala";
    setNamaPicTNT(initPic);
    setInisialPicTNT(data.inisialPicTNT || getInitials(initPic));
    setNamaSignerTNT(data.namaSignerTNT || "Ruben Arianto");
    setJabatanSignerTNT(data.jabatanSignerTNT || "Manajer Umum");
    setNamaPerusahaan(data.namaPerusahaan || "PT TNT KREATIF DIGITAL");
    setAlamatPerusahaan(
      data.alamatPerusahaan ||
        "Jalan Kavling Perkebunan Raya, RT 006 / RW 013, Panunggangan Barat, Kecamatan Cibodas, Kota Tangerang, Banten 15139"
    );
    setTempatPerjanjian(data.tempatPerjanjian || "Tangerang");

    const cNama = data.namaKreator || contract.creator_nama || "";
    const cNik = (data.nikKtp || "").toString().trim();
    const cAlamat = data.alamatKreator || "";
    const cTelp = (data.teleponKreator || "").toString().trim();
    const cBank = data.namaBank || "";
    const cRek = (data.nomorRekening || "").toString().trim();
    const cAtasNama = data.atasNamaRekening || cNama;

    setNamaKreator(cNama);
    setNikKtp(cNik);
    setAlamatKreator(cAlamat);
    setTeleponKreator(cTelp);
    setNamaBank(cBank);
    setNomorRekening(cRek);
    setAtasNamaRekening(cAtasNama);

    // Hitung apakah sudah lengkap saat awal dibuka
    const validNik = cNik.replace(/\D/g, "").length === 16;
    const validNama = cNama.trim().length >= 2;
    const validAlamat = cAlamat.trim().length >= 5;
    const validTelp = cTelp.replace(/\D/g, "").length >= 8;
    const validRek = Boolean(cBank.trim() && cRek.trim() && cAtasNama.trim());
    const validAll = validNik && validNama && validAlamat && validTelp && validRek;

    // Jika ada data yang belum lengkap, otomatis buka form koreksi kreator
    setShowCreatorEdit(!validAll);

    // Ambil nomor urut resmi berikutnya dari database
    setIsLoadingSeq(true);
    getNextContractSequenceAction()
      .then((res) => {
        if (res.success && res.seqStr) {
          setSeqStr(res.seqStr);
        }
      })
      .finally(() => {
        setIsLoadingSeq(false);
      });
  }, [isOpen, contract, currentUserName]);

  // Kalkulasi Preview Nomor Surat Kontrak: [No]/JC-TNT/[Inisial Drafter]/[Bulan Romawi]/[Tahun]
  const previewOfficialNumber = useMemo(() => {
    const today = new Date(tanggalKontrak || Date.now());
    const curYear = today.getFullYear();
    const curRomanMonth = getRomanMonth(today.getMonth());
    const init = inisialPicTNT?.trim().toUpperCase() || "HN";
    return `${seqStr}/JC-TNT/${init}/${curRomanMonth}/${curYear}`;
  }, [seqStr, inisialPicTNT, tanggalKontrak]);

  // Kalimat pembuka
  const pembukaInfo = useMemo(() => {
    return formatHariTanggal(tanggalKontrak);
  }, [tanggalKontrak]);

  // Checklist & Validasi Kelengkapan Data Kreator untuk Rilis Resmi
  const isNamaValid = Boolean(namaKreator && namaKreator.trim().length >= 2);
  const isNikValid = Boolean(nikKtp && nikKtp.trim().replace(/\D/g, "").length === 16);
  const isAlamatValid = Boolean(alamatKreator && alamatKreator.trim().length >= 5);
  const isTeleponValid = Boolean(teleponKreator && teleponKreator.trim().replace(/\D/g, "").length >= 8);
  const isBankValid = Boolean(namaBank && namaBank.trim().length >= 2);
  const isNomorRekValid = Boolean(nomorRekening && nomorRekening.trim().length >= 3);
  const isAtasNamaValid = Boolean(atasNamaRekening && atasNamaRekening.trim().length >= 2);

  const isRekeningValid = isBankValid && isNomorRekValid && isAtasNamaValid;
  const isAllDataValid =
    isNamaValid && isNikValid && isAlamatValid && isTeleponValid && isRekeningValid;

  const handleSubmitRelease = async () => {
    if (!contract?.id) return;

    if (!isAllDataValid) {
      setShowCreatorEdit(true);
      setErrorMsg(
        "Data kreator belum lengkap! Mohon lengkapi NIK 16 digit, Nama KTP, Alamat, No WhatsApp, dan Data Rekening Bank sebelum merilis resmi."
      );
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await releaseContractAction(contract.id, {
        namaDirekturTNT,
        jabatanDirekturTNT,
        namaPicTNT,
        inisialPicTNT,
        namaSignerTNT,
        jabatanSignerTNT,
        namaPerusahaan,
        alamatPerusahaan,
        tanggalPerjanjian: pembukaInfo.tanggalStr,
        tempatPerjanjian,
        customNomorKontrak: previewOfficialNumber,
        namaKreator: namaKreator.trim(),
        nikKtp: nikKtp.trim(),
        namaBank: namaBank.trim(),
        nomorRekening: nomorRekening.trim(),
        atasNamaRekening: atasNamaRekening.trim(),
        alamatKreator: alamatKreator.trim(),
        teleponKreator: teleponKreator.trim(),
      });

      if (res.success) {
        onSuccess();
        onClose();
      } else {
        setErrorMsg(res.error || "Gagal merilis dokumen.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Terjadi kesalahan sistem saat rilis.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !contract) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto">
        {/* HEADER */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">
                Konfirmasi &amp; Finalisasi Rilis Dokumen
              </h2>
              <p className="text-xs text-slate-300">
                Kunci dokumen dengan nomor resmi &bull; Pihak Pertama (TNT) &amp; Legalitas Kontrak
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ERROR ALERT */}
        {errorMsg && (
          <div className="px-6 py-2.5 bg-rose-50 border-b border-rose-200 text-rose-800 text-xs font-semibold flex items-center justify-between">
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg(null)} className="text-rose-500 hover:text-rose-700">
              &times;
            </button>
          </div>
        )}

        {/* BODY SCROLLABLE */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-700">
          {/* SUMMARY DOKUMEN & VERIFIKASI KEAMANAN DATA */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Target Kreator
                </span>
                <div className="text-sm font-bold text-slate-900 flex items-center gap-1.5 mt-0.5">
                  <span className="text-blue-600">@{contract.creator_username}</span>
                  <span className="text-slate-400">&bull;</span>
                  <span>{namaKreator || d.namaKreator || contract.creator_nama}</span>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Deliverables &amp; Honor
                </span>
                <div className="text-xs font-bold text-emerald-700 mt-0.5">
                  {d.qtyVt || 1} VT &bull; Rp {Number(d.biayaHonor || 0).toLocaleString("id-ID")}
                </div>
              </div>
            </div>

            {/* PERINGATAN BILA DATA BELUM LENGKAP */}
            {!isAllDataValid && (
              <div className="p-3 bg-rose-50/90 border border-rose-200 rounded-xl flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-bold text-rose-800 text-xs">
                    Data Kreator Belum Lengkap (Rilis Dokumen Terkunci)
                  </div>
                  <p className="text-[11px] text-rose-700 leading-relaxed">
                    Dokumen resmi membutuhkan data legalitas lengkap. Mohon lengkapi kolom yang bertanda <strong className="text-rose-900">merah (*)</strong> di bawah ini agar tombol rilis aktif.
                  </p>
                </div>
              </div>
            )}

            {/* CHECKLIST KEAMANAN DATA */}
            <div className="pt-2 border-t border-slate-200/80 flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-semibold text-slate-500">Status Data:</span>
              
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 ${
                  isNikValid
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                    : "bg-rose-100 text-rose-800 border border-rose-200"
                }`}
              >
                {isNikValid ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                NIK: {isNikValid ? "Aman (16 Digit)" : "Wajib 16 Digit"}
              </span>

              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 ${
                  isNamaValid
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                    : "bg-rose-100 text-rose-800 border border-rose-200"
                }`}
              >
                {isNamaValid ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                Nama: {isNamaValid ? "Lengkap" : "Wajib Ada"}
              </span>

              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 ${
                  isTeleponValid
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                    : "bg-rose-100 text-rose-800 border border-rose-200"
                }`}
              >
                {isTeleponValid ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                WA: {isTeleponValid ? "Aman" : "Wajib Ada"}
              </span>

              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 ${
                  isAlamatValid
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                    : "bg-rose-100 text-rose-800 border border-rose-200"
                }`}
              >
                {isAlamatValid ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                Alamat: {isAlamatValid ? "Lengkap" : "Wajib Ada"}
              </span>

              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 ${
                  isRekeningValid
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                    : "bg-rose-100 text-rose-800 border border-rose-200"
                }`}
              >
                {isRekeningValid ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                Rekening: {isRekeningValid ? `${namaBank} - Lengkap` : "Belum Lengkap"}
              </span>

              <button
                type="button"
                onClick={() => setShowCreatorEdit(!showCreatorEdit)}
                className="text-[11px] font-bold text-blue-600 hover:text-blue-800 ml-auto flex items-center gap-1 cursor-pointer"
              >
                {showCreatorEdit ? "Tutup Form Kreator" : "Lengkapi / Koreksi Data"}
                {showCreatorEdit ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            </div>
          </div>

          {/* FORM KOREKSI / LENGKAPI DATA KREATOR */}
          {showCreatorEdit && (
            <div className={`p-4 rounded-xl border space-y-3 animate-in fade-in duration-100 ${
              !isAllDataValid ? "bg-rose-50/50 border-rose-200" : "bg-blue-50/50 border-blue-200"
            }`}>
              <div className="font-bold flex items-center justify-between">
                <div className={`flex items-center gap-1.5 ${!isAllDataValid ? "text-rose-900" : "text-blue-900"}`}>
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  <span>Data Identitas KTP &amp; Rekening Bank Kreator</span>
                </div>
                <span className="text-[10px] text-slate-500 font-normal">
                  * Otomatis mengupdate master data kreator
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={`font-semibold block mb-1 ${!isNamaValid ? "text-rose-700" : "text-slate-700"}`}>
                    Nama Lengkap (Sesuai KTP) *
                    {!isNamaValid && <span className="text-[10px] font-normal text-rose-600 ml-1">(Wajib diisi)</span>}
                  </label>
                  <input
                    type="text"
                    value={namaKreator}
                    onChange={(e) => setNamaKreator(e.target.value)}
                    placeholder="Nama lengkap sesuai KTP"
                    className={`w-full px-2.5 py-1.5 bg-white border rounded-lg text-xs outline-none transition-colors ${
                      !isNamaValid ? "border-rose-400 focus:border-rose-500 bg-rose-50/20" : "border-slate-300 focus:border-blue-500"
                    }`}
                  />
                </div>

                <div>
                  <label className={`font-semibold block mb-1 ${!isNikValid ? "text-rose-700" : "text-slate-700"}`}>
                    NIK KTP (16 Digit) *
                    {!isNikValid && (
                      <span className="text-[10px] font-normal text-rose-600 ml-1">
                        (Wajib 16 digit &bull; saat ini: {nikKtp.length})
                      </span>
                    )}
                  </label>
                  <input
                    type="text"
                    value={nikKtp}
                    onChange={(e) => setNikKtp(e.target.value.replace(/\D/g, "").slice(0, 16))}
                    placeholder="Contoh: 3201xxxxxxxxxxxx"
                    className={`w-full px-2.5 py-1.5 bg-white border rounded-lg text-xs outline-none transition-colors ${
                      !isNikValid ? "border-rose-400 focus:border-rose-500 bg-rose-50/20" : "border-slate-300 focus:border-blue-500"
                    }`}
                  />
                </div>

                <div>
                  <label className={`font-semibold block mb-1 ${!isTeleponValid ? "text-rose-700" : "text-slate-700"}`}>
                    Nomor WhatsApp *
                    {!isTeleponValid && <span className="text-[10px] font-normal text-rose-600 ml-1">(Wajib diisi)</span>}
                  </label>
                  <input
                    type="text"
                    value={teleponKreator}
                    onChange={(e) => setTeleponKreator(e.target.value)}
                    placeholder="Contoh: 0812xxxxxxxx"
                    className={`w-full px-2.5 py-1.5 bg-white border rounded-lg text-xs outline-none transition-colors ${
                      !isTeleponValid ? "border-rose-400 focus:border-rose-500 bg-rose-50/20" : "border-slate-300 focus:border-blue-500"
                    }`}
                  />
                </div>

                <div>
                  <label className={`font-semibold block mb-1 ${!isBankValid ? "text-rose-700" : "text-slate-700"}`}>
                    Bank / E-Wallet *
                    {!isBankValid && <span className="text-[10px] font-normal text-rose-600 ml-1">(Wajib diisi)</span>}
                  </label>
                  <input
                    type="text"
                    value={namaBank}
                    onChange={(e) => setNamaBank(e.target.value)}
                    placeholder="BCA / Mandiri / BRI / BNI"
                    className={`w-full px-2.5 py-1.5 bg-white border rounded-lg text-xs outline-none transition-colors ${
                      !isBankValid ? "border-rose-400 focus:border-rose-500 bg-rose-50/20" : "border-slate-300 focus:border-blue-500"
                    }`}
                  />
                </div>

                <div>
                  <label className={`font-semibold block mb-1 ${!isNomorRekValid ? "text-rose-700" : "text-slate-700"}`}>
                    Nomor Rekening *
                    {!isNomorRekValid && <span className="text-[10px] font-normal text-rose-600 ml-1">(Wajib diisi)</span>}
                  </label>
                  <input
                    type="text"
                    value={nomorRekening}
                    onChange={(e) => setNomorRekening(e.target.value)}
                    placeholder="Nomor rekening tanpa spasi"
                    className={`w-full px-2.5 py-1.5 bg-white border rounded-lg text-xs outline-none transition-colors ${
                      !isNomorRekValid ? "border-rose-400 focus:border-rose-500 bg-rose-50/20" : "border-slate-300 focus:border-blue-500"
                    }`}
                  />
                </div>

                <div>
                  <label className={`font-semibold block mb-1 ${!isAtasNamaValid ? "text-rose-700" : "text-slate-700"}`}>
                    Atas Nama Rekening *
                    {!isAtasNamaValid && <span className="text-[10px] font-normal text-rose-600 ml-1">(Wajib diisi)</span>}
                  </label>
                  <input
                    type="text"
                    value={atasNamaRekening}
                    onChange={(e) => setAtasNamaRekening(e.target.value)}
                    placeholder="Nama di buku tabungan"
                    className={`w-full px-2.5 py-1.5 bg-white border rounded-lg text-xs outline-none transition-colors ${
                      !isAtasNamaValid ? "border-rose-400 focus:border-rose-500 bg-rose-50/20" : "border-slate-300 focus:border-blue-500"
                    }`}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className={`font-semibold block mb-1 ${!isAlamatValid ? "text-rose-700" : "text-slate-700"}`}>
                    Alamat Lengkap Sesuai KTP / Domisili *
                    {!isAlamatValid && <span className="text-[10px] font-normal text-rose-600 ml-1">(Wajib diisi)</span>}
                  </label>
                  <input
                    type="text"
                    value={alamatKreator}
                    onChange={(e) => setAlamatKreator(e.target.value)}
                    placeholder="Jl. Merpati No. 12, RT 01/RW 02, Kelurahan, Kecamatan, Kota..."
                    className={`w-full px-2.5 py-1.5 bg-white border rounded-lg text-xs outline-none transition-colors ${
                      !isAlamatValid ? "border-rose-400 focus:border-rose-500 bg-rose-50/20" : "border-slate-300 focus:border-blue-500"
                    }`}
                  />
                </div>
              </div>
            </div>
          )}

          {/* SECTION 1: PIHAK PERTAMA (PT TNT KREATIF DIGITAL) - PERSIS SCREENSHOT USER */}
          <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200 space-y-3">
            <h3 className="font-bold text-slate-900 flex items-center gap-1.5 uppercase tracking-wider text-[11px] text-blue-900">
              <Building className="w-4 h-4 text-blue-600" />
              <span>PIHAK PERTAMA (PT TNT KREATIF DIGITAL)</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Nama Direktur TNT *</label>
                <input
                  type="text"
                  value={namaDirekturTNT}
                  onChange={(e) => setNamaDirekturTNT(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500 font-medium"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Jabatan Perwakilan</label>
                <input
                  type="text"
                  value={jabatanDirekturTNT}
                  onChange={(e) => setJabatanDirekturTNT(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Nama Drafter / PIC TNT</label>
                <input
                  type="text"
                  value={namaPicTNT}
                  onChange={(e) => {
                    setNamaPicTNT(e.target.value);
                    setInisialPicTNT(getInitials(e.target.value));
                  }}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500 font-medium"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Inisial Nama Drafter</label>
                <input
                  type="text"
                  value={inisialPicTNT}
                  onChange={(e) => setInisialPicTNT(e.target.value.toUpperCase())}
                  placeholder="HN"
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500 font-bold uppercase tracking-wider"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Penandatangan Akhir TNT *</label>
                <input
                  type="text"
                  value={namaSignerTNT}
                  onChange={(e) => setNamaSignerTNT(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500 font-medium"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Jabatan Penandatangan</label>
                <input
                  type="text"
                  value={jabatanSignerTNT}
                  onChange={(e) => setJabatanSignerTNT(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="font-semibold text-slate-700 block mb-1">Nama Entitas Perusahaan</label>
                <input
                  type="text"
                  value={namaPerusahaan}
                  onChange={(e) => setNamaPerusahaan(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500 font-medium"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="font-semibold text-slate-700 block mb-1">Alamat Kantor Resmi</label>
                <input
                  type="text"
                  value={alamatPerusahaan}
                  onChange={(e) => setAlamatPerusahaan(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* SECTION 2: LEGALITAS SURAT & TANGGAL KONTRAK - PERSIS SCREENSHOT USER */}
          <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200 space-y-3">
            <h3 className="font-bold text-slate-900 flex items-center gap-1.5 uppercase tracking-wider text-[11px] text-blue-900">
              <Calendar className="w-4 h-4 text-blue-600" />
              <span>LEGALITAS SURAT &amp; TANGGAL KONTRAK</span>
            </h3>

            <div className="space-y-3">
              {/* NOMOR SURAT KONTRAK */}
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Nomor Surat Kontrak</label>
                <input
                  type="text"
                  value={previewOfficialNumber}
                  readOnly
                  className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-lg text-xs font-mono font-bold text-blue-900 tracking-wide outline-none cursor-not-allowed"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Format baku: [No]/JC-TNT/[Inisial Drafter]/[Bulan Romawi]/[Tahun]
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Pilih Tanggal Kontrak</label>
                  <input
                    type="date"
                    value={tanggalKontrak}
                    onChange={(e) => setTanggalKontrak(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Kota Penandatanganan</label>
                  <input
                    type="text"
                    value={tempatPerjanjian}
                    onChange={(e) => setTempatPerjanjian(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* KOTAK PREVIEW FORMAT OTOMATIS PEMBUKA */}
              <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl text-blue-900 text-xs">
                <span className="font-bold block mb-0.5 text-blue-800">
                  Format Otomatis di Pembuka Perjanjian:
                </span>
                <p className="italic text-slate-600">
                  &ldquo;{pembukaInfo.fullKalimat}, bertempat di {tempatPerjanjian}...&rdquo;
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER ACTION */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            Batal
          </button>

          <button
            type="button"
            onClick={handleSubmitRelease}
            disabled={isSubmitting || !isAllDataValid}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 ${
              isAllDataValid
                ? "bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-emerald-900/10"
                : "bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300 shadow-none"
            }`}
            title={
              !isAllDataValid
                ? "Lengkapi seluruh data kreator (NIK 16 digit, Nama KTP, Alamat, No WA, Rekening) sebelum merilis resmi"
                : "Kunci & Rilis Dokumen Resmi"
            }
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Mengunci &amp; Merilis Dokumen...</span>
              </>
            ) : !isAllDataValid ? (
              <>
                <Lock className="w-4 h-4 text-slate-400" />
                <span>Data Belum Lengkap (Rilis Terkunci)</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Kunci &amp; Rilis Dokumen Resmi ({previewOfficialNumber})</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
