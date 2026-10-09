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
} from "lucide-react";
import ContractGeneratorWorkspace from "./ContractGeneratorWorkspace";
import ContractWorkspace from "./ContractWorkspace";
import { fetchCampaignCreatorsForDocumentsAction } from "@/app/actions/campaignPageActions";

export default function DokumenClient() {
  const { campaigns, brands, fetchData } = useDatabaseStore();
  const { profile } = useAuth();

  // Mode View: "buat_dokumen" (Formulir Buat Dokumen & Live Preview) vs "batch_export" (Export Bulk ZIP)
  const [activeTab, setActiveTab] = useState<"buat_dokumen" | "batch_export">("buat_dokumen");

  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null);
  const [approvalFilter, setApprovalFilter] = useState<string>("approved");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [creators, setCreators] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCcIds, setSelectedCcIds] = useState<Set<number>>(new Set());

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
                Official Generator
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-0.5">
              Pilih jenis dokumen, isi data pada formulir di sebelah kiri, dan pantau hasil dokumen secara langsung (live preview) di sebelah kanan.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* TAB MODE SWITCHER */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200">
            <button
              onClick={() => setActiveTab("buat_dokumen")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === "buat_dokumen"
                  ? "bg-white text-blue-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <PlusCircle className="w-3.5 h-3.5" />
              Buat Dokumen
            </button>
            <button
              onClick={() => setActiveTab("batch_export")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === "batch_export"
                  ? "bg-white text-blue-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Archive className="w-3.5 h-3.5" />
              Export Batch (.ZIP)
            </button>
          </div>

          <button
            onClick={() => {
              fetchData();
              loadCreators();
            }}
            className="flex items-center gap-2 p-2.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* CONTENT UTAMA */}
      {activeTab === "buat_dokumen" ? (
        <ContractGeneratorWorkspace
          campaigns={campaigns || []}
          creators={creators || []}
          selectedCampaignId={selectedCampaignId}
          onSelectCampaign={(id) => setSelectedCampaignId(id)}
          campaignBrandName={campaignBrandName}
          defaultUserName={profile?.nama || profile?.email?.split("@")[0] || "Safira"}
          onCreatorUpdated={loadCreators}
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
