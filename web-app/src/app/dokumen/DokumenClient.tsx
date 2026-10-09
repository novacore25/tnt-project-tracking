"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useDatabaseStore } from "@/store/useDatabaseStore";
import { useAuth } from "@/providers/AuthProvider";
import {
  FileText,
  Search,
  Filter,
  Download,
  Eye,
  CheckCircle2,
  Clock,
  AlertCircle,
  FolderKanban,
  User,
  Building,
  RefreshCw,
  Sparkles,
  Layers,
  CheckSquare,
  Square,
  FileCheck,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { formatRupiah } from "@/utils/formatters";
import CreatorContractModal from "@/components/contract/CreatorContractModal";
import { fetchCampaignCreatorsForDocumentsAction } from "@/app/actions/campaignPageActions";

export default function DokumenClient() {
  const { campaigns, brands, fetchData } = useDatabaseStore();
  const { profile } = useAuth();

  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null);
  const [approvalFilter, setApprovalFilter] = useState<string>("approved");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [creators, setCreators] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCcIds, setSelectedCcIds] = useState<Set<number>>(new Set());

  // Modal Kontrak State
  const [activeModalCreator, setActiveModalCreator] = useState<any | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  // Initial select first campaign if none selected
  useEffect(() => {
    if (campaigns && campaigns.length > 0 && selectedCampaignId === null) {
      // Pick first active or simply first
      setSelectedCampaignId(campaigns[0].id);
    }
  }, [campaigns, selectedCampaignId]);

  // Load creators when campaign, filter, or search changes
  const loadCreators = async () => {
    if (!selectedCampaignId) return;
    setIsLoading(true);
    try {
      const res = await fetchCampaignCreatorsForDocumentsAction({
        campaignId: selectedCampaignId,
        approvalFilter,
        search: debouncedSearch,
      });
      if (res.success && res.data) {
        setCreators(res.data);
      } else {
        setCreators([]);
      }
    } catch (err) {
      console.error("Error loading creators for documents:", err);
      setCreators([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCreators();
  }, [selectedCampaignId, approvalFilter, debouncedSearch]);

  const selectedCampaign = useMemo(() => {
    return campaigns?.find((c: any) => c.id === selectedCampaignId) || null;
  }, [campaigns, selectedCampaignId]);

  const campaignBrandName = useMemo(() => {
    if (!selectedCampaign) return "Brand Partner";
    if ((selectedCampaign as any).brands?.nama) return (selectedCampaign as any).brands.nama;
    const b = brands?.find((br: any) => br.id === selectedCampaign.brand_id);
    return b ? b.nama : "Brand Partner";
  }, [selectedCampaign, brands]);

  // Handle Multi-select
  const toggleSelectAll = () => {
    if (selectedCcIds.size === creators.length) {
      setSelectedCcIds(new Set());
    } else {
      setSelectedCcIds(new Set(creators.map((c) => c.cc_id)));
    }
  };

  const toggleSelectOne = (id: number) => {
    const next = new Set(selectedCcIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedCcIds(next);
  };

  const handleOpenSingleContract = (creatorItem: any) => {
    setActiveModalCreator(creatorItem);
    setIsModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-50/70 p-4 md:p-8 space-y-6">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Pusat Dokumen & Kontrak</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                Client-Side Generator
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-0.5">
              Generate dan unduh surat perjanjian kerja sama kreator (SPK/Kontrak) standar TNT secara instan tanpa membebani server.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              fetchData();
              loadCreators();
            }}
            className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            title="Refresh Data"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {/* FILTER & SELECTOR BAR */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          {/* Pilih Campaign */}
          <div className="md:col-span-5 space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <FolderKanban className="w-3.5 h-3.5 text-blue-600" />
              Pilih Campaign
            </label>
            <div className="relative">
              <select
                value={selectedCampaignId || ""}
                onChange={(e) => {
                  setSelectedCampaignId(Number(e.target.value));
                  setSelectedCcIds(new Set());
                }}
                className="w-full pl-3 pr-8 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition-all"
              >
                {campaigns?.map((camp: any) => (
                  <option key={camp.id} value={camp.id}>
                    {camp.nama} {camp.brands?.nama ? `(${camp.brands.nama})` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Filter Status Approval */}
          <div className="md:col-span-3 space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-blue-600" />
              Status Kreator
            </label>
            <select
              value={approvalFilter}
              onChange={(e) => setApprovalFilter(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition-all"
            >
              <option value="approved">Approved Saja (Disetujui)</option>
              <option value="pending">Pending Saja</option>
              <option value="alternate">Alternate Saja</option>
              <option value="not_approved">Not Approved</option>
              <option value="all">Semua Status</option>
            </select>
          </div>

          {/* Pencarian Kreator */}
          <div className="md:col-span-4 space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-blue-600" />
              Cari Kreator
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Cari username atau nama..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition-all"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            </div>
          </div>
        </div>

        {/* CAMPAIGN INFO BADGE */}
        {selectedCampaign && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs text-slate-600">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 font-medium text-slate-700">
                <Building className="w-3.5 h-3.5 text-slate-400" />
                Brand: <strong className="text-slate-900">{campaignBrandName}</strong>
              </span>
              <span className="text-slate-300">|</span>
              <span>
                Total Kreator Terdaftar: <strong className="text-slate-900">{creators.length}</strong>
              </span>
              {selectedCcIds.size > 0 && (
                <>
                  <span className="text-slate-300">|</span>
                  <span className="text-blue-600 font-semibold">
                    {selectedCcIds.size} kreator terpilih
                  </span>
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={toggleSelectAll}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors"
              >
                {selectedCcIds.size === creators.length && creators.length > 0 ? (
                  <>
                    <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
                    Batal Pilih Semua
                  </>
                ) : (
                  <>
                    <Square className="w-3.5 h-3.5 text-slate-500" />
                    Pilih Semua ({creators.length})
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* LIST KREATOR & GENERATOR */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-blue-600" />
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              Daftar Kreator untuk Pembuatan Kontrak
            </h2>
          </div>
          <span className="text-xs text-slate-500">
            Klik tombol &quot;Buat Kontrak&quot; untuk preview & download PDF
          </span>
        </div>

        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
            <span className="text-sm font-medium">Memuat data kreator kampanye...</span>
          </div>
        ) : creators.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
            <AlertCircle className="w-10 h-10 text-slate-300" />
            <p className="text-sm font-semibold text-slate-600">Tidak ada kreator yang ditemukan</p>
            <p className="text-xs text-slate-400 max-w-sm text-center">
              Pastikan campaign terpilih sudah memiliki data kreator dengan status filter yang sesuai.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100/70 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  <th className="py-3 px-4 w-12 text-center">
                    <input
                      type="checkbox"
                      checked={creators.length > 0 && selectedCcIds.size === creators.length}
                      onChange={toggleSelectAll}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </th>
                  <th className="py-3 px-4">Kreator / Username</th>
                  <th className="py-3 px-4">Nama Lengkap & Kontak</th>
                  <th className="py-3 px-4 text-center">SOW (Scope)</th>
                  <th className="py-3 px-4 text-right">Ratecard / Fee</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Aksi Dokumen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {creators.map((c: any) => {
                  const isChecked = selectedCcIds.has(c.cc_id);
                  const isApproved = c.approval === "approved";
                  const contactPhone = c.no_whatsapp || c.contact_nomor || "-";
                  const realName = c.nama_lengkap || c.nama_asli || "-";
                  const ratecard = Number(c.price) || 0;

                  return (
                    <tr
                      key={c.cc_id}
                      className={`hover:bg-blue-50/40 transition-colors ${
                        isChecked ? "bg-blue-50/30" : ""
                      }`}
                    >
                      <td className="py-3.5 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelectOne(c.cc_id)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 flex items-center gap-1.5">
                            @{c.username}
                          </span>
                          <span className="text-[11px] text-slate-400 capitalize">
                            Tipe: {c.content_type || "Video"}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col text-xs">
                          <span className="font-semibold text-slate-800">{realName}</span>
                          <span className="text-slate-500">WA: {contactPhone}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 rounded-lg text-xs font-semibold text-slate-700">
                          <span>{Number(c.qty_vt) || 0} VT</span>
                          <span className="text-slate-300">•</span>
                          <span>{Number(c.qty_live) || 0} Live</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <span className="font-bold text-slate-800">
                          {formatRupiah(ratecard)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            isApproved
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : c.approval === "pending"
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : "bg-slate-100 text-slate-600 border border-slate-200"
                          }`}
                        >
                          {isApproved && <CheckCircle2 className="w-3 h-3" />}
                          {c.approval || "pending"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => handleOpenSingleContract(c)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition-all"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          Buat Kontrak
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL KONTRAK VIEWER & DOWNLOAD */}
      {isModalOpen && activeModalCreator && selectedCampaign && (
        <CreatorContractModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setActiveModalCreator(null);
          }}
          creatorData={{
            ccId: activeModalCreator.cc_id,
            username: activeModalCreator.username,
            namaLengkap: activeModalCreator.nama_lengkap || activeModalCreator.nama_asli || "",
            noWhatsapp: activeModalCreator.no_whatsapp || activeModalCreator.contact_nomor || "",
            ratecard: Number(activeModalCreator.price) || 0,
            qtyVt: Number(activeModalCreator.qty_vt) || 1,
            qtyLive: Number(activeModalCreator.qty_live) || 0,
          }}
          campaignData={{
            id: selectedCampaign.id,
            nama: selectedCampaign.nama,
            brandName: campaignBrandName,
          }}
          userName={profile?.nama || profile?.email?.split("@")[0] || "PIC TNT Kreatif"}
        />
      )}
    </div>
  );
}
