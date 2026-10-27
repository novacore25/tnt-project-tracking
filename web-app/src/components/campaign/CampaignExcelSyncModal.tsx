"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/Dialog";
import {
  Download,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Loader2,
  HelpCircle,
  FileText,
  Users,
  Video,
  DollarSign,
  TrendingUp,
} from "lucide-react";
import * as XLSX from "xlsx";
import {
  exportCampaignFullDataAction,
  importCampaignFullDataAction,
} from "@/app/actions/campaignExcelSyncActions";
import { useRouter } from "next/navigation";

interface CampaignExcelSyncModalProps {
  campaignId: number;
  campaignName?: string;
  isOpen: boolean;
  onClose: () => void;
}

// Helper parsing tanggal Excel
function parseExcelDate(val: any): string {
  if (!val) return "";
  if (typeof val === "number") {
    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
    if (!isNaN(date.getTime())) {
      return date.toISOString().substring(0, 10);
    }
  }
  if (typeof val === "string") {
    const s = val.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
    const parts = s.split(/[\/\-]/);
    if (parts.length === 3 && parts[2].length === 4) {
      const day = parts[0].padStart(2, "0");
      const month = parts[1].padStart(2, "0");
      const year = parts[2];
      return `${year}-${month}-${day}`;
    }
    return s;
  }
  return "";
}

