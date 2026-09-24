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
  testFetchCategoryAssetsAction,
  testFetchTapCampaignsAction,
  testFetchShopsAction, 
  testFetchAffiliateOrdersAction,
  testFetchSellerOrdersAction 
} from '@/app/actions/tiktokShopActions';

export default function TikTokCallbackClient() {
  const [code, setCode] = useState('');
  const [state, setState] = useState('');
  const [urlError, setUrlError] = useState('');
  const [isExchanging, setIsExchanging] = useState(false);
  const [tokenResult, setTokenResult] = useState<any>(null);
  const [accessToken, setAccessToken] = useState('');
  const [refreshToken, setRefreshToken] = useState('');
  const [serviceId, setServiceId] = useState('7688709827098347271');
  const [categoryAssets, setCategoryAssets] = useState<any[]>([
    { name: 'Seller and Scalable Creator Match-Up (TAP)', cipher: 'ROW_fyGlKwAAAAB6jCmj_Z8Zc6uknZJUdZAi' },
    { name: 'Creator collaborations', cipher: 'ROW__PB2UQAAAAC2BA1X7FYpYtw9sR5Ersu8' },
    { name: 'Creator Management', cipher: 'ROW_L2lQaAAAAAAzXkQWIHTHFI_usF_y_j4j' },
    { name: 'Analytics & Reporting', cipher: 'ROW_4oi6EQAAAAAHt3hjoNk6xj4i0L5du0R5' }
  ]);
  const [partnerCipher, setPartnerCipher] = useState('ROW_fyGlKwAAAAB6jCmj_Z8Zc6uknZJUdZAi');
  const [shopCipher, setShopCipher] = useState('');
  const [sellerName, setSellerName] = useState('');
  const [tokenError, setTokenError] = useState(urlError || '');
  
  const [activeTest, setActiveTest] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  const partnerAuthUrl = serviceId 
    ? `https://partner.tiktokshop.com/open/authorize?service_id=${encodeURIComponent(serviceId)}`
    : `https://partner.tiktokshop.com/open/authorize`;

  useEffect(() => {
    // Read query params from window.location on mount without Next.js streaming
    if (typeof window !== 'undefined') {
      try {
        const params = new URLSearchParams(window.location.search);
        const urlCode = params.get('code') || '';
        const urlState = params.get('state') || '';
        const urlErr = params.get('error') || '';
        if (urlCode) setCode(urlCode);
        if (urlState) setState(urlState);
        if (urlErr) setTokenError(urlErr);

        // Load persisted tokens from localStorage
        const savedToken = localStorage.getItem('tts_access_token');
        const savedRefresh = localStorage.getItem('tts_refresh_token');
        const savedCipher = localStorage.getItem('tts_partner_cipher');
        if (savedToken) setAccessToken(savedToken);
        if (savedRefresh) setRefreshToken(savedRefresh);
        if (savedCipher) setPartnerCipher(savedCipher);

        if (urlCode && !savedToken) {
          handleExchangeCode(urlCode);
        }
      } catch (e) {
        console.warn('Initialization error:', e);
      }
    }
  }, []);

  const handleExchangeCode = async (authCode: string) => {
    setIsExchanging(true);
    setTokenError('');
    try {
      const res = await exchangeAuthCodeAction(authCode);
      setTokenResult(res);
      if (res.code === 0 && res.data) {
        const token = res.data.access_token || '';
        const refresh = res.data.refresh_token || '';
        const name = res.data.seller_name || res.data.name || '';
        setAccessToken(token);
        setRefreshToken(refresh);
        setSellerName(name);

        try {
          localStorage.setItem('tts_access_token', token);
          localStorage.setItem('tts_refresh_token', refresh);
          // Clean URL without reloading to avoid reusing expired code
          window.history.replaceState({}, '', window.location.pathname);
        } catch (e) {
          console.warn('Failed saving to localStorage:', e);
        }
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

  const handleTestCategoryAssets = async () => {
    if (!accessToken) return;
    setActiveTest('category_assets');
    setTestResult(null);
    try {
      const res = await testFetchCategoryAssetsAction(accessToken);
      setTestResult(res);
      if (res.success && res.data?.data?.category_assets && res.data.data.category_assets.length > 0) {
        const assets = res.data.data.category_assets.map((a: any) => ({
          name: a.category?.name || 'Category',
          cipher: a.cipher
        }));
        setCategoryAssets(assets);
        const tapAsset = assets.find((a: any) => a.name.includes('Match-Up') || a.name.includes('collaborations')) || assets[0];
        if (tapAsset) {
          setPartnerCipher(tapAsset.cipher);
        }
      }
    } catch (err: any) {
      setTestResult({ success: false, error: err.message });
    } finally {
      setActiveTest(null);
    }
  };

  const handleTestTapCampaigns = async () => {
    if (!accessToken || !partnerCipher) return;
    setActiveTest('campaigns');
    setTestResult(null);
    try {
      const res = await testFetchTapCampaignsAction(accessToken, partnerCipher);
      setTestResult(res);
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
      const res = await testFetchAffiliateOrdersAction(accessToken, partnerCipher || undefined);
      setTestResult(res);
    } catch (err: any) {
      setTestResult({ success: false, error: err.message });
    } finally {
      setActiveTest(null);
    }
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
            TikTok Shop Partner Center (TAP / Agency) OpenAPI Test
          </Badge>
          <h1 className="text-2xl font-bold text-slate-900">Integrasi API Partner Center (TNT Media)</h1>
          <p className="text-sm text-slate-500 mt-1">
            Penarikan otomatis data pesanan affiliate & performa agency langsung via Akun TAP Partner Center.
          </p>
        </div>
      </div>

      {/* Step 1: Otorisasi & Token Status */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100">
          <CardTitle className="text-base flex items-center gap-2">
            <Key className="w-5 h-5 text-indigo-600" />
            Langkah 1: Otorisasi Akun Partner Agency (TNT Media)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 space-y-2">
            <p className="font-semibold text-sm text-amber-950 flex items-center gap-1.5">
              📌 Penting untuk Akun Agency / TAP:
            </p>
            <p>
              Otorisasi untuk akun Agency dilakukan melalui <b>Partner Center</b> (<code className="bg-amber-100 px-1 py-0.5 rounded">partner.tiktokshop.com/open/authorize?service_id=...</code>), bukan Seller Center.
            </p>
            <p>
              Masukkan <b>Service ID</b> dari Partner Center Anda di bawah (atau klik langsung link otorisasi dari Partner Center):
            </p>
            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <input
                type="text"
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value)}
                placeholder="Masukkan Service ID (dari Partner Center > App & Service)"
                className="flex-1 text-xs font-mono p-2 border border-amber-300 rounded-lg bg-white text-slate-800"
              />
              <a
                href={partnerAuthUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg transition-colors shadow-sm"
              >
                <ExternalLink className="w-4 h-4" />
                Buka Link Otorisasi Partner
              </a>
            </div>
          </div>

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
                  <label className="text-xs font-semibold text-slate-500 uppercase">Pilih Category Asset / Partner Cipher</label>
                  <select
                    value={partnerCipher}
                    onChange={(e) => setPartnerCipher(e.target.value)}
                    className="w-full text-xs font-medium p-2 border rounded-md bg-white text-slate-800 mt-1"
                  >
                    {categoryAssets.map((asset, idx) => (
                      <option key={idx} value={asset?.cipher || ''}>
                        {asset?.name || 'Category'} {asset?.cipher ? `(${asset.cipher.substring(0, 16)}...)` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ) : (
            !isExchanging && !tokenError && (
              <div className="text-center py-4 space-y-2">
                <ShieldCheck className="w-10 h-10 text-slate-400 mx-auto" />
                <p className="text-sm text-slate-600 max-w-md mx-auto">
                  Silakan buka link otorisasi Partner di atas untuk menghubungkan akun agency TNT Media.
                </p>
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
            Langkah 2: Eksekusi Test Pemanggilan API Agency (TAP)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <button
              onClick={handleTestCategoryAssets}
              disabled={!accessToken || activeTest !== null}
              className="flex items-center justify-center gap-2 p-3 rounded-lg border border-slate-300 hover:border-indigo-500 hover:bg-indigo-50/50 text-xs font-semibold text-slate-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {activeTest === 'category_assets' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4 text-indigo-600" />}
              1. Cek Category Assets
            </button>

            <button
              onClick={handleTestTapCampaigns}
              disabled={!accessToken || !partnerCipher || activeTest !== null}
              className="flex items-center justify-center gap-2 p-3 rounded-lg border border-indigo-300 bg-indigo-50/40 hover:bg-indigo-100/60 text-xs font-bold text-indigo-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {activeTest === 'campaigns' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4 text-indigo-600" />}
              2. Tarik Campaign (TAP)
            </button>

            <button
              onClick={handleTestAffiliateOrders}
              disabled={!accessToken || !partnerCipher || activeTest !== null}
              className="flex items-center justify-center gap-2 p-3 rounded-lg border border-emerald-300 bg-emerald-50/40 hover:bg-emerald-100/60 text-xs font-bold text-emerald-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {activeTest === 'affiliate_orders' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4 text-emerald-600" />}
              3. Tarik Orders (TAP)
            </button>

            <button
              onClick={handleTestShops}
              disabled={!accessToken || activeTest !== null}
              className="flex items-center justify-center gap-2 p-3 rounded-lg border border-slate-300 hover:border-blue-500 hover:bg-blue-50/50 text-xs font-semibold text-slate-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {activeTest === 'shops' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingBag className="w-4 h-4 text-blue-600" />}
              4. Cek Info Toko
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
