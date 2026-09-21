"use client";

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Upload, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import { resolveCreatorForMigration, importHistoricalBatch } from '../../../actions/paymentActions';
import { useAuth } from '@/providers/AuthProvider';

export default function ImportHistoricalBatchPage() {
  const params = useParams();
  const router = useRouter();
  const { profile } = useAuth();
  const campaignId = Number(params.id);

  const [batchName, setBatchName] = useState("");
  const [fileData, setFileData] = useState<any[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState("");

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        
        // Map excel format to our format
        const mappedData = data.map((row: any, index: number) => {
          let tglPengajuan = new Date().toISOString();
          if (row['Tanggal Pembayaran']) {
            const serial = Number(row['Tanggal Pembayaran']);
            if (!isNaN(serial) && serial > 25569) {
               // Excel serial date to JS Date
               tglPengajuan = new Date(Math.round((serial - 25569) * 86400 * 1000)).toISOString();
            }
          }

          let tglActual = tglPengajuan;
          if (row['Tgl Actual Payment '] || row['Tgl Actual Payment']) {
             const serialActual = Number(row['Tgl Actual Payment '] || row['Tgl Actual Payment']);
             if (!isNaN(serialActual) && serialActual > 25569) {
                 tglActual = new Date(Math.round((serialActual - 25569) * 86400 * 1000)).toISOString();
             }
          }

          return {
            _rowId: index + 2, // Excel row number
            username: row['Username Creator']?.toString().replace('@', '').trim() || '',
            payment_type: mapPaymentType(row['Status']),
            nominal: Number(row['Ratecard'] || 0),
            ratecard_awal: Number(row['Ratecard Awal'] || row['Ratecard'] || 0),
            metode_pembayaran: row['Metode Pembayaran'] || '',
            nomor_rekening: row['Nomor Rekening/ VA'] || row['Nomor Rekening/ VA\n'] || '',
            nama_penerima: row['Nama Penerima Bank'] || row['Nama Penerima Bank '] || '',
            notes: row['Note'] || '',
            nomor_wa_dealing: row['Nomor WA Dealing'] || '',
            nama_wa_pic: row['Nama WA PIC'] || row['Nama WA PIC '] || '',
            alamat_ktp: row['Alamat sesuai KTP'] || row['Alamat sesuai KTP '] || '',
            nik: row['NIK'] || '',
            link_ktp: row['Link Drive KTP'] || '',
            link_kontrak: row['Kontrak'] || '',
            bukti_transfer_url: row['Link Bukti TF'] || '',
            status_excel: row['Status Pembayaran'],
            raw_payment_type: row['Status'],
            pic_name: row['PIC'] || '',
            tanggal_pengajuan: tglPengajuan,
            tanggal_aktual: tglActual
          };
        });

        // Filter only paid off items
        const paidItems = mappedData.filter((item: any) => 
          item.status_excel?.toString().toLowerCase().includes('paid') &&
          item.username !== ''
        );

        setFileData(paidItems);
        setError("");
      } catch (err: any) {
        setError("Gagal membaca file Excel. Pastikan format sesuai template.");
      }
    };
    reader.readAsBinaryString(file);
  };

  const mapPaymentType = (status: string) => {
    if (!status) return '100_akhir';
    const s = status.toLowerCase();
    if (s.includes('dp') || s.includes('awal')) return '50_awal';
    if (s.includes('pelunasan') && s.includes('50')) return '50_akhir';
    return '100_akhir';
  };

  const handleImport = async () => {
    if (!batchName) {
      setError("Silakan isi nama batch migrasi terlebih dahulu.");
      return;
    }
    if (fileData.length === 0) {
      setError("Tidak ada data yang valid untuk diimpor.");
      return;
    }

    setIsValidating(true);
    setError("");

    try {
      const picId = profile?.id || '';

      // Validate & Resolve Creators
      const itemsToImport = [];
      for (const row of fileData) {
        if (!row.username) continue;
        
        // Resolve creator
        const campaignCreatorId = await resolveCreatorForMigration(
          row.username,
          campaignId,
          picId,
          row
        );

        itemsToImport.push({
          ...row,
          campaign_creator_id: campaignCreatorId,
        });
      }

      setIsValidating(false);
      setIsImporting(true);

      // Perform bulk insert batch
      await importHistoricalBatch(campaignId, batchName, itemsToImport);

      router.push(`/campaigns/${campaignId}/keuangan`);
      router.refresh();

    } catch (err: any) {
      setError(err.message);
      setIsValidating(false);
      setIsImporting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <Link href={`/campaigns/${campaignId}/keuangan`} className="text-sm text-blue-600 hover:underline flex items-center gap-2 mb-6">
        <ArrowLeft className="w-4 h-4" /> Kembali ke Keuangan
      </Link>

      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Migrasi Pembayaran Historis</h1>
        <p className="text-slate-500 mb-6">
          Gunakan fitur ini HANYA untuk memasukkan data pembayaran masa lalu yang sudah LUNAS (Paid Off).
          Sistem akan langsung menetapkan status batch sebagai Paid tanpa melalui funnel persetujuan.
        </p>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nama Batch Migrasi</label>
            <input 
              type="text" 
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Contoh: Migrasi Data Agustus 2026"
              value={batchName}
              onChange={(e) => setBatchName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Upload File Excel (.xlsx)</label>
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:bg-slate-50 transition">
              <Upload className="w-10 h-10 text-slate-400 mx-auto mb-3" />
              <div className="text-sm text-slate-600 mb-2">
                Format kolom wajib: <strong>Username Creator, Status, Ratecard, Metode Pembayaran, Nomor Rekening/ VA, Nama Penerima Bank, Status Pembayaran</strong>
              </div>
              <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="block w-full max-w-sm mx-auto text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
            </div>
          </div>

          {error && (
            <div className="p-4 bg-red-50 text-red-700 rounded-lg flex items-start gap-3 text-sm">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <div>{error}</div>
            </div>
          )}

          {fileData.length > 0 && (
            <div>
              <h3 className="font-semibold text-slate-700 mb-3 flex items-center justify-between">
                <span>Preview Data Siap Migrasi ({fileData.length} baris)</span>
              </h3>
              <div className="bg-slate-50 rounded-lg border overflow-hidden max-h-80 overflow-y-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-slate-500 uppercase bg-slate-100 sticky top-0">
                    <tr>
                      <th className="px-4 py-3">Baris</th>
                      <th className="px-4 py-3">Tgl Pengajuan</th>
                      <th className="px-4 py-3">Username</th>
                      <th className="px-4 py-3">PIC</th>
                      <th className="px-4 py-3">Tipe</th>
                      <th className="px-4 py-3 text-right">Nominal (Rp)</th>
                      <th className="px-4 py-3">Bank</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fileData.map((row, idx) => (
                      <tr key={idx} className="border-b last:border-0 bg-white">
                        <td className="px-4 py-2 text-slate-500">{row._rowId}</td>
                        <td className="px-4 py-2 text-xs text-slate-500">
                          {new Date(row.tanggal_pengajuan).toLocaleDateString('id-ID')}
                        </td>
                        <td className="px-4 py-2 font-medium">@{row.username}</td>
                        <td className="px-4 py-2 text-xs text-slate-500">{row.pic_name || '-'}</td>
                        <td className="px-4 py-2 text-xs uppercase text-slate-500">{row.payment_type?.replace('_', ' ')}</td>
                        <td className="px-4 py-2 text-right">{row.nominal.toLocaleString()}</td>
                        <td className="px-4 py-2">{row.metode_pembayaran}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="pt-4 border-t flex justify-end">
            <button 
              onClick={handleImport}
              disabled={isValidating || isImporting || fileData.length === 0 || !batchName}
              className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition"
            >
              {(isValidating || isImporting) && <Loader2 className="w-4 h-4 animate-spin" />}
              {isValidating ? "Validasi Kreator..." : isImporting ? "Menyimpan Migrasi..." : "Eksekusi Migrasi"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
