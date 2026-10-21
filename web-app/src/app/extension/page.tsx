'use client';

import React from 'react';
import { Download, Puzzle, AlertCircle, PlayCircle, Settings, CheckCircle2, FileJson } from 'lucide-react';

export default function ExtensionPage() {
  return (
    <div className="w-full mx-auto pb-16">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-[40px] text-white shadow-xl mb-[32px] relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <Puzzle className="w-48 h-48" />
        </div>
        <div className="relative z-10">
          <div className="inline-flex items-center gap-[8px] bg-white/20 backdrop-blur-sm px-[16px] py-[8px] rounded-full text-[14px] font-semibold mb-[24px]">
            <Puzzle className="w-4 h-4" />
            <span>Alat Bantu Wajib Manajer</span>
          </div>
          <h1 className="text-[36px] font-bold leading-tight mb-[16px]">
            TNT Scrapping Creator (v2.0)
          </h1>
          <p className="text-blue-100 text-[18px] max-w-2xl leading-relaxed mb-[32px]">
            Ekstensi resmi untuk melakukan Auto-Scrape kreator dari TikTok Partner Center (Find Creators) dilengkapi Buku Catatan Anti-Duplikat otomatis, kalkulasi GMV RIIL vs ESTIMASI, dan pengiriman batch ke menu Staging Creator.
          </p>
          
          <a 
            href="/tnt-extension.zip" 
            download
            className="inline-flex items-center gap-[12px] bg-white text-blue-700 hover:bg-blue-50 px-[24px] py-[16px] rounded-xl font-bold text-[16px] transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1"
          >
            <Download className="w-5 h-5" />
            Download Ekstensi (.zip)
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[32px]">
        {/* Kolom Kiri: Cara Install */}
        <div className="bg-white rounded-2xl shadow-sm border border-line p-[32px]">
          <div className="flex items-center gap-[16px] mb-[24px] border-b border-line pb-[16px]">
            <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600">
              <Settings className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-[24px] font-bold text-text">1. Cara Instalasi</h2>
              <p className="text-text-soft text-[14px]">Ikuti langkah ini pelan-pelan secara berurutan.</p>
            </div>
          </div>

          <div className="space-y-[24px]">
            <div className="flex gap-[16px]">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 text-[14px]">1</div>
              <div>
                <h3 className="font-bold text-text mb-[4px]">Download & Ekstrak</h3>
                <p className="text-text-soft text-[14px] leading-relaxed">
                  Klik tombol Download di atas. Anda akan mendapatkan file bernama <code>tnt-extension.zip</code>. Klik kanan pada file tersebut lalu pilih <strong className="text-text">"Extract Here"</strong> atau <strong className="text-text">"Extract to tnt-extension"</strong>. Anda akan mendapatkan sebuah FOLDER bernama <code>tnt-extension</code>.
                </p>
                <div className="mt-2 bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex gap-2">
                  <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
                  <p className="text-yellow-800 text-[13px] font-medium">PENTING: Jangan biarkan dalam bentuk .zip! Anda WAJIB mengekstraknya (mengeluarkan isinya dari zip) menjadi sebuah folder biasa berwarna kuning.</p>
                </div>
              </div>
            </div>

            <div className="flex gap-[16px]">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 text-[14px]">2</div>
              <div>
                <h3 className="font-bold text-text mb-[4px]">Buka Pengaturan Ekstensi Chrome</h3>
                <p className="text-text-soft text-[14px] leading-relaxed">
                  Di Google Chrome Anda, klik titik tiga di pojok kanan atas ➔ pilih <strong className="text-text">Extensions</strong> ➔ pilih <strong className="text-text">Manage Extensions</strong>.<br/>
                  (Atau Anda bisa ketik <code>chrome://extensions/</code> di kotak link atas lalu tekan Enter).
                </p>
              </div>
            </div>

            <div className="flex gap-[16px]">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 text-[14px]">3</div>
              <div>
                <h3 className="font-bold text-text mb-[4px]">Nyalakan Developer Mode</h3>
                <p className="text-text-soft text-[14px] leading-relaxed">
                  Perhatikan di <strong className="text-text">pojok kanan atas</strong> layar Anda, ada tombol saklar bertuliskan <strong className="text-text">"Developer mode"</strong>. Pastikan saklar itu digeser/diklik sampai menyala (biasanya berubah warna jadi biru).
                </p>
              </div>
            </div>

            <div className="flex gap-[16px]">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 text-[14px]">4</div>
              <div>
                <h3 className="font-bold text-text mb-[4px]">Pilih Load Unpacked</h3>
                <p className="text-text-soft text-[14px] leading-relaxed">
                  Setelah Developer mode menyala, akan muncul menu baru di pojok KIRI atas. Klik tombol <strong className="text-text">"Load unpacked"</strong>.
                </p>
              </div>
            </div>

            <div className="flex gap-[16px]">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 text-[14px]">5</div>
              <div>
                <h3 className="font-bold text-text mb-[4px]">Pilih Folder Ekstensi</h3>
                <p className="text-text-soft text-[14px] leading-relaxed">
                  Jendela pencarian file akan terbuka. Arahkan dan pilih <strong className="text-text">Folder <code>tnt-extension</code></strong> yang tadi sudah Anda ekstrak di langkah pertama. Lalu klik "Select Folder". 
                </p>
                <div className="mt-2 bg-green-50 border border-green-200 rounded-lg p-3 flex gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <p className="text-green-800 text-[13px] font-medium">Selesai! Ekstensi "TNT App - Creator Extractor" akan muncul di daftar. Anda sudah berhasil menginstal.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Kolom Kanan: Cara Menggunakan */}
        <div className="bg-white rounded-2xl shadow-sm border border-line p-[32px]">
          <div className="flex items-center gap-[16px] mb-[24px] border-b border-line pb-[16px]">
            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
              <PlayCircle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-[24px] font-bold text-text">2. Cara Menggunakan</h2>
              <p className="text-text-soft text-[14px]">Cara mengambil data (scrape) dari TikTok.</p>
            </div>
          </div>

          <div className="space-y-[24px]">
            <div className="flex gap-[16px]">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 text-[14px]">1</div>
              <div>
                <h3 className="font-bold text-text mb-[4px]">Buka Profil Kreator di Partner Center</h3>
                <p className="text-text-soft text-[14px] leading-relaxed">
                  Masuk ke TikTok Partner Center dan buka profil kreator mana saja yang ingin Anda ambil datanya.
                </p>
              </div>
            </div>

            <div className="flex gap-[16px]">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 text-[14px]">2</div>
              <div>
                <h3 className="font-bold text-text mb-[4px]">Klik Ikon Puzzle</h3>
                <p className="text-text-soft text-[14px] leading-relaxed">
                  Di sebelah kanan kotak link atas Google Chrome Anda, klik ikon <strong className="text-text">Puzzle (Ekstensi)</strong>, lalu klik ekstensi <strong className="text-text">TNT App - Creator Extractor</strong>.
                  <br/><br/>
                  <span className="text-blue-600 font-medium">💡 Tips:</span> Klik ikon "Pin" di sebelah nama ekstensi agar dia selalu muncul di depan, tidak perlu buka puzzle lagi.
                </p>
              </div>
            </div>

            <div className="flex gap-[16px]">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 text-[14px]">3</div>
              <div>
                <h3 className="font-bold text-text mb-[4px]">Klik Tombol "Extract Data"</h3>
                <p className="text-text-soft text-[14px] leading-relaxed">
                  Setelah popup ekstensi terbuka, akan ada informasi login Anda. Klik tombol hijau bertuliskan <strong className="text-text">Extract Data</strong>.
                  Tunggu 1-2 detik, ekstensi akan secara otomatis membaca dan menyedot Followers, GMV, Niche, dan lain-lain.
                </p>
              </div>
            </div>

            <div className="flex gap-[16px]">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 text-[14px]">4</div>
              <div>
                <h3 className="font-bold text-text mb-[4px]">Selesai (Otomatis Tersimpan)</h3>
                <p className="text-text-soft text-[14px] leading-relaxed">
                  Jika data berhasil diambil, ekstensi akan memberikan notifikasi. Anda bisa langsung membuka tab aplikasi web ini dan mengecek halaman Creator Pool.
                  Semua data kreator tadi sudah langsung masuk ke database kita secara ajaib tanpa perlu Anda ketik satu per satu!
                </p>
              </div>
            </div>

          </div>

          <div className="mt-[32px] p-[24px] bg-slate-50 border border-line rounded-xl">
             <div className="flex items-center gap-[12px] mb-[12px]">
               <FileJson className="w-5 h-5 text-slate-500" />
               <h4 className="font-bold text-text">Mode Spreadsheet (Lanjutan)</h4>
             </div>
             <p className="text-[13px] text-text-soft leading-relaxed">
               Bagi Manajer, Anda juga bisa menyedot lebih dari 100 kreator sekaligus menggunakan sistem copy paste Spreadsheet.<br/>
               Buka halaman <strong>Creator Pool ➔ Import Mode Spreadsheet</strong> untuk petunjuk lengkap tentang cara menggunakan Excel atau Google Sheets.
             </p>
          </div>
        </div>
      </div>
    </div>
  );
}
