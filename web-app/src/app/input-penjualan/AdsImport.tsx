"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Upload, AlertCircle, CheckCircle2, Loader2, Trash2, ArrowRight, ArrowLeft } from "lucide-react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { useDatabaseStore } from "@/store/useDatabaseStore";
import { StringCombobox } from "@/components/StringCombobox";
import { fetchAdNameMappingsAction, saveAdNameMappingAction, executeAdsImportAction } from "@/app/actions/importActions";

// SearchableSelect component
function SearchableSelect({ value, initialLabel, onChange, placeholder }: { value: number | '', initialLabel?: string, onChange: (val: number | '') => void, placeholder: string }) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<{id: number, label: string}[]>([]);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { creators } = useDatabaseStore();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchOptions = async () => {
      const trimmed = search.trim().replace(/\s+/g, '').replace(/^@/, '');
      if (!trimmed) {
        setOptions([]);
        return;
      }
      const matched = creators
        .filter(c => c.username.toLowerCase().includes(trimmed.toLowerCase()))
        .slice(0, 5)
        .map(c => ({ id: c.id, label: `@${c.username}` }));
      setOptions(matched);
    };
    const handler = setTimeout(fetchOptions, 200);
    return () => clearTimeout(handler);
  }, [search, creators]);

  const displayValue = open ? search : (value ? (options.find(o => o.id === value)?.label || initialLabel || search) : "");

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <input type="text" className="w-full p-2 border border-slate-300 rounded text-sm focus:outline-none focus:border-indigo-500 bg-white" placeholder={placeholder} value={displayValue} onClick={() => { setOpen(true); setSearch(""); }} onChange={(e) => { setSearch(e.target.value); setOpen(true); }} />
      {open && (
        <div className="absolute z-10 w-[250px] mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {options.length === 0 ? (
            <div className="p-2 text-xs text-slate-500 text-center">{search.trim() ? "Tidak ditemukan" : "Ketik untuk mencari..."}</div>
          ) : (
            <>{options.map(opt => <div key={opt.id} className="p-2 text-xs hover:bg-slate-50 cursor-pointer" onClick={() => { onChange(opt.id); setSearch(opt.label); setOpen(false); }}>{opt.label}</div>)}</>
          )}
        </div>
      )}
    </div>
  );
}

type FileConfig = {
  id: string;
  file: File;
  tanggal: string;
  kurs: string;
  parsedData?: any[];
};

