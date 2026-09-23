"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Upload, AlertCircle, CheckCircle2, FileSpreadsheet, Loader2, BarChart3, Users, Tags, ArrowRight, XCircle, ChevronDown, ChevronRight } from "lucide-react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { useDatabaseStore } from "@/store/useDatabaseStore";
import { syncUnmappedForProduct } from "@/lib/syncUnmapped";
import { fetchImportMetadataAction, insertCustomSkuAction, executeSalesImportAction } from "@/app/actions/importActions";

type PreviewRow = {
  campaign_id: number | null;
  creator_username: string;
  content_uid: string | null;
  product_id: string | null;
  product_name?: string;
  sku_id?: number;
  tanggal: string;
  price: number;
  quantity: number;
  gmv: number;
  is_refund: boolean;
  content_type: string;
  order_id: string | null;
  order_status: string | null;
  commission_rate: string | null;
  attribution_type: string | null;
  tiktok_campaign_id: string | null;
  shop_code: string | null;
  video_views: number;
  video_likes: number;
  duration_str: string | null;
  video_product_rpm: number;
  raw_data: any;
};

type SkuInfo = { id: string; name: string };
type CreatorGMV = { username: string; gmv: number };
type CreatorAwareness = { username: string; views: number; likes: number; count: number };

type PreviewStats = {
  totalRows: number;
  validRows: number;
  refunds: number;
  unmappedRows: number;
  totalGmv: number;
  totalViews?: number;
  totalLikes?: number;
  uniqueCreators: number;
  mappedSkus: SkuInfo[];
  unmappedSkus: SkuInfo[];
  topCreators: CreatorGMV[];
  topCreatorsAwareness?: CreatorAwareness[];
  dateRange: string;
  missingCampaignRows: number;
  missingCreatorRows: number;
  campaignBreakdown: { name: string; gmv: number; videos: number; live: number }[];
};

