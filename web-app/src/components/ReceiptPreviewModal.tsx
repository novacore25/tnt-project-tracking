"use client";

import React, { useState } from 'react';
import { X, ExternalLink, CheckCircle2, Copy, Check, ZoomIn } from 'lucide-react';

interface ReceiptPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: {
    creatorUsername?: string;
    namaPenerima?: string;
    nomorRekening?: string;
    bankName?: string;
    nominal?: number;
    previewUrl?: string | null;
    originalGdriveUrl?: string | null;
    referenceNo?: string | null;
  } | null;
}

export function ReceiptPreviewModal({ isOpen, onClose, data }: ReceiptPreviewModalProps) {
  const [copied, setCopied] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);

  if (!isOpen || !data) return null;

  const handleCopyLink = () => {
    if (data.previewUrl) {
      navigator.clipboard.writeText(data.previewUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-800">
                  Bukti Transfer Kreator
                </h3>
                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded border border-emerald-200">
                  OCR Matched
                </span>
              </div>
              <p className="text-xs text-slate-500">
                @{data.creatorUsername || 'creator'} • {data.bankName || 'Bank'} ({data.nomorRekening || '-'})
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Data Summary Bar */}
        <div className="px-6 py-2.5 bg-blue-50/60 border-b border-blue-100 grid grid-cols-3 gap-2 text-xs">
          <div>
            <span className="text-slate-500 block text-[10px] font-semibold uppercase">Nominal Transfer</span>
            <span className="font-bold text-blue-700 text-sm">
              Rp {Number(data.nominal || 0).toLocaleString('id-ID')}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] font-semibold uppercase">Atas Nama</span>
            <span className="font-semibold text-slate-800 truncate block" title={data.namaPenerima}>
              {data.namaPenerima || '-'}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] font-semibold uppercase">No Rekening / VA</span>
            <span className="font-mono text-slate-700 text-[11px] block truncate">
              {data.nomorRekening || '-'}
            </span>
          </div>
        </div>

        {/* Image Preview Container */}
        <div className="flex-1 p-4 bg-slate-100 overflow-y-auto flex items-center justify-center min-h-[300px]">
          {data.previewUrl ? (
            <div className="relative group max-w-full">
              <img 
                src={data.previewUrl} 
                alt="Bukti Transfer"
                className={`max-w-full rounded-xl border border-slate-300 shadow-md transition-all duration-200 bg-white object-contain ${
                  isZoomed ? 'scale-125 cursor-zoom-out my-12' : 'max-h-[52vh] cursor-zoom-in'
                }`}
                onClick={() => setIsZoomed(!isZoomed)}
              />
              <div className="absolute bottom-2 right-2 flex gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => setIsZoomed(!isZoomed)}
                  className="p-1.5 bg-slate-900/80 hover:bg-slate-900 text-white rounded-md text-xs flex items-center gap-1 shadow"
                  title="Zoom Gambar"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                  <span className="text-[10px]">{isZoomed ? 'Reset' : 'Zoom'}</span>
                </button>
                <a 
                  href={data.previewUrl} 
                  target="_blank" 
                  rel="noreferrer"
                  className="p-1.5 bg-slate-900/80 hover:bg-slate-900 text-white rounded-md text-xs flex items-center gap-1 shadow"
                  title="Buka Gambar Resolusi Penuh"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-400">
              <p className="text-sm">Gambar bukti transfer belum tersedia atau sedang diproses.</p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {data.originalGdriveUrl && (
              <a
                href={data.originalGdriveUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 hover:border-blue-300 transition-colors shadow-sm w-full sm:w-auto"
                title="Buka File / Folder Asli di Google Drive jika gambar preview salah"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Buka Google Drive Asli (Cari Manual)</span>
              </a>
            )}
            {data.previewUrl && (
              <button
                onClick={handleCopyLink}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                title="Salin Link Gambar Preview"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            )}
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors w-full sm:w-auto text-center"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
