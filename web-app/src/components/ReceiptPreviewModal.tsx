"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, ExternalLink, CheckCircle2, Copy, Check, ZoomIn, ZoomOut, RotateCcw, Move } from 'lucide-react';

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
  // RULE 26: Declare all hooks at the very top before any early return!
  const [copied, setCopied] = useState(false);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset zoom & pan when opening modal or changing data
  useEffect(() => {
    if (isOpen) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
      setIsDragging(false);
    }
  }, [isOpen, data?.previewUrl]);

  const handleCopyLink = useCallback(() => {
    if (data?.previewUrl) {
      navigator.clipboard.writeText(data.previewUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [data?.previewUrl]);

  const handleResetZoom = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  const handleZoomIn = useCallback(() => {
    setScale((prev) => Math.min(3.5, Number((prev + 0.25).toFixed(2))));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale((prev) => Math.max(0.5, Number((prev - 0.25).toFixed(2))));
  }, []);

  // Mouse drag handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only primary left-click
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  }, [position]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Touch drag handlers for mobile / touch screens
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y,
      });
    }
  }, [position]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    setPosition({
      x: e.touches[0].clientX - dragStart.x,
      y: e.touches[0].clientY - dragStart.y,
    });
  }, [isDragging, dragStart]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Wheel zoom handler
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY * -0.0015;
    setScale((prev) => {
      const next = Math.min(3.5, Math.max(0.5, prev + delta));
      return Number(next.toFixed(2));
    });
  }, []);

  // Keyboard escape handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Early return only after all hooks are declared
  if (!isOpen || !data) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200 select-none"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col h-[92vh] max-h-[92vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
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
            title="Tutup (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Data Summary Bar */}
        <div className="px-5 py-2.5 bg-blue-50/70 border-b border-blue-100 grid grid-cols-3 gap-2 text-xs shrink-0">
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

        {/* Interactive Pan-Zoom Viewport Container */}
        <div 
          ref={containerRef}
          className={`flex-1 relative bg-slate-900 overflow-hidden flex items-center justify-center ${
            isDragging ? 'cursor-grabbing' : 'cursor-grab'
          }`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onWheel={handleWheel}
        >
          {data.previewUrl ? (
            <>
              {/* Scaled & Panned Image Layer */}
              <div 
                style={{
                  transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                  transition: isDragging ? 'none' : 'transform 0.12s cubic-bezier(0.2, 0, 0, 1)',
                  transformOrigin: 'center center',
                }}
                className="will-change-transform flex items-center justify-center pointer-events-none select-none p-4"
              >
                <img 
                  src={data.previewUrl} 
                  alt="Bukti Transfer"
                  draggable={false}
                  className="max-h-[62vh] max-w-[85vw] sm:max-w-2xl rounded-lg shadow-2xl bg-white object-contain border border-slate-700/60"
                />
              </div>

              {/* Floating Top Hint */}
              <div className="absolute top-3 left-3 bg-slate-950/70 backdrop-blur-md text-slate-300 px-3 py-1.5 rounded-lg text-[11px] border border-slate-800 flex items-center gap-1.5 pointer-events-none shadow-md">
                <Move className="w-3.5 h-3.5 text-slate-400" />
                <span>Klik & geser untuk memindahkan struk • Scroll untuk zoom</span>
              </div>

              {/* Sleek Floating Zoom Slider & Controls Bar */}
              <div 
                className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-950/85 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-slate-700/70 shadow-2xl flex items-center gap-2.5 z-10"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Zoom Out Button */}
                <button
                  onClick={handleZoomOut}
                  className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                  title="Zoom Out"
                  disabled={scale <= 0.5}
                >
                  <ZoomOut className="w-4 h-4" />
                </button>

                {/* Range Slider */}
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0.5"
                    max="3"
                    step="0.05"
                    value={scale}
                    onChange={(e) => setScale(parseFloat(e.target.value))}
                    className="w-24 sm:w-36 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500 hover:accent-emerald-400 transition-all"
                  />
                  <span className="font-mono text-xs font-bold text-emerald-400 min-w-[42px] text-right">
                    {Math.round(scale * 100)}%
                  </span>
                </div>

                {/* Zoom In Button */}
                <button
                  onClick={handleZoomIn}
                  className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                  title="Zoom In"
                  disabled={scale >= 3.5}
                >
                  <ZoomIn className="w-4 h-4" />
                </button>

                <div className="w-[1px] h-4 bg-slate-700 mx-0.5" />

                {/* Reset Button */}
                <button
                  onClick={handleResetZoom}
                  className="px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/90 rounded-lg transition-colors border border-slate-700 flex items-center gap-1 shadow-sm"
                  title="Reset Ukuran & Posisi (100%)"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset</span>
                </button>

                {/* Direct Full-res Link */}
                <a
                  href={data.previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                  title="Buka Tab Gambar Asli Resolusi Penuh"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-slate-400">
              <p className="text-sm">Gambar bukti transfer belum tersedia atau sedang diproses.</p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
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
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-500" />}
              </button>
            )}
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors w-full sm:w-auto text-center"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
