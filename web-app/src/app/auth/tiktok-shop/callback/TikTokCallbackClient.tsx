'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { 
  CheckCircle2, XCircle, Loader2, ExternalLink, RefreshCw, Key, 
  ShoppingBag, ShieldCheck, Database, Play, Copy, Check, Users, Package, AlertTriangle 
} from 'lucide-react';
import { 
  exchangeAuthCodeAction, 
  testFetchCategoryAssetsAction,
  testFetchTapCampaignsAction,
  testFetchCampaignProductsAction,
  testFetchCampaignPerformanceAction,
  testFetchCampaignCreatorsAction,
  testFetchAffiliateOrdersAction 
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
  const [sellerName, setSellerName] = useState('');
  const [tokenError, setTokenError] = useState(urlError || '');
  
  // TAP Campaign states
  const [campaignStatus, setCampaignStatus] = useState('ONGOING');
  const [campaignList, setCampaignList] = useState<any[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');

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
      if (res && res.code === 0 && res.data) {
        const token = res.data.access_token || '';
        const refresh = res.data.refresh_token || '';
        const name = res.data.seller_name || res.data.name || '';
        setAccessToken(token);
        setRefreshToken(refresh);
        setSellerName(name);

        try {
          localStorage.setItem('tts_access_token', token);
          localStorage.setItem('tts_refresh_token', refresh);
          window.history.replaceState({}, '', window.location.pathname);
        } catch (e) {
          console.warn('Failed saving to localStorage:', e);
        }
      } else {
        setTokenError(res?.message || 'Gagal menukar kode otorisasi.');
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

  const handleClearTokens = () => {
    try {
      localStorage.removeItem('tts_access_token');
      localStorage.removeItem('tts_refresh_token');
      localStorage.removeItem('tts_partner_cipher');
    } catch (e) {
      console.warn('Failed clearing storage:', e);
    }
    setAccessToken('');
    setRefreshToken('');
    setCode('');
    setSellerName('');
    setTokenResult(null);
    setTestResult(null);
    setCampaignList([]);
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
      const res = await testFetchTapCampaignsAction(accessToken, partnerCipher, campaignStatus);
      setTestResult(res);
      if (res?.data?.code === 0 && res.data?.data?.campaigns?.length > 0) {
        setCampaignList(res.data.data.campaigns);
        if (!selectedCampaignId) {
          setSelectedCampaignId(res.data.data.campaigns[0].id);
        }
      }
    } catch (err: any) {
      setTestResult({ success: false, error: err.message });
    } finally {
      setActiveTest(null);
    }
  };

  const handleTestCampaignProducts = async () => {
    if (!accessToken || !partnerCipher) return;
    const cid = selectedCampaignId || '7684116600044947221';
    setActiveTest('products');
    setTestResult(null);
    try {
      const res = await testFetchCampaignProductsAction(accessToken, partnerCipher, cid);
      setTestResult(res);
      if (res?.data?.code === 0 && res.data?.data?.products?.length > 0) {
        setSelectedProductId(res.data.data.products[0].id);
      }
    } catch (err: any) {
      setTestResult({ success: false, error: err.message });
    } finally {
      setActiveTest(null);
    }
  };

  const handleTestCampaignCreators = async () => {
    if (!accessToken || !partnerCipher) return;
    const cid = selectedCampaignId || '7684116600044947221';
    const pid = selectedProductId || '1737102708359464222';
    setActiveTest('creators');
    setTestResult(null);
    try {
      const res = await testFetchCampaignCreatorsAction(accessToken, partnerCipher, cid, pid);
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
            Penarikan otomatis data campaign TAP, produk kolaborasi, kreator, dan pesanan langsung via TikTok Partner Center.
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
              📌 Otorisasi Akun Agency (TAP):
            </p>
            <p>
              Otorisasi untuk akun Agency dilakukan melalui <b>Partner Center</b> (<code className="bg-amber-100 px-1 py-0.5 rounded">partner.tiktokshop.com/open/authorize?service_id=...</code>).
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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-sm font-medium">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>Access Token Berhasil Diperoleh & Aktif! {sellerName && `(Akun: ${sellerName})`}</span>
                </div>
                <button
                  type="button"
                  onClick={handleClearTokens}
                  className="self-start sm:self-auto px-2.5 py-1 text-xs text-rose-700 hover:text-rose-900 border border-rose-200 hover:border-rose-300 rounded bg-white hover:bg-rose-50 transition-colors"
                >
                  Reset Token
                </button>
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
        <CardContent className="p-6 space-y-6">
          {/* Campaign Filter Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Status Filter Campaign:</label>
              <select
                value={campaignStatus}
                onChange={(e) => setCampaignStatus(e.target.value)}
                className="w-full p-2 border rounded-lg bg-white text-slate-800"
              >
                <option value="ONGOING">ONGOING (Sedang Berjalan)</option>
                <option value="READY">READY (Siap Mulai)</option>
                <option value="UPCOMING">UPCOMING (Mendatang)</option>
                <option value="CLOSED">CLOSED (Selesai/Tutup)</option>
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Pilih Campaign Target {campaignList.length > 0 && `(${campaignList.length} Campaign Ditemukan)`}:
              </label>
              <select
                value={selectedCampaignId}
                onChange={(e) => setSelectedCampaignId(e.target.value)}
                className="w-full p-2 border rounded-lg bg-white text-slate-800 font-medium"
              >
                {campaignList.length > 0 ? (
                  campaignList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.id})
                    </option>
                  ))
                ) : (
                  <option value="7684116600044947221">
                    TNT X FELAUFEE AFFILIATE BOOSTER (7684116600044947221)
                  </option>
                )}
              </select>
            </div>
          </div>

          {/* Test Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <button
              onClick={handleTestCategoryAssets}
              disabled={!accessToken || activeTest !== null}
              className="flex flex-col items-center justify-center p-3 rounded-lg border border-slate-300 hover:border-indigo-500 hover:bg-indigo-50/50 text-xs font-semibold text-slate-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {activeTest === 'category_assets' ? <Loader2 className="w-5 h-5 animate-spin mb-1 text-indigo-600" /> : <ShieldCheck className="w-5 h-5 text-indigo-600 mb-1" />}
              <span>1. Cek Category Assets</span>
              <span className="text-[10px] text-slate-500 font-normal">Verifikasi Cipher TAP</span>
            </button>

            <button
              onClick={handleTestTapCampaigns}
              disabled={!accessToken || !partnerCipher || activeTest !== null}
              className="flex flex-col items-center justify-center p-3 rounded-lg border border-indigo-300 bg-indigo-50/50 hover:bg-indigo-100 text-xs font-bold text-indigo-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {activeTest === 'campaigns' ? <Loader2 className="w-5 h-5 animate-spin mb-1 text-indigo-600" /> : <Database className="w-5 h-5 text-indigo-600 mb-1" />}
              <span>2. Tarik Campaign TAP</span>
              <span className="text-[10px] text-indigo-600 font-normal">Daftar 96 Campaign TNT</span>
            </button>

            <button
              onClick={handleTestCampaignProducts}
              disabled={!accessToken || !partnerCipher || activeTest !== null}
              className="flex flex-col items-center justify-center p-3 rounded-lg border border-emerald-300 bg-emerald-50/50 hover:bg-emerald-100 text-xs font-bold text-emerald-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {activeTest === 'products' ? <Loader2 className="w-5 h-5 animate-spin mb-1 text-emerald-600" /> : <Package className="w-5 h-5 text-emerald-600 mb-1" />}
              <span>3. Tarik Produk Campaign</span>
              <span className="text-[10px] text-emerald-600 font-normal">Produk, SKU & Komisi</span>
            </button>

            <button
              onClick={handleTestCampaignCreators}
              disabled={!accessToken || !partnerCipher || activeTest !== null}
              className="flex flex-col items-center justify-center p-3 rounded-lg border border-purple-300 bg-purple-50/50 hover:bg-purple-100 text-xs font-bold text-purple-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {activeTest === 'creators' ? <Loader2 className="w-5 h-5 animate-spin mb-1 text-purple-600" /> : <Users className="w-5 h-5 text-purple-600 mb-1" />}
              <span>4. Tarik Creator & Sample</span>
              <span className="text-[10px] text-purple-600 font-normal">Kreator & Status Sample</span>
            </button>

            <button
              onClick={handleTestAffiliateOrders}
              disabled={!accessToken || !partnerCipher || activeTest !== null}
              className="flex flex-col items-center justify-center p-3 rounded-lg border border-amber-300 bg-amber-50/50 hover:bg-amber-100 text-xs font-bold text-amber-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {activeTest === 'affiliate_orders' ? <Loader2 className="w-5 h-5 animate-spin mb-1 text-amber-600" /> : <ShoppingBag className="w-5 h-5 text-amber-600 mb-1" />}
              <span>5. Cek Pesanan TAP</span>
              <span className="text-[10px] text-amber-600 font-normal">Search TAP Orders API</span>
            </button>
          </div>

          {/* Test Results Console Display */}
          {testResult && (
            <div className="mt-6 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold uppercase text-slate-500">Hasil Output Respon API TikTok:</span>
                <Badge variant={testResult.code === 0 || testResult.success ? 'success' : 'destructive'}>
                  {testResult.code === 0 || testResult.success ? 'HTTP 200 SUCCESS' : 'RESPONSE CODE: ' + (testResult.data?.code || testResult.code || testResult.status)}
                </Badge>
              </div>
              <pre className="p-4 bg-slate-900 text-emerald-400 font-mono text-xs rounded-xl overflow-x-auto max-h-[450px] leading-relaxed shadow-inner">
                {JSON.stringify(testResult, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