// Helper pembersih angka rupiah / USD
function parseCleanNumber(val: any): number {
  if (val === null || val === undefined || val === "") return 0;
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  const cleaned = val.toString().replace(/[Rp$€,\s]/g, "").trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

export function CampaignExcelSyncModal({
  campaignId,
  campaignName = "Campaign",
  isOpen,
  onClose,
}: CampaignExcelSyncModalProps) {
  const router = useRouter();

  // State hooks - wajib di paling atas sebelum conditional returns (React Hooks Rule #26)
  const [activeTab, setActiveTab] = useState<"export" | "import">("export");
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Import states
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [modeSales, setModeSales] = useState<"append" | "replace">("append");
  const [modeAds, setModeAds] = useState<"append" | "replace">("append");
  const [parsedPayload, setParsedPayload] = useState<{
    campaign?: any;
    creators: any[];
    videos: any[];
    sales: any[];
    ads: any[];
  } | null>(null);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    counts?: any;
    error?: string;
  } | null>(null);

  // =========================================================================
  // HANDLER EXPORT EXCEL
  // =========================================================================
  const handleExport = async () => {
    setIsExporting(true);
    setExportError(null);

    try {
      const res = await exportCampaignFullDataAction(campaignId);
      if (!res.success || !res.campaign) {
        throw new Error(res.error || "Gagal mengambil data campaign.");
      }

      const camp = res.campaign;
      const creators = res.creators || [];
      const videos = res.videos || [];
      const sales = res.sales || [];
      const ads = res.ads || [];

      const wb = XLSX.utils.book_new();

      // 1. Sheet Ringkasan Campaign
      const campSheetData = [
        {
          "ID Campaign": camp.id,
          "Nama Campaign": camp.nama,
          "Brand": camp.brand_nama || "-",
          "Status": camp.status || "aktif",
          "Tipe Campaign": camp.tipe_campaign || "sales",
          "Start Date": camp.start_date ? String(camp.start_date).substring(0, 10) : "",
          "End Date": camp.end_date ? String(camp.end_date).substring(0, 10) : "",
          "Target GMV (Rp)": Number(camp.target_gmv || 0),
          "Target Video (Pcs)": Number(camp.target_video || 0),
          "Target Creator (Total)": Number(camp.target_creator || 0),
          "Budget Creator Plafon (Rp)": Number(camp.budget_creator_plafon || 0),
          "Budget Ads Plafon (Rp)": Number(camp.budget_ads_plafon || 0),
        },
      ];
      const wsCamp = XLSX.utils.json_to_sheet(campSheetData);
      wsCamp["!cols"] = [
        { wch: 12 }, { wch: 32 }, { wch: 20 }, { wch: 12 }, { wch: 16 },
        { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 20 },
        { wch: 24 }, { wch: 22 },
      ];
      XLSX.utils.book_append_sheet(wb, wsCamp, "Ringkasan Campaign");

      // 2. Sheet Creators
      const creatorsSheetData = creators.map((c: any, idx: number) => ({
        "No": idx + 1,
        "Username": c.username || "",
        "Nama Asli / KTP": c.nama_asli || "",
        "Link Profil TikTok": c.link_account || `https://www.tiktok.com/@${c.username || ""}`,
        "Status Approval": c.approval || "approved",
        "Tipe Konten": c.content_type || "video",
        "Tier": c.tier || "nano",
        "Rate Card (Rp)": Number(c.price || 0),
        "Target Qty VT": Number(c.qty_vt || 1),
        "Target Qty Live": Number(c.qty_live || 0),
      }));
      const wsCreators = XLSX.utils.json_to_sheet(
        creatorsSheetData.length > 0
          ? creatorsSheetData
          : [
              {
                "No": 1,
                "Username": "contoh_creator",
                "Nama Asli / KTP": "Nama Lengkap",
                "Link Profil TikTok": "https://www.tiktok.com/@contoh_creator",
                "Status Approval": "approved",
                "Tipe Konten": "video",
                "Tier": "nano",
                "Rate Card (Rp)": 1500000,
                "Target Qty VT": 1,
                "Target Qty Live": 0,
              },
            ]
      );
      wsCreators["!cols"] = [
        { wch: 6 }, { wch: 24 }, { wch: 26 }, { wch: 38 }, { wch: 16 },
        { wch: 14 }, { wch: 12 }, { wch: 18 }, { wch: 14 }, { wch: 16 },
      ];
      XLSX.utils.book_append_sheet(wb, wsCreators, "Creators");

      // 3. Sheet Videos
      const videosSheetData = videos.map((v: any, idx: number) => ({
        "No": idx + 1,
        "Username Creator": v.creator_username || "",
        "Urutan VT": Number(v.urutan || 1),
        "Link Video TikTok": v.link_video || "",
        "Link Draft Video": v.link_draft || "",
        "Konsep / Catatan": v.concept || "",
        "Status Approval VT": v.vt_approval || "approved",
      }));
      const wsVideos = XLSX.utils.json_to_sheet(
        videosSheetData.length > 0
          ? videosSheetData
          : [
              {
                "No": 1,
                "Username Creator": "contoh_creator",
                "Urutan VT": 1,
                "Link Video TikTok": "https://www.tiktok.com/@contoh_creator/video/1234567890",
                "Link Draft Video": "https://drive.google.com/...",
                "Konsep / Catatan": "Hook tutorial produk",
                "Status Approval VT": "approved",
              },
            ]
      );
      wsVideos["!cols"] = [
        { wch: 6 }, { wch: 24 }, { wch: 12 }, { wch: 45 }, { wch: 35 },
        { wch: 30 }, { wch: 18 },
      ];
      XLSX.utils.book_append_sheet(wb, wsVideos, "Videos");

      // 4. Sheet Sales Organik
      const salesSheetData = sales.map((s: any, idx: number) => ({
        "No": idx + 1,
        "Tanggal (YYYY-MM-DD)": s.tanggal ? String(s.tanggal).substring(0, 10) : "",
        "Username Creator": s.creator_username || "",
        "GMV (Rp)": Number(s.gmv || 0),
        "Jumlah Terjual (Qty)": Number(s.quantity || 1),
        "Tipe Konten": s.content_type || "video",
        "Order ID / Transaksi ID": s.order_id || "",
      }));
      const wsSales = XLSX.utils.json_to_sheet(
        salesSheetData.length > 0
          ? salesSheetData
          : [
              {
                "No": 1,
                "Tanggal (YYYY-MM-DD)": "2024-05-01",
                "Username Creator": "contoh_creator",
                "GMV (Rp)": 15000000,
                "Jumlah Terjual (Qty)": 50,
                "Tipe Konten": "video",
                "Order ID / Transaksi ID": "ORD-123456",
              },
            ]
      );
      wsSales["!cols"] = [
        { wch: 6 }, { wch: 22 }, { wch: 24 }, { wch: 18 }, { wch: 20 },
        { wch: 14 }, { wch: 28 },
      ];
      XLSX.utils.book_append_sheet(wb, wsSales, "Sales Organik");

      // 5. Sheet Ads Performance
      const adsSheetData = ads.map((a: any, idx: number) => ({
        "No": idx + 1,
        "Tanggal (YYYY-MM-DD)": a.tanggal ? String(a.tanggal).substring(0, 10) : "",
        "Ad ID": a.ad_id || "",
        "Nama Ads": a.ad_name || "",
        "Nama Campaign Ads": a.campaign_ads_name || "",
        "Username Creator": a.creator_username || "",
        "Cost (USD)": Number(a.cost_usd || 0),
        "Gross Revenue (USD)": Number(a.gross_revenue_usd || 0),
        "Kurs IDR": Number(a.kurs || 16000),
      }));
      const wsAds = XLSX.utils.json_to_sheet(
        adsSheetData.length > 0
          ? adsSheetData
          : [
              {
                "No": 1,
                "Tanggal (YYYY-MM-DD)": "2024-05-01",
                "Ad ID": "178923487123981",
                "Nama Ads": "Spark_Ads_01",
                "Nama Campaign Ads": "Campaign_Ads_01",
                "Username Creator": "contoh_creator",
                "Cost (USD)": 50,
                "Gross Revenue (USD)": 800,
                "Kurs IDR": 16000,
              },
            ]
      );
      wsAds["!cols"] = [
        { wch: 6 }, { wch: 22 }, { wch: 24 }, { wch: 28 }, { wch: 28 },
        { wch: 24 }, { wch: 14 }, { wch: 22 }, { wch: 14 },
      ];
      XLSX.utils.book_append_sheet(wb, wsAds, "Ads Performance");

      // 6. Sheet Panduan Pengisian
      const guideData = [
        {
          "Petunjuk & Aturan": "1. JANGAN mengubah urutan atau nama sheet (Ringkasan Campaign, Creators, Videos, Sales Organik, Ads Performance).",
        },
        {
          "Petunjuk & Aturan": "2. SHEET CREATORS: Kolom 'Username' adalah kunci utama. Jangan pakai spasi atau tanda @ di username.",
        },
        {
          "Petunjuk & Aturan": "3. SHEET VIDEOS: Kolom 'Username Creator' harus sesuai dengan salah satu username yang terdaftar di sheet Creators.",
        },
        {
          "Petunjuk & Aturan": "4. SHEET SALES ORGANIK: Nilai GMV diisi angka murni tanpa simbol 'Rp' atau titik pemisah ribuan.",
        },
        {
          "Petunjuk & Aturan": "5. SHEET ADS: Kolom 'Ad ID' wajib diisi untuk setiap baris iklan Video Shopping Ads.",
        },
        {
          "Petunjuk & Aturan": "6. FORMAT TANGGAL: Gunakan format standar YYYY-MM-DD (contoh: 2024-05-15).",
        },
        {
          "Petunjuk & Aturan": "7. Setelah tim selesai mengisi data riil, upload file ini kembali pada tab 'Import / Update Data' di sistem.",
        },
      ];
      const wsGuide = XLSX.utils.json_to_sheet(guideData);
      wsGuide["!cols"] = [{ wch: 110 }];
      XLSX.utils.book_append_sheet(wb, wsGuide, "Panduan Pengisian");

      // Download file Excel
      const cleanFileName = (camp.nama || "Campaign").replace(/[^a-zA-Z0-9_-]/g, "_");
      const dateStr = new Date().toISOString().substring(0, 10);
      XLSX.writeFile(wb, `${cleanFileName}_FullData_${dateStr}.xlsx`);
    } catch (err: any) {
      console.error("Export error:", err);
      setExportError(err.message || "Terjadi kesalahan saat mengekspor data.");
    } finally {
      setIsExporting(false);
    }
  };

  // =========================================================================
  // HANDLER PARSE FILE UPLOAD
  // =========================================================================
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setIsParsing(true);
    setImportResult(null);

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });

      const findSheet = (names: string[]) => {
        const lowerNames = names.map((n) => n.toLowerCase());
        const match = wb.SheetNames.find((s) => lowerNames.includes(s.toLowerCase().trim()));
        return match ? wb.Sheets[match] : null;
      };

      // 1. Parse Sheet Ringkasan Campaign
      const wsCamp = findSheet(["Ringkasan Campaign", "Campaign", "Ringkasan"]);
      let campaignData: any = null;
      if (wsCamp) {
        const rows = XLSX.utils.sheet_to_json<any>(wsCamp);
        if (rows.length > 0) {
          const r = rows[0];
          campaignData = {
            nama: r["Nama Campaign"] || r["nama"],
            status: r["Status"] || r["status"],
            tipe_campaign: r["Tipe Campaign"] || r["tipe_campaign"],
            start_date: parseExcelDate(r["Start Date"] || r["start_date"]),
            end_date: parseExcelDate(r["End Date"] || r["end_date"]),
            target_gmv: parseCleanNumber(r["Target GMV (Rp)"] || r["target_gmv"]),
            target_video: parseCleanNumber(r["Target Video (Pcs)"] || r["target_video"]),
            target_creator: parseCleanNumber(r["Target Creator (Total)"] || r["target_creator"]),
            budget_creator_plafon: parseCleanNumber(r["Budget Creator Plafon (Rp)"] || r["budget_creator_plafon"]),
            budget_ads_plafon: parseCleanNumber(r["Budget Ads Plafon (Rp)"] || r["budget_ads_plafon"]),
          };
        }
      }

      // 2. Parse Sheet Creators
      const wsCreators = findSheet(["Creators", "Kreator", "Creator"]);
      const creatorsList: any[] = [];
      if (wsCreators) {
        const rows = XLSX.utils.sheet_to_json<any>(wsCreators);
        for (const r of rows) {
          const u = (r["Username"] || r["username"] || "").toString().trim().replace(/^@/, "");
          if (!u || u === "contoh_creator") continue;
          creatorsList.push({
            username: u,
            nama_asli: (r["Nama Asli / KTP"] || r["nama_asli"] || "").toString().trim() || undefined,
            link_account: (r["Link Profil TikTok"] || r["link_account"] || "").toString().trim() || undefined,
            approval: (r["Status Approval"] || r["approval"] || "approved").toString().trim(),
            content_type: (r["Tipe Konten"] || r["content_type"] || "video").toString().trim(),
            tier: (r["Tier"] || r["tier"] || "nano").toString().trim(),
            price: parseCleanNumber(r["Rate Card (Rp)"] || r["price"]),
            qty_vt: parseCleanNumber(r["Target Qty VT"] || r["qty_vt"]) || 1,
            qty_live: parseCleanNumber(r["Target Qty Live"] || r["qty_live"]) || 0,
          });
        }
      }

      // 3. Parse Sheet Videos
      const wsVideos = findSheet(["Videos", "Video", "VT"]);
      const videosList: any[] = [];
      if (wsVideos) {
        const rows = XLSX.utils.sheet_to_json<any>(wsVideos);
        for (const r of rows) {
          const u = (r["Username Creator"] || r["username"] || "").toString().trim().replace(/^@/, "");
          const link = (r["Link Video TikTok"] || r["link_video"] || "").toString().trim();
          const draft = (r["Link Draft Video"] || r["link_draft"] || "").toString().trim();
          if (!u || u === "contoh_creator" || (!link && !draft)) continue;
          videosList.push({
            creator_username: u,
            urutan: parseCleanNumber(r["Urutan VT"] || r["urutan"]) || 1,
            link_video: link || undefined,
            link_draft: draft || undefined,
            concept: (r["Konsep / Catatan"] || r["concept"] || "").toString().trim() || undefined,
            vt_approval: (r["Status Approval VT"] || r["vt_approval"] || "approved").toString().trim(),
          });
        }
      }

      // 4. Parse Sheet Sales Organik
      const wsSales = findSheet(["Sales Organik", "Sales", "Penjualan"]);
      const salesList: any[] = [];
      if (wsSales) {
        const rows = XLSX.utils.sheet_to_json<any>(wsSales);
        for (const r of rows) {
          const u = (r["Username Creator"] || r["username"] || "").toString().trim().replace(/^@/, "");
          const gmv = parseCleanNumber(r["GMV (Rp)"] || r["gmv"]);
          const orderId = (r["Order ID / Transaksi ID"] || r["order_id"] || "").toString().trim();
          if (!u || u === "contoh_creator" || (gmv <= 0 && !orderId)) continue;
          salesList.push({
            tanggal: parseExcelDate(r["Tanggal (YYYY-MM-DD)"] || r["tanggal"]),
            creator_username: u,
            gmv,
            quantity: parseCleanNumber(r["Jumlah Terjual (Qty)"] || r["quantity"]) || 1,
            content_type: (r["Tipe Konten"] || r["content_type"] || "video").toString().trim(),
            order_id: orderId || undefined,
          });
        }
      }

      // 5. Parse Sheet Ads Performance
      const wsAds = findSheet(["Ads Performance", "Ads", "Iklan"]);
      const adsList: any[] = [];
      if (wsAds) {
        const rows = XLSX.utils.sheet_to_json<any>(wsAds);
        for (const r of rows) {
          const adId = (r["Ad ID"] || r["ad_id"] || "").toString().trim();
          if (!adId || adId === "178923487123981") continue;
          adsList.push({
            tanggal: parseExcelDate(r["Tanggal (YYYY-MM-DD)"] || r["tanggal"]),
            creator_username: (r["Username Creator"] || r["username"] || "").toString().trim().replace(/^@/, "") || undefined,
            ad_id: adId,
            ad_name: (r["Nama Ads"] || r["ad_name"] || "").toString().trim() || undefined,
            campaign_ads_name: (r["Nama Campaign Ads"] || r["campaign_ads_name"] || "").toString().trim() || undefined,
            cost_usd: parseCleanNumber(r["Cost (USD)"] || r["cost_usd"]),
            gross_revenue_usd: parseCleanNumber(r["Gross Revenue (USD)"] || r["gross_revenue_usd"]),
            kurs: parseCleanNumber(r["Kurs IDR"] || r["kurs"]) || 16000,
          });
        }
      }

      setParsedPayload({
        campaign: campaignData,
        creators: creatorsList,
        videos: videosList,
        sales: salesList,
        ads: adsList,
      });
    } catch (err: any) {
      console.error("Parse error:", err);
      alert("Gagal membaca file Excel. Pastikan file berformat .xlsx atau .xls yang valid.");
    } finally {
      setIsParsing(false);
    }
  };

  // =========================================================================
  // HANDLER SUBMIT IMPORT
  // =========================================================================
  const handleSubmitImport = async () => {
    if (!parsedPayload) return;

    if (modeSales === "replace") {
      const ok = confirm(
        "PERHATIAN: Mode 'Ganti Seluruh Data (Replace)' untuk Sales Organik aktif.\n\nSemua data sales organik sebelumnya pada campaign ini akan dihapus dan digantikan dengan data di file Excel ini.\n\nApakah Anda yakin ingin melanjutkan?"
      );
      if (!ok) return;
    }

    setIsImporting(true);
    setImportResult(null);

    try {
      const res = await importCampaignFullDataAction(campaignId, {
        campaign: parsedPayload.campaign,
        creators: parsedPayload.creators,
        videos: parsedPayload.videos,
        sales: parsedPayload.sales,
        ads: parsedPayload.ads,
        modeSales,
        modeAds,
      });

      if (!res.success) {
        throw new Error(res.error || "Gagal mengimpor data.");
      }

      setImportResult({
        success: true,
        counts: res.counts,
      });

      // Refresh data di halaman
      router.refresh();
    } catch (err: any) {
      console.error("Import submit error:", err);
      setImportResult({
        success: false,
        error: err.message || "Gagal mengimpor data ke database.",
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold text-slate-800">
            <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
            Excel Data Sync — {campaignName}
          </DialogTitle>
        </DialogHeader>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 mt-2">
          <button
            type="button"
            onClick={() => setActiveTab("export")}
            className={`flex items-center gap-2 px-4 py-2.5 font-semibold text-sm border-b-2 transition-colors ${
              activeTab === "export"
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Download className="w-4 h-4" />
            Export Data & Template
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("import")}
            className={`flex items-center gap-2 px-4 py-2.5 font-semibold text-sm border-b-2 transition-colors ${
              activeTab === "import"
                ? "border-indigo-600 text-indigo-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Upload className="w-4 h-4" />
            Import / Update Data Riil
          </button>
        </div>

        {/* TAB 1: EXPORT */}
        {activeTab === "export" && (
          <div className="py-4 space-y-5">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm text-emerald-900 leading-relaxed space-y-2">
              <div className="font-semibold flex items-center gap-2 text-emerald-800">
                <FileText className="w-4 h-4 text-emerald-600" />
                Format Excel Multi-Sheet Komprehensif
              </div>
              <p>
                File yang diekspor berisi <strong>6 sheet terstruktur</strong>:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-emerald-800 text-xs">
                <li>
                  <strong>Ringkasan Campaign:</strong> Target GMV, Video, Creator, Plafon Budget, Periode.
                </li>
                <li>
                  <strong>Creators:</strong> Daftar username, link akun TikTok, status approval, tier, rate card.
                </li>
                <li>
                  <strong>Videos:</strong> Link video VT, urutan, link draft, konsep/hook, approval.
                </li>
                <li>
                  <strong>Sales Organik:</strong> Riwayat transaksi/penjualan organik per tanggal & kreator.
                </li>
                <li>
                  <strong>Ads Performance:</strong> Riwayat Video Shopping Ads (Cost, Gross Revenue USD, Kurs).
                </li>
                <li>
                  <strong>Panduan Pengisian:</strong> SOP dan aturan pengisian untuk tim sebelum di-import kembali.
                </li>
              </ul>
            </div>

            {exportError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                {exportError}
              </div>
            )}

            <div className="flex justify-between items-center pt-2">
              <p className="text-xs text-slate-500">
                Tim dapat mengisi data riil langsung di file Excel ini, lalu mengunggahnya kembali.
              </p>
              <button
                type="button"
                disabled={isExporting}
                onClick={handleExport}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-sm transition-all disabled:opacity-50"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Menyiapkan Excel...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Download File Excel
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: IMPORT */}
        {activeTab === "import" && (
          <div className="py-4 space-y-5">
            {/* Success Banner */}
            {importResult?.success && (
              <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-4 text-emerald-900 space-y-2">
                <div className="flex items-center gap-2 font-bold text-emerald-800">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  Data Berhasil Disinkronkan ke Sistem!
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-xs">
                  <div className="bg-white p-2.5 rounded-lg border border-emerald-200 text-center">
                    <span className="text-slate-500 block">Kreator Disinkron</span>
                    <strong className="text-sm text-emerald-700">
                      {importResult.counts?.updatedCreatorsCount || 0}
                    </strong>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-emerald-200 text-center">
                    <span className="text-slate-500 block">Video Disinkron</span>
                    <strong className="text-sm text-emerald-700">
                      {importResult.counts?.updatedVideosCount || 0}
                    </strong>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-emerald-200 text-center">
                    <span className="text-slate-500 block">Sales Organik</span>
                    <strong className="text-sm text-emerald-700">
                      {importResult.counts?.updatedSalesCount || 0}
                    </strong>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-emerald-200 text-center">
                    <span className="text-slate-500 block">Ads Performance</span>
                    <strong className="text-sm text-emerald-700">
                      {importResult.counts?.updatedAdsCount || 0}
                    </strong>
                  </div>
                </div>
              </div>
            )}

            {/* Error Banner */}
            {importResult?.error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                {importResult.error}
              </div>
            )}

            {/* Dropzone File */}
            <div className="border-2 border-dashed border-slate-300 hover:border-indigo-400 rounded-xl p-6 text-center transition-colors bg-slate-50 hover:bg-slate-100/50">
              <Upload className="w-8 h-8 text-indigo-500 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">
                Pilih atau seret file Excel hasil pembaruan tim
              </p>
              <p className="text-xs text-slate-500 mt-1">Format didukung: .xlsx, .xls</p>
              <input
                type="file"
                accept=".xlsx, .xls"
                onChange={handleFileChange}
                className="mt-3 block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
              />
            </div>

            {isParsing && (
              <div className="flex items-center justify-center gap-2 py-4 text-sm text-slate-600">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                Membaca dan memvalidasi struktur sheet...
              </div>
            )}

            {/* Preview Parsed Data */}
            {parsedPayload && !isParsing && (
              <div className="space-y-4">
                <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-sm space-y-3">
                  <div className="font-semibold text-sm text-slate-800 flex items-center justify-between">
                    <span>Ringkasan Data yang Ditemukan di File:</span>
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
                      {selectedFile?.name}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center gap-2.5">
                      <Users className="w-4 h-4 text-indigo-600" />
                      <div>
                        <div className="text-slate-500">Kreator</div>
                        <div className="font-bold text-sm text-slate-800">
                          {parsedPayload.creators.length} baris
                        </div>
                      </div>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center gap-2.5">
                      <Video className="w-4 h-4 text-emerald-600" />
                      <div>
                        <div className="text-slate-500">Video VT</div>
                        <div className="font-bold text-sm text-slate-800">
                          {parsedPayload.videos.length} baris
                        </div>
                      </div>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center gap-2.5">
                      <DollarSign className="w-4 h-4 text-amber-600" />
                      <div>
                        <div className="text-slate-500">Sales Organik</div>
                        <div className="font-bold text-sm text-slate-800">
                          {parsedPayload.sales.length} baris
                        </div>
                      </div>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center gap-2.5">
                      <TrendingUp className="w-4 h-4 text-blue-600" />
                      <div>
                        <div className="text-slate-500">Ads Performance</div>
                        <div className="font-bold text-sm text-slate-800">
                          {parsedPayload.ads.length} baris
                        </div>
                      </div>
                    </div>
                  </div>

                  {parsedPayload.campaign && (
                    <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                      <strong>Target Campaign:</strong>{" "}
                      GMV: Rp {Number(parsedPayload.campaign.target_gmv || 0).toLocaleString("id-ID")} |{" "}
                      Video: {parsedPayload.campaign.target_video || 0} pcs |{" "}
                      Creator: {parsedPayload.campaign.target_creator || 0}
                    </div>
                  )}
                </div>

                {/* Mode Penggantian Data */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="border border-slate-200 rounded-lg p-3 bg-slate-50 space-y-1.5">
                    <label className="font-semibold text-slate-700 block">
                      Mode Sales Organik:
                    </label>
                    <select
                      className="w-full p-1.5 bg-white border border-slate-300 rounded text-xs"
                      value={modeSales}
                      onChange={(e) => setModeSales(e.target.value as any)}
                    >
                      <option value="append">Tambah Baris Baru (Append)</option>
                      <option value="replace">Ganti Seluruh Data (Replace)</option>
                    </select>
                    <p className="text-[11px] text-slate-500">
                      {modeSales === "replace"
                        ? "⚠️ Menghapus data sales lama campaign ini & mengganti dengan isi file."
                        : "Hanya menambahkan transaksi baru tanpa menghapus riwayat yang ada."}
                    </p>
                  </div>

                  <div className="border border-slate-200 rounded-lg p-3 bg-slate-50 space-y-1.5">
                    <label className="font-semibold text-slate-700 block">
                      Mode Ads Performance:
                    </label>
                    <select
                      className="w-full p-1.5 bg-white border border-slate-300 rounded text-xs"
                      value={modeAds}
                      onChange={(e) => setModeAds(e.target.value as any)}
                    >
                      <option value="append">Tambah / Update Baris Baru (Append)</option>
                      <option value="replace">Ganti Seluruh Data (Replace)</option>
                    </select>
                    <p className="text-[11px] text-slate-500">
                      {modeAds === "replace"
                        ? "⚠️ Menghapus data ads lama campaign ini & mengganti dengan isi file."
                        : "Memperbarui atau menambah baris iklan berdasarkan Ad ID."}
                    </p>
                  </div>
                </div>

                {/* Submit Button */}
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                  >
                    Tutup
                  </button>
                  <button
                    type="button"
                    disabled={isImporting}
                    onClick={handleSubmitImport}
                    className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg shadow-sm transition-all disabled:opacity-50"
                  >
                    {isImporting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Menerapkan ke Database...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        Terapkan Perubahan Data ke Sistem
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
