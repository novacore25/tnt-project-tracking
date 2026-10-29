"use client";

import { useState } from "react";
import { Lock, PlayCircle } from "lucide-react";
import PortalTutorialModal from "./PortalTutorialModal";
import { loginPortal } from "../actions/portalActions";
import { useRouter } from "next/navigation";

export default function PortalLoginForm({ campaignId }: { campaignId: number }) {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showTutorial, setShowTutorial] = useState(false);

  const verifyPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await loginPortal(campaignId, pin);
      if (res.success) {
        window.location.href = `/portal/${campaignId}/dashboard`;
      } else {
        setError(res.message || "PIN tidak valid.");
      }
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan sistem.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
        <Lock className="w-8 h-8" />
      </div>
      <form onSubmit={verifyPin} className="space-y-4">
        {error && <div className="text-sm text-red-500 text-center bg-red-50 py-2 rounded">{error}</div>}
        <div>
          <input
            type="password"
            placeholder="Masukkan PIN"
            className="w-full p-4 text-center text-2xl tracking-[0.5em] font-mono border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-sm"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            maxLength={6}
          />
        </div>
        <button
          type="submit"
          disabled={loading || !pin}
          className="w-full bg-slate-900 text-white font-medium p-4 rounded-xl hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-md"
        >
          {loading ? "Memverifikasi..." : "Akses Dashboard"}
        </button>
      </form>

      <div className="mt-6 pt-4 border-t border-slate-100 text-center">
        <button
          type="button"
          onClick={() => setShowTutorial(true)}
          className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium hover:underline transition-colors"
        >
          <PlayCircle className="w-4 h-4" />
          Tonton Tutorial Penggunaan
        </button>
      </div>

      <PortalTutorialModal isOpen={showTutorial} onClose={() => setShowTutorial(false)} />
    </div>
  );
}
