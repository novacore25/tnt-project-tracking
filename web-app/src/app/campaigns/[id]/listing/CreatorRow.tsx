import React from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Trash2, Edit2, Loader2, PlayCircle, Info, AlertCircle, Plus, RotateCw, Save, X, FileText, Video, Radio, MapPin } from "lucide-react";
import { formatAbbreviated, formatDateTime, formatDateTimeShort, formatRupiah } from "@/utils/formatters";
import { getCreatorType, getJenisKerjasama, getConceptColor } from "@/utils/computed";
import { MultiSelect } from "@/components/MultiSelect";
import { NotesTimeline } from "@/components/NotesTimeline";
import { Dialog, DialogContent } from "@/components/ui/Dialog";

const areEqual = (prev: any, next: any) => {
  return (
    prev.isExpanded === next.isExpanded &&
    prev.hasPending === next.hasPending &&
    prev.pendingChange === next.pendingChange &&
    prev.activeEditingField === next.activeEditingField &&
    prev.isSelected === next.isSelected &&
    prev.isBatchSaving === next.isBatchSaving &&
    prev.cc === next.cc &&
    prev.creator === next.creator &&
    prev.snapshot === next.snapshot &&
    prev.creatorVideos === next.creatorVideos &&
    prev.hasAccess === next.hasAccess &&
    prev.updateVideoConcept === next.updateVideoConcept &&
    prev.addEmptyVideoRow === next.addEmptyVideoRow &&
    prev.addAndSetVideoField === next.addAndSetVideoField &&
    prev.deleteVideoRow === next.deleteVideoRow &&
    prev.masterConcepts === next.masterConcepts &&
    prev.revisionNotes === next.revisionNotes &&
    prev.onGenerateContract === next.onGenerateContract
  );
};

interface CreatorRowProps {
  cc: any;
  index: number;
  creator: any;
  snapshot?: any;
  hasPending: boolean;
  pendingChange?: any;
  isExpanded: boolean;
  activeEditingField: string | null;
  creatorVideos?: any[];
  hasAccess: boolean;
  isSelected: boolean;
  toggleSelectCreator: (id: string | number) => void;
  toggleExpand: (id: string | number) => void;
  setEditingCellId: (id: string | null) => void;
  setCellChange: (ccId: string | number, field: string, value: any, cc: any) => void;
  getPendingValue: (ccId: string | number, field: string, fallback: any) => any;
  campaignSkus: any[];
  setNicheEditCreatorId: (id: string | number) => void;
  setNicheEditForm: (nicheIds: number[]) => void;
  setNicheModalOpen: (open: boolean) => void;
  staffProfiles: any[];
  isClientApprovalRequired: boolean;
  profile: any;
  isBatchSaving: boolean;
  handleDeleteCreator: (id: string | number) => void;
  updateCampaignCreator: (ccId: number, data: any, changedBy?: string) => void;
  fetchListing: (pageNum: number, isReset?: boolean) => void;
  page: number;
  updateVideoField?: (videoId: number, ccId: number, fields: any) => void;
  addEmptyVideoRow?: (ccId: number) => void;
  addAndSetVideoField?: (ccId: number, urutan: number, fields: any) => void;
  deleteVideoRow?: (ccId: number, videoId: string | number) => void;
  masterConcepts?: any[];
  revisionNotes?: Record<string, any>;
  saveRevisionNote?: (ccId: number, urutan: number, noteText: string) => Promise<void>;
  onGenerateContract?: (cc: any) => void;
}

