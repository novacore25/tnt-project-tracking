"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { approveUser, rejectUser, deactivateUser, assignCampaignsToUser, addWhitelistEmail, removeWhitelistEmail, changeUserRole } from "./actions";
import { Check, X, ShieldAlert, UserCog, UserCheck, Search, ShieldCheck, MailPlus, Trash2, Loader2 } from "lucide-react";
import { formatDateTime } from "@/utils/formatters";

export default function ManajemenAkunClient({ 
  initialProfiles, 
  campaigns, 
  initialUserCampaigns,
  initialWhitelist
}: { 
  initialProfiles: any[], 
  campaigns: any[],
  initialUserCampaigns: any[],
  initialWhitelist: any[]
}) {
  const [activeTab, setActiveTab] = useState<'persetujuan' | 'assignment' | 'whitelist'>('persetujuan');
  const [loadingId, setLoadingId] = useState<string | number | null>(null);

  // Whitelist Form State
  const [wlEmail, setWlEmail] = useState('');
  const [wlNama, setWlNama] = useState('');
  const [wlRole, setWlRole] = useState('anggota');

  const pendingUsers = initialProfiles.filter(p => p.status === 'pending');
  const activeUsers = initialProfiles.filter(p => p.status === 'approved');

  const handleApprove = async (id: string) => {
    if (!confirm('Yakin ingin menyetujui akun ini?')) return;
    setLoadingId(id);
    try {
      await approveUser(id);
    } catch (err: any) {
      alert("Error: " + e.message);
    }
    setLoadingId(null);
  };

  const handleReject = async (id: string) => {
    if (!confirm('Tolak akun ini? Data akan dihapus secara permanen.')) return;
    setLoadingId(id);
    try {
      await rejectUser(id);
    } catch (err: any) {
      alert("Error: " + e.message);
    }
    setLoadingId(null);
  };

  const handleDeactivate = async (id: string) => {
    if (!confirm('Yakin ingin menonaktifkan akun ini? Mereka tidak akan bisa login lagi.')) return;
    setLoadingId(id);
    try {
      await deactivateUser(id);
    } catch (err: any) {
      alert("Error: " + err.message);
    }
    setLoadingId(null);
  };

  const handleRoleChange = async (id: string, newRole: string) => {
    if (!confirm(`Ubah role pengguna ini menjadi ${newRole}?`)) return;
    setLoadingId(`role-${id}`);
    try {
      await changeUserRole(id, newRole);
    } catch (err: any) {
      alert("Error: " + err.message);
    }
    setLoadingId(null);
  };

  const handleAddWhitelist = async () => {
    if (!wlEmail || !wlNama) {
      alert("Email dan Nama harus diisi.");
      return;
    }
    setLoadingId('wl-add');
    try {
      await addWhitelistEmail(wlEmail, wlNama, wlRole);
      setWlEmail('');
      setWlNama('');
      setWlRole('anggota');
    } catch (err: any) {
      alert("Error: " + err.message);
    }
    setLoadingId(null);
  };

  const handleRemoveWhitelist = async (id: number) => {
    if (!confirm('Hapus email ini dari whitelist?')) return;
    setLoadingId(id);
    try {
      await removeWhitelistEmail(id);
    } catch (err: any) {
      alert("Error: " + err.message);
    }
    setLoadingId(null);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="flex border-b border-slate-200">
        <button 
          onClick={() => setActiveTab('persetujuan')}
          className={`flex-1 py-4 px-6 font-semibold text-sm flex items-center justify-center gap-2 border-b-2 transition-colors ${activeTab === 'persetujuan' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
        >
          <UserCheck className="w-4 h-4" />
          Persetujuan Akun
          {pendingUsers.length > 0 && (
            <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full ml-2">
              {pendingUsers.length} Baru
            </span>
          )}
        </button>
        <button 
          onClick={() => setActiveTab('assignment')}
          className={`flex-1 py-4 px-6 font-semibold text-sm flex items-center justify-center gap-2 border-b-2 transition-colors ${activeTab === 'assignment' ? 'border-amber-600 text-amber-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
        >
          <UserCog className="w-4 h-4" />
          Assignment Campaign
        </button>
        <button 
          onClick={() => setActiveTab('whitelist')}
          className={`flex-1 py-4 px-6 font-semibold text-sm flex items-center justify-center gap-2 border-b-2 transition-colors ${activeTab === 'whitelist' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
        >
          <MailPlus className="w-4 h-4" />
          Email Whitelist
        </button>
      </div>

      <div className="p-6">
        {activeTab === 'persetujuan' && (
          <div className="space-y-8">
            {/* Tabel Pending Users */}
            <div>
              <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-500" />
                Menunggu Persetujuan
              </h2>
              {pendingUsers.length === 0 ? (
                <div className="text-center py-8 text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                  Tidak ada permintaan akun baru.
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-600 font-medium">
                      <tr>
                        <th className="px-4 py-3">Nama Panggilan</th>
                        <th className="px-4 py-3">Email Google</th>
                        <th className="px-4 py-3">Tanggal Daftar</th>
                        <th className="px-4 py-3 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pendingUsers.map(user => (
                        <tr key={user.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-medium text-slate-900 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden shrink-0">
                              {user.avatar_url ? <img src={user.avatar_url} alt="" /> : <div className="w-full h-full flex items-center justify-center text-slate-500">{user.nama.charAt(0)}</div>}
                            </div>
                            {user.nama}
                          </td>
                          <td className="px-4 py-3 text-slate-500">{user.email}</td>
                          <td className="px-4 py-3 text-slate-500">{formatDateTime(user.created_at)}</td>
                          <td className="px-4 py-3 text-right space-x-2">
                            <Button 
                              size="sm" 
                              onClick={() => handleApprove(user.id)}
                              disabled={loadingId === user.id}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                            >
                              <Check className="w-4 h-4 mr-1" /> Approve
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleReject(user.id)}
                              disabled={loadingId === user.id}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                            >
                              <X className="w-4 h-4 mr-1" /> Tolak
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 pt-8">
              <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-500" />
                Anggota Aktif
              </h2>
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-600 font-medium">
                    <tr>
                      <th className="px-4 py-3">User</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3">Tanggal Approve</th>
                      <th className="px-4 py-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeUsers.map(user => (
                      <tr key={user.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-900 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden shrink-0">
                            {user.avatar_url ? <img src={user.avatar_url} alt="" /> : <div className="w-full h-full flex items-center justify-center text-slate-500">{user.nama.charAt(0)}</div>}
                          </div>
                          <div>
                            <div>{user.nama}</div>
                            <div className="text-xs text-slate-400 font-normal">{user.email}</div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <select 
                            value={user.role} 
                            onChange={(e) => handleRoleChange(user.id, e.target.value)}
                            disabled={loadingId === `role-${user.id}`}
                            className={`px-2 py-1 rounded text-xs font-medium border-0 focus:ring-2 focus:ring-blue-500 cursor-pointer ${user.role === 'manager' ? 'bg-amber-100 text-amber-700' : user.role === 'executive' ? 'bg-purple-100 text-purple-700' : user.role === 'finance' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}
                          >
                            <option value="anggota">Anggota</option>
                            <option value="finance">Finance</option>
                            <option value="executive">Executive</option>
                            <option value="manager">Manager</option>
                          </select>
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {user.approved_at ? formatDateTime(user.approved_at) : '-'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {user.role !== 'manager' && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleDeactivate(user.id)}
                              disabled={loadingId === user.id}
                              className="text-slate-500 hover:text-red-600 hover:bg-red-50"
                            >
                              Nonaktifkan
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'assignment' && (
          <div className="space-y-6">
            <p className="text-sm text-slate-600">
              Pilih anggota tim di bawah ini untuk mengatur hak akses (*edit data, input organik, kelola keuangan*) di setiap Campaign. Anggota tanpa assignment hanya bisa melihat data saja (Read-only).
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {activeUsers.filter(u => u.role !== 'manager').map(user => (
                <UserAssignmentCard 
                  key={user.id} 
                  user={user} 
                  campaigns={campaigns} 
                  userCampaigns={initialUserCampaigns.filter(uc => uc.user_id === user.id)}
                />
              ))}
              {activeUsers.filter(u => u.role !== 'manager').length === 0 && (
                <div className="col-span-full text-center py-12 bg-slate-50 rounded-lg text-slate-500 border border-slate-200 border-dashed">
                  Belum ada anggota tim aktif selain Manager.
                </div>
              )}
            </div>
          </div>
        )}
      {activeTab === 'whitelist' && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row gap-6">
            
            {/* Form Tambah Whitelist */}
            <div className="md:w-1/3 bg-slate-50 border border-slate-200 rounded-lg p-5">
              <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <MailPlus className="w-4 h-4 text-indigo-600" />
                Daftarkan Email
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email Google</label>
                  <input 
                    type="email" 
                    value={wlEmail}
                    onChange={(e) => setWlEmail(e.target.value)}
                    placeholder="nama@gmail.com"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nama Panggilan</label>
                  <input 
                    type="text" 
                    value={wlNama}
                    onChange={(e) => setWlNama(e.target.value)}
                    placeholder="Budi"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Role/Akses</label>
                  <select 
                    value={wlRole}
                    onChange={(e) => setWlRole(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white"
                  >
                    <option value="anggota">Anggota (Staff)</option>
                    <option value="manager">Manager</option>
                    <option value="finance">Finance</option>
                    <option value="executive">Executive</option>
                  </select>
                </div>
                <Button 
                  onClick={handleAddWhitelist} 
                  disabled={loadingId === 'wl-add' || !wlEmail || !wlNama}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  {loadingId === 'wl-add' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                  Daftarkan ke Whitelist
                </Button>
              </div>
            </div>

            {/* Tabel Whitelist */}
            <div className="md:w-2/3">
              <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                Daftar Email Whitelist
              </h3>
              {initialWhitelist.length === 0 ? (
                <div className="text-center py-8 text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                  Belum ada email yang di-whitelist.
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-600 font-medium">
                      <tr>
                        <th className="px-4 py-3">Email</th>
                        <th className="px-4 py-3">Nama</th>
                        <th className="px-4 py-3">Role</th>
                        <th className="px-4 py-3 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {initialWhitelist.map(wl => (
                        <tr key={wl.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-medium text-slate-900">{wl.email}</td>
                          <td className="px-4 py-3 text-slate-500">{wl.nama}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 text-xs rounded-full font-medium ${wl.role === 'manager' ? 'bg-amber-100 text-amber-700' : wl.role === 'executive' ? 'bg-purple-100 text-purple-700' : wl.role === 'finance' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                              {wl.role}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleRemoveWhitelist(wl.id)}
                              disabled={loadingId === wl.id}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                              title="Hapus dari Whitelist"
                            >
                              {loadingId === wl.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        </div>
      )}
      </div>
    </div>
  );
}

function UserAssignmentCard({ user, campaigns, userCampaigns }: { user: any, campaigns: any[], userCampaigns: any[] }) {
  // If user has any record with all_campaigns = true
  const isAllCampaigns = userCampaigns.some(uc => uc.all_campaigns);
  const assignedCampaignIds = userCampaigns.filter(uc => !uc.all_campaigns).map(uc => uc.campaign_id);
  
  const [localAllCampaigns, setLocalAllCampaigns] = useState(isAllCampaigns);
  const [localCampaignIds, setLocalCampaignIds] = useState<number[]>(assignedCampaignIds);
  const [isSaving, setIsSaving] = useState(false);

  // Check if state changed
  const hasChanges = localAllCampaigns !== isAllCampaigns || 
                     localCampaignIds.length !== assignedCampaignIds.length ||
                     !localCampaignIds.every(id => assignedCampaignIds.includes(id));

  const handleToggleCampaign = (id: number) => {
    if (localAllCampaigns) return; // disabled
    if (localCampaignIds.includes(id)) {
      setLocalCampaignIds(localCampaignIds.filter(cid => cid !== id));
    } else {
      setLocalCampaignIds([...localCampaignIds, id]);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await assignCampaignsToUser(user.id, localCampaignIds, localAllCampaigns);
    } catch (err: any) {
      alert("Error saving: " + err.message);
    }
    setIsSaving(false);
  };

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm flex flex-col">
      <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold overflow-hidden">
            {user.avatar_url ? <img src={user.avatar_url} alt="" /> : user.nama.charAt(0)}
          </div>
          <div>
            <div className="font-semibold text-slate-900">{user.nama}</div>
            <div className="text-xs text-slate-500">{user.email}</div>
          </div>
        </div>
        {hasChanges && (
          <Button size="sm" onClick={handleSave} disabled={isSaving} className="bg-amber-600 hover:bg-amber-700 text-white">
            {isSaving ? "Menyimpan..." : "Simpan Perubahan"}
          </Button>
        )}
      </div>
      
      <div className="p-4 flex-1">
        <label className="flex items-center gap-3 p-3 rounded-lg border border-amber-200 bg-amber-50 cursor-pointer mb-4 transition-colors hover:bg-amber-100">
          <input 
            type="checkbox" 
            className="w-4 h-4 text-amber-600 rounded border-amber-300 focus:ring-amber-500" 
            checked={localAllCampaigns}
            onChange={(e) => {
              setLocalAllCampaigns(e.target.checked);
              if (e.target.checked) setLocalCampaignIds([]);
            }}
          />
          <div>
            <div className="text-sm font-semibold text-amber-900">Akses Semua Campaign</div>
            <div className="text-xs text-amber-700">Berikan akses penuh ke semua campaign saat ini dan yang akan datang.</div>
          </div>
        </label>

        <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
          {campaigns.map(camp => (
            <label 
              key={camp.id} 
              className={`flex items-center gap-3 p-2 rounded-md border ${localAllCampaigns ? 'opacity-50 cursor-not-allowed bg-slate-50 border-transparent' : 'cursor-pointer hover:bg-slate-50 border-slate-100'} transition-colors`}
            >
              <input 
                type="checkbox" 
                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500" 
                checked={localAllCampaigns || localCampaignIds.includes(camp.id)}
                disabled={localAllCampaigns}
                onChange={() => handleToggleCampaign(camp.id)}
              />
              <span className="text-sm text-slate-700 font-medium">{camp.name}</span>
            </label>
          ))}
          {campaigns.length === 0 && (
            <div className="text-xs text-slate-400 text-center py-4">Belum ada campaign dibuat.</div>
          )}
        </div>
      </div>
    </div>
  );
}
