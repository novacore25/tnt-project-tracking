import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, Video, Search, ChevronRight, PlayCircle, AlertCircle, CheckSquare, Square, Radio, CheckCircle2 } from 'lucide-react';
import { fetchUnpaidCreators } from '../app/campaigns/actions/paymentActions';
import { BatchForm } from '../app/campaigns/[id]/keuangan/BatchForm';

export function UnpaidCreatorsTab({ campaignId, onSuccess }: { campaignId: number, onSuccess: () => void }) {
  const [creators, setCreators] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  
  // Video Modal State
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [activeVideos, setActiveVideos] = useState<any[]>([]);
  const [activeCreatorName, setActiveCreatorName] = useState('');

  // Form Mode
  const [showBatchForm, setShowBatchForm] = useState(false);
  const [prefilledCreators, setPrefilledCreators] = useState<any[]>([]);
  const [creatorHistory, setCreatorHistory] = useState<Record<number, any[]>>({});

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchUnpaidCreators(campaignId);
      // Filter out creators who are fully paid
      // A creator is fully paid if they have '100_akhir' paid/pending OR ('50_awal' + '50_akhir' paid/pending)
      
      const processed = (data || []).map(cc => {
        const history = cc.payment_items || [];
        const paidOrPendingTypes = history.filter((h: any) => h.final_status !== 'rejected' && h.final_status !== 'cancelled').map((h: any) => h.payment_type);
        const isFullyPaid = paidOrPendingTypes.includes('100_akhir') || (paidOrPendingTypes.includes('50_awal') && paidOrPendingTypes.includes('50_akhir'));
        
        // Find latest snapshot for GMV/Followers and Ratecard
        const snapshots = cc.creators?.creator_snapshots || [];
        const sortedSnaps = [...snapshots].sort((a: any, b: any) => {
          const tDiff = new Date(b.tanggal_update || 0).getTime() - new Date(a.tanggal_update || 0).getTime();
          if (tDiff !== 0) return tDiff;
          return (b.id || 0) - (a.id || 0);
        });
        const latestSnapshot = sortedSnaps[0] || { followers: 0, gmv_30d: 0, ratecard: 0 };
        const validSnap = sortedSnaps.find((s: any) => Number(s.ratecard || 0) > 0);
        const effectivePrice = Number(cc.price || 0) || Number(validSnap?.ratecard || 0);
        
        // Content types (for display badges)
        const rawContentType = (cc.content_type || '').toLowerCase();
        const isLiveType = rawContentType.includes('live') || Number(cc.qty_live || 0) > 0;
        const isVideoType = rawContentType.includes('video') || Number(cc.qty_vt || 0) > 0 || (!isLiveType);

        // Deliverables check (informational only, no longer blocks payment submission)
        const hasVideo = Boolean(cc.videos && cc.videos.some((v: any) => v.link_video || v.content_uid));
        const hasLive = Boolean(cc.has_live_activity || (cc.videos && cc.videos.some((v: any) => v.content_uid && !v.link_video)));

        const gmv = Number(latestSnapshot.gmv_30d || 0) || (Number(latestSnapshot.gmv_30d_video || 0) + Number(latestSnapshot.gmv_30d_live || 0)) || 0;
        const followers = Number(latestSnapshot.followers || 0);

        // ATURAN BARU:
        // Syarat harus ada video & harus ada live DIHILANGKAN.
        // Yang penting:
        // 1. Ratecard > 0 (effectivePrice > 0)
        // 2. Data profil lengkap: followers > 0 dan gmv > 0
        const hasRatecard = effectivePrice > 0;
        const hasFollowers = followers > 0;
        const hasGmv = gmv > 0;

        const isDataLengkap = hasRatecard && hasFollowers && hasGmv;
        const canSubmit = isDataLengkap;

        let disableReason = '';
        if (!hasRatecard) {
          disableReason = 'Ratecard belum diisi / Rp 0';
        } else if (!hasFollowers && !hasGmv) {
          disableReason = 'Followers & GMV 30 Days belum lengkap';
        } else if (!hasFollowers) {
          disableReason = 'Followers belum diisi (Data belum lengkap)';
        } else if (!hasGmv) {
          disableReason = 'GMV 30 Days masih 0 (Data belum lengkap)';
        }

        return {
          ...cc,
          price: effectivePrice,
          isFullyPaid,
          hasVideo,
          hasLive,
          isLiveType,
          isVideoType,
          gmv,
          followers,
          canSubmit,
          disableReason,
          paidOrPendingTypes
        };
      }).filter(cc => !cc.isFullyPaid && (cc.price || 0) > 0); // Only show those who are NOT fully paid AND have a ratecard > 0

      const historyMap: Record<number, any[]> = {};
      (data || []).forEach((cc: any) => {
        if (cc.payment_items && cc.payment_items.length > 0) {
          historyMap[cc.id] = cc.payment_items.map((pi: any) => ({
            id: pi.id,
            payment_type: pi.payment_type,
            nominal: Number(pi.nominal || 0),
            status: pi.final_status
          }));
        }
      });
      setCreatorHistory(historyMap);

      setCreators(processed);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleSelection = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredCreators.filter(c => c.canSubmit).length) {
      setSelectedIds(new Set());
    } else {
      const allEligible = filteredCreators.filter(c => c.canSubmit).map(c => c.id);
      setSelectedIds(new Set(allEligible));
    }
  };

  const filteredCreators = creators.filter(c => {
    const search = searchTerm.trim().replace(/^@/, '').toLowerCase();
    const username = (c.creators?.username || '').toLowerCase();
    const name = (c.creators?.nama_asli || c.creators?.nama_lengkap || '').toLowerCase();
    return username.includes(search) || name.includes(search);
  });

  const handleAjukanPembayaran = () => {
    if (selectedIds.size === 0) return;
    
    // Prepare pre-filled data for BatchForm
    const selectedData = creators.filter(c => selectedIds.has(c.id));
    
    // Format to match what BatchForm expects
    const prefilled = selectedData.map(cc => {
      // Get latest bank account
      const banks = cc.creators?.creator_bank_accounts || [];
      const latestBank = banks.length > 0 ? banks[banks.length - 1] : null;
      
      // Determine next payment type
      let nextPaymentType = '';
      if (cc.paidOrPendingTypes.includes('50_awal')) {
        nextPaymentType = '50_akhir';
      }
      
      return {
        campaign_creator_id: cc.id,
        creator: { ...cc, username: cc.creators?.username },
        payment_type: nextPaymentType,
        metode_pembayaran: latestBank?.bank_name || '',
        nomor_rekening: latestBank?.account_number || '',
        nama_penerima: latestBank?.account_holder || '',
        nominal: '', // Let PIC fill or we can pre-calc based on ratecard
      };
    });

    setPrefilledCreators(prefilled);
    setShowBatchForm(true);
  };

  if (showBatchForm) {
    return (
      <BatchForm 
        campaignId={campaignId} 
        creators={creators} // pass all creators so the dropdown still works if they want to add more
        creatorHistory={creatorHistory}
        initialItems={prefilledCreators}
        onCancel={() => setShowBatchForm(false)} 
        onSuccess={() => {
          setShowBatchForm(false);
          setSelectedIds(new Set());
          loadData();
          onSuccess();
        }} 
      />
    );
  }

  const allEligibleCount = filteredCreators.filter(c => c.canSubmit).length;

  return (
    <div className="space-y-4 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Daftar Kreator Belum Dibayar</h2>
          <p className="text-sm text-slate-500">Pilih kreator dengan ratecard valid dan data profil lengkap (Followers &amp; GMV) untuk diajukan pembayarannya.</p>
        </div>
        <button
          disabled={selectedIds.size === 0}
          onClick={handleAjukanPembayaran}
          className="btn btn-primary whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Ajukan Pembayaran ({selectedIds.size})
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Cari username kreator..."
              className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-blue-500 transition-colors"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-100 text-slate-600 font-medium">
              <tr>
                <th className="px-4 py-3 w-12 text-center cursor-pointer" onClick={handleSelectAll}>
                  {allEligibleCount > 0 && selectedIds.size === allEligibleCount ? (
                    <CheckSquare className="w-5 h-5 text-blue-600 mx-auto" />
                  ) : (
                    <Square className="w-5 h-5 text-slate-400 hover:text-slate-600 mx-auto transition-colors" />
                  )}
                </th>
                <th className="px-4 py-3">Username & Tier</th>
                <th className="px-4 py-3 text-center">SOW</th>
                <th className="px-4 py-3 text-right">Followers</th>
                <th className="px-4 py-3 text-right">GMV 30 Days</th>
                <th className="px-4 py-3 text-right">Ratecard</th>
                <th className="px-4 py-3 text-center">Aksi / Keterangan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-4" />
                    <p className="text-slate-500">Memuat data kreator...</p>
                  </td>
                </tr>
              ) : filteredCreators.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    Tidak ada kreator yang sesuai.
                  </td>
                </tr>
              ) : (
                filteredCreators.map(cc => {
                  const isSelected = selectedIds.has(cc.id);
                  const username = cc.creators?.username || '-';

                  return (
                    <tr key={cc.id} className={`transition-colors ${isSelected ? 'bg-blue-50/50' : 'hover:bg-slate-50'} ${!cc.canSubmit ? 'opacity-60 bg-slate-50' : ''}`}>
                      <td className="px-4 py-3 text-center cursor-pointer" onClick={() => cc.canSubmit && toggleSelection(cc.id)}>
                        {cc.canSubmit ? (
                          isSelected ? <CheckSquare className="w-5 h-5 text-blue-600 mx-auto" /> : <Square className="w-5 h-5 text-slate-300 mx-auto" />
                        ) : (
                          <div className="w-5 h-5 mx-auto bg-slate-200 rounded text-slate-400 flex items-center justify-center text-[10px]">✕</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800">@{username}</div>
                        <div className="text-xs text-slate-500">{cc.tier || 'No Tier'}</div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded inline-block font-medium">
                          {cc.qty_vt || 0} VT / {cc.qty_live || 0} Live
                        </div>
                        {cc.content_type && (
                          <div className="text-[10px] text-slate-500 mt-0.5">{cc.content_type}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-700">
                        {cc.followers.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-800">
                        Rp {cc.gmv.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-700">
                        Rp {(Number(cc.price) || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {cc.canSubmit ? (
                          <div className="flex items-center justify-center gap-1.5 flex-wrap">
                            {cc.hasVideo && (
                              <button 
                                onClick={(e) => { e.stopPropagation(); setActiveVideos(cc.videos || []); setActiveCreatorName(username); setShowVideoModal(true); }}
                                className="text-xs bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-2.5 py-1.5 rounded-lg font-medium transition-colors inline-flex items-center gap-1"
                                title="Lihat Video yang Diupload"
                              >
                                <PlayCircle className="w-3.5 h-3.5" /> Video ({cc.videos?.filter((v:any) => v.link_video || v.content_uid).length || 0})
                              </button>
                            )}
                            {cc.hasLive && (
                              <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1.5 rounded-lg font-medium inline-flex items-center gap-1" title="Aktivitas live stream tercatat">
                                <Radio className="w-3.5 h-3.5 text-emerald-600 animate-pulse" /> Live Ada
                              </span>
                            )}
                            <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1.5 rounded-lg font-medium inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Siap Diajukan
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1 text-[11px] text-red-500 font-medium">
                            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /> {cc.disableReason}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Video Modal */}
      {showVideoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Video className="w-5 h-5 text-indigo-500" />
                Video @{activeCreatorName}
              </h3>
              <button onClick={() => setShowVideoModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                ✕
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              {activeVideos.length === 0 ? (
                <div className="text-center text-slate-500 py-8">Belum ada video.</div>
              ) : (
                <div className="space-y-3">
                  {activeVideos.map((v, i) => (
                    <a key={v.id || i} href={v.link_video} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50 transition-colors group">
                      <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                        <PlayCircle className="w-5 h-5" />
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <div className="text-sm font-semibold text-slate-800">Video {i + 1}</div>
                        <div className="text-xs text-slate-500 truncate">{v.link_video}</div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
