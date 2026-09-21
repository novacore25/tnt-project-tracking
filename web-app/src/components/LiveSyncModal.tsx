"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Upload, Loader2, FileSpreadsheet, CheckCircle } from "lucide-react";
import * as xlsx from 'xlsx';
import { importLiveOrganicAction } from "@/app/actions/importActions";

const parseRp = (val: any) => {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  return parseInt(val.toString().replace(/[Rp\.\s]/g, ''), 10) || 0;
};

export function LiveSyncModal() {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState('');
  const [stats, setStats] = useState({ sessions: 0, products: 0 });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
  };

  const handleProcess = async () => {
    if (!file) return;
    setIsProcessing(true);
    setStatus('Membaca file Excel...');
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = xlsx.read(arrayBuffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rawData = xlsx.utils.sheet_to_json(worksheet, { defval: null }) as any[];

      setStatus('Memproses baris data...');
      
      const sessionsMap = new Map<string, any>();
      const productsList: any[] = [];

      for (const row of rawData) {
        // Skip summary row or invalid rows
        const creatorName = row['Creator name'] || '';
        if (creatorName === '-' || !creatorName) continue;
        
        const roomId = (row['Livestream room ID'] || '').toString();
        if (!roomId || roomId === '-') continue;

        // Clean username
        const username = creatorName.toString().trim().replace(/^@/, '').replace(/\s+/g, '');

        if (!sessionsMap.has(roomId)) {
          // Parse LIVE time info
          const timeInfo = row['LIVE time info'] || '';
          let startTime = null;
          let endTime = null;
          if (timeInfo && timeInfo.includes('-')) {
            if (timeInfo.length >= 39) {
              startTime = timeInfo.substring(0, 19);
              endTime = timeInfo.substring(20, 39);
            }
          }

          sessionsMap.set(roomId, {
            livestream_room_id: roomId,
            creator_username: username,
            tt_campaign_id: (row['Campaign ID'] || '').toString(),
            livestream_name: row['Livestream name'] || null,
            start_time: startTime,
            end_time: endTime,
            duration_str: row['Duration'] || null,
            live_views: parseInt(row['LIVE views']) || 0,
            live_likes: parseInt(row['LIVE likes']) || 0,
            live_product_rpm: parseRp(row['LIVE product RPM']),
          });
        }

        const productId = (row['Product ID'] || '').toString();
        if (productId && productId !== '-') {
          productsList.push({
            livestream_room_id: roomId,
            product_id: productId,
            product_name: row['Product name'] || null,
            shop_id: (row['Shop ID'] || '').toString(),
            shop_name: row['Shop name'] || null,
            category_1: row['Level 1 category'] || null,
            category_2: row['Level 2 category'] || null,
            gmv: parseRp(row['Affiliate LIVE GMV']),
            orders: parseInt(row['LIVE orders']) || 0,
            items_sold: parseInt(row['Items sold']) || 0,
            commission: parseRp(row['Estimated affiliate partner commission '] || row['Estimated affiliate partner commission']),
            actual_commission: parseRp(row['Actual affiliate partner commission']),
          });
        }
      }

      const sessionsArray = Array.from(sessionsMap.values());
      
      setStatus(`Menyimpan ${sessionsArray.length} Sesi Live dan ${productsList.length} Produk via Server Action...`);
      const result = await importLiveOrganicAction(sessionsArray, productsList);
      if (!result.success) {
        throw new Error(result.error);
      }

      setStats({ sessions: sessionsArray.length, products: productsList.length });
      setStatus('Selesai! Berhasil mensinkronisasi data.');

    } catch (err: any) {
      console.error(err);
      setStatus(`Error: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="flex flex-col items-center justify-center gap-3 bg-white p-6 rounded-xl border border-slate-200 hover:border-pink-300 hover:shadow-md transition-all text-center">
          <div className="w-12 h-12 rounded-full bg-pink-100 flex items-center justify-center text-pink-600 mb-2">
            <Upload className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800">Live Organic Data</h3>
            <p className="text-sm text-slate-500 mt-1">Export dari Partner Center</p>
          </div>
        </button>
      </DialogTrigger>
      
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Import Data Live Organik</DialogTitle>
        </DialogHeader>

        {!stats.sessions ? (
          <div className="space-y-6 pt-4">
            <div className="flex items-center gap-4 p-4 bg-pink-50 text-pink-800 rounded-xl border border-pink-100">
              <FileSpreadsheet className="w-8 h-8 shrink-0" />
              <div className="text-sm">
                <p className="font-medium mb-1">Panduan Export:</p>
                <ul className="text-xs text-slate-600 list-disc list-inside space-y-1">
                  <li>Buka TikTok Partner Center</li>
                  <li>Download file <strong>CustomReport_Campaign_Creator_Live_Product...</strong></li>
                  <li>Pilih file berformat <strong>.xlsx</strong>.</li>
                </ul>
              </div>
            </div>

            <div className="space-y-2">
              <input 
                type="file" 
                accept=".xlsx, .csv" 
                onChange={handleFileChange} 
                disabled={isProcessing}
                className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-pink-50 file:text-pink-700 hover:file:bg-pink-100 disabled:opacity-50" 
              />
            </div>

            {status && (
              <div className="p-3 bg-slate-50 border rounded text-sm text-slate-700">
                {isProcessing && <Loader2 className="w-4 h-4 inline animate-spin mr-2" />}
                {status}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={isProcessing}>Batal</Button>
              <Button onClick={handleProcess} disabled={!file || isProcessing} className="bg-pink-600 hover:bg-pink-700 text-white">
                Mulai Import
              </Button>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center space-y-4">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold">Import Berhasil!</h3>
            <p className="text-slate-600">
              Tersimpan <strong>{stats.sessions}</strong> sesi Live dengan total <strong>{stats.products}</strong> record produk.
            </p>
            <Button onClick={() => setOpen(false)} className="mt-4">Tutup</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
