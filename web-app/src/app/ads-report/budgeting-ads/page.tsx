"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { ArrowLeft, Plus, DollarSign, Wallet, TrendingUp, AlertCircle, History, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import { useDatabaseStore } from "@/store/useDatabaseStore";
import { normalizeKurs } from "@/utils/computed";
import {
  fetchAdsBudgetingDataAction,
  addAdsTopupAction,
  deleteAdsTopupAction,
  addAdsAllocationAction,
  deleteAdsAllocationAction
} from "@/app/ads-report/actions";

export default function BudgetingAdsPage() {
  const { campaigns } = useDatabaseStore();
  
  const [topups, setTopups] = useState<any[]>([]);
  const [allocations, setAllocations] = useState<any[]>([]);
  const [adsSpend, setAdsSpend] = useState<any[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);

  // Form State Top Up
  const [showTopupForm, setShowTopupForm] = useState(false);
  const [topupDate, setTopupDate] = useState("");
  const [topupIdr, setTopupIdr] = useState("");
  const [topupUsd, setTopupUsd] = useState("");
  const [topupNote, setTopupNote] = useState("");

  const [expandedTopupId, setExpandedTopupId] = useState<number | null>(null);

  // Form State Allocation
  const [showAllocForm, setShowAllocForm] = useState(false);
  const [allocDate, setAllocDate] = useState("");
  const [allocTopupId, setAllocTopupId] = useState("");
  const [allocCampaignId, setAllocCampaignId] = useState("");
  const [allocIdr, setAllocIdr] = useState("");
  const [allocNote, setAllocNote] = useState("");

  // Filter States
  const [filterTopupStart, setFilterTopupStart] = useState("");
  const [filterTopupEnd, setFilterTopupEnd] = useState("");
  const [filterAllocStart, setFilterAllocStart] = useState("");
  const [filterAllocEnd, setFilterAllocEnd] = useState("");
  const [filterAllocCampaign, setFilterAllocCampaign] = useState("");

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const data = await fetchAdsBudgetingDataAction();
      setTopups(data.topups);
      setAllocations(data.allocations);
      setAdsSpend(data.performance);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // -- Kalkulasi Metrik Global --
  const totalTopupUsd = topups.reduce((acc, curr) => acc + Number(curr.nominal_usd || curr.nominal_topup_usd || 0), 0);
  const totalTopupIdr = topups.reduce((acc, curr) => acc + Number(curr.nominal_idr || curr.nominal_topup_idr || 0), 0);
  
  const totalAllocatedUsd = allocations.reduce((acc, curr) => acc + Number(curr.alokasi_usd), 0);
  const totalAllocatedIdr = allocations.reduce((acc, curr) => acc + Number(curr.alokasi_idr || 0), 0);
  
  const idleFundsUsd = totalTopupUsd - totalAllocatedUsd;

  // -- Kalkulasi Per Campaign --
  const campaignBalances = campaigns.map(camp => {
    // total alokasi ke campaign ini
    const campAllocations = allocations.filter(a => Number(a.campaign_id) === Number(camp.id));
    const allocatedUsd = campAllocations.reduce((acc, curr) => acc + Number(curr.alokasi_usd), 0);
    const allocatedIdr = campAllocations.reduce((acc, curr) => acc + Number(curr.alokasi_idr || 0), 0);
    
    // total spend campaign ini - ambil HANYA tanggal terakhir per ad_id
    const campSpends = adsSpend.filter(s => Number(s.campaign_id) === Number(camp.id));
    
    // Group by ad_id, lalu ambil baris dengan tanggal terbaru
    const adIdMap = new Map<string, any>();
    for (const row of campSpends) {
      const adId = row.ad_id;
      if (!adId) continue;
      const existing = adIdMap.get(adId);
      if (!existing || (row.tanggal && (!existing.tanggal || row.tanggal > existing.tanggal))) {
        adIdMap.set(adId, row);
      }
    }
    
    // Jumlahkan cost_usd dari tanggal terakhir per ad_id
    let spentUsd = 0;
    let spentIdr = 0;
    for (const ad of adIdMap.values()) {
      const kurs = normalizeKurs(ad.kurs);
      spentUsd += Number(ad.cost_usd || 0);
      spentIdr += Number(ad.cost_usd || 0) * kurs;
    }
    
    const remainingUsd = allocatedUsd - spentUsd;
    const remainingIdr = allocatedIdr - spentIdr;

    const plafonIdr = Number(camp.budget_ads_plafon || 0);
    const sisaPlafonIdr = plafonIdr - allocatedIdr;
    
    return {
      ...camp,
      allocatedUsd,
      allocatedIdr,
      spentUsd,
      spentIdr,
      remainingUsd,
      remainingIdr,
      plafonIdr,
      sisaPlafonIdr,
      allocations: campAllocations
    };
  });
  
  // Sort by remaining desc
  campaignBalances.sort((a, b) => b.remainingUsd - a.remainingUsd);

  const overspentCampaigns = campaignBalances.filter(c => c.remainingUsd < -1);

  // -- Handlers --
  const handleSubmitTopup = async (e: React.FormEvent) => {
    e.preventDefault();
    const idr = Number(topupIdr);
    const usd = Number(topupUsd);
    if (!idr || !usd || !topupDate) return alert("Lengkapi form Top Up");
    
    const kurs = idr / usd;
    
    try {
      await addAdsTopupAction({
        tanggal: topupDate,
        nominal_topup_idr: idr,
        nominal_topup_usd: usd,
        kurs: kurs,
        keterangan: topupNote
      });
      setShowTopupForm(false);
      setTopupDate(""); setTopupIdr(""); setTopupUsd(""); setTopupNote("");
      fetchData();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleSubmitAlloc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allocDate || !allocTopupId || !allocCampaignId || !allocIdr) return alert("Lengkapi form");
    
    const sourceTopup = topups.find(t => t.id.toString() === allocTopupId);
    if (!sourceTopup) return alert("Top up sumber tidak valid");
    
    const idr = Number(allocIdr);
    const kurs = Number(sourceTopup.kurs_topup || (Number(sourceTopup.nominal_idr || sourceTopup.nominal_topup_idr) / Number(sourceTopup.nominal_usd || sourceTopup.nominal_topup_usd)) || 16000);
    const usd = idr / kurs;
    
    // VALIDASI HARD BLOCK:
    const topupAllocated = allocations.filter(a => a.topup_id?.toString() === allocTopupId).reduce((sum, curr) => sum + Number(curr.alokasi_usd), 0);
    const sisaIdle = Number(sourceTopup.nominal_usd || sourceTopup.nominal_topup_usd) - topupAllocated;
    
    if (usd > sisaIdle + 0.05) {
      return alert(`Gagal: Dana Top Up tidak cukup!\nAnda mencoba membagikan $${usd.toLocaleString('en-US', {minimumFractionDigits: 2})}, tapi Sisa Top Up ini hanya $${sisaIdle.toLocaleString('en-US', {minimumFractionDigits: 2})}.`);
    }
    
    try {
      await addAdsAllocationAction({
        tanggal: allocDate,
        campaign_id: Number(allocCampaignId),
        alokasi_usd: usd,
        keterangan: allocNote,
        topup_id: Number(allocTopupId),
        alokasi_idr: idr
      });
      setShowAllocForm(false);
      setAllocDate(""); setAllocTopupId(""); setAllocCampaignId(""); setAllocIdr(""); setAllocNote("");
      fetchData();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleDeleteTopup = async (id: number) => {
    if (!confirm("Hapus Top Up ini? Semua alokasi yang menggunakan dana dari top up ini juga akan ikut terhapus!")) return;
    try {
      await deleteAdsTopupAction(id);
      fetchData();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleDeleteAlloc = async (id: number) => {
    if (!confirm("Hapus riwayat alokasi ini? Saldo USD akan dikembalikan ke status Idle.")) return;
    try {
      await deleteAdsAllocationAction(id);
      fetchData();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const filteredTopups = topups.filter(t => {
    let pass = true;
    if (filterTopupStart) pass = pass && new Date(t.tanggal) >= new Date(filterTopupStart);
    if (filterTopupEnd) pass = pass && new Date(t.tanggal) <= new Date(filterTopupEnd);
    return pass;
  });

  const filteredAllocations = allocations.filter(a => {
    let pass = true;
    if (filterAllocStart) pass = pass && new Date(a.tanggal) >= new Date(filterAllocStart);
    if (filterAllocEnd) pass = pass && new Date(a.tanggal) <= new Date(filterAllocEnd);
    if (filterAllocCampaign) pass = pass && a.campaign_id.toString() === filterAllocCampaign;
    return pass;
  });

  return (
    <div className="w-full mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/ads-report" className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Ads Budgeting (Finance)</h1>
          <p className="text-sm text-slate-500">Kelola dompet USD dan pantau distribusi saldo per Campaign.</p>
        </div>
      </div>

      {overspentCampaigns.length > 0 && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-lg flex gap-3 items-start shadow-sm mb-2">
          <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
          <div>
            <h3 className="text-red-800 font-bold text-sm">Overspend Alert!</h3>
            <p className="text-red-700 text-xs mt-1 leading-relaxed">
              Ada {overspentCampaigns.length} campaign yang sisa saldonya minus (menggunakan dana campaign lain): 
              <strong className="ml-1">{overspentCampaigns.map(c => c.nama).join(', ')}</strong>.
              <br />Segera lakukan alokasi Top Up ke campaign tersebut untuk menutup defisit.
            </p>
          </div>
        </div>
      )}

      {/* Global Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-md border-0">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                <Wallet className="w-5 h-5 text-white" />
              </div>
            </div>
            <p className="text-indigo-100 font-medium text-sm mb-1">Total Saldo USD Tersedia (Idle)</p>
            <h3 className="text-3xl font-bold tracking-tight mb-2">
              ${idleFundsUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <p className="text-xs text-indigo-200">
              Uang Top Up yang belum dialokasikan ke Campaign.
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white shadow-sm border-slate-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <DollarSign className="w-5 h-5 text-emerald-600" />
              </div>
            </div>
            <p className="text-slate-500 font-medium text-sm mb-1">Total Top Up Masuk (USD)</p>
            <h3 className="text-3xl font-bold text-slate-800 tracking-tight mb-2">
              ${totalTopupUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <p className="text-xs text-slate-400">
              Ekuivalen dengan Rp {totalTopupIdr.toLocaleString('id-ID')}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white shadow-sm border-slate-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                <TrendingUp className="w-5 h-5 text-blue-600" />
              </div>
            </div>
            <p className="text-slate-500 font-medium text-sm mb-1">Total Teralokasi ke Campaign (USD)</p>
            <h3 className="text-3xl font-bold text-slate-800 tracking-tight mb-2">
              ${totalAllocatedUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <p className="text-xs text-slate-400">
              Sudah didistribusikan ke dompet Campaign
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Kolom Kiri: Campaign Balances (Memakan 2 kolom di layar besar) */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="border-b border-slate-100 pb-4">
              <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Wallet className="w-5 h-5 text-indigo-500" />
                Dompet Ads Campaign
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="font-semibold text-slate-700 whitespace-nowrap">Campaign</TableHead>
                      <TableHead className="font-semibold text-right text-slate-700 border-l border-slate-200 bg-slate-100/50 whitespace-nowrap">Budgeting (IDR)</TableHead>
                      <TableHead className="font-semibold text-right text-slate-700 bg-slate-100/50 whitespace-nowrap">Telah di-Top Up (IDR)</TableHead>
                      <TableHead className="font-semibold text-right text-orange-600 bg-slate-100/50 whitespace-nowrap">Sisa Top Up (IDR)</TableHead>
                      <TableHead className="font-semibold text-right border-l border-slate-200 whitespace-nowrap">Modal (USD)</TableHead>
                      <TableHead className="font-semibold text-right text-red-600 whitespace-nowrap">Terpakai (USD)</TableHead>
                      <TableHead className="font-semibold text-right text-emerald-600 whitespace-nowrap">SISA SALDO</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow><TableCell colSpan={4} className="text-center py-8">Memuat data...</TableCell></TableRow>
                    ) : campaignBalances.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center py-8 text-slate-500">Tidak ada data campaign aktif.</TableCell></TableRow>
                    ) : (
                      campaignBalances.map(camp => {
                        const isOverspent = camp.remainingUsd < -1;
                        return (
                          <TableRow key={camp.id} className={`hover:bg-slate-50 ${isOverspent ? 'bg-red-50/50' : ''}`}>
                            <TableCell className="font-medium text-slate-800 whitespace-nowrap">
                              {camp.nama}
                              {isOverspent && <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-800">Overspend</span>}
                            </TableCell>
                          <TableCell className="text-right text-slate-600 border-l border-slate-100 bg-slate-50/50 whitespace-nowrap">Rp{(camp.plafonIdr).toLocaleString('id-ID')}</TableCell>
                          <TableCell className="text-right text-slate-600 bg-slate-50/50 whitespace-nowrap">Rp{(camp.allocatedIdr).toLocaleString('id-ID')}</TableCell>
                          <TableCell className="text-right font-medium text-orange-600 bg-slate-50/50 whitespace-nowrap">Rp{(camp.sisaPlafonIdr).toLocaleString('id-ID')}</TableCell>
                          <TableCell className="text-right border-l border-slate-200 whitespace-nowrap">
                            <div className="text-slate-600">${camp.allocatedUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            <div className="text-red-600">${camp.spentUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                            {camp.spentIdr > 0 && <div className="text-[10px] text-slate-400">Rp{Math.round(camp.spentIdr).toLocaleString('id-ID')}</div>}
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            <span className={`font-bold ${camp.remainingUsd <= 10 ? 'text-red-600' : 'text-emerald-600'}`}>
                              ${camp.remainingUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Kolom Kanan: Actions (Top Up & Alokasi) */}
        <div className="space-y-6">
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="bg-slate-50 border-b border-slate-100 py-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <History className="w-4 h-4 text-slate-500" />
                Riwayat Top Up
              </CardTitle>
              <button 
                onClick={() => setShowTopupForm(!showTopupForm)}
                className="p-1.5 bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100 transition-colors"
                title="Tambah Top Up Baru"
              >
                {showTopupForm ? <ArrowLeft className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              </button>
            </CardHeader>
            <CardContent className="p-4">
              {showTopupForm ? (
                <form onSubmit={handleSubmitTopup} className="space-y-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <h4 className="text-xs font-semibold text-slate-700 uppercase">Input Top Up Global</h4>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Tanggal</label>
                    <input type="date" value={topupDate} onChange={e => setTopupDate(e.target.value)} className="w-full p-2 text-sm border rounded focus:ring-2 focus:ring-indigo-500 outline-none" required />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Nominal Rupiah (Setor)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-slate-400 text-sm">Rp</span>
                      <input type="number" value={topupIdr} onChange={e => setTopupIdr(e.target.value)} className="w-full pl-8 p-2 text-sm border rounded focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="10000000" required />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Nominal USD (Didapat)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-slate-400 text-sm">$</span>
                      <input type="number" step="0.01" value={topupUsd} onChange={e => setTopupUsd(e.target.value)} className="w-full pl-7 p-2 text-sm border rounded focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="500.00" required />
                    </div>
                  </div>
                  {(topupIdr && topupUsd) && (
                    <div className="bg-blue-50 text-blue-800 text-xs p-2 rounded flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      Kurs Top Up ini: Rp {(Number(topupIdr) / Number(topupUsd)).toLocaleString('id-ID')} / USD
                    </div>
                  )}
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Catatan</label>
                    <input type="text" value={topupNote} onChange={e => setTopupNote(e.target.value)} className="w-full p-2 text-sm border rounded focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Top up bulan Juli via BCA" />
                  </div>
                  <button type="submit" className="w-full py-2 bg-indigo-600 text-white rounded text-sm font-medium hover:bg-indigo-700 transition-colors">
                    Simpan Top Up
                  </button>
                </form>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="flex gap-2 items-center bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <span className="text-xs font-medium text-slate-500 whitespace-nowrap">Periode:</span>
                    <input type="date" value={filterTopupStart} onChange={e => setFilterTopupStart(e.target.value)} className="w-full p-1.5 text-xs border rounded outline-none text-slate-600" title="Start Date" />
                    <span className="text-slate-400 text-xs">-</span>
                    <input type="date" value={filterTopupEnd} onChange={e => setFilterTopupEnd(e.target.value)} className="w-full p-1.5 text-xs border rounded outline-none text-slate-600" title="End Date" />
                    {(filterTopupStart || filterTopupEnd) && (
                      <button onClick={() => {setFilterTopupStart(""); setFilterTopupEnd("");}} className="p-1 text-xs text-slate-500 hover:text-slate-700 bg-white border border-slate-200 rounded shrink-0">Reset</button>
                    )}
                  </div>
                  <div className="space-y-3 max-h-[350px] overflow-y-auto custom-scrollbar pr-1">
                    {filteredTopups.map((t, idx) => {
                      const isExpanded = expandedTopupId === t.id;
                      const topupAllocations = allocations.filter(a => a.topup_id === t.id);
                      
                      return (
                        <div key={idx} className="border border-slate-100 rounded-lg bg-white shadow-sm overflow-hidden group">
                          <div 
                            className="p-3 flex justify-between items-center cursor-pointer hover:bg-slate-50 transition-colors"
                            onClick={() => setExpandedTopupId(isExpanded ? null : t.id)}
                          >
                            <div>
                              <div className="text-xs text-slate-400 mb-0.5">{new Date(t.tanggal).toLocaleDateString('id-ID')} {t.catatan && `• ${t.catatan}`}</div>
                              <div className="font-bold text-slate-800 flex items-center gap-2">
                                ${Number(t.nominal_usd).toLocaleString('en-US', {minimumFractionDigits: 2})}
                                {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                              </div>
                              <div className="text-xs text-slate-500">Rp{Number(t.nominal_idr).toLocaleString('id-ID')} (Kurs: {(Number(t.kurs_topup)).toLocaleString('id-ID')})</div>
                            </div>
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleDeleteTopup(t.id); }} 
                              className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all"
                              title="Hapus Top Up"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          
                          {isExpanded && (
                            <div className="bg-slate-50 p-3 border-t border-slate-100">
                              <div className="text-xs font-semibold text-slate-500 mb-2">Dibagikan ke:</div>
                              {topupAllocations.length > 0 ? (
                                <div className="space-y-1">
                                  {topupAllocations.map(a => {
                                    const cName = campaigns.find(c => c.id === a.campaign_id)?.nama || 'Unknown';
                                    const percentage = (Number(a.alokasi_idr) / Number(t.nominal_idr)) * 100;
                                    return (
                                      <div key={a.id} className="flex justify-between items-center text-xs p-1.5 rounded hover:bg-slate-200/50 transition-colors">
                                        <span className="text-slate-700 font-medium w-1/3">{cName}</span>
                                        <span className="text-slate-500 w-1/4 text-right">Rp{Number(a.alokasi_idr).toLocaleString('id-ID')}</span>
                                        <span className="text-blue-600 font-medium w-1/5 text-right">{percentage.toFixed(2)}%</span>
                                        <span className="text-emerald-600 font-bold w-1/4 text-right">${Number(a.alokasi_usd).toLocaleString('en-US', {minimumFractionDigits: 2})}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="text-xs text-slate-400 italic">Belum ada dana yang dibagikan dari Top Up ini.</div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                    {filteredTopups.length === 0 && <div className="text-center text-sm text-slate-500 py-4">Tidak ada data top up</div>}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm border-slate-200">
            <CardHeader className="bg-slate-50 border-b border-slate-100 py-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-slate-500" />
                Distribusi Jatah (Alokasi)
              </CardTitle>
              <button 
                onClick={() => setShowAllocForm(!showAllocForm)}
                className="p-1.5 bg-emerald-50 text-emerald-600 rounded hover:bg-emerald-100 transition-colors"
                title="Bagi Dana ke Campaign"
              >
                {showAllocForm ? <ArrowLeft className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              </button>
            </CardHeader>
            <CardContent className="p-4">
              {showAllocForm ? (
                <form onSubmit={handleSubmitAlloc} className="space-y-3 bg-emerald-50/50 p-3 rounded-lg border border-emerald-100">
                  <h4 className="text-xs font-semibold text-slate-700 uppercase">Bagikan Dana ke Campaign</h4>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Tanggal</label>
                    <input type="date" value={allocDate} onChange={e => setAllocDate(e.target.value)} className="w-full p-2 text-sm border rounded focus:ring-2 focus:ring-emerald-500 outline-none" required />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Sumber Uang (Pilih Top Up)</label>
                    <select value={allocTopupId} onChange={e => setAllocTopupId(e.target.value)} className="w-full p-2 text-sm border rounded focus:ring-2 focus:ring-emerald-500 outline-none bg-white" required>
                      <option value="">-- Pilih Top Up --</option>
                      {topups.map(t => {
                        const topupAllocated = allocations.filter(a => a.topup_id === t.id).reduce((sum, curr) => sum + Number(curr.alokasi_usd), 0);
                        const sisaIdle = Number(t.nominal_usd) - topupAllocated;
                        return (
                          <option key={t.id} value={t.id}>
                            {new Date(t.tanggal).toLocaleDateString('id-ID')} | {t.catatan || 'Top Up'} (${Number(t.nominal_usd)}) - Sisa: ${sisaIdle.toLocaleString('en-US', {minimumFractionDigits: 2})}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Campaign Penerima</label>
                    <select value={allocCampaignId} onChange={e => setAllocCampaignId(e.target.value)} className="w-full p-2 text-sm border rounded focus:ring-2 focus:ring-emerald-500 outline-none bg-white" required>
                      <option value="">-- Pilih Campaign --</option>
                      {campaigns.map(c => (
                        <option key={c.id} value={c.id}>{c.nama} {c.status !== 'aktif' ? `(${c.status})` : ''}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Nominal Jatah Rupiah</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-slate-400 text-sm">Rp</span>
                      <input type="number" value={allocIdr} onChange={e => setAllocIdr(e.target.value)} className="w-full pl-8 p-2 text-sm border rounded focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="3000000" required />
                    </div>
                  </div>
                  {(allocTopupId && allocIdr) && (
                    <div className="bg-blue-50 text-blue-800 text-xs p-2 rounded">
                      Karena kurs top up sumber adalah Rp {(Number(topups.find(t => t.id.toString() === allocTopupId)?.kurs_topup)).toLocaleString('id-ID')}, maka dompet campaign akan terisi: <br/>
                      <strong className="text-sm">${(Number(allocIdr) / Number(topups.find(t => t.id.toString() === allocTopupId)?.kurs_topup)).toLocaleString('en-US', { minimumFractionDigits: 2, minimumFractionDigits: 2 })}</strong>
                    </div>
                  )}
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Catatan</label>
                    <input type="text" value={allocNote} onChange={e => setAllocNote(e.target.value)} className="w-full p-2 text-sm border rounded focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="Jatah minggu pertama" />
                  </div>
                  <button type="submit" className="w-full py-2 bg-emerald-600 text-white rounded text-sm font-medium hover:bg-emerald-700 transition-colors">
                    Bagikan Saldo
                  </button>
                </form>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="flex gap-2 items-center bg-emerald-50 p-2 rounded-lg border border-emerald-100/50">
                    <input type="date" value={filterAllocStart} onChange={e => setFilterAllocStart(e.target.value)} className="w-1/3 p-1.5 text-xs border rounded outline-none text-slate-600" title="Start Date" />
                    <span className="text-emerald-400 text-xs">-</span>
                    <input type="date" value={filterAllocEnd} onChange={e => setFilterAllocEnd(e.target.value)} className="w-1/3 p-1.5 text-xs border rounded outline-none text-slate-600" title="End Date" />
                    <select value={filterAllocCampaign} onChange={e => setFilterAllocCampaign(e.target.value)} className="w-1/3 p-1.5 text-xs border rounded outline-none bg-white text-slate-600">
                      <option value="">Semua Campaign</option>
                      {campaigns.map(c => (
                        <option key={c.id} value={c.id}>{c.nama} {c.status !== 'aktif' ? `(${c.status})` : ''}</option>
                      ))}
                    </select>
                    {(filterAllocStart || filterAllocEnd || filterAllocCampaign) && (
                      <button onClick={() => {setFilterAllocStart(""); setFilterAllocEnd(""); setFilterAllocCampaign("");}} className="p-1 text-xs text-emerald-600 hover:text-emerald-700 bg-white border border-emerald-200 rounded shrink-0">Reset</button>
                    )}
                  </div>
                  <div className="space-y-3 max-h-[350px] overflow-y-auto custom-scrollbar pr-1">
                    {filteredAllocations.map((a, idx) => {
                      const camp = campaigns.find(c => c.id === a.campaign_id);
                      return (
                        <div key={idx} className="p-3 border border-slate-100 rounded-lg bg-white shadow-sm flex flex-col gap-1 relative group">
                          <div className="flex justify-between items-start pr-6">
                            <span className="font-bold text-slate-800 text-sm">{camp?.nama || 'Unknown'}</span>
                            <span className="text-emerald-600 font-bold text-sm">+${Number(a.alokasi_usd).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between items-center mt-1 text-xs text-slate-500 pr-6">
                            <span>{new Date(a.tanggal).toLocaleDateString('id-ID')}</span>
                            <span>Rp{Number(a.alokasi_idr).toLocaleString('id-ID')}</span>
                          </div>
                          <button 
                            onClick={() => handleDeleteAlloc(a.id)} 
                            className="absolute top-2 right-2 p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all"
                            title="Hapus Alokasi"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )
                    })}
                    {filteredAllocations.length === 0 && <div className="text-center text-sm text-slate-500 py-4">Tidak ada data alokasi</div>}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
