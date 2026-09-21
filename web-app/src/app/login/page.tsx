"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/Button";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [namaPanggilan, setNamaPanggilan] = useState("");
  const supabase = createClient();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("error") === "not-registered") {
        alert("Gagal Login: Akun Anda belum terdaftar. Silakan klik 'Daftar sekarang' terlebih dahulu.");
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, []);

  const handleAuth = async () => {
    setIsLoading(true);
    try {
      // Login Google via Auth.js (NextAuth)
      window.location.href = '/api/auth/signin/google';
    } catch (error: any) {
      alert("Error logging in: " + error.message);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100">
        <div className="p-8 text-center space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">TNT App</h1>
            <p className="text-slate-500">Campaign & Creator Management System</p>
          </div>

          <div className="bg-slate-50 p-6 rounded-xl border border-slate-100">
            <p className="text-sm text-slate-600 mb-6">
              {isRegistering 
                ? "Silakan isi nama panggilan Anda sebelum mendaftar dengan akun Google."
                : "Silakan login menggunakan akun Google Anda untuk mengakses sistem."}
            </p>
            
            {isRegistering && (
              <div className="mb-4 text-left">
                <label className="block text-sm font-medium text-slate-700 mb-1">Nama Panggilan</label>
                <input 
                  type="text" 
                  value={namaPanggilan}
                  onChange={(e) => setNamaPanggilan(e.target.value)}
                  placeholder="Contoh: Budi"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            <Button 
              onClick={handleAuth} 
              disabled={isLoading || (isRegistering && !namaPanggilan.trim())}
              className="w-full py-6 text-base font-semibold shadow-md flex items-center justify-center gap-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <svg viewBox="0 0 24 24" className="w-5 h-5">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                  <path d="M1 1h22v22H1z" fill="none" />
                </svg>
              )}
              {isLoading ? "Mengalihkan..." : isRegistering ? "Daftar dengan Google" : "Login dengan Google"}
            </Button>

            <div className="mt-6 text-sm">
              {isRegistering ? (
                <p className="text-slate-600">
                  Sudah terdaftar?{" "}
                  <button onClick={() => setIsRegistering(false)} className="text-blue-600 hover:underline font-medium">
                    Login di sini
                  </button>
                </p>
              ) : (
                <p className="text-slate-600">
                  Belum punya akun?{" "}
                  <button onClick={() => setIsRegistering(true)} className="text-blue-600 hover:underline font-medium">
                    Daftar sekarang
                  </button>
                </p>
              )}
            </div>
          </div>
        </div>
        
        <div className="bg-slate-900 px-8 py-4 text-center">
          <p className="text-xs text-slate-400">
            TNT Agency &copy; {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
}
