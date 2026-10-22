"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useDatabaseStore } from "@/store/useDatabaseStore";
import { useAuth } from "@/providers/AuthProvider";
import {
  FileText,
  PlusCircle,
  FolderKanban,
  Building,
  RefreshCw,
  Sparkles,
  Layers,
  Archive,
  Search,
  ListFilter,
  CheckCircle2,
  Table as TableIcon,
  Zap,
} from "lucide-react";
import ContractGeneratorWorkspace from "./ContractGeneratorWorkspace";
import ContractWorkspace from "./ContractWorkspace";
import ContractTableView from "./ContractTableView";
import { fetchCampaignCreatorsForDocumentsAction } from "@/app/actions/campaignPageActions";
import {
  fetchContractsAction,
  autoGenerateApprovedCreatorDraftsAction,
} from "@/app/actions/contractActions";

interface DokumenClientProps {
  initialCampaignId?: number;
  isCampaignScoped?: boolean;
}

export default function DokumenClient({
  initialCampaignId,
  isCampaignScoped = false,
}: DokumenClientProps) {
  const { campaigns, brands, fetchData } = useDatabaseStore();
  const { profile } = useAuth();

  // Mode View: "daftar_dokumen" (Tabel Dokumen & Mini-Excel) vs "buat_dokumen" (Generator Form & Preview) vs "batch_export"
  const [activeTab, setActiveTab] = useState<"daftar_dokumen" | "buat_dokumen" | "batch_export">(
    "daftar_dokumen"
  );

  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(
    initialCampaignId || null
  );
  const [approvalFilter, setApprovalFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [creators, setCreators] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [isLoadingCreators, setIsLoadingCreators] = useState(false);
  const [isLoadingContracts, setIsLoadingContracts] = useState(false);
  const [isAutoGenerating, setIsAutoGenerating] = useState(false);
  const [selectedCcIds, setSelectedCcIds] = useState<Set<number>>(new Set());
  const [activeEditingContract, setActiveEditingContract] = useState<any | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  // Initial select first campaign if none selected & not campaign scoped
  useEffect(() => {
    if (initialCampaignId) {
      setSelectedCampaignId(initialCampaignId);
    } else if (campaigns && campaigns.length > 0 && selectedCampaignId === null) {
      setSelectedCampaignId(campaigns[0].id);
    }
  }, [campaigns, initialCampaignId, selectedCampaignId]);

  // Load contracts from database
  const loadContracts = async () => {
    setIsLoadingContracts(true);
    try {
      const res = await fetchContractsAction({
        campaignId: isCampaignScoped ? selectedCampaignId || undefined : undefined,
      });
      if (res.success && res.data) {
        setContracts(res.data);
      } else {
        setContracts([]);
      }
    } catch (err) {
      console.error("Error loading contracts:", err);
      setContracts([]);
    } finally {
      setIsLoadingContracts(false);
    }
  };

  // Load creators when campaign changes
  const loadCreators = async () => {
    if (!selectedCampaignId) return;
    setIsLoadingCreators(true);
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
      setIsLoadingCreators(false);
    }
  };

  useEffect(() => {
    loadCreators();
  }, [selectedCampaignId, approvalFilter, debouncedSearch]);

  useEffect(() => {
    loadContracts();
  }, [selectedCampaignId, isCampaignScoped]);

  // Auto-generate batch untuk seluruh kreator approved
  const handleAutoGenerateApproved = async () => {
    if (!selectedCampaignId) return;
    setIsAutoGenerating(true);
    try {
      const res = await autoGenerateApprovedCreatorDraftsAction(selectedCampaignId);
      if (res.success) {
        alert(res.message);
        loadContracts();
      } else {
        alert(res.error || "Gagal membuat draft otomatis.");
      }
    } catch (err: any) {
      alert(err.message || "Terjadi kesalahan.");
    } finally {
      setIsAutoGenerating(false);
    }
  };

  const selectedCampaign = useMemo(() => {
    return campaigns?.find((c: any) => c.id === selectedCampaignId) || null;
  }, [campaigns, selectedCampaignId]);

  const campaignBrandName = useMemo(() => {
    if (!selectedCampaign) return "Brand Partner";
    if ((selectedCampaign as any).brands?.nama) return (selectedCampaign as any).brands.nama;
    const b = brands?.find((br: any) => br.id === selectedCampaign.brand_id);
    return b ? b.nama : "Brand Partner";
  }, [selectedCampaign, brands]);

  return (
    <div className="min-h-screen bg-slate-50/70 p-4 md:p-8 space-y-6">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                {isCampaignScoped
                  ? `Dokumen & Kontrak — ${selectedCampaign?.nama || "Campaign"}`
                  : "Pusat Dokumen & Kontrak"}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                Official Generator
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-0.5">
              {isCampaignScoped
                ? "Kelola berkas perjanjian kerja sama khusus untuk campaign ini. Nomor urut resmi otomatis terkunci saat dirilis."
                : "Pusat monitoring, pembuatan dokumen perjanjian kerja sama, dan pengelolaan kontrak resmi se-sistem."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* TAB MODE SWITCHER */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200">
            <button
              onClick={() => {
                setActiveEditingContract(null);
                setActiveTab("daftar_dokumen");
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === "daftar_dokumen"
                  ? "bg-white text-blue-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <ListFilter className="w-3.5 h-3.5" />
              Daftar Dokumen
            </button>
            <button
              onClick={() => {
                setActiveEditingContract(null);
                setActiveTab("buat_dokumen");
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === "buat_dokumen"
                  ? "bg-white text-blue-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <PlusCircle className="w-3.5 h-3.5" />
              Buat Baru
            </button>
            <button
              onClick={() => {
                setActiveEditingContract(null);
                setActiveTab("batch_export");
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === "batch_export"
                  ? "bg-white text-blue-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Archive className="w-3.5 h-3.5" />
              Export ZIP
            </button>
          </div>

          {/* AUTO GENERATE APPROVED DRAFTS BUTTON */}
          {selectedCampaignId && (
            <button
              type="button"
              onClick={handleAutoGenerateApproved}
              disabled={isAutoGenerating}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50"
              title="Buat draft otomatis untuk seluruh kreator yang berstatus approved"
            >
              {isAutoGenerating ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Zap className="w-3.5 h-3.5" />
              )}
              <span>Auto-Generate Approved</span>
            </button>
          )}

          <button
            onClick={() => {
              fetchData();
              loadCreators();
              loadContracts();
            }}
            className="flex items-center gap-2 p-2.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* CONTENT UTAMA BERDASARKAN TAB */}
      {activeTab === "daftar_dokumen" ? (
        <ContractTableView
          contracts={contracts}
          onRefresh={loadContracts}
          onEditContract={(contract) => {
            setActiveEditingContract(contract);
            setActiveTab("buat_dokumen");
          }}
          onPreviewContract={(contract) => {
            setActiveEditingContract(contract);
            setActiveTab("buat_dokumen");
          }}
          campaignId={selectedCampaignId || undefined}
        />
      ) : activeTab === "buat_dokumen" ? (
        <ContractGeneratorWorkspace
          campaigns={campaigns || []}
          creators={creators || []}
          selectedCampaignId={selectedCampaignId}
          onSelectCampaign={(id) => setSelectedCampaignId(id)}
          campaignBrandName={campaignBrandName}
          defaultUserName={profile?.nama || profile?.email?.split("@")[0] || "Safira"}
          onCreatorUpdated={() => {
            loadCreators();
            loadContracts();
          }}
          initialContract={activeEditingContract}
          isCampaignScoped={isCampaignScoped}
        />
      ) : (
        <ContractWorkspace
          creators={creators}
          selectedCcIds={selectedCcIds}
          selectedCampaign={selectedCampaign}
          campaignBrandName={campaignBrandName}
          userName={profile?.nama || profile?.email?.split("@")[0] || "PIC TNT Kreatif"}
          onClearSelection={() => setSelectedCcIds(new Set())}
        />
      )}
    </div>
  );
}
