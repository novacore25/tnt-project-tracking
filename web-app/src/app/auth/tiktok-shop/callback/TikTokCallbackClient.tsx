'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { 
  CheckCircle2, XCircle, Loader2, ExternalLink, RefreshCw, Key, 
  ShoppingBag, ShieldCheck, Database, Play, Copy, Check 
} from 'lucide-react';
import { 
  exchangeAuthCodeAction, 
  testFetchShopsAction, 
  testFetchAffiliateOrdersAction,
  testFetchSellerOrdersAction 
} from '@/app/actions/tiktokShopActions';

export default function TikTokCallbackClient({
  code,
  state,
  urlError
}: {
  code?: string;
  state?: string;
  urlError?: string;
}) {
  const [isExchanging, setIsExchanging] = useState(false);
  const [tokenResult, setTokenResult] = useState<any>(null);
  const [accessToken, setAccessToken] = useState('');
  const [refreshToken, setRefreshToken] = useState('');
  const [shopCipher, setShopCipher] = useState('');
  const [sellerName, setSellerName] = useState('');
  const [tokenError, setTokenError] = useState(urlError || '');
  
  const [activeTest, setActiveTest] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  const authUrl = `https://services.tiktokshop.com/open/authorize?service_id=6lahgd8e9i686`;

  useEffect(() => {
    if (code && !accessToken) {
      handleExchangeCode(code);
    }
  }, [code]);

  const handleExchangeCode = async (authCode: string) => {
    setIsExchanging(true);
    setTokenError('');
    try {
      const res = await exchangeAuthCodeAction(authCode);
      setTokenResult(res);
      if (res.code === 0 && res.data) {
        setAccessToken(res.data.access_token || '');
        setRefreshToken(res.data.refresh_token || '');
        setSellerName(res.data.seller_name || res.data.name || '');
      } else {
        setTokenError(res.message || 'Gagal menukar kode otorisasi.');
      }
    } catch (err: any) {
      setTokenError(err.message || 'Terjadi kesalahan jaringan.');
    } finally {
      setIsExchanging(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTestShops = async () => {
    if (!accessToken) return;
    setActiveTest('shops');
    setTestResult(null);
    try {
      const res = await testFetchShopsAction(accessToken);
      setTestResult(res);
      if (res.success && res.data?.data?.shops && res.data.data.shops.length > 0) {
        const firstShop = res.data.data.shops[0];
        if (firstShop.cipher) {
          setShopCipher(firstShop.cipher);
        }
      }
    } catch (err: any) {
      setTestResult({ success: false, error: err.message });
    } finally {
      setActiveTest(null);
    }
  };

  const handleTestAffiliateOrders = async () => {
    if (!accessToken) return;
    setActiveTest('affiliate_orders');
    setTestResult(null);
    try {
      const res = await testFetchAffiliateOrdersAction(accessToken, shopCipher || undefined);
      setTestResult(res);
    } catch (err: any) {
      setTestResult({ success: false, error: err.message });
    } finally {
      setActiveTest(null);
    }
  };

  const handleTestSellerOrders = async () => {
    if (!accessToken || !shopCipher) return;
    setActiveTest('seller_orders');
    setTestResult(null);
    try {
      const res = await testFetchSellerOrdersAction(accessToken, shopCipher);
      setTestResult(res);
    } catch (err: any) {
      setTestResult({ success: false, error: err.message });
    } finally {
      setActiveTest(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <Badge variant="outline" className="mb-2 border-indigo-200 bg-indigo-50 text-indigo-700">
            TikTok Shop Open Platform Sandbox & Live Test
          </Badge>
          <h1 className="text-2xl font-bold text-slate-900">Uji Coba Integrasi TikTok Shop OpenAPI</h1>
          <p className="text-sm text-slate-500 mt-1">
            Validasi penarikan otomatis data pesanan affiliate & toko langsung via API TikTok resmi.
          </p>
        </div>
        <a
          href={authUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-pink-500 via-rose-500 to-indigo-600 text-white font-semibold text-sm rounded-xl hover:opacity-90 shadow-md transition-all"
        >
          <ExternalLink className="w-4 h-4" />
          Hubungkan / Otorisasi Akun TikTok
        </a>
      </div>

      {/* Step 1: Otorisasi & Token Status */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100">
          <CardTitle className="text-base flex items-center gap-2">
            <Key className="w-5 h-5 text-indigo-600" />
            Langkah 1: Status Kredensial & Access Token
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          {code && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs font-mono text-blue-800 break-all">
              <span className="font-bold">Auth Code Diterima:</span> {code}
            </div>
          )}

          {isExchanging && (
            <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
              <Loader2 className="w-5 h-5 animate-spin text-amber-600" />
              Sedang menukarkan auth code dengan access token ke server TikTok...
            </div>
          )}

          {tokenError && (
            <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
              <XCircle className="w-5 h-5 text-red-600 shrink-0" />
              <div>
                <p className="font-semibold">Otorisasi Belum Berhasil:</p>
                <p className="text-xs mt-0.5">{tokenError}</p>
                <p className="text-xs text-red-600 mt-2">
                  Tips: Klik tombol <b>&quot;Hubungkan / Otorisasi Akun TikTok&quot;</b> di atas, lalu login ke akun TikTok Shop Anda untuk mendapatkan token baru.
                </p>
              </div>
            </div>
          )}

          {accessToken ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-sm font-medium">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                Access Token Berhasil Diperoleh & Aktif! {sellerName && `(Akun: ${sellerName})`}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase">Access Token</label>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="text"
                      readOnly
                      value={accessToken}
                      className="w-full text-xs font-mono p-2 border rounded-md bg-slate-50 text-slate-700"
                    />
                    <button
                      onClick={() => copyToClipboard(accessToken)}
                      className="p-2 border rounded-md hover:bg-slate-100 text-slate-600"
                      title="Copy"
                    >
                      {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase">Shop Cipher (Opsional)</label>
                  <input
                    type="text"
                    value={shopCipher}
                    onChange={(e) => setShopCipher(e.target.value)}
                    placeholder="Auto terisi dari tombol cek toko..."
                    className="w-full text-xs font-mono p-2 border rounded-md bg-white text-slate-700 mt-1"
                  />
                </div>
              </div>
            </div>
          ) : (
            !isExchanging && !tokenError && (
              <div className="text-center py-6 space-y-3">
                <ShieldCheck className="w-12 h-12 text-slate-400 mx-auto" />
                <p className="text-sm text-slate-600 max-w-md mx-auto">
                  Belum ada Access Token yang aktif. Silakan klik tombol di bawah untuk mengotorisasi akun TikTok Shop Anda.
                </p>
                <a
                  href={authUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 text-white font-medium text-sm rounded-xl hover:bg-slate-800 transition-colors shadow-sm"
                >
                  <ExternalLink className="w-4 h-4" />
                  Mulai Otorisasi Akun TikTok
                </a>
              </div>
            )
          )}
        </CardContent>
      </Card>

      {/* Step 2: Test Action Buttons */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100">
          <CardTitle className="text-base flex items-center gap-2">
            <Play className="w-5 h-5 text-indigo-600" />
            Langkah 2: Eksekusi Test Pemanggilan API
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              onClick={handleTestShops}
              disabled={!accessToken || activeTest !== null}
              className="flex items-center justify-center gap-2 p-3 rounded-lg border border-slate-300 hover:border-blue-500 hover:bg-blue-50/50 text-sm font-semibold text-slate-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {activeTest === 'shops' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingBag className="w-4 h-4 text-blue-600" />}
              1. Cek Info Toko & Cipher
            </button>

            <button
              onClick={handleTestAffiliateOrders}
              disabled={!accessToken || activeTest !== null}
              className="flex items-center justify-center gap-2 p-3 rounded-lg border border-emerald-300 bg-emerald-50/40 hover:bg-emerald-100/60 text-sm font-bold text-emerald-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {activeTest === 'affiliate_orders' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4 text-emerald-600" />}
              2. Tarik Pesanan Affiliate (TAP)
            </button>

            <button
              onClick={handleTestSellerOrders}
              disabled={!accessToken || !shopCipher || activeTest !== null}
              className="flex items-center justify-center gap-2 p-3 rounded-lg border border-slate-300 hover:border-purple-500 hover:bg-purple-50/50 text-sm font-semibold text-slate-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {activeTest === 'seller_orders' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4 text-purple-600" />}
              3. Tarik Pesanan Seller (Direct)
            </button>
          </div>

          {/* Test Results Console Display */}
          {testResult && (
            <div className="mt-6 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold uppercase text-slate-500">Hasil Output Respon API TikTok:</span>
                <Badge variant={testResult.success ? 'success' : 'destructive'}>
                  {testResult.success ? 'HTTP 200 SUCCESS' : 'RESPONSE ERROR'}
                </Badge>
              </div>
              <pre className="p-4 bg-slate-900 text-emerald-400 font-mono text-xs rounded-xl overflow-x-auto max-h-[400px] leading-relaxed shadow-inner">
                {JSON.stringify(testResult, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
