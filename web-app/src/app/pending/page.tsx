"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/Button";
import { LogOut, RefreshCw, ShieldAlert } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";

export default function PendingPage() {
  const { profile, isLoading } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Jika status sudah approved, otomatis lempar ke dashboard tanpa glitch!
  useEffect(() => {
    if (!isLoading && profile && profile.status === 'approved') {
      window.location.replace('/');
    }
  }, [profile, isLoading]);

  const handleLogout = async () => {
    await signOut({ callbackUrl: "/login" });
  };

  const handleCheckStatus = () => {
    setIsRefreshing(true);
    window.location.reload();
  };

  if (!isLoading && profile && profile.status === 'approved') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden border border-emerald-100 text-center p-8 space-y-4">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-3xl font-bold">
            ✓
          </div>
          <h1 className="text-xl font-bold text-slate-900">Akun Anda Telah Disetujui!</h1>
          <p className="text-sm text-slate-500">Mengalihkan ke dashboard utama...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100 text-center p-8 space-y-6">
        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
          ⏳
        </div>
        
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Menunggu Persetujuan</h1>
          <p className="text-sm text-slate-500 mt-1">Akses Sistem Internal TNT Campaign</p>
        </div>

        {profile && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-left space-y-2">
            <div className="flex items-center gap-3">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-10 h-10 rounded-full border border-slate-200" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 font-bold flex items-center justify-center">
                  {(profile.nama || 'U').charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800 truncate">{profile.nama}</p>
                <p className="text-xs text-slate-500 truncate">{profile.email}</p>
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800">
                <ShieldAlert className="w-3 h-3" /> Pending
              </span>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <p className="text-slate-600 text-sm leading-relaxed">
            Akun Anda telah terdaftar di database, namun masih <strong>menunggu persetujuan (approval)</strong> dari Manager atau Executive untuk bisa mengakses dashboard dan data campaign.
          </p>
          <p className="text-xs text-slate-500 bg-amber-50/60 border border-amber-200/50 p-3 rounded-lg text-amber-900">
            Silakan hubungi Manager Anda untuk meminta persetujuan akun di menu <em>Manajemen Akun</em>.
          </p>
        </div>
        
        <div className="pt-4 border-t border-slate-100 space-y-2">
          <Button 
            onClick={handleCheckStatus} 
            disabled={isRefreshing}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Periksa Status Persetujuan
          </Button>

          <Button 
            onClick={handleLogout} 
            variant="outline" 
            className="w-full flex items-center justify-center gap-2 border-slate-200 text-slate-600 hover:bg-slate-50 font-medium py-2.5 rounded-lg"
          >
            <LogOut className="w-4 h-4" /> Keluar (Logout)
          </Button>
        </div>
      </div>
    </div>
  );
}
