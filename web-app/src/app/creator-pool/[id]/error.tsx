"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { AlertCircle, RefreshCw, ArrowLeft } from "lucide-react";

export default function CreatorProfileError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error("Creator Profile Error caught by boundary:", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-xl p-8 text-center space-y-6">
        <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto ring-8 ring-rose-50/50">
          <AlertCircle className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold text-slate-800">
            Terjadi Masalah pada Profil Kreator
          </h2>
          <p className="text-sm text-slate-500">
            Halaman profil gagal dimuat. Silakan coba muat ulang atau kembali ke daftar kreator.
          </p>
        </div>

        {error?.message && (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-left text-xs font-mono text-slate-600 max-h-36 overflow-y-auto">
            {error.message}
          </div>
        )}

        <div className="flex flex-col gap-3 pt-2">
          <Button
            onClick={() => reset()}
            className="w-full bg-slate-800 hover:bg-slate-900 text-white font-semibold flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" /> Muat Ulang Halaman
          </Button>

          <Button
            variant="outline"
            onClick={() => router.push("/creator-pool")}
            className="w-full border-slate-200 text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" /> Kembali ke Creator Pool
          </Button>
        </div>
      </div>
    </div>
  );
}
