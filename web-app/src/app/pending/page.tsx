"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/Button";
import { LogOut } from "lucide-react";

export default function PendingPage() {
  const handleLogout = async () => {
    await signOut({ callbackUrl: "/login" });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100 text-center p-8 space-y-6">
        <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">⏳</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Menunggu Persetujuan</h1>
        <p className="text-slate-600">
          Akun Anda telah terdaftar namun masih menunggu persetujuan dari Manager untuk bisa mengakses sistem.
        </p>
        <p className="text-sm text-slate-500 bg-slate-50 p-3 rounded-lg">
          Silakan hubungi Manager Anda untuk meminta akses.
        </p>
        
        <div className="pt-4 border-t border-slate-100">
          <Button onClick={handleLogout} variant="outline" className="w-full flex items-center justify-center gap-2">
            <LogOut className="w-4 h-4" /> Kembali ke Login
          </Button>
        </div>
      </div>
    </div>
  );
}