export default function OrganicImport({ mode = 'sales' }: { mode?: 'sales' | 'video' | 'live' }) {
  const [step, setStep] = useState<1 | 1.5 | 2 | 3 | 4>(1);
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [previewPage, setPreviewPage] = useState(1);
  
  // ================= COLUMN MAPPING STATES =================
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [parsedData, setParsedData] = useState<any[]>([]);

  const REQUIRED_COLUMNS = mode === 'sales' ? [
    { key: 'order_id', label: 'Order ID', autoMatch: ['order id', 'id pesanan'] },
    { key: 'sku_id', label: 'SKU ID', autoMatch: ['sku id'] },
    { key: 'product_id', label: 'Product ID', autoMatch: ['product id', 'id produk'] },
    { key: 'product_name', label: 'Product Name', autoMatch: ['product name', 'nama produk'] },
    { key: 'creator_username', label: 'Creator Username', autoMatch: ['creator username', 'creator', 'kreator', 'username'] },
    { key: 'time_created', label: 'Time Created', autoMatch: ['time created', 'created time', 'waktu pesanan', 'waktu dibuat', 'order creation time', 'waktu pembuatan pesanan', 'paid time', 'waktu dibayar'] },
    { key: 'price', label: 'Price', autoMatch: ['price', 'harga'] },
    { key: 'quantity', label: 'Quantity', autoMatch: ['quantity', 'jumlah'] },
    { key: 'commission_gmv', label: 'Base Commission (GMV)', autoMatch: ['commission gmv', 'est. base commission', 'commission base', 'base commission'] },
    { key: 'refund_status', label: 'Refund Status', autoMatch: ['fully returned or refunded', 'refund', 'pengembalian'] },
    { key: 'tiktok_campaign_id', label: 'Campaign ID', autoMatch: ['partner campaign id', 'campaign id'] },
    { key: 'shop_code', label: 'Shop Code', autoMatch: ['shop code', 'shop id'] },
    { key: 'content_id', label: 'Content ID / Live ID', autoMatch: ['content id', 'live id', 'live stream id', 'livestream id'] },
    { key: 'content_type', label: 'Content Type', autoMatch: ['content type', 'tipe konten'] },
    { key: 'order_status', label: 'Order Status', autoMatch: ['order settlement status', 'order status', 'status pesanan'] },
    { key: 'commission_rate', label: 'Commission Rate', autoMatch: ['standard affiliate partner commission rate', 'commission rate'] },
    { key: 'attribution_type', label: 'Attribution Type', autoMatch: ['attribution type'] },
  ] : mode === 'video' ? [
    { key: 'content_uid', label: 'Video ID', autoMatch: ['video id'] },
    { key: 'creator_username', label: 'Creator Name', autoMatch: ['creator name', 'creator username', 'kreator'] },
    { key: 'product_id', label: 'Product ID', autoMatch: ['product id'] },
    { key: 'product_name', label: 'Product Name', autoMatch: ['product name'] },
    { key: 'tiktok_campaign_id', label: 'Campaign ID', autoMatch: ['campaign id'] },
    { key: 'post_time', label: 'Post Time', autoMatch: ['post time'] },
    { key: 'video_views', label: 'Video Views', autoMatch: ['video views', 'views'] },
    { key: 'video_likes', label: 'Video Likes', autoMatch: ['video likes', 'likes'] },
    { key: 'duration_str', label: 'Duration', autoMatch: ['duration'] },
    { key: 'video_product_rpm', label: 'Video Product RPM', autoMatch: ['video product rpm', 'rpm'] },
  ] : [
    // mode === 'live'
    { key: 'content_uid', label: 'Livestream Room ID', autoMatch: ['livestream room id', 'live id'] },
    { key: 'creator_username', label: 'Creator Name', autoMatch: ['creator name', 'creator username', 'kreator'] },
    { key: 'product_id', label: 'Product ID', autoMatch: ['product id'] },
    { key: 'product_name', label: 'Product Name', autoMatch: ['product name'] },
    { key: 'tiktok_campaign_id', label: 'Campaign ID', autoMatch: ['campaign id'] },
    { key: 'post_time', label: 'LIVE Time Info', autoMatch: ['live time info'] },
    { key: 'video_views', label: 'LIVE Views', autoMatch: ['live views', 'views'] },
    { key: 'video_likes', label: 'LIVE Likes', autoMatch: ['live likes', 'likes'] },
    { key: 'duration_str', label: 'Duration', autoMatch: ['duration'] },
    { key: 'video_product_rpm', label: 'LIVE Product RPM', autoMatch: ['live product rpm', 'rpm'] },
  ];

  const [previewPayload, setPreviewPayload] = useState<PreviewRow[]>([]);
  const [stats, setStats] = useState<PreviewStats | null>(null);
  const [result, setResult] = useState<{success: number; skipped: number; errors: string[]} | null>(null);
  const [showSkuTable, setShowSkuTable] = useState(false);
  const [showErrorLogs, setShowErrorLogs] = useState(false);
  
  // Ambil tabel SKU dari store global
  const { skus, campaigns, fetchData } = useDatabaseStore();
  
  // State for inline SKU registration
  const [skuCampaignSelect, setSkuCampaignSelect] = useState<Record<string, string>>({});
  const [isRegisteringSku, setIsRegisteringSku] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFiles(Array.from(e.target.files));
    }
  };

  const processFileLocally = () => {
    if (files.length === 0) return;
    setLoading(true);

    // Memberikan jeda 100ms agar browser sempat me-render animasi loading sebelum CPU terkunci
    setTimeout(async () => {
      let allData: any[] = [];
      try {
        for (const file of files) {
          const ext = file.name.split('.').pop()?.toLowerCase();
          
          if (ext === 'csv') {
            const data = await new Promise<any[]>((resolve, reject) => {
              Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => resolve(results.data),
                error: (err) => reject(err)
              });
            });
            allData = allData.concat(data);
          } else if (ext === 'xlsx' || ext === 'xls') {
            const data = await new Promise<any[]>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = (e) => {
                try {
                  const dataArr = new Uint8Array(e.target?.result as ArrayBuffer);
                  const workbook = XLSX.read(dataArr, { type: 'array' });
                  const customReportSheet = workbook.SheetNames.find(s => s.toLowerCase().trim() === 'custom report');
                  const sheetToUse = customReportSheet || workbook.SheetNames[0];
                  const worksheet = workbook.Sheets[sheetToUse];
                  const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: false });
                  resolve(jsonData as any[]);
                } catch (error) {
                  reject(error);
                }
              };
              reader.onerror = reject;
              reader.readAsArrayBuffer(file);
            });
            allData = allData.concat(data);
          } else {
            alert(`Format file ${file.name} tidak didukung. File ini akan dilewati.`);
          }
        } // <-- Added missing closing brace
        if (allData.length > 0) {
          const headers = Object.keys(allData[0]);
          setCsvHeaders(headers);
          
          const initialMapping: Record<string, string> = {};
          REQUIRED_COLUMNS.forEach(col => {
            let matchedHeader: string | undefined;
            for (const matchAlias of col.autoMatch) {
              matchedHeader = headers.find(h => h.toLowerCase().trim() === matchAlias);
              if (matchedHeader) break;
            }
            if (matchedHeader) {
              initialMapping[col.key] = matchedHeader;
            }
          });
          setColumnMapping(initialMapping);
          setParsedData(allData);
          setStep(1.5);
        } else {
          alert("File kosong atau tidak memiliki data yang valid.");
        }
        setLoading(false);
      } catch (error: any) {
        alert("Error membaca file: " + error.message);
        setLoading(false);
      }
    }, 100);
  };

  const handleRegisterSku = async (productId: string, productName: string) => {
    const campaignId = skuCampaignSelect[productId];
    if (!campaignId) {
      alert("Mohon pilih Campaign terlebih dahulu untuk SKU ini!");
      return;
    }
    
    setIsRegisteringSku(productId);
    try {
      const newSku = await insertCustomSkuAction({
        product_id: productId,
        nama_produk: productName,
        campaign_id: parseInt(campaignId)
      });
      
      // Sinkronisasi otomatis data lama yang belum terpetakan
      await syncUnmappedForProduct(productId, parseInt(campaignId), newSku?.id);

      alert(`SKU ${productName} berhasil didaftarkan dan data historis telah disinkronkan! Memuat ulang...`);
      await fetchData(); // Refresh global state to get new SKU
      processFileLocally(); // Re-scan the file
    } catch (err: any) {
      alert("Gagal mendaftarkan SKU: " + (err?.message || err));
    } finally {
      setIsRegisteringSku(null);
    }
  };

  const generatePreview = async () => {
    setLoading(true);
    // We already parsed the data and have mapping
    const data = parsedData;
    const isSalesFormat = mode === 'sales';
    const isAwarenessFormat = mode === 'video';
    const isLiveFormat = mode === 'live';

    // Buat Dictionary Mapping
    const skuMapping: Record<string, number> = {};
    const skuNameMapping: Record<string, string> = {};
    const skuIdMapping: Record<string, number> = {};
    const tiktokToCampaigns: Record<string, number[]> = {};

    const { skus: localSkus, campaigns: localCampaigns } = await fetchImportMetadataAction();

    localSkus.forEach(s => {
      if (s.product_id) {
        skuMapping[s.product_id.toString()] = s.campaign_id;
        skuNameMapping[s.product_id.toString()] = s.nama_produk;
        skuIdMapping[s.product_id.toString()] = s.id;
      }
    });

    localCampaigns.forEach(c => {
      if (c.tiktok_campaign_ids && c.tiktok_campaign_ids.length > 0) {
        c.tiktok_campaign_ids.forEach(tid => {
          if (!tiktokToCampaigns[tid]) tiktokToCampaigns[tid] = [];
          tiktokToCampaigns[tid].push(c.id);
        });
      }
    });

    let validRows = data;
    if (isAwarenessFormat) {
      validRows = data.filter((row: any) => {
        const dateStr = row[columnMapping['post_time']]?.toString();
        const vId = row[columnMapping['content_uid']];
        return dateStr !== 'Summary' && vId && vId !== '-';
      });
    } else if (isLiveFormat) {
      validRows = data.filter((row: any) => {
        const dateStr = row[columnMapping['post_time']]?.toString();
        const vId = row[columnMapping['content_uid']];
        return dateStr !== 'Summary' && vId && vId !== '-';
      });
    } else {
      validRows = data.filter((row: any) => row[columnMapping['order_id']]);
    }

    let refundCount = 0;
    let unmappedRowsCount = 0;
    let totalGmv = 0;
    let totalAwarenessViews = 0;
    let totalAwarenessLikes = 0;
    let missingCampaignRows = 0;
    let missingCreatorRows = 0;
    
    const uniqueCreators = new Set<string>();
    const creatorGmvMap = new Map<string, number>();
    const creatorAwarenessMap = new Map<string, { views: number; likes: number; count: number }>();
    const campaignBreakdownMap = new Map<string, { gmv: number; videos: number; live: number }>();
    
    const mappedSkusMap = new Map<string, string>(); // id -> name
    const unmappedSkusMap = new Map<string, string>(); // id -> name

    const payload: PreviewRow[] = [];

    let minDate = new Date('2099-01-01').getTime();
    let maxDate = new Date('1970-01-01').getTime();

    const parseTikTokDate = (dateStr: string) => {
      if (!dateStr) return new Date('1970-01-01T00:00:00Z').toISOString();
      try {
        let str = dateStr.trim();
        // 1. Remove range (e.g. LIVE time info)
        if (str.includes('-') && str.length > 15) {
          const match = str.match(/^(\d{4}-\d{2}-\d{2}(?:\s\d{2}:\d{2}:\d{2})?)/);
          if (match) str = match[1];
        }
        
        // 2. Handle DD/MM/YYYY HH:MM or MM/DD/YYYY HH:MM
        if (str.includes('/')) {
          const parts = str.split(' ');
          const dateParts = parts[0].split('/');
          if (dateParts.length === 3) {
            let year = dateParts[2];
            let p1 = parseInt(dateParts[1]);
            let p0 = parseInt(dateParts[0]);
            let month = p1;
            let day = p0;
            // auto detect DD/MM vs MM/DD
            if (p0 > 12) { month = p1; day = p0; }
            else if (p1 > 12) { month = p0; day = p1; }
            if (year.length === 2) year = '20' + year;
            str = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} ${parts[1] || '00:00:00'}`;
          }
        }

        // 3. Fix Safari space issue: YYYY-MM-DD HH:MM:SS -> YYYY-MM-DDTHH:MM:SS
        str = str.replace(' ', 'T');
        
        // 4. Ensure it has seconds if it has a T
        if (str.includes('T')) {
          const timeParts = str.split('T')[1].split(':');
          if (timeParts.length === 2) {
            str += ':00';
          }
          if (!str.endsWith('Z') && !str.includes('+')) {
            str += '.000Z'; // Force UTC
          }
        }

        const d = new Date(str);
        if (!isNaN(d.getTime())) return d.toISOString();
        
        // Fallback: just parse the first 10 characters
        const fallback = new Date(str.substring(0, 10));
        if (!isNaN(fallback.getTime())) return fallback.toISOString();

        return new Date('1970-01-01T00:00:00Z').toISOString();
      } catch (err) {
        return new Date('1970-01-01T00:00:00Z').toISOString();
      }
    };

    for (const row of validRows) {
      let isRefund = false;
      let rawProductId = '';
      let productName = '';
      let price = 0;
      let quantity = 0;
      let gmv = 0;
      let creatorUsername = '';
      let contentUid = '';
      let tanggal = '';
      let contentType = 'Video';
      let orderId = '';
      let orderStatus = '';
      let commissionRate = '';
      let attributionType = '';
      let tiktokCampaignId = '';
      let shopCode = '';
      let videoViews = 0;
      let videoLikes = 0;
      let durationStr = '';
      let videoProductRpm = 0;

      if (isSalesFormat) {
        const isRefundStr = row[columnMapping['refund_status']]?.toString() || 'No';
        isRefund = isRefundStr.trim().toLowerCase() === 'yes';

        tiktokCampaignId = row[columnMapping['tiktok_campaign_id']]?.toString().trim() || '';
        shopCode = row[columnMapping['shop_code']]?.toString().trim() || '';

        rawProductId = row[columnMapping['product_id']]?.toString().trim() || '';
        productName = row[columnMapping['product_name']]?.toString().trim() || skuNameMapping[rawProductId] || 'Unknown Product';
        price = Math.round(parseFloat(row[columnMapping['price']]?.toString().replace(/[^0-9.-]+/g,"") || '0'));
        quantity = parseInt(row[columnMapping['quantity']]?.toString().replace(/[^0-9.-]+/g,"") || '0');
        
        // GMV: Hitung dari Qty * Est. Base Commission (atau jika Est. Base Commission sudah merupakan total pesanan)
        const rawEstBase = parseFloat(row[columnMapping['commission_gmv']]?.toString().replace(/[^0-9.-]+/g,"") || '0');
        if (rawEstBase > 0) {
          if (quantity > 1 && rawEstBase < (price * quantity * 0.7)) {
            gmv = Math.round(rawEstBase * quantity);
          } else {
            gmv = Math.round(rawEstBase);
          }
        } else {
          gmv = Math.round(price * quantity);
        }
        
        const rawUsername = row[columnMapping['creator_username']]?.toString().trim() || '';
        creatorUsername = rawUsername.replace('@', '').toLowerCase();
        
        contentUid = row[columnMapping['content_id']]?.toString().trim() || '';
        contentType = row[columnMapping['content_type']]?.toString().trim() || 'Video';
        
        tanggal = parseTikTokDate(row[columnMapping['time_created']]?.toString().trim() || '');
        const orderIdRaw = row[columnMapping['order_id']]?.toString().trim() || '';
        const skuIdStr = row[columnMapping['sku_id']]?.toString().trim() || '';
        orderId = `${orderIdRaw}_${skuIdStr}_${rawProductId}_${tiktokCampaignId}`;
        orderStatus = row[columnMapping['order_status']]?.toString().trim() || '';
        
        commissionRate = row[columnMapping['commission_rate']]?.toString().trim() || '';
        attributionType = row[columnMapping['attribution_type']]?.toString().trim() || '';
      } else if (isLiveFormat) {
        // Live Format - HANYA UPDATE AWARENESS
        rawProductId = row[columnMapping['product_id']]?.toString().trim() || '';
        productName = row[columnMapping['product_name']]?.toString().trim() || skuNameMapping[rawProductId] || 'Unknown Product';
        gmv = 0; 
        quantity = 0;
        price = 0;
        tiktokCampaignId = row[columnMapping['tiktok_campaign_id']]?.toString().trim() || '';
        shopCode = row[columnMapping['shop_code']]?.toString().trim() || '';
        const rawUsername = row[columnMapping['creator_username']]?.toString().trim() || '';
        creatorUsername = rawUsername.replace('@', '').toLowerCase();
        contentUid = row[columnMapping['content_uid']]?.toString().trim() || '';
        tanggal = parseTikTokDate(row[columnMapping['post_time']]?.toString().trim() || '');
        contentType = 'Livestream';
        orderId = ''; 
        orderStatus = 'Completed'; 
        videoViews = parseInt(row[columnMapping['video_views']]?.toString().replace(/[^0-9.-]+/g,"") || '0');
        videoLikes = parseInt(row[columnMapping['video_likes']]?.toString().replace(/[^0-9.-]+/g,"") || '0');
        durationStr = row[columnMapping['duration_str']]?.toString().trim() || '';
        const rpmStr = row[columnMapping['video_product_rpm']]?.toString() || '0';
        videoProductRpm = Math.round(parseFloat(rpmStr.replace(/[^0-9.-]+/g, '')) || 0);
      } else {
        // Awareness Format (Video)
        rawProductId = row[columnMapping['product_id']]?.toString().trim() || '';
        productName = row[columnMapping['product_name']]?.toString().trim() || skuNameMapping[rawProductId] || 'Unknown Product';
        gmv = 0; 
        quantity = 0;
        price = 0;
        tiktokCampaignId = row[columnMapping['tiktok_campaign_id']]?.toString().trim() || '';
        shopCode = row[columnMapping['shop_code']]?.toString().trim() || '';
        const rawUsername = row[columnMapping['creator_username']]?.toString().trim() || '';
        creatorUsername = rawUsername.replace('@', '').toLowerCase();
        contentUid = row[columnMapping['content_uid']]?.toString().trim() || '';
        tanggal = parseTikTokDate(row[columnMapping['post_time']]?.toString().trim() || '');
        contentType = 'Video';
        orderId = ''; 
        orderStatus = 'Completed'; 
        videoViews = parseInt(row[columnMapping['video_views']]?.toString().replace(/[^0-9.-]+/g,"") || '0');
        videoLikes = parseInt(row[columnMapping['video_likes']]?.toString().replace(/[^0-9.-]+/g,"") || '0');
        durationStr = row[columnMapping['duration_str']]?.toString().trim() || '';
        const rpmStr = row[columnMapping['video_product_rpm']]?.toString() || '0';
        videoProductRpm = Math.round(parseFloat(rpmStr.replace(/[^0-9.-]+/g, '')) || 0);
      }

      // SMART ROUTING: Hierarchy 1: Product ID (Absolute Priority) -> Hierarchy 2: Campaign ID Fallback
      let mappedCampaignId = null;

      // Priority 1: SKU Match (Absolute Priority, tidak peduli tiktok_campaign_ids cocok atau tidak)
      if (rawProductId && skuMapping[rawProductId]) {
         mappedCampaignId = skuMapping[rawProductId];
      }
      
      // Priority 2: Fallback to TikTok Campaign ID if SKU is not mapped
      if (!mappedCampaignId && tiktokCampaignId && tiktokToCampaigns[tiktokCampaignId]) {
        const possibleCampaigns = tiktokToCampaigns[tiktokCampaignId];
        if (possibleCampaigns.length === 1) {
           mappedCampaignId = possibleCampaigns[0]; 
        } else if (possibleCampaigns.length > 1) {
           mappedCampaignId = possibleCampaigns[0];
        }
      }

      if (!mappedCampaignId) {
        unmappedRowsCount++;
        missingCampaignRows++;
        if (rawProductId) unmappedSkusMap.set(rawProductId, productName);
        // Tetap simpan baris ini dengan campaign_id = null
      } else {
        if (rawProductId) mappedSkusMap.set(rawProductId, productName);
      }
      
      if (!creatorUsername) {
        missingCreatorRows++;
      }
      
      const campName = mappedCampaignId ? (localCampaigns.find(c => c.id === mappedCampaignId)?.nama || 'Unknown Campaign') : 'Belum Terpetakan';
      const breakdown = campaignBreakdownMap.get(campName) || { gmv: 0, videos: 0, live: 0 };
      if (isSalesFormat) {
          breakdown.gmv += gmv;
      } else if (isLiveFormat) {
          breakdown.live += 1;
      } else {
          breakdown.videos += 1;
      }
      campaignBreakdownMap.set(campName, breakdown);

      // Update Date Range
      const rowDate = new Date(tanggal).getTime();
      if (!isNaN(rowDate)) {
        if (rowDate < minDate) minDate = rowDate;
        if (rowDate > maxDate) maxDate = rowDate;
      }

      if (isRefund) {
        refundCount++;
        // GMV tetap dihitung (price × qty) karena order tetap terjadi.
        // Flag is_refund disimpan untuk keperluan analisis di masa depan.
      }

      // Hitung agregat untuk data yang VALID saja
      totalGmv += gmv;
      if (creatorUsername) {
        uniqueCreators.add(creatorUsername);
        creatorGmvMap.set(creatorUsername, (creatorGmvMap.get(creatorUsername) || 0) + gmv);

        if (isAwarenessFormat || isLiveFormat) {
          totalAwarenessViews += videoViews;
          totalAwarenessLikes += videoLikes;
          const cur = creatorAwarenessMap.get(creatorUsername) || { views: 0, likes: 0, count: 0 };
          cur.views += videoViews;
          cur.likes += videoLikes;
          cur.count += 1;
          creatorAwarenessMap.set(creatorUsername, cur);
        }
      }

      payload.push({
        campaign_id: mappedCampaignId,
        creator_username: creatorUsername,
        content_uid: contentUid || null,
        product_id: rawProductId || null,
        product_name: productName,
        sku_id: rawProductId ? skuIdMapping[rawProductId] : undefined,
        tanggal: tanggal,
        price: price,
        quantity: quantity,
        gmv: gmv,
        is_refund: isRefund,
        content_type: contentType,
        order_id: orderId || null,
        order_status: orderStatus || null,
        commission_rate: commissionRate || null,
        attribution_type: attributionType || null,
        tiktok_campaign_id: tiktokCampaignId || null,
        shop_code: shopCode || null,
        video_views: videoViews,
        video_likes: videoLikes,
        duration_str: durationStr || null,
        video_product_rpm: videoProductRpm,
        raw_data: row
      });
    }

    // ====== DEDUP ANTAR FILE ======
    // Jika user upload beberapa file, hapus baris duplikat berdasarkan composite key (order_id)
    const seenOrderIds = new Set<string>();
    const dedupedPayload = payload.filter(row => {
      if (!row.order_id) return true; // baris tanpa order_id tetap diproses
      if (seenOrderIds.has(row.order_id)) return false; // buang duplikat
      seenOrderIds.add(row.order_id);
      return true;
    });
    const dupCount = payload.length - dedupedPayload.length;

    // Top 3 Creators by GMV
    const topCreators = Array.from(creatorGmvMap.entries())
      .map(([username, gmv]) => ({ username, gmv }))
      .sort((a, b) => b.gmv - a.gmv)
      .slice(0, 3);

    // Top 3 Creators by Views (Awareness)
    const topCreatorsAwareness = Array.from(creatorAwarenessMap.entries())
      .map(([username, d]) => ({ username, ...d }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 3);

    // Array SKU
    const mappedSkusArray = Array.from(mappedSkusMap.entries()).map(([id, name]) => ({ id, name }));
    const unmappedSkusArray = Array.from(unmappedSkusMap.entries()).map(([id, name]) => ({ id, name }));

    let dateRangeStr = "Unknown Date";
    if (minDate <= maxDate) {
      const formatDate = (ts: number) => new Date(ts).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
      dateRangeStr = `${formatDate(minDate)} - ${formatDate(maxDate)}`;
    }

    setPreviewPayload(dedupedPayload);
    setStats({
      totalRows: data.length,
      validRows: dedupedPayload.length,
      refunds: refundCount,
      unmappedRows: unmappedRowsCount + dupCount,
      totalGmv,
      totalViews: totalAwarenessViews,
      totalLikes: totalAwarenessLikes,
      uniqueCreators: uniqueCreators.size,
      mappedSkus: mappedSkusArray,
      unmappedSkus: unmappedSkusArray,
      topCreators,
      topCreatorsAwareness,
      dateRange: dateRangeStr,
      missingCampaignRows,
      missingCreatorRows,
      campaignBreakdown: Array.from(campaignBreakdownMap.entries()).map(([name, data]) => ({ name, ...data })).sort((a, b) => b.gmv - a.gmv || b.videos - a.videos)
    });
    setStep(2);
    setLoading(false);
  };

  const executeImport = async () => {
    setStep(3);
    setLoading(true);
    setResult(null);
    setProgress({ current: 0, total: previewPayload.length });
    
    let successCount = 0;
    const errors: string[] = [];
    
    // Deduplicate payload correctly based on type
    const salesMap = new Map<string, any>();
    const videoMap = new Map<string, any>();
    
    for (const item of previewPayload) {
      if (item.order_id) {
        // Sales Route
        if (salesMap.has(item.order_id)) {
          const existing = salesMap.get(item.order_id);
          existing.gmv += item.gmv;
          existing.quantity += item.quantity;
        } else {
          salesMap.set(item.order_id, { ...item }); 
        }
      } else if (item.content_uid) {
        // Engagement Route (Custom Report)
        const compositeKey = `${item.content_uid}_${item.product_id || 'unknown'}`;
        if (!videoMap.has(compositeKey)) {
          videoMap.set(compositeKey, { ...item });
        } else {
          // If the existing entry doesn't have a campaign_id but the new one does, prioritize the new one
          const existing = videoMap.get(compositeKey);
          if (!existing.campaign_id && item.campaign_id) {
            videoMap.set(compositeKey, { ...item });
          }
        }
      }
    }
    
    const uniqueSalesPayload = Array.from(salesMap.values());
    const uniqueVideoPayload = Array.from(videoMap.values());
    const total = uniqueSalesPayload.length + uniqueVideoPayload.length;
    
    try {
      const res = await executeSalesImportAction(uniqueSalesPayload, uniqueVideoPayload, mode === 'video');
      if (res.success) {
        successCount = res.salesInserted + res.videosInserted;
      }
    } catch (err: any) {
      errors.push(`Gagal import data: ${err.message || err}`);
    }
    
    setResult({ success: successCount, skipped: total - successCount, errors });
    setStep(4);
    setLoading(false);
  };

  const reset = () => {
    setFiles([]);
    setStep(1);
    setPreviewPayload([]);
    setStats(null);
    setResult(null);
    setPreviewPage(1);
  };

  return (
    <Card className="border-0 shadow-md rounded-2xl overflow-hidden bg-white">
      {/* Wizard Header */}
      <div className="bg-slate-50 border-b border-slate-100 p-4 flex items-center justify-between overflow-x-auto whitespace-nowrap">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${step >= 1 ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'}`}>1</div>
          <span className={`text-sm font-medium ${step >= 1 ? 'text-slate-900' : 'text-slate-500'}`}>Pilih File</span>
          <div className="w-8 h-[2px] bg-slate-200 mx-1 shrink-0"></div>
          
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${step >= 1.5 ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'}`}>M</div>
          <span className={`text-sm font-medium ${step >= 1.5 ? 'text-slate-900' : 'text-slate-500'}`}>Mapping Kolom</span>
          <div className="w-8 h-[2px] bg-slate-200 mx-1 shrink-0"></div>

          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${step >= 2 ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'}`}>2</div>
          <span className={`text-sm font-medium ${step >= 2 ? 'text-slate-900' : 'text-slate-500'}`}>Preview</span>
          <div className="w-8 h-[2px] bg-slate-200 mx-1 shrink-0"></div>
          
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${step >= 3 ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'}`}>3</div>
          <span className={`text-sm font-medium ${step >= 3 ? 'text-slate-900' : 'text-slate-500'}`}>Import</span>
        </div>
      </div>

      <CardContent className="p-6">
        {step === 1 && (
          <div className="space-y-6">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-amber-900 text-sm">Smart Routing Aktif!</p>
                <p className="text-sm text-amber-800 mt-1">
                  Data otomatis dipisah ke masing-masing Campaign. Data dengan SKU/Campaign ID yang <b>belum terdaftar</b> akan tetap disimpan ke database, namun statusnya <b>belum terpetakan</b> sampai Anda mendaftarkan SKU tersebut di Campaign.
                </p>
              </div>
            </div>

            <div className="border-2 border-dashed border-slate-300 rounded-2xl p-10 text-center bg-slate-50 hover:bg-indigo-50 hover:border-indigo-300 transition-all cursor-pointer" onClick={() => document.getElementById('organic-upload')?.click()}>
              <FileSpreadsheet className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <p className="font-semibold text-lg mb-1 text-slate-700">Upload File Export Partner Center</p>
              <p className="text-sm text-slate-500 mb-6">Mendukung format .csv dan .xlsx dari TikTok</p>
              <input 
                type="file" 
                multiple
                accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" 
                className="hidden" 
                id="organic-upload"
                onChange={handleFileUpload}
              />
              <Button variant="secondary" className="pointer-events-none rounded-xl">
                Pilih File Komputer
              </Button>              {files.length > 0 && (
                <div className="mt-4 text-sm text-indigo-600 font-bold bg-indigo-100/50 py-2 px-4 rounded-lg inline-block">
                  Terpilih: {files.length} file <br/>
                  <span className="text-xs font-normal text-indigo-500">{files.map(f => f.name).join(', ')}</span>
                </div>
              )}
            </div>

            <Button onClick={processFileLocally} className="w-full h-12 text-base font-bold rounded-xl" disabled={files.length === 0 || loading}>
              {loading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Sedang Memproses...</> : 'Lanjut ke Mapping Kolom'}
            </Button>
          </div>
        )}

        {step === 1.5 && (
          <div className="space-y-6">
             <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
               <h3 className="font-bold text-slate-900 mb-2">Pencocokan Kolom (Column Mapping)</h3>
               <p className="text-sm text-slate-600 mb-4">Pastikan nama kolom di sistem kami cocok dengan nama kolom yang ada di file Excel/CSV Anda. Sistem sudah mencoba mencocokkan otomatis.</p>
               
               <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                 {REQUIRED_COLUMNS.map(col => (
                   <div key={col.key} className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200 shadow-sm">
                     <div className="w-1/3">
                        <span className="text-sm font-bold text-slate-800">{col.label}</span>
                     </div>
                     <div className="w-1/12 text-center text-slate-400">
                        <ArrowRight className="w-4 h-4 mx-auto" />
                     </div>
                     <div className="w-7/12">
                        <select 
                          className="w-full text-sm border-slate-300 rounded-lg p-2 focus:ring-indigo-500 focus:border-indigo-500"
                          value={columnMapping[col.key] || ''}
                          onChange={(e) => setColumnMapping(prev => ({ ...prev, [col.key]: e.target.value }))}
                        >
                          <option value="">-- Pilih Kolom di Excel --</option>
                          {csvHeaders.map(header => (
                            <option key={header} value={header}>{header}</option>
                          ))}
                        </select>
                     </div>
                   </div>
                 ))}
               </div>
             </div>
             
             <div className="flex gap-4">
                <Button variant="outline" onClick={() => setStep(1)} className="w-1/3 h-12 text-base font-bold rounded-xl">Kembali</Button>
                <Button 
                  onClick={async () => {
                    await generatePreview();
                  }} 
                  className="w-2/3 h-12 text-base font-bold rounded-xl"
                >
                  Lanjut ke Preview
                </Button>
             </div>
          </div>
        )}

        {step === 2 && stats && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {stats.missingCampaignRows > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-4 shadow-sm shadow-red-100">
                <AlertCircle className="w-6 h-6 text-red-600 shrink-0 mt-1" />
                <div>
                  <h4 className="font-bold text-red-900 mb-1">Peringatan: Campaign ID Kosong!</h4>
                  <p className="text-sm text-red-800">
                    Ditemukan <b>{stats.missingCampaignRows} baris</b> data yang tidak memiliki Campaign ID (atau SKU tidak terdaftar). Data ini akan masuk sebagai "Belum Terpetakan" dan <b>TIDAK AKAN</b> dihitung ke performa Campaign manapun. Harap daftarkan SKU atau perbaiki file Excel Anda sebelum melanjutkan.
                  </p>
                </div>
              </div>
            )}
            
            {stats.missingCreatorRows > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-4 shadow-sm shadow-red-100">
                <AlertCircle className="w-6 h-6 text-red-600 shrink-0 mt-1" />
                <div>
                  <h4 className="font-bold text-red-900 mb-1">Peringatan: Creator Username Kosong!</h4>
                  <p className="text-sm text-red-800">
                    Ditemukan <b>{stats.missingCreatorRows} baris</b> data yang tidak memiliki Username Kreator. Data ini tidak akan masuk ke performa kreator manapun.
                  </p>
                </div>
              </div>
            )}

            {stats.unmappedRows > 0 && stats.missingCampaignRows === 0 ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-4">
                <AlertCircle className="w-6 h-6 text-amber-600 shrink-0 mt-1" />
                <div>
                  <h4 className="font-bold text-amber-900 mb-1">Ada Data Belum Terpetakan!</h4>
                  <p className="text-sm text-amber-800">
                    Ada <b>{stats.unmappedRows} baris</b> data yang SKU-nya belum terdaftar. Data ini <b>tetap akan disimpan ke database</b>, namun belum masuk ke total GMV Campaign mana pun. Harap daftarkan ID Produk di bawah ini ke menu "SKU Campaign" jika ingin data tersebut dihitung.
                  </p>
                </div>
              </div>
            ) : null}
            
            {stats.unmappedRows === 0 && stats.missingCampaignRows === 0 && stats.missingCreatorRows === 0 && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-4">
                <CheckCircle2 className="w-6 h-6 text-green-600 shrink-0 mt-1" />
                <div>
                  <h4 className="font-bold text-green-900 mb-1">Semua Data Valid & Terpetakan!</h4>
                  <p className="text-sm text-green-800">Bagus! Semua produk di dalam file ini cocok dengan SKU yang sudah didaftarkan, dan semua baris memiliki Campaign ID.</p>
                </div>
              </div>
            )}

            <div className="bg-slate-900 rounded-xl p-5 text-white shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
              <h3 className="font-bold text-lg mb-4 relative z-10 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-indigo-400" /> Ringkasan Penambahan Data ({mode === 'sales' ? 'Organik Sales' : mode === 'video' ? 'Awareness Video' : 'Awareness Livestream'})
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 relative z-10">
                {mode === 'sales' ? (
                  <>
                    <div className="bg-slate-800/50 border border-slate-700/50 p-4 rounded-xl">
                      <p className="text-xs text-slate-400 font-medium mb-1">Total GMV (Semua Status)</p>
                      <p className="text-xl font-bold text-emerald-400">Rp {(stats.totalGmv / 1000000).toFixed(1)}M</p>
                      <p className="text-[10px] text-slate-500 mt-1">Rp {stats.totalGmv.toLocaleString('id-ID')}</p>
                    </div>
                    <div className="bg-slate-800/50 border border-slate-700/50 p-4 rounded-xl">
                      <p className="text-xs text-slate-400 font-medium mb-1">Total Pesanan (Orders)</p>
                      <p className="text-xl font-bold text-white">{stats.validRows.toLocaleString()}</p>
                      <p className="text-[10px] text-slate-500 mt-1">{stats.refunds} refund tercatat (GMV tetap masuk)</p>
                    </div>
                    <div className="bg-slate-800/50 border border-slate-700/50 p-4 rounded-xl">
                      <p className="text-xs text-slate-400 font-medium mb-1">Total Kreator Aktif</p>
                      <p className="text-xl font-bold text-blue-400">{stats.uniqueCreators.toLocaleString()}</p>
                      <p className="text-[10px] text-slate-500 mt-1">Kreator penyumbang order</p>
                    </div>
                    <div className="bg-slate-800/50 border border-slate-700/50 p-4 rounded-xl">
                      <p className="text-xs text-slate-400 font-medium mb-1">Campaign Terpetakan</p>
                      <p className="text-xl font-bold text-indigo-400">{stats.campaignBreakdown.filter(b => b.name !== 'Belum Terpetakan').length} Campaign</p>
                      <p className="text-[10px] text-slate-500 mt-1">{stats.missingCampaignRows} baris perlu mapping</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="bg-slate-800/50 border border-slate-700/50 p-4 rounded-xl">
                      <p className="text-xs text-slate-400 font-medium mb-1">Total Views (Tayangan)</p>
                      <p className="text-xl font-bold text-blue-400">{(stats.totalViews || 0).toLocaleString()}</p>
                      <p className="text-[10px] text-slate-500 mt-1">Akumulasi views konten</p>
                    </div>
                    <div className="bg-slate-800/50 border border-slate-700/50 p-4 rounded-xl">
                      <p className="text-xs text-slate-400 font-medium mb-1">Total Likes (Suka)</p>
                      <p className="text-xl font-bold text-rose-400">{(stats.totalLikes || 0).toLocaleString()}</p>
                      <p className="text-[10px] text-slate-500 mt-1">Interaksi likes dari audiens</p>
                    </div>
                    <div className="bg-slate-800/50 border border-slate-700/50 p-4 rounded-xl">
                      <p className="text-xs text-slate-400 font-medium mb-1">{mode === 'video' ? 'Total Video Terdeteksi' : 'Total Livestream Terdeteksi'}</p>
                      <p className="text-xl font-bold text-white">
                        {mode === 'video' 
                          ? stats.campaignBreakdown.reduce((sum, b) => sum + b.videos, 0).toLocaleString()
                          : stats.campaignBreakdown.reduce((sum, b) => sum + b.live, 0).toLocaleString()}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-1">{stats.validRows.toLocaleString()} baris data valid</p>
                    </div>
                    <div className="bg-slate-800/50 border border-slate-700/50 p-4 rounded-xl">
                      <p className="text-xs text-slate-400 font-medium mb-1">Total Kreator Terdeteksi</p>
                      <p className="text-xl font-bold text-emerald-400">{stats.uniqueCreators.toLocaleString()}</p>
                      <p className="text-[10px] text-slate-500 mt-1">Kreator yang terhubung</p>
                    </div>
                  </>
                )}
              </div>
              
              <div className="mt-4 pt-4 border-t border-slate-700/50 relative z-10">
                <p className="text-xs text-slate-400 font-bold mb-3 uppercase tracking-wider">Breakdown per Campaign</p>
                <div className="grid md:grid-cols-2 gap-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                  {stats.campaignBreakdown.map((b, i) => (
                    <div key={i} className="flex justify-between items-center bg-slate-800/50 p-3 rounded-lg border border-slate-700/30">
                      <span className={`font-medium text-sm truncate pr-2 ${b.name === 'Belum Terpetakan' ? 'text-red-400' : 'text-slate-200'}`} title={b.name}>{b.name}</span>
                      <div className="flex gap-3 text-xs text-right whitespace-nowrap">
                        {b.gmv > 0 && <span className="text-emerald-400 font-semibold">+Rp {(b.gmv / 1000000).toFixed(1)}M</span>}
                        {b.videos > 0 && <span className="text-blue-400 font-semibold">+{b.videos} Vid</span>}
                        {b.live > 0 && <span className="text-amber-400 font-semibold">+{b.live} Live</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-indigo-900 mb-1">Rentang Tanggal Data:</p>
              <p className="text-lg font-bold text-indigo-700">{stats.dateRange}</p>
              <p className="text-xs text-indigo-600 mt-1">Pastikan ini adalah rentang tanggal yang benar sebelum klik Import.</p>
            </div>



            <div className="grid md:grid-cols-2 gap-6">
              {/* Leaderboard Manual Verification */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-50 p-3 border-b border-slate-200">
                  <p className="font-bold text-sm text-slate-800">
                    {mode === 'sales' ? 'Top 3 Kreator (Berdasarkan GMV)' : 'Top 3 Kreator (Berdasarkan Views)'}
                  </p>
                </div>
                <div className="p-0">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50/50 text-slate-500 text-xs">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium">Username</th>
                        {mode === 'sales' ? (
                          <th className="px-4 py-2 text-right font-medium">Total GMV</th>
                        ) : (
                          <>
                            <th className="px-4 py-2 text-right font-medium">Views</th>
                            <th className="px-4 py-2 text-right font-medium">Likes</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {mode === 'sales' ? (
                        stats.topCreators.length > 0 ? stats.topCreators.map((c, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="px-4 py-3 font-medium text-slate-700">@{c.username}</td>
                            <td className="px-4 py-3 text-right font-bold text-emerald-600">
                              Rp {c.gmv.toLocaleString('id-ID')}
                            </td>
                          </tr>
                        )) : (
                          <tr><td colSpan={2} className="px-4 py-3 text-center text-slate-500">Tidak ada data</td></tr>
                        )
                      ) : (
                        (stats.topCreatorsAwareness || []).length > 0 ? (stats.topCreatorsAwareness || []).map((c, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="px-4 py-3 font-medium text-slate-700">@{c.username}</td>
                            <td className="px-4 py-3 text-right font-bold text-blue-600">
                              {c.views.toLocaleString('id-ID')}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-rose-500">
                              {c.likes.toLocaleString('id-ID')}
                            </td>
                          </tr>
                        )) : (
                          <tr><td colSpan={3} className="px-4 py-3 text-center text-slate-500">Tidak ada data</td></tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* SKU Detective Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden flex flex-col">
                <div 
                  className="bg-slate-50 p-3 border-b border-slate-200 flex justify-between items-center cursor-pointer hover:bg-slate-100 transition-colors"
                  onClick={() => setShowSkuTable(!showSkuTable)}
                >
                  <div className="flex items-center gap-2">
                    {showSkuTable ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
                    <p className="font-bold text-sm text-slate-800">Daftar SKU Ditemukan</p>
                  </div>
                  <span className="text-xs bg-white px-2 py-1 rounded border border-slate-200 font-medium">
                    {stats.mappedSkus.length + stats.unmappedSkus.length} Produk
                  </span>
                </div>
                {showSkuTable && (
                  <div className="overflow-y-auto max-h-[250px] flex-1">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50/50 text-slate-500 sticky top-0 backdrop-blur-sm">
                        <tr>
                          <th className="px-4 py-2 text-left font-medium w-16">Status</th>
                          <th className="px-4 py-2 text-left font-medium">Product ID</th>
                          <th className="px-4 py-2 text-left font-medium">Nama Produk</th>
                          <th className="px-4 py-2 text-left font-medium w-64">Daftarkan ke Campaign</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {stats.unmappedSkus.map(sku => (
                          <tr key={sku.id} className="bg-amber-50/50 hover:bg-amber-50">
                            <td className="px-4 py-2"><span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700">TERTUNDA</span></td>
                            <td className="px-4 py-2 font-mono text-amber-700">{sku.id}</td>
                            <td className="px-4 py-2 text-amber-900 max-w-[150px] truncate" title={sku.name}>{sku.name}</td>
                            <td className="px-4 py-2">
                              <div className="flex items-center gap-2">
                                <select 
                                  className="border border-slate-200 rounded px-2 py-1 bg-white text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 w-36"
                                  value={skuCampaignSelect[sku.id] || ''}
                                  onChange={(e) => setSkuCampaignSelect(prev => ({...prev, [sku.id]: e.target.value}))}
                                >
                                  <option value="">-- Pilih Campaign --</option>
                                  {campaigns.map(c => (
                                    <option key={c.id} value={c.id}>{c.nama}</option>
                                  ))}
                                </select>
                                <button 
                                  onClick={() => handleRegisterSku(sku.id, sku.name)}
                                  disabled={isRegisteringSku === sku.id || !skuCampaignSelect[sku.id]}
                                  className="bg-blue-600 text-white px-3 py-1 rounded text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
                                >
                                  {isRegisteringSku === sku.id ? '...' : 'Simpan'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {stats.mappedSkus.map(sku => (
                          <tr key={sku.id} className="hover:bg-slate-50">
                            <td className="px-4 py-2"><span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700">TERDAFTAR</span></td>
                            <td className="px-4 py-2 font-mono text-slate-600">{sku.id}</td>
                            <td className="px-4 py-2 text-slate-700 max-w-[150px] truncate" title={sku.name}>{sku.name}</td>
                            <td className="px-4 py-2">
                              <span className="text-[10px] text-slate-400 font-medium italic">Terkoneksi</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* PREVIEW TABLE */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mt-6 shadow-sm">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                <h3 className="font-semibold text-slate-800">Preview Data yang akan Di-import</h3>
                <div className="text-sm text-slate-500">
                  Total {previewPayload.length.toLocaleString()} baris valid
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs">
                    {mode === 'sales' ? (
                      <tr>
                        <th className="p-3 font-semibold w-12">No</th>
                        <th className="p-3 font-semibold">Tanggal</th>
                        <th className="p-3 font-semibold">Kreator</th>
                        <th className="p-3 font-semibold">Order ID</th>
                        <th className="p-3 font-semibold">Produk</th>
                        <th className="p-3 font-semibold text-center">Qty</th>
                        <th className="p-3 font-semibold text-right">GMV (Rp)</th>
                        <th className="p-3 font-semibold">Status</th>
                      </tr>
                    ) : (
                      <tr>
                        <th className="p-3 font-semibold w-12">No</th>
                        <th className="p-3 font-semibold">{mode === 'video' ? 'Post Time' : 'LIVE Time'}</th>
                        <th className="p-3 font-semibold">Kreator</th>
                        <th className="p-3 font-semibold">{mode === 'video' ? 'Video ID' : 'Livestream Room ID'}</th>
                        <th className="p-3 font-semibold">Produk</th>
                        <th className="p-3 font-semibold text-right">Views</th>
                        <th className="p-3 font-semibold text-right">Likes</th>
                        <th className="p-3 font-semibold text-center">Durasi</th>
                        <th className="p-3 font-semibold text-right">RPM</th>
                        <th className="p-3 font-semibold">Status</th>
                      </tr>
                    )}
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previewPayload.slice((previewPage - 1) * 50, previewPage * 50).map((row, idx) => {
                      const isError = !row.campaign_id || !row.creator_username;
                      const prodName = row.product_name || row.raw_data?.['Product name'] || row.raw_data?.['Product Name'] || row.product_id || '-';
                      return (
                      <tr key={idx} className={`border-b border-slate-100 hover:bg-slate-50 ${isError ? 'bg-red-50/50' : ''}`}>
                        <td className="p-3 text-slate-400">{(previewPage - 1) * 50 + idx + 1}</td>
                        <td className="p-3 whitespace-nowrap text-xs text-slate-600">{new Date(row.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                        <td className="p-3 font-medium text-slate-700">
                          {row.creator_username ? `@${row.creator_username}` : <span className="text-red-500 text-xs font-bold bg-red-100 px-2 py-0.5 rounded">KOSONG</span>}
                        </td>
                        <td className="p-3 font-mono text-xs text-slate-500 max-w-[130px] truncate" title={row.order_id || row.content_uid || ''}>
                          {mode === 'sales' ? (row.order_id?.split('_')[0] || row.order_id) : row.content_uid}
                        </td>
                        <td className="p-3 text-xs text-slate-700 max-w-[200px] truncate" title={prodName}>
                          {prodName}
                        </td>
                        
                        {mode === 'sales' ? (
                          <>
                            <td className="p-3 text-center font-semibold text-slate-700">{row.quantity}</td>
                            <td className="p-3 text-right text-emerald-600 font-bold whitespace-nowrap">Rp {row.gmv.toLocaleString('id-ID')}</td>
                          </>
                        ) : (
                          <>
                            <td className="p-3 text-right font-bold text-blue-600">{Number(row.video_views || 0).toLocaleString('id-ID')}</td>
                            <td className="p-3 text-right font-medium text-rose-500">{Number(row.video_likes || 0).toLocaleString('id-ID')}</td>
                            <td className="p-3 text-center text-xs text-slate-500 font-mono">{row.duration_str || '-'}</td>
                            <td className="p-3 text-right text-xs text-slate-600 font-semibold">{row.video_product_rpm ? `Rp ${row.video_product_rpm.toLocaleString('id-ID')}` : '-'}</td>
                          </>
                        )}
                        
                        <td className="p-3 whitespace-nowrap">
                          {!row.campaign_id ? (
                            <span className="text-red-600 text-xs font-bold bg-red-100 px-2 py-0.5 rounded">Belum Terdaftar</span>
                          ) : (
                            <span className="text-emerald-700 text-xs font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">Terpetakan</span>
                          )}
                        </td>
                      </tr>
                    )})}
                  </tbody>
                </table>
              </div>
              {previewPayload.length > 50 && (
                <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                  <span className="text-sm text-slate-500">Halaman {previewPage} dari {Math.ceil(previewPayload.length / 50)}</span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPreviewPage(p => Math.max(1, p - 1))} disabled={previewPage === 1}>Sebelumnya</Button>
                    <Button variant="outline" size="sm" onClick={() => setPreviewPage(p => Math.min(Math.ceil(previewPayload.length / 50), p + 1))} disabled={previewPage >= Math.ceil(previewPayload.length / 50)}>Selanjutnya</Button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-4 border-t border-slate-100">
              <Button variant="outline" className="w-1/3 h-12 rounded-xl border-slate-300 text-slate-600" onClick={() => setStep(1)}>
                Batal / Ganti File
              </Button>
              <Button className="w-2/3 h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700" onClick={executeImport} disabled={stats.validRows === 0}>
                {stats.validRows > 0 ? `Import ${stats.validRows.toLocaleString()} Baris Data` : 'Tidak ada data valid'} <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="py-12 flex flex-col items-center justify-center space-y-6 animate-in zoom-in-95 duration-500">
            <Loader2 className="w-16 h-16 text-indigo-600 animate-spin" />
            <div className="text-center">
              <h3 className="text-xl font-bold text-slate-900 mb-2">Mengimpor Data...</h3>
              <p className="text-slate-500 text-sm mb-6">Jangan tutup halaman ini. Menyimpan secara rombongan (bulk upsert).</p>
              
              <div className="w-80 max-w-full">
                <div className="flex justify-between text-xs font-bold mb-2 text-slate-700">
                  <span>{progress.current.toLocaleString()} / {progress.total.toLocaleString()} Baris</span>
                  <span>{Math.round((progress.current / Math.max(progress.total, 1)) * 100)}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                  <div 
                    className="bg-indigo-600 h-3 rounded-full transition-all duration-500 ease-out" 
                    style={{ width: `${Math.round((progress.current / Math.max(progress.total, 1)) * 100)}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 4 && result && (
          <div className="py-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className={`p-6 rounded-2xl flex items-start gap-4 mb-6 ${result.errors.length > 0 ? 'bg-amber-50 border border-amber-200' : 'bg-emerald-50 border border-emerald-200'}`}>
              {result.errors.length > 0 ? (
                <AlertCircle className="w-10 h-10 text-amber-500 shrink-0" />
              ) : (
                <CheckCircle2 className="w-10 h-10 text-emerald-500 shrink-0" />
              )}
              
              <div className="flex-1">
                <h3 className={`text-xl font-bold mb-2 ${result.errors.length > 0 ? 'text-amber-900' : 'text-emerald-900'}`}>
                  {result.errors.length > 0 ? 'Import Selesai dengan Beberapa Peringatan' : 'Import Sukses 100%!'}
                </h3>
                <p className={`text-sm mb-4 ${result.errors.length > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                  Semua data valid berhasil dimasukkan / di-update ke dalam database. Laporan GMV di Dashboard akan otomatis menyesuaikan dengan data terbaru ini.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="bg-white/60 p-4 rounded-xl border border-white shadow-sm flex flex-col justify-center items-center text-center">
                    <p className="text-xs font-semibold uppercase tracking-wider mb-1 opacity-70">Total Data Ter-Update</p>
                    <p className="text-3xl font-bold text-slate-800">{result.success.toLocaleString()} <span className="text-sm font-normal">baris</span></p>
                  </div>
                  {result.skipped > 0 && (
                    <div className="bg-red-50/60 p-4 rounded-xl border border-red-100 shadow-sm flex flex-col justify-center items-center text-center">
                      <p className="text-xs font-semibold uppercase tracking-wider mb-1 opacity-70 text-red-700">Data Gagal</p>
                      <p className="text-3xl font-bold text-red-600">{result.skipped.toLocaleString()} <span className="text-sm font-normal">baris</span></p>
                    </div>
                  )}
                </div>

                {result.errors.length > 0 && (
                  <div className="mt-4 bg-white/50 rounded-xl border border-amber-100 text-xs overflow-hidden">
                    <div 
                      className="p-3 font-bold text-amber-900 flex items-center justify-between cursor-pointer hover:bg-amber-50/50 transition-colors"
                      onClick={() => setShowErrorLogs(!showErrorLogs)}
                    >
                      <div className="flex items-center gap-2">
                        {showErrorLogs ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        <span>Log Error ({result.errors.length})</span>
                      </div>
                    </div>
                    {showErrorLogs && (
                      <div className="p-4 pt-0 border-t border-amber-100">
                        <ul className="list-disc pl-4 space-y-1 text-amber-800 font-mono mt-2">
                          {result.errors.slice(0, 50).map((e, i) => <li key={i}>{e}</li>)}
                          {result.errors.length > 50 && <li>...dan {result.errors.length - 50} error lainnya.</li>}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <Button className="w-full h-12 rounded-xl text-base bg-slate-900 hover:bg-slate-800 text-white" onClick={reset}>
              Upload File Lainnya
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