export const CreatorRow = React.memo(({
  cc,
  index,
  creator,
  snapshot,
  hasPending,
  pendingChange,
  isExpanded,
  activeEditingField,
  creatorVideos,
  hasAccess,
  isSelected,
  toggleSelectCreator,
  toggleExpand,
  setEditingCellId,
  setCellChange,
  getPendingValue,
  campaignSkus,
  setNicheEditCreatorId,
  setNicheEditForm,
  setNicheModalOpen,
  staffProfiles,
  isClientApprovalRequired,
  profile,
  isBatchSaving,
  handleDeleteCreator,
  updateCampaignCreator,
  fetchListing,
  page,
  updateVideoField,
  addEmptyVideoRow,
  addAndSetVideoField,
  deleteVideoRow,
  masterConcepts = [],
  revisionNotes = {},
  saveRevisionNote,
  onGenerateContract,
}: CreatorRowProps) => {
  const [selectedConcept, setSelectedConcept] = React.useState<any>(null);
  const [playingDriveId, setPlayingDriveId] = React.useState<string | null>(null);

  const canManageRevisionNotes = profile?.role === 'manager' || profile?.role === 'executive';

  // Draft Video Revision Note state
  const [revisionModalState, setRevisionModalState] = React.useState<{
    open: boolean;
    video: any | null;
    noteText: string;
    isSaving: boolean;
  }>({
    open: false,
    video: null,
    noteText: '',
    isSaving: false
  });

  const handleOpenRevisionModal = (video: any) => {
    if (!canManageRevisionNotes) return;
    const existingNote = revisionNotes[`${cc.id}_${video.urutan}`]?.isi || '';
    setRevisionModalState({
      open: true,
      video,
      noteText: existingNote,
      isSaving: false
    });
  };

  const handleSaveModalRevisionNote = async () => {
    if (!canManageRevisionNotes || !revisionModalState.video || !saveRevisionNote) return;
    setRevisionModalState(prev => ({ ...prev, isSaving: true }));
    try {
      await saveRevisionNote(cc.id, revisionModalState.video.urutan, revisionModalState.noteText);
      setRevisionModalState(prev => ({ ...prev, open: false, isSaving: false }));
    } catch {
      setRevisionModalState(prev => ({ ...prev, isSaving: false }));
    }
  };

  const extractGDriveId = (url: string) => {
    if (!url) return null;
    const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  };

  const parseNotes = React.useMemo(() => {
    return (raw: string, role: string) => {
      if (!raw) return [];
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.map((n: any) => ({ 
            isi: n.isi || '', 
            created_at: n.created_at || null,
            role
          })).slice(-3);
        }
        return [{ isi: raw, created_at: null, role }];
      } catch (err) {
        return [{ isi: raw, created_at: null, role }];
      }
    };
  }, []);

  const managerNotes = React.useMemo(() => {
    return parseNotes(cc.notes_manager, 'Manager')
      .filter((n: any) => n.isi && n.isi.trim() !== '')
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 3);
  }, [cc.notes_manager, parseNotes]);

  const picNotes = React.useMemo(() => {
    return parseNotes(cc.notes_pic, 'PIC')
      .filter((n: any) => n.isi && n.isi.trim() !== '')
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 3);
  }, [cc.notes_pic, parseNotes]);

  const paddedVideos = React.useMemo(() => {
    const vids = [...(creatorVideos || [])];
    const target = cc.qty_vt || 0;
    if (vids.length < target) {
      const diff = target - vids.length;
      let nextUrutan = vids.length > 0 ? Math.max(...vids.map(v => v.urutan)) + 1 : 1;
      for (let i = 0; i < diff; i++) {
        vids.push({
          id: `phantom_${nextUrutan}`,
          urutan: nextUrutan,
          concept: '',
          concept_updated_at: null,
          concept_updated_by: null,
          link_video: '',
          vt_approval: 'pending'
        });
        nextUrutan++;
      }
    }
    return vids;
  }, [creatorVideos, cc.qty_vt]);

  return (
    <React.Fragment>
      <tr className={`group transition-colors ${hasPending ? 'bg-amber-50/70 hover:bg-amber-50' : 'hover:bg-[#f8fafc]'}`}>
        <td className="text-center">
          {hasAccess && (
            <input 
              type="checkbox" 
              className="rounded border-slate-300 text-p300 focus:ring-p300 cursor-pointer w-4 h-4"
              checked={isSelected}
              onChange={() => toggleSelectCreator(cc.id)}
            />
          )}
        </td>
        <td>
          <button onClick={() => toggleExpand(cc.id)} className="p-[4px] hover:bg-slate-200 rounded">
            {isExpanded ? <ChevronDown className="w-4 h-4 text-text-soft" /> : <ChevronRight className="w-4 h-4 text-text-soft" />}
          </button>
        </td>
        <td className="text-center font-medium text-[13px] text-text-soft">
          {index + 1}
        </td>
        <td className="relative min-w-[240px]">
          <div className="flex items-start gap-2.5">
            {creator.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={creator.avatar_url}
                alt={creator.username}
                className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0 mt-0.5"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                {String(creator.username || '?').charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Link href={`/creator-pool/${creator.id}`} className="font-bold text-slate-900 hover:text-indigo-600 inline-flex items-center gap-1 text-[13px]">
                  @{creator.username}
                </Link>
                {activeEditingField === `level` ? (
                  <input 
                    type="number" 
                    min="1"
                    autoFocus
                    defaultValue={getPendingValue(cc.id, 'level', snapshot?.level || '')}
                    onBlur={e => { setCellChange(cc.id, 'level', Number(e.target.value), cc); setEditingCellId(null); }}
                    onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                    className="input w-14 !p-[2px] text-center text-[10px] font-bold"
                  />
                ) : (
                  <span 
                    onClick={() => hasAccess && setEditingCellId(`${cc.id}-level`)}
                    className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 rounded cursor-pointer hover:bg-amber-200"
                    title="Klik untuk edit level"
                  >
                    LVL {getPendingValue(cc.id, 'level', snapshot?.level || '-') || '-'}
                  </span>
                )}
                {(!cc.added_by || cc.tier === 'Auto-Detect') && (
                  <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-800 text-[10px] font-bold rounded-full">AUTO</span>
                )}
              </div>

              {creator.display_name && (
                <div className="text-[11px] text-slate-600 font-medium truncate max-w-[190px]" title={creator.display_name}>
                  {creator.display_name}
                </div>
              )}

              {/* Followers & Tier */}
              <div className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
                <span>Followers:</span>
                {activeEditingField === `followers` ? (
                  <input 
                    type="number" 
                    min="0"
                    autoFocus
                    defaultValue={getPendingValue(cc.id, 'followers', snapshot?.followers || 0)}
                    onBlur={e => { setCellChange(cc.id, 'followers', e.target.value === '' ? '' : Number(e.target.value), cc); setEditingCellId(null); }}
                    onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                    className="input w-20 !p-[2px] text-right text-[11px]"
                  />
                ) : (
                  <span 
                    className={`font-bold text-indigo-700 cursor-pointer hover:underline ${hasPending && pendingChange?.followers !== undefined ? 'text-amber-700' : ''}`}
                    onClick={() => hasAccess && setEditingCellId(`${cc.id}-followers`)}
                    title="Klik untuk edit followers"
                  >
                    {formatAbbreviated(Number(getPendingValue(cc.id, 'followers', snapshot?.followers || 0)), false)}
                  </span>
                )}
                <span className="text-slate-400 font-normal">
                  ({(() => {
                    const f = getPendingValue(cc.id, 'followers', snapshot?.followers);
                    if (f !== undefined && f !== null && Number(f) > 0) {
                      const numF = Number(f);
                      if (numF < 10000) return 'Nano';
                      if (numF < 100000) return 'Micro';
                      if (numF < 1000000) return 'Macro';
                      return 'Mega';
                    }
                    return snapshot?.tier || cc.tier || '-';
                  })()})
                </span>
              </div>

              {/* Niche & MCN badges */}
              <div className="flex flex-wrap items-center gap-1 pt-0.5">
                {creator.creator_niches?.map((cn: any, idx: number) => {
                  const nicheName = cn.niches?.nama || cn.nama;
                  return nicheName ? (
                    <span key={idx} className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap">
                      {nicheName}
                    </span>
                  ) : null;
                })}
                {hasAccess && (
                  <button 
                    onClick={() => {
                      setNicheEditCreatorId(creator.id);
                      setNicheEditForm(creator.creator_niches?.map((cn: any) => cn.niche_id) || []);
                      setNicheModalOpen(true);
                    }}
                    className="p-0.5 hover:bg-slate-100 rounded text-slate-400 hover:text-blue-600 transition-colors shrink-0"
                    title="Edit Niche"
                  >
                    <Edit2 className="w-2.5 h-2.5" />
                  </button>
                )}
                {creator.mcn ? (
                  <span className="px-1.5 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-full text-[10px] font-medium truncate max-w-[130px]" title={creator.mcn}>
                    🏢 {creator.mcn}
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded-full text-[10px]">
                    Tanpa MCN
                  </span>
                )}
              </div>

              {/* Contact & Links */}
              <div className="flex items-center gap-1.5 pt-0.5 flex-wrap">
                <a href={creator.link_account || `https://www.tiktok.com/@${creator.username}`} target="_blank" rel="noopener noreferrer" className="inline-block hover:opacity-80 transition-opacity shrink-0">
                  <img src="/logo-tiktok-landscape-button.svg" alt="TikTok" className="h-[16px]" />
                </a>
                {creator.creator_contacts?.find((c: any) => c.status === 'aktif')?.nomor && (
                  <a href={`https://wa.me/${creator.creator_contacts.find((c: any) => c.status === 'aktif').nomor.replace(/^0/, '62').replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="text-[10px] text-emerald-600 hover:underline flex items-center gap-1 font-medium bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    {creator.creator_contacts.find((c: any) => c.status === 'aktif').nomor}
                  </a>
                )}
              </div>
            </div>
          </div>
          {(managerNotes.length > 0 || picNotes.length > 0) && (
            <div className="absolute bottom-1 left-[120px] flex gap-3 max-w-[480px] text-left z-10 opacity-90 group-hover:opacity-100 transition-opacity">
              {managerNotes.length > 0 && (
                <div className="overflow-hidden whitespace-nowrap border border-orange-200 bg-orange-50/90 rounded px-1.5 py-0.5" title="Detail notes Manager">
                  <div className="animate-marquee inline-block text-[10px] text-orange-700 font-medium">
                    {managerNotes.map((n: any, i: number) => (
                      <span key={i} className="mr-4">
                        <span className="font-bold">[Manager]</span> {n.isi}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {picNotes.length > 0 && (
                <div className="overflow-hidden whitespace-nowrap border border-blue-200 bg-blue-50/90 rounded px-1.5 py-0.5" title="Detail notes PIC">
                  <div className="animate-marquee inline-block text-[10px] text-blue-700 font-medium">
                    {picNotes.map((n: any, i: number) => (
                      <span key={i} className="mr-4">
                        <span className="font-bold">[PIC]</span> {n.isi}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </td>

        {/* Kolom 2: KERJASAMA & SOW */}
        <td className="min-w-[200px] text-[11px] space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-600">
              {getJenisKerjasama(getPendingValue(cc.id, 'price', cc.price))}:
            </span>
            {activeEditingField === `price` ? (
              <input 
                type="number" 
                autoFocus
                defaultValue={getPendingValue(cc.id, 'price', cc.price)}
                onBlur={e => { setCellChange(cc.id, 'price', Number(e.target.value), cc); setEditingCellId(null); }}
                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                className="input w-24 !p-[2px] text-right text-[11px]"
              />
            ) : (
              <span 
                className={`font-bold cursor-pointer hover:bg-blue-50 px-1 py-0.5 rounded ${hasPending && pendingChange?.price !== undefined ? 'text-amber-700' : 'text-slate-900'}`}
                onClick={() => hasAccess && setEditingCellId(`${cc.id}-price`)}
                title="Klik untuk edit Price (Rp)"
              >
                {formatRupiah(getPendingValue(cc.id, 'price', cc.price))}
              </span>
            )}
          </div>

          {/* SOW */}
          <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded border border-slate-100">
            <div className="flex items-center gap-1">
              <span className="text-blue-700 font-bold">🎬</span>
              {activeEditingField === `qty_vt` ? (
                <input 
                  type="number" 
                  min="0"
                  autoFocus
                  defaultValue={getPendingValue(cc.id, 'qty_vt', cc.qty_vt)}
                  onBlur={e => { setCellChange(cc.id, 'qty_vt', Number(e.target.value), cc); setEditingCellId(null); }}
                  onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                  className="input w-12 !p-[1px] text-center text-[10px]"
                />
              ) : (
                <span 
                  className="font-bold text-slate-800 cursor-pointer hover:underline"
                  onClick={() => hasAccess && setEditingCellId(`${cc.id}-qty_vt`)}
                  title="Klik untuk edit Qty VT"
                >
                  {getPendingValue(cc.id, 'qty_vt', cc.qty_vt)} VT
                </span>
              )}
            </div>
            <span className="text-slate-300">•</span>
            <div className="flex items-center gap-1">
              <span className="text-rose-600 font-bold">🔴</span>
              {activeEditingField === `qty_live` ? (
                <input 
                  type="number" 
                  min="0"
                  autoFocus
                  defaultValue={getPendingValue(cc.id, 'qty_live', cc.qty_live || 0)}
                  onBlur={e => { setCellChange(cc.id, 'qty_live', Number(e.target.value), cc); setEditingCellId(null); }}
                  onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                  className="input w-12 !p-[1px] text-center text-[10px]"
                />
              ) : (
                <span 
                  className="font-bold text-slate-800 cursor-pointer hover:underline"
                  onClick={() => hasAccess && setEditingCellId(`${cc.id}-qty_live`)}
                  title="Klik untuk edit Qty Live"
                >
                  {getPendingValue(cc.id, 'qty_live', cc.qty_live || 0)} Live
                </span>
              )}
            </div>
          </div>

          {/* Assigned Products / SKU */}
          {activeEditingField === `produk` ? (
            <div className="w-full">
              <MultiSelect 
                options={campaignSkus.map((s: any) => ({ id: s.id, label: s.nama_produk }))}
                selectedIds={(getPendingValue(cc.id, 'assigned_sku_ids', cc.assigned_sku_ids || []) as number[])}
                onChange={(ids: number[]) => { setCellChange(cc.id, 'assigned_sku_ids', ids, cc); }}
                placeholder="Pilih Produk..."
                emptyMessage="Belum ada produk"
              />
              <button onClick={() => setEditingCellId(null)} className="text-[10px] text-blue-600 mt-1 hover:underline">Tutup</button>
            </div>
          ) : (
            <div 
              className={`flex flex-wrap gap-1 cursor-pointer hover:bg-blue-50 rounded p-1 ${hasPending && pendingChange?.assigned_sku_ids !== undefined ? 'ring-1 ring-amber-300' : ''}`}
              onClick={() => hasAccess && setEditingCellId(`${cc.id}-produk`)}
              title="Klik untuk pilih produk"
            >
              {(() => {
                const skuIds = getPendingValue(cc.id, 'assigned_sku_ids', cc.assigned_sku_ids || []) as number[];
                return skuIds && skuIds.length > 0 ? (
                  skuIds.map((skuId: number) => {
                    const sku = campaignSkus.find((s: any) => s.id === skuId);
                    return sku ? <span key={skuId} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-[10px] px-1.5 py-0.5 rounded border border-blue-100">{sku.nama_produk}</span> : null;
                  })
                ) : (
                  <span className="text-[10px] text-slate-400 italic">Pilih Produk...</span>
                );
              })()}
            </div>
          )}
        </td>

        {/* Kolom 3: STATUS & PIC */}
        <td className="min-w-[150px] text-center text-[11px] space-y-1">
          {activeEditingField === `approval` ? (
            <select 
              autoFocus
              value={getPendingValue(cc.id, 'approval', cc.approval) as string}
              onChange={e => { setCellChange(cc.id, 'approval', e.target.value, cc); setEditingCellId(null); }}
              onBlur={() => setEditingCellId(null)}
              className="select !p-[4px] text-xs"
            >
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="alternate">Alternate</option>
              <option value="not_approved">Not Approved</option>
            </select>
          ) : (
            <div 
              className={`flex flex-col items-center cursor-pointer hover:bg-blue-50 rounded p-1 ${hasPending && pendingChange?.approval !== undefined ? 'ring-1 ring-amber-300' : ''}`}
              onClick={() => hasAccess && setEditingCellId(`${cc.id}-approval`)}
            >
              {(() => {
                const approvalVal = getPendingValue(cc.id, 'approval', cc.approval) as string;
                const isApprovalPending = hasPending && pendingChange?.approval !== undefined;
                
                let name = 'System';
                let dateStr = '-';
                
                if (isApprovalPending) {
                  name = profile?.nama || 'Unknown';
                  dateStr = formatDateTimeShort(new Date());
                } else if (approvalVal === 'pending') {
                  name = staffProfiles.find((p: any) => p.id === cc.added_by)?.nama || cc.added_by_profile?.nama || 'System';
                  dateStr = cc.created_at ? formatDateTimeShort(cc.created_at) : '-';
                } else if (approvalVal === 'approved') {
                  name = staffProfiles.find((p: any) => p.id === (cc.approved_by || cc.added_by))?.nama || cc.approved_by_profile?.nama || cc.added_by_profile?.nama || 'System';
                  dateStr = (cc.approved_at || cc.created_at) ? formatDateTimeShort(cc.approved_at || cc.created_at) : '-';
                } else if (approvalVal === 'not_approved' || approvalVal === 'alternate') {
                  name = staffProfiles.find((p: any) => p.id === (cc.not_approved_by || cc.added_by))?.nama || cc.not_approved_by_profile?.nama || cc.added_by_profile?.nama || 'System';
                  dateStr = (cc.not_approved_at || cc.created_at) ? formatDateTimeShort(cc.not_approved_at || cc.created_at) : '-';
                }

                return (
                  <div className="w-full flex flex-col items-center">
                    <span className={`badge ${
                      approvalVal === 'approved' ? 'b-approved' : 
                      approvalVal === 'not_approved' ? 'b-rejected' : 
                      approvalVal === 'alternate' ? 'b-alternate' : 'b-pending'
                    }`}>
                      {approvalVal}
                    </span>
                    <div className="text-[10px] text-text-soft mt-1 leading-tight text-center flex flex-col items-center w-full">
                      <span className="block w-full truncate">Oleh: {name}</span>
                      <span className="block w-full truncate">{dateStr}</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {isClientApprovalRequired && (
            <div className="pt-1 border-t border-slate-100 flex flex-col items-center">
              <span 
                className={`text-[9px] font-bold px-1.5 py-0.5 rounded cursor-pointer ${
                  (getPendingValue(cc.id, 'client_approval', cc.client_approval) as string) === 'approved' ? 'bg-emerald-100 text-emerald-800' : 
                  (getPendingValue(cc.id, 'client_approval', cc.client_approval) as string) === 'rejected' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'
                }`}
                onClick={() => hasAccess && setEditingCellId(`${cc.id}-client_approval`)}
                title="Client Approval"
              >
                Klien: {(getPendingValue(cc.id, 'client_approval', cc.client_approval) as string) || 'Pending'}
              </span>
            </div>
          )}
        </td>

        {/* Kolom 4: TOTAL GMV 30D & SALES CHANNEL */}
        <td className="min-w-[220px] p-2 space-y-1.5 text-[11px]">
          <div className="flex items-center gap-1.5 flex-wrap">
            {activeEditingField === `gmv_30d` ? (
              <input 
                type="number" 
                min="0"
                autoFocus
                defaultValue={getPendingValue(cc.id, 'gmv_30d', snapshot?.gmv_30d || 0)}
                onBlur={e => { setCellChange(cc.id, 'gmv_30d', Number(e.target.value), cc); setEditingCellId(null); }}
                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                className="input w-24 !p-[2px] text-right text-[12px] font-bold"
              />
            ) : (
              <span 
                className={`text-sm font-extrabold cursor-pointer hover:bg-blue-50 px-1 py-0.5 rounded ${hasPending && pendingChange?.gmv_30d !== undefined ? 'text-amber-700' : 'text-slate-900'}`}
                onClick={() => hasAccess && setEditingCellId(`${cc.id}-gmv_30d`)}
                title="Klik untuk edit Total GMV"
              >
                {(getPendingValue(cc.id, 'gmv_30d', snapshot?.gmv_30d || 0) as number) > 0 ? formatRupiah(getPendingValue(cc.id, 'gmv_30d', snapshot?.gmv_30d || 0) as number) : '-'}
              </span>
            )}
            <span
              className={`px-1.5 py-0.5 text-[10px] font-bold rounded uppercase ${
                snapshot?.gmv_status === 'ESTIMASI'
                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                  : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
              }`}
            >
              {snapshot?.gmv_status || 'RIIL'}
            </span>
          </div>

          <div className="space-y-1 text-[11px] bg-slate-50 p-2 rounded-lg border border-slate-100">
            <div className="flex items-center justify-between">
              <span className="text-rose-600 font-semibold">🔴 LIVE ({Number(snapshot?.pct_live || 0)}%):</span>
              {activeEditingField === `gmv_30d_live` ? (
                <input 
                  type="number" 
                  min="0"
                  autoFocus
                  defaultValue={getPendingValue(cc.id, 'gmv_30d_live', snapshot?.gmv_30d_live || 0)}
                  onBlur={e => { setCellChange(cc.id, 'gmv_30d_live', Number(e.target.value), cc); setEditingCellId(null); }}
                  onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                  className="input w-20 !p-[1px] text-right text-[10px]"
                />
              ) : (
                <span 
                  className="font-bold text-slate-800 cursor-pointer hover:underline"
                  onClick={() => hasAccess && setEditingCellId(`${cc.id}-gmv_30d_live`)}
                  title="Klik untuk edit GMV Live"
                >
                  {formatRupiah(Number(getPendingValue(cc.id, 'gmv_30d_live', snapshot?.gmv_30d_live || 0)))}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-blue-600 font-semibold">🎬 Video ({Number(snapshot?.pct_video || 0)}%):</span>
              {activeEditingField === `gmv_30d_video` ? (
                <input 
                  type="number" 
                  min="0"
                  autoFocus
                  defaultValue={getPendingValue(cc.id, 'gmv_30d_video', snapshot?.gmv_30d_video || 0)}
                  onBlur={e => { setCellChange(cc.id, 'gmv_30d_video', Number(e.target.value), cc); setEditingCellId(null); }}
                  onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                  className="input w-20 !p-[1px] text-right text-[10px]"
                />
              ) : (
                <span 
                  className="font-bold text-slate-800 cursor-pointer hover:underline"
                  onClick={() => hasAccess && setEditingCellId(`${cc.id}-gmv_30d_video`)}
                  title="Klik untuk edit GMV Video"
                >
                  {formatRupiah(Number(getPendingValue(cc.id, 'gmv_30d_video', snapshot?.gmv_30d_video || 0)))}
                </span>
              )}
            </div>
            {Number(snapshot?.pct_showcase) > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-amber-700 font-semibold">🛍️ Cards ({Number(snapshot.pct_showcase)}%):</span>
                <span className="font-bold text-slate-800">{formatRupiah(Number(snapshot?.gmv_30d_showcase || 0))}</span>
              </div>
            )}
          </div>
        </td>
{/* Kolom Staging 1: Metrik Sales & Kolaborasi */}
        <td className="min-w-[180px] text-[11px] text-slate-700 space-y-0.5">
          {snapshot?.items_sold_30d != null || snapshot?.gpm_30d != null || snapshot?.avg_commission_rate != null ? (
            <>
              <div>
                Items Sold: <strong className="text-slate-900">{Number(snapshot?.items_sold_30d || 0).toLocaleString('id-ID')}</strong>
              </div>
              <div>
                GPM: <strong className="text-slate-900">{Number(snapshot?.gpm_30d || 0) > 0 ? formatAbbreviated(Number(snapshot.gpm_30d), true) : '-'}</strong>
              </div>
              {(snapshot?.gmv_per_customer_min || snapshot?.gmv_per_customer_max) && (
                <div>
                  GMV/Cust:{' '}
                  <strong className="text-slate-900">
                    {formatAbbreviated(Number(snapshot?.gmv_per_customer_min || 0), false)} - {formatAbbreviated(Number(snapshot?.gmv_per_customer_max || 0), false)}
                  </strong>
                </div>
              )}
              <div>
                Avg Komisi: <strong className="text-slate-900">{snapshot?.avg_commission_rate ?? 0}%</strong>
              </div>
              <div className="pt-0.5 border-t border-slate-100 flex items-center gap-1.5 text-[10px]">
                <span>Produk: <strong>{snapshot?.products_promoted_count || 0}</strong></span>
                <span>•</span>
                <span>Collab: <strong>{snapshot?.brand_collaborations_count || 0}</strong></span>
              </div>
            </>
          ) : (
            <span className="text-slate-400 italic text-[11px]">-</span>
          )}
        </td>
        {/* Kolom Staging 2: Performa Video & LIVE */}
        <td className="min-w-[195px] text-[11px] space-y-1.5">
          {snapshot?.videos_count_30d != null || snapshot?.avg_video_views != null || snapshot?.live_streams_count_30d != null || snapshot?.avg_live_views != null ? (
            <>
              <div className="bg-blue-50/60 border border-blue-100 rounded-md p-1.5 space-y-0.5">
                <div className="font-bold text-blue-800 flex items-center gap-1 text-[10px]">
                  <Video className="w-3 h-3" />
                  <span>Video ({snapshot?.videos_count_30d || 0} VT)</span>
                </div>
                <div className="text-slate-700 text-[10px]">
                  Views: <strong>{formatAbbreviated(Number(snapshot?.avg_video_views || 0), false)}</strong> • ER: <strong>{snapshot?.avg_video_engagement_rate ?? 0}%</strong>
                </div>
                <div className="text-slate-600 text-[10px]">
                  GPM: <strong>{Number(snapshot?.video_gpm || 0) > 0 ? formatAbbreviated(Number(snapshot.video_gpm), true) : '-'}</strong>
                </div>
              </div>
              <div className="bg-rose-50/60 border border-rose-100 rounded-md p-1.5 space-y-0.5">
                <div className="font-bold text-rose-800 flex items-center gap-1 text-[10px]">
                  <Radio className="w-3 h-3" />
                  <span>LIVE ({snapshot?.live_streams_count_30d || 0} Sesi)</span>
                </div>
                <div className="text-slate-700 text-[10px]">
                  Views: <strong>{formatAbbreviated(Number(snapshot?.avg_live_views || 0), false)}</strong> • ER: <strong>{snapshot?.avg_live_engagement_rate ?? 0}%</strong>
                </div>
                <div className="text-slate-600 text-[10px]">
                  GPM: <strong>{Number(snapshot?.live_gpm || 0) > 0 ? formatAbbreviated(Number(snapshot.live_gpm), true) : '-'}</strong>
                </div>
              </div>
            </>
          ) : (
            <span className="text-slate-400 italic text-[11px]">-</span>
          )}
        </td>
        {/* Kolom Staging 3: Demografi & Top 5 Lokasi */}
        <td className="min-w-[220px] text-[11px] space-y-1.5">
          {(() => {
            const topLocs: Array<{ loc: string; pct: number }> = Array.isArray(snapshot?.top_locations)
              ? snapshot.top_locations
              : typeof snapshot?.top_locations === 'string'
              ? (() => {
                  try {
                    return JSON.parse(snapshot.top_locations);
                  } catch {
                    return [];
                  }
                })()
              : [];
            const hasDemo = snapshot?.audience_female_pct != null || snapshot?.audience_male_pct != null || snapshot?.audience_age || topLocs.length > 0;
            if (!hasDemo) return <span className="text-slate-400 italic text-[11px]">-</span>;
            return (
              <>
                <div className="flex flex-wrap items-center gap-1">
                  {snapshot?.audience_female_pct != null && (
                    <span className="px-1.5 py-0.5 bg-pink-50 text-pink-700 border border-pink-200 rounded text-[10px] font-semibold">
                      👩 {snapshot.audience_female_pct}%
                    </span>
                  )}
                  {snapshot?.audience_male_pct != null && (
                    <span className="px-1.5 py-0.5 bg-sky-50 text-sky-700 border border-sky-200 rounded text-[10px] font-semibold">
                      👨 {snapshot.audience_male_pct}%
                    </span>
                  )}
                  {snapshot?.audience_age && (
                    <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-semibold">
                      🎂 {snapshot.audience_age}
                    </span>
                  )}
                </div>
                {topLocs.length > 0 && (
                  <div className="space-y-0.5">
                    <div className="text-[9px] font-semibold text-slate-400 uppercase flex items-center gap-0.5">
                      <MapPin className="w-2.5 h-2.5" />
                      <span>Top 5 Lokasi</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {topLocs.slice(0, 5).map((item, idx) => (
                        <span
                          key={idx}
                          className="px-1.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded text-[9px] font-semibold"
                        >
                          {item.loc} {item.pct}%
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </td>
        <td className="text-right">
          {hasAccess ? (
            <div className="flex justify-end items-center gap-[4px] transition-opacity">
              {onGenerateContract && (
                <button
                  type="button"
                  onClick={() => onGenerateContract(cc)}
                  className="p-[6px] hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 rounded transition-colors"
                  title="Generate Surat Kontrak Kreator (PDF)"
                >
                  <FileText className="w-4 h-4" />
                </button>
              )}
              <button onClick={() => handleDeleteCreator(cc.id)} className="p-[6px] hover:bg-red-50 rounded" title="Hapus Creator">
                <Trash2 className="w-4 h-4 text-text-soft hover:text-red-600" />
              </button>
            </div>
          ) : null}
        </td>
    </tr>
      {/* Expandable Video Row */}
      {isExpanded && (
        <tr className="bg-slate-50 hover:bg-slate-50">
          <td></td>
          <td></td>
          <td colSpan={9} className="p-0 border-b-0">
            <div className="py-[16px] pr-[16px]">
              <div className="bg-white border border-line rounded-[12px] p-[16px]">
                <div className="flex items-center justify-between mb-[12px]">
                  <h4 className="text-[12px] font-bold text-text-soft uppercase">Daftar Video ({cc.qty_vt})</h4>
                  {hasAccess && addEmptyVideoRow && (
                    <button 
                      onClick={() => addEmptyVideoRow(cc.id)}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                    >
                      + Tambah Slot Manual
                    </button>
                  )}
                </div>
                {paddedVideos.length > 0 ? (
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="text-text-soft border-b border-line">
                        <th className="font-semibold text-left pb-[8px] w-10">#</th>
                        <th className="font-semibold text-left pb-[8px]">Konsep</th>
                        <th className="font-semibold text-left pb-[8px]">Link Video</th>
                        <th className="font-semibold text-left pb-[8px] w-32">VT Approval</th>
                        <th className="font-semibold text-left pb-[8px] min-w-[200px]">Notes Revisi</th>
                        <th className="font-semibold text-left pb-[8px] w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {paddedVideos.map((v: any) => {
                        const isPhantom = typeof v.id === 'string' && v.id.startsWith('phantom_');
                        const conceptNum = parseInt(v.concept);
                        const matchedConcept = !isNaN(conceptNum) ? masterConcepts.find((c: any) => c.no_konsep === conceptNum) : null;
                        const isConceptError = v.concept && !matchedConcept && masterConcepts.length > 0;

                        return (
                        <tr key={v.id} className="border-b border-line last:border-0 align-top">
                          <td className="py-[12px]">{v.urutan}</td>
                          <td className="py-[12px]">
                            <div className="flex flex-col gap-1.5 pr-4 min-w-[220px] max-w-[320px]">
                              {masterConcepts.length === 0 ? (
                                <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px] leading-tight flex items-start gap-1.5 shadow-sm">
                                  <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                                  <div className="flex flex-col gap-0.5">
                                    <span className="font-medium">Belum ada konsep di master konsep campaign ini.</span>
                                    <Link 
                                      href={`/campaigns/${cc.campaign_id}/concepts`}
                                      className="text-indigo-600 font-bold hover:underline inline-flex items-center gap-1"
                                    >
                                      + Tambah di Menu Konsep
                                    </Link>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  <div className="relative flex-1">
                                    <select
                                      className={`select select-sm w-full text-[12px] font-medium rounded-lg border shadow-sm transition-all focus:ring-1 ${
                                        isConceptError 
                                          ? 'border-red-400 bg-red-50 text-red-900 focus:ring-red-400' 
                                          : matchedConcept 
                                            ? 'border-indigo-200 bg-indigo-50/50 text-slate-800 focus:border-indigo-400 focus:ring-indigo-400' 
                                            : 'border-slate-200 bg-white text-slate-600 focus:border-slate-400'
                                      }`}
                                      value={v.concept || ''}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        if (hasAccess && val !== (v.concept || '')) {
                                          if (isPhantom) {
                                            if (addAndSetVideoField) addAndSetVideoField(cc.id, v.urutan, { concept: val });
                                          } else {
                                            if (updateVideoField) updateVideoField(v.id, cc.id, { concept: val });
                                          }
                                        }
                                      }}
                                      disabled={!hasAccess || v.vt_approval === 'approved'}
                                    >
                                      <option value="">- (Belum Dipilih)</option>
                                      {v.concept && !matchedConcept && (
                                        <option value={v.concept}>
                                          [Custom] {v.concept}
                                        </option>
                                      )}
                                      {[...masterConcepts]
                                        .sort((a: any, b: any) => (Number(a.no_konsep) || 0) - (Number(b.no_konsep) || 0))
                                        .map((c: any) => {
                                          const sku = (campaignSkus || []).find((s: any) => s.id === c.sku_id);
                                          const productLabel = sku?.nama_produk || 'Semua Produk';
                                          const optionLabel = `No. ${c.no_konsep} - ${productLabel} - ${c.judul_konsep || 'Tanpa Judul'}`;
                                          return (
                                            <option key={c.id || c.no_konsep} value={String(c.no_konsep)}>
                                              {optionLabel}
                                            </option>
                                          );
                                        })}
                                    </select>
                                  </div>

                                  {matchedConcept && (
                                    <button
                                      type="button"
                                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg border border-slate-200 hover:border-indigo-200 transition-colors shrink-0 shadow-sm"
                                      onClick={() => setSelectedConcept(matchedConcept)}
                                      title="Lihat Detail Brief Konsep"
                                    >
                                      <Info className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              )}

                              {isConceptError && (
                                <p className="text-[10px] text-red-500 font-medium leading-tight">
                                  Konsep belum ada di master konsep campaign ini.
                                </p>
                              )}

                              {v.concept && v.concept_updated_at && v.concept_updated_by ? (
                                <p className="text-[9px] text-slate-400 leading-tight">
                                  Diinput pd {formatDateTimeShort(v.concept_updated_at)} <br/>
                                  Oleh: <span className="font-medium text-slate-500">{v.concept_updated_by}</span>
                                </p>
                              ) : null}
                            </div>
                          </td>
                          <td className="py-[12px]">
                            <div className="flex flex-col gap-3 pr-4">
                              <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Link Draft Video</label>
                                <div className="flex items-center gap-2">
                                  {v.link_draft && extractGDriveId(v.link_draft) && (
                                    <button
                                      type="button"
                                      onClick={() => setPlayingDriveId(extractGDriveId(v.link_draft))}
                                      className="text-p300 hover:text-p400 shrink-0 hover:scale-110 transition-transform"
                                      title="Putar Video Draft"
                                    >
                                      <PlayCircle className="w-5 h-5" />
                                    </button>
                                  )}
                                  <div className="flex-1">
                                    {hasAccess && v.vt_approval !== 'approved' ? (
                                      <>
                                        <input 
                                          type="text" 
                                          className="input w-full !text-[12px] !p-1.5"
                                          placeholder="Tempel link GDrive..."
                                          defaultValue={v.link_draft || ''}
                                          onBlur={(e) => {
                                            const val = e.target.value.trim();
                                            if (val !== (v.link_draft || '')) {
                                              const payload = { 
                                                link_draft: val,
                                                link_draft_updated_by: profile?.nama || 'User',
                                                link_draft_updated_at: new Date().toISOString()
                                              };
                                              if (isPhantom) {
                                                if (addAndSetVideoField) addAndSetVideoField(cc.id, v.urutan, payload);
                                              } else {
                                                if (updateVideoField) updateVideoField(v.id, cc.id, payload);
                                              }
                                            }
                                          }}
                                          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                                        />
                                        {v.link_draft && v.link_draft.trim() !== '' && (
                                          <p className="text-[9px] text-slate-400 leading-tight mt-1">
                                            {v.link_draft_updated_by && <>Diinput oleh: <span className="font-medium text-slate-500">{v.link_draft_updated_by}</span></>}
                                            {v.link_draft_updated_at && (
                                              <> {v.link_draft_updated_by ? '• ' : 'Diinput pd '}<span>{formatDateTimeShort(v.link_draft_updated_at)}</span></>
                                            )}
                                          </p>
                                        )}
                                      </>
                                    ) : (
                                      v.link_draft ? (
                                        <div>
                                          <a href={v.link_draft} target="_blank" rel="noreferrer" className="text-[12px] text-p300 hover:underline break-all">
                                            {v.link_draft}
                                          </a>
                                          {(v.link_draft_updated_by || v.link_draft_updated_at) && (
                                            <p className="text-[9px] text-slate-400 leading-tight mt-1">
                                              {v.link_draft_updated_by && <>Diinput oleh: <span className="font-medium text-slate-500">{v.link_draft_updated_by}</span></>}
                                              {v.link_draft_updated_at && (
                                                <> {v.link_draft_updated_by ? '• ' : 'Diinput pd '}<span>{formatDateTimeShort(v.link_draft_updated_at)}</span></>
                                              )}
                                            </p>
                                          )}
                                        </div>
                                      ) : <span className="text-slate-300">-</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Link Final (TikTok)</label>
                                {v.link_video ? (
                                  <a href={v.link_video} target="_blank" rel="noreferrer" className="text-[12px] text-p300 hover:underline break-all">
                                    {v.link_video}
                                  </a>
                                ) : <span className="text-slate-300">-</span>}
                              </div>
                            </div>
                          </td>
                          <td className="py-[12px]">
                            {canManageRevisionNotes ? (
                              <div className="flex flex-col gap-1 pr-2">
                                <select 
                                  className={`select !p-1.5 w-[110px] font-semibold !text-[12px] ${v.vt_approval === 'approved' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : v.vt_approval === 'revisi' ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-slate-600'}`}
                                  value={v.vt_approval || 'pending'}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    if (isPhantom) {
                                      if (addAndSetVideoField) addAndSetVideoField(cc.id, v.urutan, { vt_approval: val, vt_approved_by: profile?.nama, vt_approved_at: new Date().toISOString() });
                                    } else {
                                      if (updateVideoField) updateVideoField(v.id, cc.id, { vt_approval: val, vt_approved_by: profile?.nama, vt_approved_at: new Date().toISOString() });
                                    }
                                    if (val === 'revisi') {
                                      handleOpenRevisionModal(v);
                                    }
                                  }}
                                >
                                  <option value="pending">Pending</option>
                                  <option value="approved">Approved</option>
                                  <option value="revisi">Revisi</option>
                                </select>
                                {v.vt_approved_by && (
                                  <p className="text-[9px] text-slate-400 leading-tight">
                                    Oleh: {v.vt_approved_by}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <div className="flex flex-col gap-1">
                                <span className={`badge ${v.vt_approval === 'approved' ? 'b-success' : v.vt_approval === 'revisi' ? 'b-warning' : 'b-neutral'}`}>
                                  {v.vt_approval || 'pending'}
                                </span>
                                {v.vt_approved_by && (
                                  <span className="text-[9px] text-slate-400">Oleh: {v.vt_approved_by}</span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="py-[12px] align-top">
                            {(() => {
                              const revNote = revisionNotes[`${cc.id}_${v.urutan}`];
                              const noteContent = revNote?.isi || revNote?.notes || v.revision_notes || '';
                              const noteAuthor = revNote?.author_name || revNote?.updated_by || v.revision_notes_updated_by || 'Manager';
                              const noteDate = revNote?.updated_at || revNote?.created_at || v.revision_notes_updated_at;
                              const isRevisiStatus = v.vt_approval === 'revisi';

                              if (noteContent && noteContent.trim() !== '') {
                                return (
                                  <div className={`p-2 rounded-lg border text-xs shadow-sm transition-all max-w-[260px] ${
                                    isRevisiStatus 
                                      ? 'bg-rose-50/80 border-rose-200 text-rose-950' 
                                      : 'bg-amber-50/60 border-amber-200 text-slate-800'
                                  }`}>
                                    <div className="flex items-start justify-between gap-1 mb-0.5">
                                      <span className={`text-[9px] font-bold uppercase tracking-wider ${
                                        isRevisiStatus ? 'text-rose-700' : 'text-amber-700'
                                      }`}>
                                        {isRevisiStatus ? 'Catatan Revisi' : 'Riwayat Revisi'}
                                      </span>
                                      {canManageRevisionNotes && (
                                        <button
                                          type="button"
                                          onClick={() => handleOpenRevisionModal(v)}
                                          className="text-slate-400 hover:text-slate-700 p-0.5 hover:bg-white/80 rounded transition-colors"
                                          title="Edit Catatan Revisi (Manager / Eksekutif)"
                                        >
                                          <Edit2 className="w-3 h-3" />
                                        </button>
                                      )}
                                    </div>
                                    <p className="whitespace-pre-wrap text-[11px] leading-relaxed break-words font-medium">
                                      {noteContent}
                                    </p>
                                    {(noteAuthor || noteDate) && (
                                      <div className="text-[9px] text-slate-500 mt-1 pt-1 border-t border-slate-200/60 flex items-center justify-between">
                                        <span>Oleh: <strong className="text-slate-700">{noteAuthor}</strong></span>
                                        {noteDate && <span>{formatDateTimeShort(noteDate)}</span>}
                                      </div>
                                    )}
                                  </div>
                                );
                              }

                              if (isRevisiStatus) {
                                return (
                                  <div>
                                    {canManageRevisionNotes ? (
                                      <button
                                        type="button"
                                        onClick={() => handleOpenRevisionModal(v)}
                                        className="inline-flex items-center gap-1 px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-semibold rounded-md border border-rose-200 transition-colors shadow-sm"
                                      >
                                        <Plus className="w-3 h-3" />
                                        <span>Tulis Catatan</span>
                                      </button>
                                    ) : (
                                      <span className="text-[11px] text-rose-600 italic">Menunggu catatan revisi manager</span>
                                    )}
                                  </div>
                                );
                              }

                              return (
                                <div className="flex items-center gap-1">
                                  <span className="text-slate-300 text-xs italic">-</span>
                                  {canManageRevisionNotes && (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenRevisionModal(v)}
                                      className="text-slate-300 hover:text-slate-600 p-0.5 hover:bg-slate-100 rounded transition-colors"
                                      title="Tambah Catatan Revisi"
                                    >
                                      <Plus className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              );
                            })()}
                          </td>
                          <td className="py-[12px] text-right pr-2">
                            {hasAccess && deleteVideoRow && v.urutan > (cc.qty_vt || 0) && (
                              <button 
                                onClick={() => deleteVideoRow(cc.id, v.id)}
                                className="p-1 hover:bg-red-50 rounded text-slate-300 hover:text-red-500 transition-colors"
                                title="Hapus slot video manual ini"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      )})}
                    </tbody>
                  </table>
                  ) : (
                  <div className="flex flex-col items-center justify-center py-[24px] gap-3">
                    <div className="text-text-soft text-[13px]">
                      Belum ada data slot video untuk kreator ini.
                    </div>
                    {hasAccess && addEmptyVideoRow && (
                      <button 
                        onClick={() => addEmptyVideoRow(cc.id)}
                        className="btn btn-outline border-indigo-200 text-indigo-700 hover:bg-indigo-50 text-xs px-3 py-1"
                      >
                        + Tambah Slot Konsep
                      </button>
                    )}
                  </div>
                )}
                  <div className="mt-[24px] pt-[16px] border-t border-line">
                    <h4 className="text-[12px] font-bold text-text-soft uppercase mb-[12px]">Detail & Catatan Kreator</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-[16px]">
                      <div className="bg-slate-50 border border-line rounded-[8px] p-[12px]">
                        <h5 className="text-[11px] font-bold text-text-soft uppercase mb-[4px]">Status Pembayaran</h5>
                        <p className="text-[13px] font-semibold text-text capitalize">{cc.status_bayar || '-'}</p>
                        {activeEditingField !== null && <p className="text-[10px] text-text-soft italic mt-1">Dikelola via Tab Keuangan</p>}
                      </div>
                      <div className="bg-slate-50 border border-line rounded-[8px] p-[12px]">
                        <h5 className="text-[11px] font-bold text-text-soft uppercase mb-[4px]">Progress Sample</h5>
                        {hasAccess ? (
                          <select 
                            value={cc.sample_progress || 'Done Req Sample'} 
                            onChange={async (e) => {
                              await updateCampaignCreator(cc.id, { sample_progress: e.target.value }, profile?.nama || 'System');
                              fetchListing(page, true);
                            }} 
                            className="select !p-[4px]"
                          >
                            <option value="Done Req Sample">Done Req Sample</option>
                            <option value="Sudah Proses Pengiriman">Sudah Proses Pengiriman</option>
                            <option value="Sampai">Sampai</option>
                            <option value="Kendala [FU!]">Kendala [FU!]</option>
                          </select>
                        ) : (
                          <span className={`badge ${
                            cc.sample_progress === 'Sampai' ? 'b-success' : 
                            cc.sample_progress === 'Kendala [FU!]' ? 'b-destructive' : 
                            cc.sample_progress === 'Sudah Proses Pengiriman' ? 'b-warning' : 'b-neutral'
                          }`}>
                            {cc.sample_progress || '-'}
                          </span>
                        )}
                      </div>
                      <div className="bg-slate-50 border border-line rounded-[8px] p-[12px] md:col-span-2">
                        <NotesTimeline 
                          title="Notes Manager" 
                          rawNotes={cc.notes_manager} 
                          hasAccess={hasAccess}
                          onSave={async (val) => {
                            await updateCampaignCreator(cc.id, { notes_manager: val }, profile?.nama || 'System');
                            fetchListing(page, true); // reload to show changes
                          }}
                        />
                      </div>
                      <div className="bg-slate-50 border border-line rounded-[8px] p-[12px] md:col-span-4">
                        <NotesTimeline 
                          title={`Notes PIC (${cc.pic_assist || 'Belum di-assign'})`} 
                          rawNotes={cc.notes_pic} 
                          hasAccess={hasAccess}
                          onSave={async (val) => {
                            await updateCampaignCreator(cc.id, { notes_pic: val }, profile?.nama || 'System');
                            fetchListing(page, true);
                          }}
                        />
                      </div>
                      <div className="bg-slate-50 border border-line rounded-[8px] p-[12px] md:col-span-4">
                        <h5 className="text-[11px] font-bold text-text-soft uppercase mb-[8px]">Informasi Tracking</h5>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-[8px] text-[12px]">
                          <div>
                            <span className="text-text-soft block mb-[2px]">Ditambahkan Oleh:</span>
                            <span className="font-semibold text-text">
                              {staffProfiles.find((p: any) => p.id === cc.added_by)?.nama || cc.added_by_profile?.nama || 'Unknown'}
                              {cc.created_at && <span className="text-text-soft font-normal ml-1">({formatDateTimeShort(cc.created_at)})</span>}
                            </span>
                          </div>
                          {cc.approval === 'approved' && (cc.approved_by || cc.approved_by_profile) && (
                            <div>
                              <span className="text-text-soft block mb-[2px]">Di-approve Oleh:</span>
                              <span className="font-semibold text-green-600">
                                {staffProfiles.find((p: any) => p.id === cc.approved_by)?.nama || cc.approved_by_profile?.nama || '-'} 
                                {cc.approved_at && <span className="text-text-soft ml-[4px] font-normal">({formatDateTimeShort(cc.approved_at)})</span>}
                              </span>
                            </div>
                          )}
                          {(cc.approval === 'not_approved' || cc.approval === 'alternate') && (cc.not_approved_by || cc.not_approved_by_profile) && (
                            <div>
                              <span className="text-text-soft block mb-[2px]">{cc.approval === 'alternate' ? 'Alternate Oleh:' : 'Ditolak Oleh:'}</span>
                              <span className="font-semibold text-red-600">
                                {staffProfiles.find((p: any) => p.id === cc.not_approved_by)?.nama || cc.not_approved_by_profile?.nama || '-'} 
                                {cc.not_approved_at && <span className="text-text-soft ml-[4px] font-normal">({formatDateTimeShort(cc.not_approved_at)})</span>}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
            </div>
          </td>
        </tr>
      )}

      {/* Modal Brief Konsep */}
      {selectedConcept && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-line">
            <div className="sticky top-0 bg-white border-b border-line px-6 py-4 flex items-center justify-between z-10">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Brief Konsep #{selectedConcept.no_konsep}</h3>
                <p className="text-sm text-slate-500">{selectedConcept.judul_konsep}</p>
              </div>
              <button 
                onClick={() => setSelectedConcept(null)}
                className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full transition-colors"
              >
                Tutup
              </button>
            </div>
            <div className="p-6">
              <table className="w-full text-sm text-left border border-line rounded-lg overflow-hidden">
                <tbody className="divide-y divide-line">
                  <tr className="bg-slate-50"><th className="px-4 py-3 w-1/4 font-semibold text-slate-600">Product</th><td className="px-4 py-3 bg-white">{campaignSkus.find(s => s.id === selectedConcept.sku_id)?.nama_produk || '-'}</td></tr>
                  <tr className="bg-slate-50"><th className="px-4 py-3 font-semibold text-slate-600">Tier</th><td className="px-4 py-3 bg-white"><span className="badge b-neutral">{selectedConcept.tier || '-'}</span></td></tr>
                  <tr className="bg-slate-50"><th className="px-4 py-3 font-semibold text-slate-600">Hook</th><td className="px-4 py-3 bg-white whitespace-pre-wrap">{selectedConcept.hook || '-'}</td></tr>
                  <tr className="bg-slate-50"><th className="px-4 py-3 font-semibold text-slate-600">Fitur / USP</th><td className="px-4 py-3 bg-white whitespace-pre-wrap">{selectedConcept.fitur_usp || '-'}</td></tr>
                  <tr className="bg-slate-50"><th className="px-4 py-3 font-semibold text-slate-600">CTA</th><td className="px-4 py-3 bg-white whitespace-pre-wrap">{selectedConcept.cta || '-'}</td></tr>
                  <tr className="bg-slate-50">
                    <th className="px-4 py-3 font-semibold text-slate-600">Status Approval Manager</th>
                    <td className="px-4 py-3 bg-white">
                      <span className={`badge ${selectedConcept.status_approval === 'approved' ? 'b-success' : selectedConcept.status_approval === 'revisi' ? 'b-warning' : 'b-neutral'}`}>
                        {selectedConcept.status_approval || 'pending'}
                      </span>
                    </td>
                  </tr>
                  <tr className="bg-slate-50">
                    <th className="px-4 py-3 font-semibold text-slate-600">Notes Revisi</th>
                    <td className="px-4 py-3 bg-white">
                      {selectedConcept.notes ? (
                        <div className="whitespace-pre-wrap text-red-600 italic text-sm">{selectedConcept.notes}</div>
                      ) : <span className="text-slate-400">-</span>}
                    </td>
                  </tr>
                </tbody>
              </table>
              <div className="mt-6 flex justify-end">
                <button 
                  onClick={() => setSelectedConcept(null)}
                  className="btn btn-primary"
                >
                  Mengerti & Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Video Player (GDrive) */}
      {playingDriveId && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
          <div className="bg-black rounded-xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col relative border border-slate-700">
            <div className="absolute -top-12 right-0 flex items-center gap-2">
              <a 
                href={`https://drive.google.com/file/d/${playingDriveId}/view`}
                target="_blank"
                rel="noreferrer"
                className="text-white/70 hover:text-white hover:bg-white/10 px-4 py-2 rounded-full transition-colors text-sm font-medium border border-white/20"
              >
                Buka di Tab Baru
              </a>
              <button 
                onClick={() => setPlayingDriveId(null)}
                className="text-white/70 hover:text-white hover:bg-white/10 px-4 py-2 rounded-full transition-colors flex items-center gap-2 text-sm font-medium border border-white/20"
              >
                Tutup <span className="text-xl leading-none">&times;</span>
              </button>
            </div>
            <div className="flex-1 w-full h-full rounded-xl overflow-hidden bg-black flex items-center justify-center relative">
              <iframe 
                src={`https://drive.google.com/file/d/${playingDriveId}/preview`} 
                className="absolute inset-0 w-full h-full border-0 bg-transparent"
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
                referrerPolicy="no-referrer"
                title="Google Drive Video Player"
              ></iframe>
            </div>
          </div>
        </div>
      )}

      {/* Revision Note Modal for CreatorRow */}
      <Dialog open={revisionModalState.open} onOpenChange={(open) => setRevisionModalState(prev => ({ ...prev, open }))}>
        <DialogContent className="max-w-[460px] p-6 bg-white rounded-2xl shadow-2xl border border-slate-100">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                <RotateCw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-base">Catatan Revisi Draft Video</h3>
                <p className="text-xs text-slate-500">
                  Kreator: <strong className="text-indigo-600">@{creator?.username}</strong> (Slot #{revisionModalState.video?.urutan})
                </p>
              </div>
            </div>
            <button 
              onClick={() => setRevisionModalState(prev => ({ ...prev, open: false }))}
              className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="py-4 space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Isi Catatan / Feedback Revisi:
              </label>
              <textarea
                rows={4}
                value={revisionModalState.noteText}
                onChange={(e) => setRevisionModalState(prev => ({ ...prev, noteText: e.target.value }))}
                placeholder="Tuliskan poin-poin yang perlu direvisi oleh kreator / PIC..."
                className="input w-full !p-3 text-sm resize-y min-h-[100px] border border-slate-200 focus:border-rose-400 focus:ring-1 focus:ring-rose-400"
                autoFocus
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Catatan ini akan tetap tersimpan ke database VPS dan dapat dilihat meskipun status video nantinya diubah menjadi Approved.
              </p>
            </div>

            {revisionModalState.isSaving && (
              <div className="flex items-center gap-2.5 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold animate-pulse shadow-sm">
                <Loader2 className="w-4 h-4 animate-spin text-rose-600 shrink-0" />
                <span>Sedang menyimpan catatan ke database VPS... Mohon tunggu sebentar.</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setRevisionModalState(prev => ({ ...prev, open: false }))}
              className="btn btn-outline text-xs px-4 py-2"
              disabled={revisionModalState.isSaving}
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSaveModalRevisionNote}
              className="btn bg-rose-600 hover:bg-rose-700 text-white text-xs px-4 py-2 flex items-center gap-1.5 shadow-sm"
              disabled={revisionModalState.isSaving}
            >
              {revisionModalState.isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Menyimpan ke database...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Simpan Catatan</span>
                </>
              )}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </React.Fragment>
  );
}, areEqual);
