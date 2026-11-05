"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { AuthProvider, useAuth } from "@/providers/AuthProvider";
import { Loader2 } from "lucide-react";

function LayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Halaman publik yang tidak memerlukan verifikasi status approved
  const isAuthPage = !pathname || pathname === "/login" || pathname === "/pending" || pathname.startsWith("/auth") || pathname.startsWith("/portal");
  const { profile, isLoading } = useAuth();

  // Jika halaman auth (/login, /pending, /portal), render langsung tanpa sidebar
  if (isAuthPage) {
    return (
      <main className="flex-1 min-w-0 flex flex-col h-screen overflow-y-auto bg-bg text-text">
        <div className="w-full h-full">
          {children}
        </div>
      </main>
    );
  }

  // Jika sedang memverifikasi session di halaman internal, tampilkan gate aman
  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <div className="text-center p-8 space-y-3">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" />
          <p className="text-sm font-medium text-slate-600">Memverifikasi hak akses...</p>
        </div>
      </div>
    );
  }

  // KEAMANAN KETAT: Jika akun belum diapprove (pending / null / bukan approved), DILARANG KERAS merender dashboard/children!
  if (!profile || profile.status !== 'approved') {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <div className="text-center p-8 space-y-4 max-w-md bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto text-xl">⏳</div>
          <h2 className="text-base font-bold text-slate-800">Menunggu Persetujuan Manager</h2>
          <p className="text-xs text-slate-500">Akun Anda belum disetujui. Anda tidak memiliki izin untuk melihat dashboard internal. Mengalihkan ke halaman status...</p>
        </div>
      </div>
    );
  }

  // Hanya jika SUDAH APPROVED, render sidebar dan konten internal
  return (
    <>
      <Sidebar />
      <main className="flex-1 min-w-0 flex flex-col h-screen overflow-y-auto bg-bg text-text">
        <div className="py-8 mx-auto w-full px-4 lg:px-8">
          {children}
        </div>
      </main>
    </>
  );
}

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <LayoutContent>{children}</LayoutContent>
    </AuthProvider>
  );
}