export default function AdsImport() {
  const [files, setFiles] = useState<FileConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [result, setResult] = useState<{success: number; errors: string[]} | null>(null);
  
  const { campaigns, creators } = useDatabaseStore();

  // Carousel Mapping State
  const [unmappedAdsByFile, setUnmappedAdsByFile] = useState<{fileId: string, fileName: string, unmapped: {adName: string, adId: string}[]}[]>([]);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [mappings, setMappings] = useState<Record<string, number>>({});
  
  // Global Config State
  const [globalCampaignId, setGlobalCampaignId] = useState<number | ''>('');
  const [globalCampaignAdsName, setGlobalCampaignAdsName] = useState('');
  const [globalCampaignAdsOptions, setGlobalCampaignAdsOptions] = useState<string[]>([]);

  useEffect(() => {
    const fetchCampaignAds = async () => {
      try {
        const mappingsData = await fetchAdNameMappingsAction();
        const unique = Array.from(new Set(mappingsData.map((d: any) => d.ad_name).filter(Boolean))) as string[];
        setGlobalCampaignAdsOptions(unique);
      } catch (err) {
        console.error('Error fetching campaign ads options:', err);
      }
    };
    fetchCampaignAds();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setLoading(true);
      
      const newFiles = Array.from(e.target.files).map(f => {
        const dateMatch = f.name.match(/(\d{4}-\d{2}-\d{2})/g);
        const guessedDate = dateMatch && dateMatch.length > 0 ? dateMatch[dateMatch.length - 1] : new Date().toISOString().split('T')[0];
        
        return {
          id: Math.random().toString(),
          file: f,
          tanggal: guessedDate,
          kurs: '16000'
        };
      });

      const filesWithData = [...files, ...newFiles];
      let hasMissingAdId = false;

      // Get existing mappings
      const knownMappingMap: Record<string, number> = { ...mappings };
      try {
        const existingMappings = await fetchAdNameMappingsAction();
        existingMappings.forEach((m: any) => {
          if (!knownMappingMap[m.ad_name] && m.creator_id) {
            knownMappingMap[m.ad_name] = m.creator_id;
          }
        });
      } catch (err) {
        console.error('Error loading mappings:', err);
      }

      let unmappedByFile: {fileId: string, fileName: string, unmapped: {adName: string, adId: string}[]}[] = [];

      for (let i = 0; i < filesWithData.length; i++) {
        const fConfig = filesWithData[i];
        if (fConfig.parsedData) continue; // Already parsed
        
        const ext = fConfig.file.name.split('.').pop()?.toLowerCase();
        
        const parsed = await new Promise<any[]>((resolve, reject) => {
          if (ext === 'csv') {
            Papa.parse(fConfig.file, {
              header: true, skipEmptyLines: true,
              complete: (results) => resolve(results.data),
              error: reject
            });
          } else {
            const reader = new FileReader();
            reader.onload = (e) => {
              const data = new Uint8Array(e.target?.result as ArrayBuffer);
              const workbook = XLSX.read(data, { type: 'array' });
              const worksheet = workbook.Sheets[workbook.SheetNames[0]];
              resolve(XLSX.utils.sheet_to_json(worksheet));
            };
            reader.readAsArrayBuffer(fConfig.file);
          }
        });

        const validData = parsed.filter(row => {
          if (Object.keys(row).length === 0) return false;
          const adName = String(row['Ad name'] || row['Ad Name'] || row['Ad Group Name'] || '').trim();
          const adId = String(row['Ad ID'] || row['Ad ID (Shop)'] || row['Ad Id'] || '').trim();
          // Ignore summary rows from TikTok Ads
          if (adName.toLowerCase().startsWith('total of') || adName.toLowerCase() === 'total' || adId.toLowerCase().includes('total') || (!adName && !adId)) return false;
          return !!adName;
        });
        const missingAdIds = validData.filter(row => !String(row['Ad ID'] || row['Ad ID (Shop)'] || row['Ad Id'] || '').trim());
        
        if (missingAdIds.length > 0) {
          alert(`BLOKIR: File ${fConfig.file.name} memiliki ${missingAdIds.length} baris tanpa Ad ID. Harap perbaiki sebelum upload.`);
          hasMissingAdId = true;
          break;
        }
        
        fConfig.parsedData = validData;
        
        // Find unmapped
        let unknownAdsMap = new Map<string, string>(); 
        for (const row of validData) {
          const adName = row['Ad name'] || row['Ad Name'] || row['Ad Group Name'] || '';
          const adId = String(row['Ad ID'] || row['Ad ID (Shop)'] || row['Ad Id'] || '').trim();
          if (adName && !knownMappingMap[adName]) {
            unknownAdsMap.set(adName, adId);
          }
        }
        
        if (unknownAdsMap.size > 0) {
          unmappedByFile.push({
            fileId: fConfig.id,
            fileName: fConfig.file.name,
            unmapped: Array.from(unknownAdsMap.entries()).map(([name, id]) => ({ adName: name, adId: id }))
          });
        }
      }

      setLoading(false);

      if (hasMissingAdId) return;

      setFiles(filesWithData);
      setMappings(knownMappingMap);

      if (unmappedByFile.length > 0) {
        setUnmappedAdsByFile(unmappedByFile);
        setCurrentFileIndex(0);
        setStep(2);
      } else {
        setStep(3);
      }
    }
  };

  const updateFileConfig = (id: string, field: keyof FileConfig, value: any) => {
    setFiles(files.map(f => f.id === id ? { ...f, [field]: value } : f));
  };

  const executeImport = async () => {
    setLoading(true);
    setStep(5);

    try {
      let successCount = 0;
      let errors: string[] = [];

      // Save new mappings globally
      const newMappingsToSave = Object.entries(mappings).map(([name, creatorId]) => ({ ad_name: name, creator_id: creatorId }));
      for (const mapping of newMappingsToSave) {
        await saveAdNameMappingAction(mapping);
      }

      // Process each file
      for (const fConfig of files) {
        if (!fConfig.parsedData) continue;
        
        const safeParseNum = (val: any) => {
          if (!val) return 0;
          if (typeof val === 'number') return val;
          const cleaned = String(val).replace(/[^0-9.-]+/g, "");
          return Number(cleaned) || 0;
        };

        const rawInserts = fConfig.parsedData.map(row => {
          const adName = row['Ad name'] || row['Ad Name'] || row['Ad Group Name'] || '';
          const adId = String(row['Ad ID'] || row['Ad ID (Shop)'] || row['Ad Id']).trim();
          const costUsd = safeParseNum(row['Cost'] || row['Spend'] || row['Amount Spent (USD)']);
          const grossRevenueUsd = safeParseNum(row['Gross revenue (Shop)'] || row['Total Revenue']);
          const purchases = safeParseNum(row['Purchases (Shop)'] || row['Purchases'] || row['Conversions']);
          const impressions = safeParseNum(row['Impressions']);
          const clicks = safeParseNum(row['Clicks (destination)'] || row['Clicks']);
          const ppv = safeParseNum(row['Product page views'] || row['Product Page Views']);
          const checkouts = safeParseNum(row['Checkouts initiated'] || row['Checkouts Initiated']);
          const itemsPurchased = safeParseNum(row['Items purchased'] || row['Items Purchased']);
          
          return {
            campaign_id: globalCampaignId ? Number(globalCampaignId) : null,
            campaign_ads_name: globalCampaignAdsName,
            tanggal: fConfig.tanggal,
            kurs: Number(fConfig.kurs) || 16000,
            ad_name: adName,
            ad_id: adId,
            creator_id: mappings[adName] || null,
            cost_usd: costUsd,
            gross_revenue_usd: grossRevenueUsd,
            purchases: purchases,
            impressions: impressions,
            clicks: clicks,
            product_page_views: ppv,
            checkouts_initiated: checkouts,
            items_purchased: itemsPurchased,
            raw_data: row
          };
        });

        const res = await executeAdsImportAction(
          rawInserts,
          {
            minDate: fConfig.tanggal,
            maxDate: fConfig.tanggal
          },
          globalCampaignId ? Number(globalCampaignId) : undefined
        );

        if (res.success) {
          successCount += res.count;
        } else {
          errors.push(`File ${fConfig.file.name}: Gagal import`);
        }
      }

      setResult({ success: successCount, errors });
      setStep(6);
      
      if (successCount > 0) {
        const { fetchData } = useDatabaseStore.getState();
        await fetchData();
      }
    } catch (err: any) {
      alert("Terjadi kesalahan sistem saat import: " + err.message);
      console.error(err);
      setStep(4);
    } finally {
      setLoading(false);
    }
  };

  const handleNextSlide = () => {
    if (currentFileIndex < unmappedAdsByFile.length - 1) {
      setCurrentFileIndex(i => i + 1);
    } else {
      setStep(3); // move to global config
    }
  };
  
  const handlePrevSlide = () => {
    if (currentFileIndex > 0) {
      setCurrentFileIndex(i => i - 1);
    }
  };

  return (
    <Card className="border-0 shadow-sm ring-1 ring-slate-200">
      <CardContent className="p-0">
        
        {/* STEP PROGRESS INDICATOR */}
        <div className="flex bg-slate-50 border-b border-slate-200 p-4 text-sm font-medium text-slate-500 overflow-x-auto whitespace-nowrap">
          <div className={`flex items-center ${step >= 1 ? 'text-indigo-600' : ''}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center mr-2 text-xs ${step >= 1 ? 'bg-indigo-600 text-white' : 'bg-slate-200'}`}>1</span>
            Upload File
          </div>
          <div className="mx-4 text-slate-300">/</div>
          <div className={`flex items-center ${step >= 2 ? 'text-indigo-600' : ''}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center mr-2 text-xs ${step >= 2 ? 'bg-indigo-600 text-white' : 'bg-slate-200'}`}>2</span>
            Mapping
          </div>
          <div className="mx-4 text-slate-300">/</div>
          <div className={`flex items-center ${step >= 3 ? 'text-indigo-600' : ''}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center mr-2 text-xs ${step >= 3 ? 'bg-indigo-600 text-white' : 'bg-slate-200'}`}>3</span>
            Set Campaign
          </div>
          <div className="mx-4 text-slate-300">/</div>
          <div className={`flex items-center ${step >= 4 ? 'text-indigo-600' : ''}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center mr-2 text-xs ${step >= 4 ? 'bg-indigo-600 text-white' : 'bg-slate-200'}`}>4</span>
            Set Tanggal & Kurs
          </div>
        </div>

        <div className="p-8">
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="border-2 border-dashed border-indigo-200 rounded-2xl p-12 text-center bg-indigo-50/50 hover:bg-indigo-50 transition-colors">
                <Upload className="w-12 h-12 text-indigo-400 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-slate-800 mb-2">Upload File Excel/CSV TikTok Ads</h3>
                <p className="text-slate-500 mb-6 max-w-md mx-auto">Tarik & lepas banyak file sekaligus ke area ini, atau klik tombol di bawah untuk memilih file dari komputer Anda.</p>
                <input type="file" multiple accept=".csv, .xlsx, .xls" className="hidden" id="ads-upload" onChange={handleFileUpload} disabled={loading} />
                <Button className="rounded-xl h-12 px-8 bg-indigo-600 hover:bg-indigo-700" disabled={loading} onClick={() => document.getElementById('ads-upload')?.click()}>
                  {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
                  {loading ? "Memproses File..." : "Pilih File Sekarang"}
                </Button>
              </div>
              <div className="mt-8 pt-8 border-t border-slate-100 w-full flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-slate-700 text-sm">Butuh format CSV yang benar?</h4>
                  <p className="text-xs text-slate-500 mt-1">Unduh template agar sesuai dengan sistem.</p>
                </div>
                <Button variant="outline" onClick={() => {
                  const headers = ['Ad ID', 'Ad name', 'Cost', 'Gross revenue (Shop)', 'Purchases (Shop)', 'Impressions', 'Clicks (destination)', 'Product page views (Shop)', 'Checkouts initiated (Shop)', 'Items purchased (Shop)'];
                  const blob = new Blob([headers.join(',')], { type: 'text/csv;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.setAttribute('download', 'Ads_Performance_Template.csv');
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }} className="gap-2 rounded-xl">
                  Unduh Template CSV
                </Button>
              </div>
            </div>
          )}

          {step === 2 && unmappedAdsByFile.length > 0 && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-slate-800">Mapping Kreator</h3>
                  <p className="text-slate-500">Terdapat Iklan yang tidak dikenali sistem. Silakan petakan ke kreator yang tepat.</p>
                </div>
                <div className="bg-amber-100 text-amber-800 px-4 py-2 rounded-lg font-bold flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  File {currentFileIndex + 1} dari {unmappedAdsByFile.length}
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 font-semibold text-slate-700">
                  📄 {unmappedAdsByFile[currentFileIndex].fileName}
                </div>
                <div className="max-h-[400px] overflow-y-auto p-0">
                  <table className="w-full text-sm">
                    <thead className="bg-white sticky top-0 z-10 shadow-sm">
                      <tr>
                        <th className="px-6 py-3 text-left font-semibold text-slate-500 uppercase text-xs tracking-wider">Ad Name (Dari File)</th>
                        <th className="px-6 py-3 text-left font-semibold text-slate-500 uppercase text-xs tracking-wider w-1/2">Pilih Kreator</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {unmappedAdsByFile[currentFileIndex].unmapped.map((ad, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="px-6 py-4 font-medium text-slate-700">{ad.adName}</td>
                          <td className="px-6 py-4">
                            <SearchableSelect 
                              value={mappings[ad.adName] || ''} 
                              initialLabel={mappings[ad.adName] ? `@${creators.find(c => c.id === mappings[ad.adName])?.username}` : ''} 
                              onChange={(val) => setMappings({...mappings, [ad.adName]: val as number})} 
                              placeholder="Cari username kreator..." 
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4">
                <Button variant="outline" className="h-12 px-6 rounded-xl" onClick={handlePrevSlide} disabled={currentFileIndex === 0}>
                  <ArrowLeft className="w-4 h-4 mr-2" /> Sebelumnya
                </Button>
                
                <Button className="h-12 px-8 rounded-xl bg-indigo-600 hover:bg-indigo-700" onClick={handleNextSlide}>
                  {currentFileIndex === unmappedAdsByFile.length - 1 ? (
                    <>Selesai Mapping <CheckCircle2 className="w-4 h-4 ml-2" /></>
                  ) : (
                    <>Selanjutnya <ArrowRight className="w-4 h-4 ml-2" /></>
                  )}
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="max-w-xl mx-auto space-y-6 animate-in zoom-in-95 duration-300 py-10">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8 text-indigo-600" />
                </div>
                <h3 className="text-2xl font-bold text-slate-800">Pengaturan Campaign Global</h3>
                <p className="text-slate-500 mt-2">Semua file yang Anda upload akan dimasukkan ke Campaign di bawah ini.</p>
              </div>

              <div className="space-y-4 bg-slate-50 p-6 rounded-2xl border border-slate-200">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Campaign di Sistem</label>
                  <select className="w-full p-3 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" value={globalCampaignId} onChange={(e) => setGlobalCampaignId(Number(e.target.value))}>
                    <option value="">-- Pilih Campaign --</option>
                    {campaigns.map(c => <option key={c.id} value={c.id}>{c.nama}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Campaign Ads (Nama Group Ads)</label>
                  <div className="bg-white rounded-xl">
                    <StringCombobox 
                      value={globalCampaignAdsName} 
                      onChange={(val) => setGlobalCampaignAdsName(val)} 
                      options={globalCampaignAdsOptions} 
                      placeholder="Contoh: QAHIRA" 
                      className="w-full h-12"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <Button 
                  className="w-full h-12 text-md rounded-xl bg-indigo-600 hover:bg-indigo-700" 
                  disabled={!globalCampaignId || !globalCampaignAdsName} 
                  onClick={() => setStep(4)}
                >
                  Lanjut ke Pengaturan Tanggal & Kurs <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div>
                <h3 className="text-xl font-bold text-slate-800">Finalisasi Tanggal & Kurs</h3>
                <p className="text-slate-500">Tentukan tanggal data dan kurs USD untuk masing-masing file sebelum di-import.</p>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-3 text-left font-semibold text-slate-500 uppercase text-xs tracking-wider">Nama File</th>
                      <th className="px-6 py-3 text-left font-semibold text-slate-500 uppercase text-xs tracking-wider">Tanggal Data</th>
                      <th className="px-6 py-3 text-left font-semibold text-slate-500 uppercase text-xs tracking-wider">Kurs (IDR/USD)</th>
                      <th className="px-6 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {files.map((f, index) => (
                      <tr key={f.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 font-medium text-slate-700">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded bg-green-100 text-green-600 flex items-center justify-center font-bold text-xs">{index + 1}</div>
                            <span className="truncate max-w-[250px]" title={f.file.name}>{f.file.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <input type="date" className="p-2 border border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg w-[150px]" value={f.tanggal} onChange={(e) => updateFileConfig(f.id, 'tanggal', e.target.value)} />
                        </td>
                        <td className="px-6 py-4">
                          <div className="relative">
                            <span className="absolute left-3 top-2.5 text-slate-400">Rp</span>
                            <input type="number" className="p-2 pl-8 border border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg w-[130px]" value={f.kurs} onChange={(e) => updateFileConfig(f.id, 'kurs', e.target.value)} />
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button onClick={() => setFiles(files.filter(file => file.id !== f.id))} className="text-red-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition-colors">
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div className="flex gap-4 pt-4">
                <Button variant="outline" className="w-1/4 h-12 rounded-xl" onClick={() => setStep(3)}>Kembali</Button>
                <Button className="w-3/4 h-12 text-md rounded-xl bg-indigo-600 hover:bg-indigo-700" onClick={executeImport}>
                  <Upload className="w-5 h-5 mr-2" /> Mulai Import ke Database
                </Button>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="text-center py-24 animate-in zoom-in-95 duration-500">
              <Loader2 className="w-20 h-20 text-indigo-600 animate-spin mx-auto mb-8" />
              <h3 className="text-3xl font-bold text-slate-800 mb-3">Menyimpan Data...</h3>
              <p className="text-slate-500 text-lg">Proses ini memakan waktu beberapa detik. Jangan tutup halaman ini.</p>
            </div>
          )}

          {step === 6 && result && (
            <div className="text-center py-16 animate-in slide-in-from-bottom-8 duration-500">
              <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-8 shadow-sm">
                <CheckCircle2 className="w-12 h-12 text-green-500" />
              </div>
              <h3 className="text-4xl font-black text-slate-800 mb-3">Selesai!</h3>
              <p className="text-slate-600 mb-10 text-lg">Berhasil meng-import <strong className="text-indigo-600">{result.success}</strong> baris data.</p>
              
              {result.errors.length > 0 && (
                <div className="bg-red-50 text-red-700 p-6 rounded-2xl text-left text-sm max-h-60 overflow-y-auto mb-10 border border-red-100 max-w-2xl mx-auto shadow-inner">
                  <p className="font-bold mb-3 flex items-center gap-2"><AlertCircle className="w-5 h-5" /> Beberapa baris gagal:</p>
                  <ul className="list-disc pl-5 space-y-2">
                    {result.errors.map((err, i) => <li key={i}>{err}</li>)}
                  </ul>
                </div>
              )}

              <Button className="h-14 px-10 rounded-xl bg-slate-900 hover:bg-slate-800 text-lg font-semibold" onClick={() => { setStep(1); setFiles([]); }}>
                Import File Lainnya
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
