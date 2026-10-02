"use client";

import React, { useState, useRef, useEffect, useDeferredValue, useMemo, startTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { useDatabaseStore } from "@/store/useDatabaseStore";
import { Edit2, Check, X, Search, FileSpreadsheet, Loader2, Trash2, Lock, Download, DollarSign, TrendingUp, AlertCircle, BarChart3, ChevronUp, ChevronDown, ChevronRight, Eye, Activity, UploadCloud, Calendar, Wallet } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/providers/AuthProvider";
import { exportToExcel } from "@/utils/exportToExcel";
import { normalizeKurs } from "@/utils/computed";
import { Button } from "@/components/ui/Button";

import { SearchableSelect } from "@/components/SearchableSelect";
import { StringCombobox } from "@/components/StringCombobox";
import { getAdsReportData, updateAdPerformanceAction, deleteAdPerformanceAction } from "./actions";


const MemoizedTableRow = React.memo(({
  ad, isChild, isParent, parentKey, groupStats, isExpanded,
  pendingChange, isManager, selectedAds, setSelectedAds,
  setExpandedGroups, campaigns, globalCampaignAdsOptions,
  setCellChange, deletingId, deleteAd
}: any) => {
  const pendingCampaignId = pendingChange?.campaign_id !== undefined ? pendingChange.campaign_id : ad.campaign_id;
  const pendingCreatorId = pendingChange?.creator_id !== undefined ? pendingChange.creator_id : ad.creator_id;
  const pendingKurs = pendingChange?.kurs !== undefined ? pendingChange.kurs : ad.kurs;
  const pendingAdId = pendingChange?.ad_id !== undefined ? pendingChange.ad_id : ad.ad_id;
  const pendingAdName = pendingChange?.ad_name !== undefined ? pendingChange.ad_name : ad.ad_name;
  const pendingCampaignAdsName = pendingChange?.campaign_ads_name !== undefined ? pendingChange.campaign_ads_name : ad.campaign_ads_name;
  const pendingTanggal = pendingChange?.tanggal !== undefined ? pendingChange.tanggal : ad.tanggal;
  const hasPending = !!pendingChange;

  const creatorUsername = ad.creators?.username;
const cost = isParent && groupStats ? groupStats.cost_usd : (ad.cost_usd || 0);
    const impr = isParent && groupStats ? groupStats.impressions : (ad.impressions || 0);
    const clicks = isParent && groupStats ? groupStats.clicks : (ad.clicks || 0);
    const ppv = isParent && groupStats ? groupStats.product_page_views : (ad.product_page_views || 0);
    const checkouts = isParent && groupStats ? groupStats.checkouts_initiated : (ad.checkouts_initiated || 0);
    const purchases = isParent && groupStats ? groupStats.purchases : (ad.purchases || 0);
    const items = isParent && groupStats ? groupStats.items_purchased : (ad.items_purchased || 0);
    const rev = isParent && groupStats ? groupStats.gross_revenue_usd : (ad.gross_revenue_usd || 0);

    const ppvRate = clicks > 0 ? (ppv / clicks) * 100 : 0;
    const roas = cost > 0 ? (rev / cost) : 0;
    const cpm = impr > 0 ? (cost / impr) * 1000 : 0;
    const cpc = clicks > 0 ? (cost / clicks) : 0;
    const cpp = purchases > 0 ? (cost / purchases) : 0;
    const ctr = impr > 0 ? (clicks / impr) * 100 : 0;
    const purchaseRate = clicks > 0 ? (purchases / clicks) * 100 : 0;
    const aov = purchases > 0 ? (rev / purchases) : 0;

    return (
      <TableRow 
        key={isParent ? `parent-${parentKey}` : ad.id} 
        className={`transition-colors ${isParent ? 'bg-indigo-50/50 hover:bg-indigo-50 border-b-2 border-indigo-100 cursor-pointer' : isChild ? 'bg-slate-50/50 pl-4 border-l-4 border-l-indigo-300' : 'hover:bg-slate-50/50'} ${hasPending && !isParent ? 'bg-amber-50/30' : ''}`}
        onClick={() => {
          if (isParent) {
            startTransition(() => {
              setExpandedGroups((prev: Set<string>) => {
                const next = new Set(prev);
                if (next.has(parentKey)) next.delete(parentKey);
                else next.add(parentKey);
                return next;
              });
            });
          }
        }}
      >
        <TableCell className="text-xs text-slate-500">
          <div className="flex items-center gap-2">
            {!isParent && isManager && (
              <input
                type="checkbox"
                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                checked={selectedAds.includes(ad.id)}
                onChange={(e) => {
                  e.stopPropagation();
                  setSelectedAds((prev: number[]) => e.target.checked ? [...prev, ad.id] : prev.filter((id: number) => id !== ad.id));
                }}
                onClick={(e) => e.stopPropagation()}
              />
            )}
            {isParent && (
              <div className="text-indigo-500">
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </div>
            )}
            {isParent ? (
              <span className="font-semibold text-indigo-700">{groupStats.rows.length} Data</span>
            ) : isManager ? (
              <input
                type="date"
                className="w-full p-1 border border-transparent hover:border-slate-300 rounded text-xs text-slate-700 focus:ring-1 focus:ring-indigo-500 bg-transparent"
                value={pendingTanggal || ''}
                onChange={(e) => setCellChange(ad.id, 'tanggal', e.target.value, ad)}
              />
            ) : (
              ad.tanggal ? new Date(ad.tanggal).toLocaleDateString('id-ID') : '-'
            )}
          </div>
        </TableCell>
        
        <TableCell className="font-medium text-xs whitespace-nowrap">
          {isChild || !isManager ? (
            <span className={isParent ? "font-bold" : ""}>{ad.ad_id || '-'}</span>
          ) : (
            <input
              type="text"
              placeholder="Ad ID"
              className={`w-full p-1.5 border rounded text-xs focus:ring-1 focus:ring-indigo-500 bg-transparent ${!pendingAdId ? 'border-red-300 outline-red-300' : 'border-transparent hover:border-slate-300'}`}
              value={pendingAdId || ''}
              onChange={(e) => setCellChange(ad.id, 'ad_id', e.target.value, ad)}
            />
          )}
        </TableCell>
        
        <TableCell className="text-xs font-medium text-slate-700">
          {isChild || !isManager ? (
            <div className="whitespace-nowrap min-w-[200px]" title={ad.ad_name}>{ad.ad_name}</div>
          ) : (
            <input
              type="text"
              placeholder="Ad Name"
              className="w-full min-w-[200px] p-1.5 border border-transparent hover:border-slate-300 rounded text-xs focus:ring-1 focus:ring-indigo-500 bg-transparent"
              value={pendingAdName || ''}
              onChange={(e) => setCellChange(ad.id, 'ad_name', e.target.value, ad)}
            />
          )}
        </TableCell>
        
        {/* Campaign Column */}
        <TableCell>
          {isChild || !isManager ? (
            <span className="text-slate-600">{campaigns.find((c: any) => c.id === ad.campaign_id)?.nama || '-'}</span>
          ) : (
            <select
              className={`w-full p-1.5 border rounded text-xs focus:outline-none focus:border-indigo-500 bg-transparent ${!pendingCampaignId ? 'border-red-300 text-red-600 font-semibold' : 'border-transparent hover:border-slate-300 text-indigo-700 font-medium'}`}
              value={pendingCampaignId || ''}
              onChange={(e) => {
                const val = e.target.value ? Number(e.target.value) : null;
                setCellChange(ad.id, 'campaign_id', val, ad);
                if (val !== ad.campaign_id) {
                    setCellChange(ad.id, 'creator_id', null, ad);
                }
              }}
            >
              <option value="">PILIH CAMPAIGN</option>
              {campaigns.filter((c: any) => c.status === 'aktif' || c.id === ad.campaign_id).map((c: any) => (
                <option key={c.id} value={c.id}>{c.nama}</option>
              ))}
            </select>
          )}
        </TableCell>

        {/* Campaign Ads Column */}
        <TableCell className="text-xs font-medium text-slate-700 min-w-[200px]">
          {isChild || !isManager ? (
            <span>{ad.campaign_ads_name || '-'}</span>
          ) : (
            <StringCombobox
              value={pendingCampaignAdsName || ''}
              onChange={(val) => setCellChange(ad.id, 'campaign_ads_name', val, ad)}
              options={globalCampaignAdsOptions}
              placeholder="Campaign Ads"
              className="w-full p-1.5 border rounded text-xs focus:ring-1 focus:ring-indigo-500 bg-transparent border-transparent hover:border-slate-300"
            />
          )}
        </TableCell>

        {/* Creator Column */}
        <TableCell>
          {isChild || !isManager ? (
            <span className="text-slate-600">{creatorUsername ? `@${creatorUsername}` : '-'}</span>
          ) : (
            pendingCampaignId ? (
              <div className={!pendingCreatorId ? 'ring-1 ring-red-300 rounded' : ''}>
                <SearchableSelect 
                  value={pendingCreatorId || ''} 
                  onChange={(val) => setCellChange(ad.id, 'creator_id', val === '' ? null : val, ad)} 
                  placeholder="Ketik username..." 
                  initialLabel={creatorUsername ? `@${creatorUsername}` : ''}
                />
              </div>
            ) : (
              <span className="text-[10px] text-slate-400">Pilih campaign dulu</span>
            )
          )}
        </TableCell>

        {/* Kurs Column */}
        <TableCell>
          {isParent || !isManager ? (
            <span className="text-xs text-slate-500">Rp{ad.kurs}</span>
          ) : (
            <div className="flex items-center gap-1 group">
              <span className="text-xs text-slate-400 group-hover:text-slate-600">Rp</span>
              <input
                type="number"
                className="w-full p-1 border border-transparent hover:border-slate-300 rounded text-xs text-center focus:ring-1 focus:ring-indigo-500 bg-transparent"
                value={pendingKurs || ''}
                onChange={(e) => setCellChange(ad.id, 'kurs', Number(e.target.value), ad)}
              />
            </div>
          )}
        </TableCell>

        <TableCell className={`text-right font-medium text-xs ${isChild ? 'text-emerald-600' : 'text-slate-700'}`}>
          {isChild ? (
            <div className="flex flex-col items-end gap-0.5">
              <span>{cost > 0 ? '+' : ''}${cost.toFixed(2)}</span>
              <span className="text-[10px] text-slate-400">({ad.lifetime_cost_usd?.toFixed(2) || '0.00'})</span>
            </div>
          ) : (
            `$${cost.toFixed(2)}`
          )}
        </TableCell>
        <TableCell className={`text-right font-medium text-xs ${isChild ? 'text-emerald-600' : 'text-slate-700'}`}>
          {isChild ? (
            <div className="flex flex-col items-end gap-0.5">
              <span>{impr > 0 ? '+' : ''}{impr.toLocaleString('id-ID')}</span>
              <span className="text-[10px] text-slate-400">({ad.lifetime_impressions?.toLocaleString('id-ID') || '0'})</span>
            </div>
          ) : (
            impr.toLocaleString('id-ID')
          )}
        </TableCell>
        <TableCell className={`text-right font-medium text-xs ${isChild ? 'text-emerald-600' : 'text-slate-700'}`}>
          {isChild ? (
            <div className="flex flex-col items-end gap-0.5">
              <span>{clicks > 0 ? '+' : ''}{clicks.toLocaleString('id-ID')}</span>
              <span className="text-[10px] text-slate-400">({ad.lifetime_clicks?.toLocaleString('id-ID') || '0'})</span>
            </div>
          ) : (
            clicks.toLocaleString('id-ID')
          )}
        </TableCell>
        <TableCell className={`text-right font-medium text-xs ${isChild ? 'text-emerald-600' : 'text-slate-700'}`}>
          {isChild ? (
            <div className="flex flex-col items-end gap-0.5">
              <span>{ppv > 0 ? '+' : ''}{ppv.toLocaleString('id-ID')}</span>
              <span className="text-[10px] text-slate-400">({ad.lifetime_product_page_views?.toLocaleString('id-ID') || '0'})</span>
            </div>
          ) : (
            ppv.toLocaleString('id-ID')
          )}
        </TableCell>
        <TableCell className={`text-right font-medium text-xs ${isChild ? 'text-emerald-600' : 'text-slate-700'}`}>
          {ppvRate.toFixed(2)}%
        </TableCell>
        <TableCell className={`text-right font-medium text-xs ${isChild ? 'text-emerald-600' : 'text-slate-700'}`}>
          {isChild ? (
            <div className="flex flex-col items-end gap-0.5">
              <span>{checkouts > 0 ? '+' : ''}{checkouts.toLocaleString('id-ID')}</span>
              <span className="text-[10px] text-slate-400">({ad.lifetime_checkouts_initiated?.toLocaleString('id-ID') || '0'})</span>
            </div>
          ) : (
            checkouts.toLocaleString('id-ID')
          )}
        </TableCell>
        <TableCell className={`text-right font-medium text-xs ${isChild ? 'text-emerald-600' : 'text-slate-700'}`}>
          {isChild ? (
            <div className="flex flex-col items-end gap-0.5">
              <span>{purchases > 0 ? '+' : ''}{purchases.toLocaleString('id-ID')}</span>
              <span className="text-[10px] text-slate-400">({ad.lifetime_purchases?.toLocaleString('id-ID') || '0'})</span>
            </div>
          ) : (
            purchases.toLocaleString('id-ID')
          )}
        </TableCell>
        <TableCell className={`text-right font-medium text-xs ${isChild ? 'text-emerald-600' : 'text-slate-700'}`}>
          {isChild ? (
            <div className="flex flex-col items-end gap-0.5">
              <span>{items > 0 ? '+' : ''}{items.toLocaleString('id-ID')}</span>
              <span className="text-[10px] text-slate-400">({ad.lifetime_items_purchased?.toLocaleString('id-ID') || '0'})</span>
            </div>
          ) : (
            items.toLocaleString('id-ID')
          )}
        </TableCell>
        <TableCell className={`text-right font-medium text-xs ${isChild ? 'text-emerald-600' : 'text-green-600'}`}>
          {isChild ? (
            <div className="flex flex-col items-end gap-0.5">
              <span>{rev > 0 ? '+' : ''}${rev.toFixed(2)}</span>
              <span className="text-[10px] text-slate-400">({ad.lifetime_gross_revenue_usd?.toFixed(2) || '0.00'})</span>
            </div>
          ) : (
            `$${rev.toFixed(2)}`
          )}
        </TableCell>
        <TableCell className="text-right font-medium text-xs text-slate-700">
          {roas.toFixed(2)}
        </TableCell>
        <TableCell className="text-right font-medium text-xs text-slate-700">
          ${cpm.toFixed(2)}
        </TableCell>
        <TableCell className="text-right font-medium text-xs text-slate-700">
          ${cpc.toFixed(2)}
        </TableCell>
        <TableCell className="text-right font-medium text-xs text-slate-700">
          ${cpp.toFixed(2)}
        </TableCell>
        <TableCell className="text-right font-medium text-xs text-slate-700">
          {ctr.toFixed(2)}%
        </TableCell>
        <TableCell className="text-right font-medium text-xs text-slate-700">
          {purchaseRate.toFixed(2)}%
        </TableCell>
        <TableCell className="text-right font-medium text-xs text-slate-700">
          ${aov.toFixed(2)}
        </TableCell>
        
        {/* Action Column */}
        <TableCell className="text-center sticky right-0 bg-slate-50 z-10 border-l border-slate-100 shadow-[-5px_0_10px_-5px_rgba(0,0,0,0.05)]">
          {!isParent && isManager && (
            <div className="flex items-center justify-center gap-1">
              <button onClick={(e) => { e.stopPropagation(); deleteAd(ad.id); }} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors" disabled={deletingId === ad.id} title="Hapus Permanen">
                {deletingId === ad.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              </button>
            </div>
          )}
        </TableCell>
      </TableRow>
    );

}, (prevProps: any, nextProps: any) => {
  const isSelectedPrev = prevProps.selectedAds.includes(prevProps.ad.id);
  const isSelectedNext = nextProps.selectedAds.includes(nextProps.ad.id);
  
  return (
      prevProps.isExpanded === nextProps.isExpanded &&
      prevProps.ad === nextProps.ad &&
      prevProps.pendingChange === nextProps.pendingChange &&
      isSelectedPrev === isSelectedNext &&
      prevProps.deletingId === nextProps.deletingId &&
      prevProps.isManager === nextProps.isManager &&
      prevProps.groupStats === nextProps.groupStats &&
      prevProps.campaigns === nextProps.campaigns &&
      prevProps.globalCampaignAdsOptions === nextProps.globalCampaignAdsOptions
  );
});

export default function AdsReportPage() {
  const { creators, campaigns } = useDatabaseStore();
  const [adsPerformance, setAdsPerformance] = useState<any[]>([]);
  const [globalSummary, setGlobalSummary] = useState<any>({ totalSpend: 0, totalGmv: 0, totalImpressions: 0, roas: 0, cpm: 0 });
  const [filteredSummary, setFilteredSummary] = useState<any>({ totalSpend: 0, totalGmv: 0, totalImpressions: 0, roas: 0, cpm: 0 });
  const [campaignBreakdown, setCampaignBreakdown] = useState<any>({ list: [], globalUnmappedCampaigns: 0 });
  const [budgetBalances, setBudgetBalances] = useState<Record<number, any>>({});
  
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  
  // Date Filter States (UI only)
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  
  // Applied Filter States (Triggers Fetch)
  const [appliedStartDate, setAppliedStartDate] = useState<string>('');
  const [appliedEndDate, setAppliedEndDate] = useState<string>('');
  const [campaignAdsName, setCampaignAdsName] = useState<string>('');
  const [appliedCampaignAdsName, setAppliedCampaignAdsName] = useState<string>('');
  
  const { profile } = useAuth();
  const isManager = profile?.role === 'manager' || profile?.role === 'executive';

  const [displayLimit, setDisplayLimit] = useState(100);

  // Sorting States

  type SortColumn = 'tanggal' | 'ad_id' | 'ad_name' | 'campaign_ads_name' | 'campaign_id' | 'creator_id' | 'kurs' | 'cost_usd' | 'gross_revenue_usd' | 'impressions' | 'clicks' | 'product_page_views' | 'checkouts_initiated' | 'purchases' | 'items_purchased';
  const [sortConfig, setSortConfig] = useState<{ key: SortColumn; direction: 'asc' | 'desc' } | null>({ key: 'tanggal', direction: 'desc' });

  // New States for Accordion View
  const [viewMode, setViewMode] = useState<'flat' | 'grouped'>('grouped');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const handleSort = (key: SortColumn) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  useEffect(() => {
    const fetchAds = async () => {
      setIsLoading(true);
      try {
        const result = await getAdsReportData({
          startDate: appliedStartDate || undefined,
          endDate: appliedEndDate || undefined,
          campaignId: selectedCampaignId,
          campaignAdsName: appliedCampaignAdsName || undefined,
          searchQuery: deferredSearchQuery || undefined,
          sortKey: sortConfig?.key || 'tanggal',
          sortDir: sortConfig?.direction || 'desc'
        });
        
        setAdsPerformance(result.data || []);
        setGlobalSummary(result.summary);
        setFilteredSummary(result.filteredSummary);
        setCampaignBreakdown(result.campaignBreakdown);
        setBudgetBalances(result.budgetBalances || {});
      } catch (err) {
        console.error(err);
      }
      setIsLoading(false);
    };
    fetchAds();
  }, [appliedStartDate, appliedEndDate, selectedCampaignId, appliedCampaignAdsName, deferredSearchQuery, sortConfig]);
  
  // Inline Auto-Save States
  type PendingAdChange = { campaign_id?: number | null; campaign_ads_name?: string | null; creator_id?: number | null; kurs?: number; ad_id?: string; ad_name?: string; tanggal?: string; original: any };
  const [pendingChanges, setPendingChanges] = useState<Map<number, PendingAdChange>>(new Map());
  const [isBatchSaving, setIsBatchSaving] = useState(false);
  const [batchSaveProgress, setBatchSaveProgress] = useState(0);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const [selectedAds, setSelectedAds] = useState<number[]>([]);

  // beforeunload protection
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (pendingChanges.size > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [pendingChanges.size]);

  const batchSaveAll = async () => {
    if (pendingChanges.size === 0 || isBatchSaving) return;
    setIsBatchSaving(true);
    setBatchSaveProgress(0);
    
    let processed = 0;
    const total = pendingChanges.size;
    const currentAds = [...adsPerformance];
    
    for (const [adId, change] of pendingChanges.entries()) {
      const updates: any = {};
      if (change.campaign_id !== undefined) updates.campaign_id = change.campaign_id;
      if (change.campaign_ads_name !== undefined) updates.campaign_ads_name = change.campaign_ads_name;
      if (change.creator_id !== undefined) updates.creator_id = change.creator_id;
      if (change.kurs !== undefined) updates.kurs = change.kurs;
      if (change.ad_id !== undefined) updates.ad_id = change.ad_id;
      if (change.ad_name !== undefined) updates.ad_name = change.ad_name;
      if (change.tanggal !== undefined) updates.tanggal = change.tanggal;
      
      let newUsername = change.original.creators?.username;
      
      if (Object.keys(updates).length > 0) {
        const bulkUpdates: any = {};
        const specificUpdates: any = {};
        
        if (updates.campaign_id !== undefined) bulkUpdates.campaign_id = updates.campaign_id;
        if (updates.campaign_ads_name !== undefined) bulkUpdates.campaign_ads_name = updates.campaign_ads_name;
        if (updates.creator_id !== undefined) bulkUpdates.creator_id = updates.creator_id;
        if (updates.ad_id !== undefined) bulkUpdates.ad_id = updates.ad_id;
        if (updates.ad_name !== undefined) bulkUpdates.ad_name = updates.ad_name;
        
        if (updates.kurs !== undefined) specificUpdates.kurs = updates.kurs;
        if (updates.tanggal !== undefined) specificUpdates.tanggal = updates.tanggal;

        if (Object.keys(bulkUpdates).length > 0) {
          const originalAdId = change.original.ad_id;
          try {
            await updateAdPerformanceAction({
              adId: originalAdId,
              updates: bulkUpdates,
              bulkByAdId: true
            });
            currentAds.forEach((a, idx) => {
              if (a.ad_id === originalAdId) {
                currentAds[idx] = {
                  ...currentAds[idx],
                  ...bulkUpdates,
                  creators: newUsername !== undefined ? (newUsername ? { username: newUsername } : null) : currentAds[idx].creators
                };
              }
            });
          } catch (err) {
            console.error('Error updating bulk ads performance:', err);
          }
        }
        
        if (Object.keys(specificUpdates).length > 0) {
          try {
            await updateAdPerformanceAction({
              id: adId,
              updates: specificUpdates
            });
            const adIndex = currentAds.findIndex(a => a.id === adId);
            if (adIndex !== -1) {
              currentAds[adIndex] = { ...currentAds[adIndex], ...specificUpdates };
            }
          } catch (err) {
            console.error('Error updating specific ad performance:', err);
          }
        }
      }
      
      processed++;
      setBatchSaveProgress(Math.round((processed / total) * 100));
    }
    
    setAdsPerformance(currentAds);
    setPendingChanges(new Map());
    setIsBatchSaving(false);
  };

  useEffect(() => {
    if (pendingChanges.size > 0 && !isBatchSaving) {
      if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
      autoSaveTimeoutRef.current = setTimeout(() => {
        batchSaveAll();
      }, 2000);
    }
    return () => {
      if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
    };
  }, [pendingChanges, isBatchSaving]);

  const setCellChange = (adId: number, field: keyof PendingAdChange, value: any, originalAd: any) => {
    setPendingChanges(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(adId) || { original: originalAd };
      
      let isDifferent = false;
      if (field === 'campaign_id') isDifferent = value !== originalAd.campaign_id;
      else if (field === 'campaign_ads_name') isDifferent = value !== originalAd.campaign_ads_name;
      else if (field === 'creator_id') isDifferent = value !== originalAd.creator_id;
      else if (field === 'kurs') isDifferent = value !== originalAd.kurs;
      else if (field === 'ad_id') isDifferent = value !== originalAd.ad_id;
      else if (field === 'ad_name') isDifferent = value !== originalAd.ad_name;
      else if (field === 'tanggal') isDifferent = value !== originalAd.tanggal;
      
      if (isDifferent) {
        existing[field] = value;
        newMap.set(adId, existing);
      } else {
        delete existing[field];
        if (Object.keys(existing).length <= 1) newMap.delete(adId);
        else newMap.set(adId, existing);
      }
      return newMap;
    });
  };

  const getPendingValue = (adId: number, field: keyof PendingAdChange, originalValue: any) => {
    const change = pendingChanges.get(adId);
    if (change && change[field] !== undefined) return change[field];
    return originalValue;
  };

  const deleteAd = async (id: number) => {
    if (!confirm("Apakah Anda yakin ingin menghapus data iklan ini secara permanen?")) return;
    setDeletingId(id);
    
    try {
      await deleteAdPerformanceAction([id]);
      setAdsPerformance(prev => prev.filter(ad => ad.id !== id));
      setSelectedAds(prev => prev.filter(selectedId => selectedId !== id));
    } catch (error: any) {
      alert("Gagal menghapus data: " + error.message);
    }
    setDeletingId(null);
  };

  const bulkDeleteSelectedAds = async () => {
    if (selectedAds.length === 0) return;
    if (!confirm(`Apakah Anda yakin ingin menghapus ${selectedAds.length} data iklan yang dipilih secara permanen?`)) return;
    
    setIsLoading(true);
    try {
      await deleteAdPerformanceAction(selectedAds);
      setAdsPerformance(prev => prev.filter(ad => !selectedAds.includes(ad.id)));
      setSelectedAds([]);
    } catch (error: any) {
      alert("Gagal menghapus data masal: " + error.message);
    }
    setIsLoading(false);
  };

  // 1. (Removed) Filter by Search Query ONLY (for Campaign Cards) - Now handled by Server Action

  // 2. (Removed) Filter by Search Query AND Clicked Campaign (for Table & Global Summary) - Now handled by Server Action
  
  // 3. (Removed) Campaign Breakdown Calculation - Now handled by Server Action

  const groupedAds = useMemo(() => {
    const groups: Record<string, {
      key: string;
      ad_id: string;
      ad_name: string;
      campaign_id: number | null;
      campaign_ads_name: string | null;
      creator_id: number | null;
      kurs: number;
      cost_usd: number;
      impressions: number;
      clicks: number;
      product_page_views: number;
      checkouts_initiated: number;
      purchases: number;
      items_purchased: number;
      gross_revenue_usd: number;
      rows: any[];
    }> = {};

    const sortedAds = [...adsPerformance].sort((a, b) => {
      const dA = a.tanggal || '';
      const dB = b.tanggal || '';
      return dA.localeCompare(dB);
    });

    sortedAds.forEach(ad => {
      const key = ad.ad_id || ad.ad_name || `unknown-${ad.id}`;
      if (!groups[key]) {
        groups[key] = {
          key,
          ad_id: ad.ad_id,
          ad_name: ad.ad_name,
          campaign_id: ad.campaign_id,
          campaign_ads_name: ad.campaign_ads_name,
          creator_id: ad.creator_id,
          kurs: ad.kurs,
          cost_usd: 0, impressions: 0, clicks: 0, product_page_views: 0, checkouts_initiated: 0, purchases: 0, items_purchased: 0, gross_revenue_usd: 0,
          rows: []
        };
      }
      // Data is lifetime cumulative, so we don't sum it up. 
      // Since sortedAds is sorted chronologically, overwriting it will leave us with the latest date's value.
      // If server calculated a delta value (for date filtering), we use it to show the growth, otherwise use raw cumulative value.
      groups[key].cost_usd = Number(ad.delta_cost_usd !== undefined ? ad.delta_cost_usd : ad.cost_usd || 0);
      groups[key].impressions = Number(ad.delta_impressions !== undefined ? ad.delta_impressions : ad.impressions || 0);
      groups[key].clicks = Number(ad.delta_clicks !== undefined ? ad.delta_clicks : ad.clicks || 0);
      groups[key].product_page_views = Number(ad.delta_product_page_views !== undefined ? ad.delta_product_page_views : ad.product_page_views || 0);
      groups[key].checkouts_initiated = Number(ad.delta_checkouts_initiated !== undefined ? ad.delta_checkouts_initiated : ad.checkouts_initiated || 0);
      groups[key].purchases = Number(ad.delta_purchases !== undefined ? ad.delta_purchases : ad.purchases || 0);
      groups[key].items_purchased = Number(ad.delta_items_purchased !== undefined ? ad.delta_items_purchased : ad.items_purchased || 0);
      groups[key].gross_revenue_usd = Number(ad.delta_gross_revenue_usd !== undefined ? ad.delta_gross_revenue_usd : ad.gross_revenue_usd || 0);
      
      // Update metadata to latest (chronological)
      groups[key].ad_id = ad.ad_id;
      groups[key].ad_name = ad.ad_name;
      groups[key].campaign_id = ad.campaign_id;
      groups[key].campaign_ads_name = ad.campaign_ads_name;
      groups[key].creator_id = ad.creator_id;
      groups[key].kurs = ad.kurs;

      groups[key].rows.push(ad);
    });

    return Object.values(groups).sort((a, b) => b.cost_usd - a.cost_usd);
  }, [adsPerformance]);

  const globalCampaignAdsOptions = useMemo(() => {
    return Array.from(new Set(adsPerformance.map(ad => ad.campaign_ads_name).filter(Boolean))) as string[];
  }, [adsPerformance]);

  // 4. (Removed) Global Summary Calculation - Now handled by Server Action

  // const creatorOptions = creators.map(c => ({ id: c.id, label: `@${c.username}` }));

  const handleExport = () => {
    const dataToExport = adsPerformance.map(ad => ({
      "Tanggal": ad.tanggal,
      "Campaign": campaigns.find(c => c.id === ad.campaign_id)?.nama || 'Unknown',
      "Creator": ad.creators?.username || 'Unknown',
      "Ad Name": ad.ad_name,
      "Ad ID": ad.ad_id,
      "Cost": ad.cost,
      "Kurs": ad.kurs,
      "Cost (IDR)": (Number(ad.cost) || 0) * normalizeKurs(ad.kurs),
      "Video Views": ad.video_views,
      "GMV (VSA)": ad.vsa_gmv
    }));
    exportToExcel(dataToExport, "Laporan_Ads_Export");
  };

  

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Laporan Ads & Performa</h1>
          <p className="text-slate-500">Pemetaan Manual Ad ID dari TikTok Ads Manager ke Creator & Campaign.</p>
        </div>
        <div className="flex items-center gap-4">

          <div className="relative w-72">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari Ad Name, ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
            {isManager && (
              <div className="flex items-center gap-2">
                <Link href="/ads-report/budgeting-ads">
                  <Button variant="outline" className="text-indigo-600 border-indigo-200 hover:bg-indigo-50">
                    <Wallet className="w-4 h-4 mr-2" />
                    Budgeting (Finance)
                  </Button>
                </Link>
                <Link href="/ads-report/import-ads">
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                    <UploadCloud className="w-4 h-4 mr-2" />
                    Import Ads Data
                  </Button>
                </Link>
              </div>
            )}

          <Button onClick={handleExport} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white">
            <Download className="w-4 h-4" /> Export Excel
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
      <>
        {/* Global Summary Cards */}
        {globalSummary.totalUnmapped > 0 && (
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl p-4 text-white shadow-lg flex items-center justify-between mb-4 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-full">
                <AlertCircle className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Perhatian: {globalSummary.totalUnmapped} Iklan Belum Di-Map!</h3>
                <p className="text-amber-50 text-sm">Ada {globalSummary.totalUnmapped} data ads yang belum terhubung ke Campaign atau Kreator. Segera lengkapi agar ROAS akurat.</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <Card className="border-0 shadow-xl bg-white/60 backdrop-blur-xl relative overflow-hidden group hover:shadow-2xl transition-all duration-300">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-all group-hover:bg-red-500/20"></div>
            <CardContent className="p-5 relative z-10">
              <div className="flex justify-between items-start mb-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center text-white shadow-lg shadow-red-500/30">
                  <DollarSign className="w-5 h-5" />
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">Total Spend (USD)</p>
                <h3 className="text-2xl font-bold text-slate-800 tracking-tight">
                  ${(globalSummary.totalSpendUsd || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h3>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-xl bg-white/60 backdrop-blur-xl relative overflow-hidden group hover:shadow-2xl transition-all duration-300">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-all group-hover:bg-emerald-500/20"></div>
            <CardContent className="p-5 relative z-10">
              <div className="flex justify-between items-start mb-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/30">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">Total GMV (IDR)</p>
                <h3 className="text-2xl font-bold text-emerald-600 tracking-tight">
                  Rp {(globalSummary.totalGmv || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                </h3>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-xl bg-white/60 backdrop-blur-xl relative overflow-hidden group hover:shadow-2xl transition-all duration-300">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-all group-hover:bg-blue-500/20"></div>
            <CardContent className="p-5 relative z-10">
              <div className="flex justify-between items-start mb-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
                  <BarChart3 className="w-5 h-5" />
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">ROAS Keseluruhan</p>
                <h3 className={`text-2xl font-bold tracking-tight ${(globalSummary.roas || 0) >= 2 ? 'text-emerald-600' : (globalSummary.roas || 0) >= 1 ? 'text-amber-500' : 'text-red-500'}`}>
                  {(globalSummary.roas || 0).toFixed(2)}x
                </h3>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-xl bg-white/60 backdrop-blur-xl relative overflow-hidden group hover:shadow-2xl transition-all duration-300">
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-all group-hover:bg-purple-500/20"></div>
            <CardContent className="p-5 relative z-10">
              <div className="flex justify-between items-start mb-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-fuchsia-600 flex items-center justify-center text-white shadow-lg shadow-purple-500/30">
                  <Eye className="w-5 h-5" />
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">Total Impressions</p>
                <h3 className="text-2xl font-bold text-purple-700 tracking-tight">
                  {(globalSummary.totalImpressions || 0).toLocaleString('id-ID')}
                </h3>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-xl bg-white/60 backdrop-blur-xl relative overflow-hidden group hover:shadow-2xl transition-all duration-300">
            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-all group-hover:bg-orange-500/20"></div>
            <CardContent className="p-5 relative z-10">
              <div className="flex justify-between items-start mb-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white shadow-lg shadow-orange-500/30">
                  <Activity className="w-5 h-5" />
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">Cost Per Mille (CPM)</p>
                <h3 className="text-2xl font-bold text-orange-600 tracking-tight">
                  Rp {(globalSummary.cpm || 0).toLocaleString('id-ID', { maximumFractionDigits: 1 })}
                </h3>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Campaign Breakdown Cards (Interactive Filter) */}
        {campaignBreakdown.list.length > 0 && (
          <div className="py-2">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-700">Campaign Breakdown (Klik untuk Filter Tabel)</h3>
              {selectedCampaignId && (
                <button 
                  onClick={() => setSelectedCampaignId(null)}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                >
                  <X className="w-3 h-3" /> Hapus Filter
                </button>
              )}
            </div>
            <div className="flex gap-4 overflow-x-auto pb-4 pt-1 px-1 custom-scrollbar snap-x">
              {campaignBreakdown.list.map((camp: any) => {
                const roas = camp.spend > 0 ? camp.gmv / camp.spend : 0;
                const isActive = selectedCampaignId === camp.id;
                return (
                  <div 
                    key={camp.id}
                    onClick={() => setSelectedCampaignId(isActive ? null : camp.id)}
                    className={`flex-shrink-0 w-[280px] p-5 rounded-2xl transition-all cursor-pointer snap-start relative overflow-hidden group ${
                      isActive 
                        ? 'bg-blue-600 shadow-xl shadow-blue-500/30 text-white' 
                        : 'bg-white/80 backdrop-blur-md border border-slate-200/60 hover:shadow-xl hover:shadow-slate-200/50 text-slate-800'
                    }`}
                  >
                    {isActive && <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10"></div>}
                    <div className="flex justify-between items-start mb-3 relative z-10">
                      <h4 className={`font-bold truncate pr-2 text-lg ${isActive ? 'text-white' : 'text-slate-800'}`} title={camp.name}>{camp.name}</h4>
                      {camp.unmapped > 0 && (
                        <span className={`text-[10px] px-2 py-1 rounded-full font-bold flex items-center gap-1 shadow-sm ${isActive ? 'bg-red-500 text-white' : 'bg-red-100 text-red-700'}`} title={`${camp.unmapped} iklan belum di-map`}>
                          <AlertCircle className="w-3 h-3" /> {camp.unmapped}
                        </span>
                      )}
                    </div>
                    
                      <div className="space-y-1 mb-3 relative z-10">
                        {/* Budget Info */}
                        <div className="flex justify-between items-end mb-2 pb-2 border-b border-white/10">
                          <div>
                            <div className={`text-[10px] uppercase font-bold tracking-wider mb-0.5 opacity-80 ${isActive ? 'text-blue-200' : 'text-slate-500'}`}>Sisa Budget (USD)</div>
                            <div className={`font-bold ${isActive ? 'text-white' : 'text-slate-800'}`}>
                              ${budgetBalances[camp.id]?.remaining?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                            </div>
                          </div>
                          <div className={`text-[10px] ${isActive ? 'text-blue-100' : 'text-slate-500'} text-right`}>
                            <div>Alokasi: ${budgetBalances[camp.id]?.allocated?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}</div>
                          </div>
                        </div>

                        <div className="flex justify-between text-xs">
                          <span className={isActive ? 'text-blue-100' : 'text-slate-500'}>Spend:</span>
                          <span className={`font-bold ${isActive ? 'text-white' : 'text-slate-700'}`}>${(camp.spend_usd || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      <div className="flex justify-between text-xs">
                        <span className={isActive ? 'text-blue-100' : 'text-slate-500'}>GMV:</span>
                        <div className="flex flex-col items-end">
                          <span className={`font-bold ${isActive ? 'text-emerald-300' : 'text-emerald-600'}`}>Rp {camp.gmv.toLocaleString('id-ID')}</span>
                          <span className={`text-[10px] ${isActive ? 'text-blue-200' : 'text-slate-400'}`}>${(camp.gmv_usd || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className={isActive ? 'text-blue-100' : 'text-slate-500'}>Total Orders:</span>
                        <span className={`font-bold ${isActive ? 'text-white' : 'text-slate-700'}`}>{(camp.purchases || 0).toLocaleString('id-ID')}</span>
                      </div>
                    </div>

                    <div className="w-full h-1.5 bg-slate-200/50 rounded-full mb-3 overflow-hidden flex relative z-10">
                      <div className="h-full bg-red-400" style={{ width: `${Math.min((camp.spend / (camp.gmv || 1)) * 100, 100)}%` }}></div>
                      <div className="h-full bg-emerald-400 flex-1"></div>
                    </div>

                    <div className={`grid grid-cols-4 gap-2 text-xs pt-3 border-t ${isActive ? 'border-white/20' : 'border-slate-100'} mt-2 relative z-10`}>
                      <div className="flex flex-col">
                        <span className={isActive ? 'text-blue-100 text-[10px]' : 'text-slate-400 text-[10px]'}>ROAS</span>
                        <span className={`font-black text-sm ${isActive ? 'text-white' : (roas >= 2 ? 'text-emerald-600' : roas >= 1 ? 'text-amber-500' : 'text-red-500')}`}>
                          {roas.toFixed(2)}x
                        </span>
                      </div>
                      <div className="flex flex-col text-center">
                        <span className={isActive ? 'text-blue-100 text-[10px]' : 'text-slate-400 text-[10px]'}>CPA</span>
                        <span className={`font-bold text-xs mt-0.5 ${isActive ? 'text-white' : 'text-slate-700'}`}>
                          {camp.purchases > 0 ? `Rp${(camp.spend / camp.purchases / 1000).toFixed(0)}k` : '0'}
                        </span>
                      </div>
                      <div className="flex flex-col text-center">
                        <span className={isActive ? 'text-blue-100 text-[10px]' : 'text-slate-400 text-[10px]'}>CTR</span>
                        <span className={`font-bold text-xs mt-0.5 ${isActive ? 'text-white' : 'text-slate-700'}`}>
                          {camp.impressions > 0 ? ((camp.clicks / camp.impressions) * 100).toFixed(1) + '%' : '0%'}
                        </span>
                      </div>
                      <div className="flex flex-col text-right">
                        <span className={isActive ? 'text-blue-100 text-[10px]' : 'text-slate-400 text-[10px]'}>CPC</span>
                        <span className={`font-bold text-xs mt-0.5 ${isActive ? 'text-white' : 'text-slate-700'}`}>
                          Rp{camp.clicks > 0 ? (camp.spend / camp.clicks).toFixed(0) : '0'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Auto-Save Toast Banner */}
        {(pendingChanges.size > 0 || isBatchSaving) && (
          <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] pointer-events-none animate-in slide-in-from-bottom-5 fade-in duration-300">
            <div className="bg-slate-900/90 backdrop-blur-sm text-white px-5 py-3 rounded-full shadow-2xl flex items-center gap-3 border border-slate-700/50">
              {isBatchSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-slate-300" />
                  <span className="text-sm font-medium tracking-wide">Menyimpan pemetaan... {batchSaveProgress}%</span>
                </>
              ) : (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                  <span className="text-sm font-medium tracking-wide text-amber-100">Menunggu {pendingChanges.size} perubahan (Autosave dalam 2d)...</span>
                </>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mt-6 mb-2">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-6">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-700 whitespace-nowrap">
              <Calendar className="w-4 h-4 text-indigo-600" /> Filter Laporan:
            </div>
            
            {/* Filtered Summary Matrix */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm">
              <div className="flex flex-col">
                <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Spend Filtered</span>
                <span className="font-bold text-slate-800">${(filteredSummary?.totalSpendUsd || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex flex-col border-l border-slate-100 pl-4">
                <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">GMV Filtered</span>
                <span className="font-bold text-emerald-600">Rp {(filteredSummary?.totalGmv || 0).toLocaleString('id-ID')}</span>
              </div>
              <div className="flex flex-col border-l border-slate-100 pl-4">
                <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">ROAS Filtered</span>
                <span className="font-bold text-indigo-600">{(filteredSummary?.roas || 0).toFixed(2)}x</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
            <div className="flex items-center gap-2">
              <input 
                type="date" 
                className="p-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-indigo-500"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <span className="text-slate-500 text-sm">s/d</span>
              <input 
                type="date" 
                className="p-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-indigo-500"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <input
                type="text"
                placeholder="Pilih Campaign Ads..."
                value={campaignAdsName}
                onChange={(e) => setCampaignAdsName(e.target.value)}
                className="w-full md:w-48 p-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-indigo-500"
                list="campaign-ads-list"
              />
              <datalist id="campaign-ads-list">
                {globalCampaignAdsOptions.map(name => <option key={name} value={name} />)}
              </datalist>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => {
                  setAppliedStartDate(startDate);
                  setAppliedEndDate(endDate);
                  setAppliedCampaignAdsName(campaignAdsName);
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                Terapkan
              </Button>
              {(startDate || endDate || campaignAdsName) && (
                <button 
                  onClick={() => { 
                    setStartDate(''); setEndDate(''); setCampaignAdsName('');
                    setAppliedStartDate(''); setAppliedEndDate(''); setAppliedCampaignAdsName('');
                  }}
                  className="p-2 text-red-500 hover:bg-red-50 rounded border border-red-200"
                  title="Reset Filter"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
            Laporan Detail Iklan
            {selectedCampaignId && <span className="ml-2 text-xs font-normal px-2 py-1 bg-blue-100 text-blue-700 rounded-full">Filtered</span>}
          </CardTitle>
          <div className="flex bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => { setViewMode('flat'); setDisplayLimit(100); }}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${viewMode === 'flat' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Database Ads
            </button>
            <button
              onClick={() => { setViewMode('grouped'); setDisplayLimit(100); }}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${viewMode === 'grouped' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Performa Ads (Per ID)
            </button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[70vh] overflow-auto">
            <Table className="whitespace-nowrap">
              <TableHeader className="bg-slate-50 sticky top-0 z-10 shadow-sm select-none">
                <TableRow>
                  <TableHead className="w-[100px] cursor-pointer hover:bg-slate-200 transition-colors" onClick={() => handleSort('tanggal')}>
                    <div className="flex items-center gap-1">Tanggal {sortConfig?.key === 'tanggal' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</div>
                  </TableHead>
                  <TableHead className="w-[120px] cursor-pointer hover:bg-slate-200 transition-colors" onClick={() => handleSort('ad_id')}>
                    <div className="flex items-center gap-1">Ad ID {sortConfig?.key === 'ad_id' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</div>
                  </TableHead>
                  <TableHead className="max-w-[200px] cursor-pointer hover:bg-slate-200 transition-colors" onClick={() => handleSort('ad_name')}>
                    <div className="flex items-center gap-1">Ad Name {sortConfig?.key === 'ad_name' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</div>
                  </TableHead>
                  <TableHead className="w-[150px] cursor-pointer hover:bg-slate-200 transition-colors" onClick={() => handleSort('campaign_id')}>
                    <div className="flex items-center gap-1">Campaign Sistem {sortConfig?.key === 'campaign_id' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</div>
                  </TableHead>
                  <TableHead className="w-[150px] cursor-pointer hover:bg-slate-200 transition-colors" onClick={() => handleSort('campaign_ads_name')}>
                    <div className="flex items-center gap-1">Campaign Ads {sortConfig?.key === 'campaign_ads_name' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</div>
                  </TableHead>
                  <TableHead className="w-[150px] cursor-pointer hover:bg-slate-200 transition-colors" onClick={() => handleSort('creator_id')}>
                    <div className="flex items-center gap-1">Kreator {sortConfig?.key === 'creator_id' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</div>
                  </TableHead>
                  <TableHead className="w-[100px] text-center cursor-pointer hover:bg-slate-200 transition-colors" onClick={() => handleSort('kurs')}>
                    <div className="flex items-center justify-center gap-1">Kurs {sortConfig?.key === 'kurs' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</div>
                  </TableHead>
                  <TableHead className="text-right cursor-pointer hover:bg-slate-200 transition-colors" onClick={() => handleSort('cost_usd')}>
                    <div className="flex items-center justify-end gap-1">Cost (USD) {sortConfig?.key === 'cost_usd' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</div>
                  </TableHead>
                  <TableHead className="text-right cursor-pointer hover:bg-slate-200 transition-colors" onClick={() => handleSort('impressions')}>
                    <div className="flex items-center justify-end gap-1">Impressions {sortConfig?.key === 'impressions' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</div>
                  </TableHead>
                  <TableHead className="text-right cursor-pointer hover:bg-slate-200 transition-colors" onClick={() => handleSort('clicks')}>
                    <div className="flex items-center justify-end gap-1">Clicks {sortConfig?.key === 'clicks' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</div>
                  </TableHead>
                  <TableHead className="text-right cursor-pointer hover:bg-slate-200 transition-colors" onClick={() => handleSort('product_page_views')}>
                    <div className="flex items-center justify-end gap-1">PP Views {sortConfig?.key === 'product_page_views' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</div>
                  </TableHead>
                  <TableHead className="text-right">PP View Rate</TableHead>
                  <TableHead className="text-right cursor-pointer hover:bg-slate-200 transition-colors" onClick={() => handleSort('checkouts_initiated')}>
                    <div className="flex items-center justify-end gap-1">Checkouts {sortConfig?.key === 'checkouts_initiated' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</div>
                  </TableHead>
                  <TableHead className="text-right cursor-pointer hover:bg-slate-200 transition-colors" onClick={() => handleSort('purchases')}>
                    <div className="flex items-center justify-end gap-1">Purchases {sortConfig?.key === 'purchases' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</div>
                  </TableHead>
                  <TableHead className="text-right cursor-pointer hover:bg-slate-200 transition-colors" onClick={() => handleSort('items_purchased')}>
                    <div className="flex items-center justify-end gap-1">Items {sortConfig?.key === 'items_purchased' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</div>
                  </TableHead>
                  <TableHead className="text-right cursor-pointer hover:bg-slate-200 transition-colors" onClick={() => handleSort('gross_revenue_usd')}>
                    <div className="flex items-center justify-end gap-1">Gross Rev (USD) {sortConfig?.key === 'gross_revenue_usd' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</div>
                  </TableHead>
                  <TableHead className="text-right">ROAS</TableHead>
                  <TableHead className="text-right">CPM</TableHead>
                  <TableHead className="text-right">CPC</TableHead>
                  <TableHead className="text-right">Cost/Purchase</TableHead>
                  <TableHead className="text-right">CTR</TableHead>
                  <TableHead className="text-right">Purchase Rate</TableHead>
                  <TableHead className="text-right">AOV</TableHead>
                  <TableHead className="text-center sticky right-0 bg-slate-50 z-10 border-l border-slate-100 min-w-[120px]">
                    {selectedAds.length > 0 ? (
                      <Button onClick={bulkDeleteSelectedAds} size="sm" className="h-7 px-2 text-xs bg-red-600 hover:bg-red-700 text-white flex items-center gap-1 mx-auto">
                        <Trash2 className="w-3 h-3" /> Hapus ({selectedAds.length})
                      </Button>
                    ) : (
                      "Aksi"
                    )}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {viewMode === 'flat' && adsPerformance.slice(0, displayLimit).map((ad) => {
                  return <MemoizedTableRow 
                    key={ad.id}
                    ad={ad} 
                    isChild={false} 
                    isParent={false} 
                    parentKey="" 
                    groupStats={null} 
                    isExpanded={false}
                    pendingChange={pendingChanges.get(ad.id)}
                    isManager={isManager}
                    selectedAds={selectedAds}
                    setSelectedAds={setSelectedAds}
                    setExpandedGroups={setExpandedGroups}
                    campaigns={campaigns}
                    globalCampaignAdsOptions={globalCampaignAdsOptions}
                    setCellChange={setCellChange}
                    deletingId={deletingId}
                    deleteAd={deleteAd}
                  />;
                })}

                {viewMode === 'grouped' && groupedAds.slice(0, displayLimit).map((group) => {
                  const isExpanded = expandedGroups.has(group.key);
                  const latestRow = group.rows[group.rows.length - 1] || {};
                  
                  return (
                    <React.Fragment key={`group-${group.key}`}>
                      <MemoizedTableRow 
                        ad={latestRow} 
                        isChild={false} 
                        isParent={true} 
                        parentKey={group.key} 
                        groupStats={group} 
                        isExpanded={isExpanded}
                        pendingChange={pendingChanges.get(latestRow.id)}
                        isManager={isManager}
                        selectedAds={selectedAds}
                        setSelectedAds={setSelectedAds}
                        setExpandedGroups={setExpandedGroups}
                        campaigns={campaigns}
                        globalCampaignAdsOptions={globalCampaignAdsOptions}
                        setCellChange={setCellChange}
                        deletingId={deletingId}
                        deleteAd={deleteAd}
                      />
                      {isExpanded && group.rows.map((childAd, index) => {
                        const prevAd = index > 0 ? group.rows[index - 1] : null;
                        
                        const cost_usd_diff = prevAd ? (childAd.cost_usd - prevAd.cost_usd) : childAd.cost_usd;
                        const impressions_diff = prevAd ? (childAd.impressions - prevAd.impressions) : childAd.impressions;
                        const clicks_diff = prevAd ? (childAd.clicks - prevAd.clicks) : childAd.clicks;
                        const product_page_views_diff = prevAd ? (childAd.product_page_views - prevAd.product_page_views) : childAd.product_page_views;
                        const checkouts_initiated_diff = prevAd ? (childAd.checkouts_initiated - prevAd.checkouts_initiated) : childAd.checkouts_initiated;
                        const purchases_diff = prevAd ? (childAd.purchases - prevAd.purchases) : childAd.purchases;
                        const items_purchased_diff = prevAd ? (childAd.items_purchased - prevAd.items_purchased) : childAd.items_purchased;
                        const gross_revenue_usd_diff = prevAd ? (childAd.gross_revenue_usd - prevAd.gross_revenue_usd) : childAd.gross_revenue_usd;

                        const modifiedChildAd = {
                          ...childAd,
                          cost_usd: cost_usd_diff,
                          impressions: impressions_diff,
                          clicks: clicks_diff,
                          product_page_views: product_page_views_diff,
                          checkouts_initiated: checkouts_initiated_diff,
                          purchases: purchases_diff,
                          items_purchased: items_purchased_diff,
                          gross_revenue_usd: gross_revenue_usd_diff,
                          
                          lifetime_cost_usd: childAd.cost_usd,
                          lifetime_impressions: childAd.impressions,
                          lifetime_clicks: childAd.clicks,
                          lifetime_product_page_views: childAd.product_page_views,
                          lifetime_checkouts_initiated: childAd.checkouts_initiated,
                          lifetime_purchases: childAd.purchases,
                          lifetime_items_purchased: childAd.items_purchased,
                          lifetime_gross_revenue_usd: childAd.gross_revenue_usd,
                        };

                        return (
                        <MemoizedTableRow 
                          key={childAd.id}
                          ad={modifiedChildAd} 
                          isChild={true} 
                          isParent={false} 
                          parentKey="" 
                          groupStats={null} 
                          isExpanded={false}
                          pendingChange={pendingChanges.get(childAd.id)}
                          isManager={isManager}
                          selectedAds={selectedAds}
                          setSelectedAds={setSelectedAds}
                          setExpandedGroups={setExpandedGroups}
                          campaigns={campaigns}
                          globalCampaignAdsOptions={globalCampaignAdsOptions}
                          setCellChange={setCellChange}
                          deletingId={deletingId}
                          deleteAd={deleteAd}
                        />
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
            {adsPerformance.length > displayLimit && (
              <div className="flex justify-center p-4 border-t border-slate-100">
                <Button variant="outline" onClick={() => setDisplayLimit(prev => prev + 100)}>
                  Tampilkan Lainnya ({adsPerformance.length - displayLimit} lagi)
                </Button>
              </div>
            )}
            {adsPerformance.length === 0 && (
              <div className="text-center py-12 text-slate-500">
                Tidak ada data iklan yang ditemukan.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      </>
      )}
    </div>
  );
}
