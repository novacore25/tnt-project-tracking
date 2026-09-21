"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { useDatabaseStore } from "@/store/useDatabaseStore";
import { CreatorAddress } from "@/types/database";
import { Download, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { exportToCSV } from "@/utils/exportCsv";
import { useAuth } from "@/providers/AuthProvider";
import { MultiSelect } from "@/components/MultiSelect";
import { useCampaignFilter } from "@/providers/CampaignFilterProvider";
import { 
  fetchCampaignCreatorsForAddressAction,
  fetchCreatorAddressBookAction,
  saveAddressDetailsAction,
  syncMissingCampaignAddressesAction
} from "@/app/actions/addressActions";

const PAGE_SIZE = 50;

export default function AlamatPage() {
  const { id } = useParams();
  const campaignId = Number(id);
  const { isCreatorVisible } = useCampaignFilter();

  const {
    creator_addresses,
    fetchCreatorAddresses,
    isLoading,
    campaigns,
    skus
  } = useDatabaseStore();

  const campaign = campaigns.find(c => c.id === campaignId);
  const campaignSkus = skus.filter(s => s.campaign_id === campaignId);

  const { canEditCampaign } = useAuth();
  const hasAccess = canEditCampaign(campaignId);

  const [editId, setEditId] = useState<number | null>(null);
  const [formData, setFormData] = useState<Partial<CreatorAddress>>({});
  const [editWhatsapp, setEditWhatsapp] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [localCreators, setLocalCreators] = useState<any[]>([]);
  const [isFetchingCC, setIsFetchingCC] = useState(true);
  const [sortConfig, setSortConfig] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'id', dir: 'desc' });
  const [currentPage, setCurrentPage] = useState(0);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const hasSyncedRef = useRef(new Set<number>());

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const toggleSort = (key: string) => {
    setSortConfig(prev => prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' });
  };

  const SortIcon = ({ col }: { col: string }) => {
    if (sortConfig.key !== col) return <ArrowUpDown className="w-3 h-3 ml-1 text-slate-400" />;
    return sortConfig.dir === 'asc' ? <ArrowUp className="w-3 h-3 ml-1 text-blue-500" /> : <ArrowDown className="w-3 h-3 ml-1 text-blue-500" />;
  };

  // Address Book state
  const [addressBook, setAddressBook] = useState<any[]>([]);
  const [selectedBookId, setSelectedBookId] = useState<string>('');

  const loadData = useCallback(async () => {
    if (!campaignId) return;
    setIsFetchingCC(true);
    try {
      const ccs = await fetchCampaignCreatorsForAddressAction(campaignId, campaign?.require_client_approval);
      setLocalCreators(ccs);
      await fetchCreatorAddresses(campaignId);
    } catch (err) {
      console.error('Error fetching campaign creators for address:', err);
    } finally {
      setIsFetchingCC(false);
    }
  }, [campaignId, campaign?.require_client_approval, fetchCreatorAddresses]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-sync missing addresses from profile
  useEffect(() => {
    if (isFetchingCC || isLoading || localCreators.length === 0 || !campaignId) return;
    if (hasSyncedRef.current.has(campaignId)) return;
    
    const autoSync = async () => {
      hasSyncedRef.current.add(campaignId);
      try {
        const res = await syncMissingCampaignAddressesAction(campaignId);
        if (res.inserted > 0) {
          await fetchCreatorAddresses(campaignId);
        }
      } catch (err) {
        console.error("Auto sync failed", err);
      }
    };
    
    autoSync();
  }, [isFetchingCC, isLoading, localCreators, campaignId, fetchCreatorAddresses]);

  // Memoize address lookup map for O(1) access instead of O(n) per row
  const addressMap = useMemo(() => {
    const map = new Map<number, typeof creator_addresses[0]>();
    creator_addresses.forEach(a => map.set(a.campaign_creator_id, a));
    return map;
  }, [creator_addresses]);

  const approvedCCs = useMemo(() => {
    const filtered = localCreators.filter(cc => {
      if (!isCreatorVisible(cc.creators?.username)) return false;
      if (debouncedSearch) {
        if (!cc.creators?.username.toLowerCase().includes(debouncedSearch.toLowerCase())) return false;
      }
      return true;
    });

    filtered.sort((a: any, b: any) => {
      const dir = sortConfig.dir === 'asc' ? 1 : -1;
      if (sortConfig.key === 'username') {
        return (a.creators?.username || '').localeCompare(b.creators?.username || '') * dir;
      }
      if (sortConfig.key === 'status') {
        const addrA = addressMap.get(a.id)?.proses || '';
        const addrB = addressMap.get(b.id)?.proses || '';
        return addrA.localeCompare(addrB) * dir;
      }
      if (sortConfig.key === 'id') {
        const idA = addressMap.get(a.id)?.id || a.id;
        const idB = addressMap.get(b.id)?.id || b.id;
        return (idA - idB) * dir;
      }
      return 0;
    });

    return filtered;
  }, [localCreators, debouncedSearch, sortConfig, addressMap, isCreatorVisible]);

  const totalPages = Math.ceil(approvedCCs.length / PAGE_SIZE);
  const paginatedCCs = useMemo(() => {
    const start = currentPage * PAGE_SIZE;
    return approvedCCs.slice(start, start + PAGE_SIZE);
  }, [approvedCCs, currentPage]);

  const handleExport = () => {
    const exportData = approvedCCs.map((cc, idx) => {
      const addr = addressMap.get(cc.id);
      const contacts = Array.isArray(cc.creators?.creator_contacts) ? cc.creators.creator_contacts : (cc.creators?.creator_contacts ? [cc.creators.creator_contacts] : []);
      const activeContact = contacts.find((c: any) => c.status === 'aktif') || contacts[0];
      const noWhatsapp = activeContact?.nomor || '';

      const skuNames = (cc.assigned_sku_ids || []).map((id: number) => {
        const sku = campaignSkus.find(s => s.id === id);
        return sku ? sku.nama_produk : '';
      }).filter(Boolean).join(', ');

      return {
        'No': idx + 1,
        'Product': skuNames || '',
        'Username': cc.creators?.username,
        'No Whatsapp': noWhatsapp,
        'Nama Penerima': addr?.nama_penerima || '',
        'Nama Jalan': addr?.nama_jalan || '',
        'Provinsi': addr?.provinsi || '',
        'Kabupaten/Kota': addr?.kabupaten_kota || '',
        'Kecamatan': addr?.kecamatan || '',
        'Kelurahan': addr?.kelurahan || '',
        'Kode Pos': addr?.kode_pos || '',
        'Proses': addr?.proses || 'Diproses',
        'Tanggal Kirim': addr?.tanggal_kirim || '',
        'Resi': addr?.resi || '',
        'Ekspedisi': addr?.ekspedisi || '',
        'Notes': addr?.notes || '',
        'Status': cc.approval || 'pending',
      };
    });
    exportToCSV(exportData, `campaign_${campaignId}_alamat`);
  };

  const [editAssignedSkus, setEditAssignedSkus] = useState<number[]>([]);
  const { updateCampaignCreator } = useDatabaseStore();

  const handleEdit = async (ccId: number) => {
    // 1. Fetch address book for this creator
    const cc = localCreators.find(c => c.id === ccId);
    const creator = cc?.creators;
    const creatorId = cc?.creator_id;
    if (creatorId) {
      const book = await fetchCreatorAddressBookAction(creatorId);
      setAddressBook(book || []);
    } else {
      setAddressBook([]);
    }
    setSelectedBookId('');

    const existing = addressMap.get(ccId);
    if (existing) {
      setFormData(existing);
      setEditId(existing.id);
    } else {
      // Find creator's master address as fallback if no address book
      
      setFormData({
        campaign_creator_id: ccId,
        nama_penerima: creator?.alamat_penerima || '',
        nama_jalan: creator?.alamat_jalan || '',
        kecamatan: creator?.alamat_kecamatan || '',
        kabupaten_kota: creator?.alamat_kota || '',
        provinsi: creator?.alamat_provinsi || '',
        kode_pos: creator?.alamat_kodepos || '',
        proses: 'Belum diproses'
      });
      setEditId(-ccId); // Temp ID for new records
    }
    setEditAssignedSkus(cc?.assigned_sku_ids || []);

    const contacts = Array.isArray(creator?.creator_contacts) ? creator.creator_contacts : (creator?.creator_contacts ? [creator.creator_contacts] : []);
    const activeContact = contacts.find((c: any) => c.status === 'aktif') || contacts[0];
    setEditWhatsapp(activeContact?.nomor || '');
  };

  const handleSave = async (ccId: number) => {
    setIsSaving(true);
    const existing = addressMap.get(ccId);
    const cc = localCreators.find(c => c.id === ccId);
    
    // Check if anything actually changed before proceeding
    const isSkusChanged = JSON.stringify(cc?.assigned_sku_ids || []) !== JSON.stringify(editAssignedSkus);
    
    let isDataChanged = true;
    if (existing) {
      isDataChanged = (
        (existing.nama_penerima || '') !== (formData.nama_penerima || '') ||
        (existing.nama_jalan || '') !== (formData.nama_jalan || '') ||
        (existing.kecamatan || '') !== (formData.kecamatan || '') ||
        (existing.kelurahan || '') !== (formData.kelurahan || '') ||
        (existing.kabupaten_kota || '') !== (formData.kabupaten_kota || '') ||
        (existing.provinsi || '') !== (formData.provinsi || '') ||
        (existing.kode_pos || '') !== (formData.kode_pos || '') ||
        (existing.proses || '') !== (formData.proses || '') ||
        (existing.resi || '') !== (formData.resi || '') ||
        (existing.ekspedisi || '') !== (formData.ekspedisi || '') ||
        (existing.notes || '') !== (formData.notes || '') ||
        (existing.tanggal_kirim || '') !== (formData.tanggal_kirim || '')
      );
    }
    // Check if WA changed
    let isWaChanged = false;
    let cleanWa = editWhatsapp.replace(/\D/g, '');
    if (cleanWa.startsWith('62')) {
      cleanWa = '0' + cleanWa.substring(2);
    } else if (cleanWa.startsWith('8')) {
      cleanWa = '0' + cleanWa;
    }
    const contacts = Array.isArray(cc?.creators?.creator_contacts) ? cc?.creators.creator_contacts : (cc?.creators?.creator_contacts ? [cc?.creators.creator_contacts] : []);
    const activeContact = contacts.find((c: any) => c.status === 'aktif') || contacts[0];
    if (cleanWa && (!activeContact || activeContact.nomor !== cleanWa)) {
      isWaChanged = true;
    }

    if (!isDataChanged && !isSkusChanged && !isWaChanged) {
      setEditId(null);
      setIsSaving(false);
      return;
    }

    const payload = { ...formData };
    if ((existing?.resi || '') !== (payload.resi || '')) {
      (payload as any).resi_updated_at = new Date().toISOString();
      (payload as any).resi_updated_by = 'Internal TNT';
    }

    try {
      await saveAddressDetailsAction({
        campaignCreatorId: ccId,
        existingAddressId: existing?.id,
        formData: payload,
        assignedSkuIds: isSkusChanged ? editAssignedSkus : undefined,
        whatsapp: isWaChanged ? cleanWa : undefined,
        creatorId: cc?.creator_id,
        saveToBook: Boolean(formData.nama_jalan && !selectedBookId),
        campaignName: campaign?.nama
      });

      // Refresh data
      await loadData();
    } catch (err) {
      console.error('Error saving address:', err);
    } finally {
      setEditId(null);
      setIsSaving(false);
    }
  };

  const handleSelectBook = (bookId: string) => {
    setSelectedBookId(bookId);
    if (!bookId) return;
    const b = addressBook.find(x => x.id.toString() === bookId);
    if (b) {
      setFormData(prev => ({
        ...prev,
        nama_penerima: b.nama_penerima || '',
        nama_jalan: b.alamat_jalan || '',
        kecamatan: b.kecamatan || '',
        kabupaten_kota: b.kota || '',
        provinsi: b.provinsi || '',
        kode_pos: b.kodepos || ''
      }));
    }
  };

  if (isLoading && creator_addresses.length === 0) {
    return <div className="p-8 text-center text-slate-500">Memuat data alamat...</div>;
  }

  return (
    <div className="space-y-[24px] pb-[80px]">
      <div className="ccard !p-0 overflow-hidden">
        <div className="p-[16px] border-b border-line flex flex-col md:flex-row items-start md:items-center justify-between gap-[16px] bg-slate-50">
          <h3 className="font-semibold text-text text-[16px]">Data Alamat Pengiriman Sampel</h3>
          <div className="flex gap-[8px]">
            {hasAccess && (
              <button
                onClick={() => window.open(`/campaigns/${campaignId}/alamat/import`, '_blank')}
                className="btn btn-primary flex items-center gap-[8px] !py-[6px] !text-[13px]"
              >
                Import Massal
              </button>
            )}
            <button
              onClick={handleExport}
              className="btn btn-outline flex items-center gap-[8px] !py-[6px] !text-[13px]"
            >
              <Download className="w-4 h-4" /> Export CSV
            </button>
            <input 
              type="text" 
              placeholder="Cari username..." 
              value={searchQuery} 
              onChange={e => setSearchQuery(e.target.value)} 
              className="input min-w-[200px]"
            />
          </div>
        </div>
        <div className="tbl-wrap !border-0 !rounded-none overflow-x-auto pb-4">
          <table className="w-full whitespace-nowrap text-[13px]">
            <thead className="border-b border-line bg-slate-50">
              <tr>
                <th className="py-[16px] px-3 sticky left-0 z-20 bg-slate-50 min-w-[50px] max-w-[50px]">No</th>
                <th className="py-[16px] px-3 sticky left-[50px] z-20 bg-slate-50 min-w-[150px] max-w-[150px]">Product</th>
                <th className="py-[16px] px-3 sticky left-[200px] z-20 bg-slate-50 min-w-[150px] max-w-[150px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                  <button onClick={() => toggleSort('username')} className="flex items-center font-semibold hover:text-blue-600 transition-colors">
                    Username <SortIcon col="username" />
                  </button>
                </th>
                <th className="py-[16px] px-3">No Whatsapp</th>
                <th className="py-[16px] px-3 min-w-[150px]">Nama Penerima</th>
                <th className="py-[16px] px-3 min-w-[200px]">Nama Jalan</th>
                <th className="py-[16px] px-3">Provinsi</th>
                <th className="py-[16px] px-3">Kabupaten/Kota</th>
                <th className="py-[16px] px-3">Kecamatan</th>
                <th className="py-[16px] px-3">Kelurahan</th>
                <th className="py-[16px] px-3">Kode Pos</th>
                <th className="py-[16px] px-3 min-w-[120px]">
                  <button onClick={() => toggleSort('status')} className="flex items-center font-semibold hover:text-blue-600 transition-colors">
                    Proses <SortIcon col="status" />
                  </button>
                </th>
                <th className="py-[16px] px-3">Tanggal Kirim</th>
                <th className="py-[16px] px-3">Resi</th>
                <th className="py-[16px] px-3">Ekspedisi</th>
                <th className="py-[16px] px-3 min-w-[150px]">Notes</th>
                <th className="py-[16px] px-3">Status</th>
                {hasAccess && <th className="text-center py-[16px] px-3 sticky right-0 bg-slate-50 shadow-[-4px_0_10px_-4px_rgba(0,0,0,0.1)]">Aksi</th>}
              </tr>
            </thead>
            <tbody>
              {approvedCCs.length === 0 ? (
                <tr>
                  <td colSpan={hasAccess ? 17 : 16} className="text-center py-8 text-text-soft">
                    Belum ada kreator yang di-approve di campaign ini.
                  </td>
                </tr>
              ) : (
                paginatedCCs.map((cc, idx) => {
                  const creator = cc.creators;
                  const addr = addressMap.get(cc.id);
                  const isEditing = editId === addr?.id || editId === -cc.id;
                  
                  const contacts = Array.isArray(creator?.creator_contacts) ? creator.creator_contacts : (creator?.creator_contacts ? [creator.creator_contacts] : []);
                  const activeContact = contacts.find((c: any) => c.status === 'aktif') || contacts[0];
                  const noWhatsapp = activeContact?.nomor || '';

                  return (
                    <tr 
                      key={cc.id} 
                      className="border-b border-line hover:bg-slate-50 group cursor-pointer"
                      onClick={() => { if (!isEditing && !isSaving) handleEdit(cc.id); }}
                      onBlur={(e) => {
                        if (isEditing && !e.currentTarget.contains(e.relatedTarget)) {
                          handleSave(cc.id);
                        }
                      }}
                    >
                      <td className="px-3 py-3 text-center sticky left-0 z-10 bg-white group-hover:bg-slate-50 transition-colors min-w-[50px] max-w-[50px]">{currentPage * PAGE_SIZE + idx + 1}</td>
                      <td className="px-3 py-3 whitespace-normal sticky left-[50px] z-10 bg-white group-hover:bg-slate-50 transition-colors min-w-[150px] max-w-[150px]">
                        {isEditing ? (
                          <div className="w-[200px]">
                            <MultiSelect 
                              options={campaignSkus.map(s => ({ id: s.id, label: s.nama_produk }))}
                              selectedIds={editAssignedSkus}
                              onChange={setEditAssignedSkus}
                              placeholder="Pilih Produk..."
                              emptyMessage="Belum ada produk"
                            />
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1 w-[200px]">
                            {cc.assigned_sku_ids && cc.assigned_sku_ids.length > 0 ? (
                              cc.assigned_sku_ids.map((id: number) => {
                                const sku = campaignSkus.find(s => s.id === id);
                                return sku ? <span key={id} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-[11px] px-2 py-0.5 rounded border border-blue-100">{sku.nama_produk}</span> : null;
                              })
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">Belum dipilih</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 font-medium sticky left-[200px] z-10 bg-white group-hover:bg-slate-50 transition-colors min-w-[150px] max-w-[150px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">@{creator?.username}</td>
                      <td className="px-3 py-3">
                        {isEditing ? (
                          <input type="text" className="input w-full w-28 text-xs" value={editWhatsapp} onChange={e => setEditWhatsapp(e.target.value)} placeholder="08..." />
                        ) : (
                          noWhatsapp || '-'
                        )}
                      </td>
                      
                      <td className="px-3 py-3">
                        {isEditing ? (
                          <input type="text" className="input w-full min-w-[150px]" value={formData.nama_penerima || ''} onChange={e => setFormData({ ...formData, nama_penerima: e.target.value })} />
                        ) : (
                          addr?.nama_penerima || '-'
                        )}
                      </td>
                      <td className="px-3 py-3 whitespace-normal">
                        {isEditing ? (
                          <div className="flex flex-col gap-2">
                            {addressBook.length > 0 && (
                              <select 
                                className="input w-full min-w-[200px] bg-blue-50 border-blue-200 text-blue-800 text-[12px] font-semibold"
                                value={selectedBookId}
                                onChange={e => handleSelectBook(e.target.value)}
                              >
                                <option value="">+ Ketik Manual</option>
                                {addressBook.map(b => (
                                  <option key={b.id} value={b.id}>
                                    📖 {b.label || 'Alamat Utama'} ({b.alamat_jalan?.substring(0, 20)}...)
                                  </option>
                                ))}
                              </select>
                            )}
                            <textarea className="input w-full min-w-[200px] h-20" placeholder="Alamat lengkap..." value={formData.nama_jalan || ''} onChange={e => setFormData({ ...formData, nama_jalan: e.target.value })} />
                          </div>
                        ) : (
                          addr?.nama_jalan || '-'
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {isEditing ? (
                          <input type="text" className="input w-full min-w-[120px]" value={formData.provinsi || ''} onChange={e => setFormData({ ...formData, provinsi: e.target.value })} />
                        ) : (
                          addr?.provinsi || '-'
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {isEditing ? (
                          <input type="text" className="input w-full min-w-[120px]" value={formData.kabupaten_kota || ''} onChange={e => setFormData({ ...formData, kabupaten_kota: e.target.value })} />
                        ) : (
                          addr?.kabupaten_kota || '-'
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {isEditing ? (
                          <input type="text" className="input w-full min-w-[120px]" value={formData.kecamatan || ''} onChange={e => setFormData({ ...formData, kecamatan: e.target.value })} />
                        ) : (
                          addr?.kecamatan || '-'
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {isEditing ? (
                          <input type="text" className="input w-full min-w-[120px]" value={formData.kelurahan || ''} onChange={e => setFormData({ ...formData, kelurahan: e.target.value })} />
                        ) : (
                          addr?.kelurahan || '-'
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {isEditing ? (
                          <input type="text" className="input w-full w-24" value={formData.kode_pos || ''} onChange={e => setFormData({ ...formData, kode_pos: e.target.value })} />
                        ) : (
                          addr?.kode_pos || '-'
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {isEditing ? (
                          <select className="input w-full min-w-[120px]" value={formData.proses || 'Belum diproses'} onChange={e => setFormData({ ...formData, proses: e.target.value })}>
                            <option value="Belum diproses">Belum diproses</option>
                            <option value="Diproses">Diproses</option>
                            <option value="Dikirim">Dikirim</option>
                            <option value="Diterima">Diterima</option>
                            <option value="Batal">Batal</option>
                          </select>
                        ) : (
                          <span className={`inline-block px-[8px] py-[4px] rounded-[6px] text-[11px] font-bold ${(addr?.proses === 'Dikirim' || addr?.proses === 'Diterima') ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'}`}>
                            {addr?.proses || 'Belum diproses'}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {isEditing ? (
                          <input type="date" className="input w-full min-w-[130px]" value={formData.tanggal_kirim || ''} onChange={e => setFormData({ ...formData, tanggal_kirim: e.target.value })} />
                        ) : (
                          addr?.tanggal_kirim || '-'
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {isEditing ? (
                          <input type="text" className="input w-full min-w-[150px]" value={formData.resi || ''} onChange={e => setFormData({ ...formData, resi: e.target.value })} />
                        ) : (
                          <div className="flex flex-col">
                            <span className="font-mono">{addr?.resi || '-'}</span>
                            {(addr as any)?.resi_updated_at && (
                              <span className="text-[9px] text-slate-400 mt-1 leading-tight">
                                Updated by {(addr as any)?.resi_updated_by || 'Unknown'} <br/>
                                {new Date((addr as any)?.resi_updated_at).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'})}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {isEditing ? (
                          <input type="text" className="input w-full min-w-[120px]" value={formData.ekspedisi || ''} onChange={e => setFormData({ ...formData, ekspedisi: e.target.value })} />
                        ) : (
                          addr?.ekspedisi || '-'
                        )}
                      </td>
                      <td className="px-3 py-3 whitespace-normal">
                        {isEditing ? (
                          <input type="text" className="input w-full min-w-[150px]" value={formData.notes || ''} onChange={e => setFormData({ ...formData, notes: e.target.value })} />
                        ) : (
                          addr?.notes || '-'
                        )}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className="inline-block px-[8px] py-[2px] border border-line rounded-[4px] text-[10px] font-semibold text-text-soft uppercase bg-slate-100">{cc.approval}</span>
                      </td>
                      {hasAccess && (
                        <td className="text-center align-middle px-3 py-3 sticky right-0 bg-white group-hover:bg-slate-50 transition-colors shadow-[-4px_0_10px_-4px_rgba(0,0,0,0.1)]">
                          {isEditing ? (
                            <span className="text-blue-500 font-semibold text-[12px]">{isSaving ? 'Menyimpan...' : 'Sedang Edit'}</span>
                          ) : (
                            <button onClick={(e) => { e.stopPropagation(); handleEdit(cc.id); }} className="text-[12px] text-blue-600 hover:text-blue-800 hover:underline font-semibold whitespace-nowrap">Edit Data</button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-line bg-slate-50">
            <span className="text-xs text-slate-500">
              Menampilkan {currentPage * PAGE_SIZE + 1}-{Math.min((currentPage + 1) * PAGE_SIZE, approvedCCs.length)} dari {approvedCCs.length} kreator
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                disabled={currentPage === 0}
                className="px-3 py-1 text-xs rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ← Prev
              </button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 7) {
                  pageNum = i;
                } else if (currentPage < 3) {
                  pageNum = i;
                } else if (currentPage > totalPages - 4) {
                  pageNum = totalPages - 7 + i;
                } else {
                  pageNum = currentPage - 3 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`px-3 py-1 text-xs rounded border ${
                      currentPage === pageNum 
                        ? 'bg-blue-600 text-white border-blue-600' 
                        : 'border-slate-300 bg-white hover:bg-slate-100'
                    }`}
                  >
                    {pageNum + 1}
                  </button>
                );
              })}
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={currentPage >= totalPages - 1}
                className="px-3 py-1 text-xs rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
