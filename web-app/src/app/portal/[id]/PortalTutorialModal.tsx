"use client";

import React, { useRef, useEffect } from "react";
import { X, PlayCircle, ExternalLink, HelpCircle } from "lucide-react";

interface PortalTutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PortalTutorialModal({ isOpen, onClose }: PortalTutorialModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Pause video when modal is closed
  useEffect(() => {
    if (!isOpen && videoRef.current) {
      videoRef.current.pause();
    }
  }, [isOpen]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-3 sm:p-4 md:p-6 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity cursor-pointer" 
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-900/90 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <PlayCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white leading-tight">Tutorial Penggunaan Portal Brand</h3>
              <p className="text-xs text-slate-400 mt-0.5">Panduan fitur laporan performa, listing kreator, approval sampel & video</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            title="Tutup (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Player Area */}
        <div className="relative w-full bg-black flex items-center justify-center aspect-video max-h-[calc(92vh-110px)] overflow-hidden">
          <video
            ref={videoRef}
            src="/videos/tutorial-portal-brand.mp4"
            controls
            autoPlay
            playsInline
            className="w-full h-full object-contain"
          >
            Browser Anda tidak mendukung tag video. Silakan unduh video untuk menontonnya.
          </video>
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between px-5 py-2.5 bg-slate-900/95 border-t border-slate-800 text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-blue-400" />
            Butuh bantuan lebih lanjut? Hubungi tim Account Manager TNT Anda.
          </span>
          <a
            href="/videos/tutorial-portal-brand.mp4"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-blue-400 hover:text-blue-300 font-medium transition-colors"
          >
            <span>Buka di Tab Baru</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
