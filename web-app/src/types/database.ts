export type Brand = {
  id: number;
  nama: string;
  status: 'aktif' | 'arsip';
  created_at: string;
};

export type Campaign = {
  id: number;
  brand_id: number;
  nama: string;
  tipe_campaign: 'sales' | 'awareness' | 'gmv_awareness';
  persiapan_14hari: string | null;
  start_date: string;
  end_date: string;
  target_gmv: number | null;
  target_video: number | null;
  target_creator: number | null;
  target_creator_nano?: number | null;
  target_creator_micro?: number | null;
  target_creator_macro?: number | null;
  target_creator_mega?: number | null;
  target_creator_live?: number | null;
  target_creator_live_nano?: number | null;
  target_creator_live_micro?: number | null;
  target_creator_live_macro?: number | null;
  target_creator_live_mega?: number | null;
  target_views: number | null;
  budget_creator_plafon: number;
  budget_ads_plafon: number;
  vsa_gmv_max: number | null;
  pic: string | null;
  assist: string | null;
  file_concept_url: string | null;
  tiktok_campaign_ids?: string[] | null;
  status: 'aktif' | 'selesai';
  pin: string | null;
  require_client_approval: boolean;
  creator_filter_type?: string | null;
  creator_filter_usernames?: string | null;
  campaign_group?: string | null;
  created_at: string;
};

export type Creator = {
  id: number;
  username: string;
  nama_asli: string | null;
  link_account: string | null;
  pic: string | null;
  contact_pic: string | null;
  domisili: string | null;
  category: string | null;
  notes: string | null;
  rekening: string | null;
  rekening_bank: string | null;
  rekening_atas_nama: string | null;
  rekening_nomor: string | null;
  mcn: string | null;
  avatar_url: string | null;
  created_at: string;
  added_by: string | null;
  added_at: string | null;
  // relations
  campaign_creators?: CampaignCreator[];
  creator_evaluations?: CreatorEvaluation[];
  creator_snapshots?: CreatorSnapshot[];
};

export type CreatorEvaluation = {
  id: number;
  creator_id: number;
  catatan: string;
  rating: number;
  created_at: string;
  added_by: string | null;
  added_at: string | null;
};

export type CreatorSnapshot = {
  id: number;
  creator_id: number;
  tanggal_update: string;
  audience_age: string | null;
  followers: number | null;
  level: number | null;
  ratecard: number | null;
  tier: string | null;
  gmv_30d: number | null;
  gmv_30d_video?: number | null;
  gmv_30d_live?: number | null;
  updated_by: string | null;
  created_at: string;
};

export type CreatorContact = {
  id: number;
  creator_id: number;
  nomor: string;
  status: 'aktif' | 'arsip';
  tanggal_mulai: string;
  tanggal_diganti: string | null;
};

export type Niche = {
  id: number;
  nama: string;
};

export type CreatorNiche = {
  creator_id: number;
  niche_id: number;
  peringkat: number;
};

export type CreatorNote = {
  id: number;
  creator_id: number;
  isi: string;
  penulis: string;
  created_at: string;
};

export type CampaignCreator = {
  id: number;
  campaign_id: number;
  creator_id: number;
  tier: string | null;
  price: number;
  qty_vt: number;
  content_type: string | null;
  approval: 'pending' | 'approved' | 'alternate' | 'not_approved';
  status_bayar: 'belum' | 'sebagian' | 'lunas';
  nominal_pelunasan: number | null;
  tgl_pembayaran: string | null;
  pic_assist: string | null;
  notes_manager: string | null;
  notes_pic: string | null;
  sample_progress: string | null;
  gmv_organic_legacy: number | null;
  gmv_ads_legacy: number | null;
  client_approval: 'pending' | 'approved' | 'rejected' | 'not_required';
  assigned_sku_ids: number[] | null;
  added_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  not_approved_by: string | null;
  not_approved_at: string | null;
  payment_updated_by: string | null;
  payment_updated_at: string | null;
  created_at: string;
};

export type Video = {
  id: number;
  campaign_creator_id: number;
  urutan: number;
  concept: string | null;
  link_draft?: string | null;
  link_video: string | null;
  content_uid: string | null;
  sku_id: number | null;
  vt_approval: 'pending' | 'approved' | 'reject' | 'revisi';
  vt_approved_by?: string | null;
  vt_approved_at?: string | null;
  concept_updated_at?: string | null;
  concept_updated_by?: string | null;
  created_at: string;
};

export type AuditLog = {
  id: number;
  user_id: string | null;
  user_name: string | null;
  action: string;
  table_name: string | null;
  record_id: string | null;
  old_data: any | null;
  new_data: any | null;
  description: string | null;
  created_at: string;
};

export type Sku = {
  id: number;
  campaign_id: number;
  link_gmv_max: string | null;
  nama_produk: string;
  product_id: string;
  satuan_bundle: string | null;
  link_tap: string | null;
  commission: number | null;
};

export type CampaignSummary = {
  campaign_id: number;
  nama: string;
  tipe_campaign: 'sales' | 'awareness' | 'gmv_awareness';
  status: 'aktif' | 'selesai';
  start_date: string;
  end_date: string;
  target_gmv: number | null;
  target_video: number | null;
  target_creator: number | null;
  budget_creator_plafon: number;
  budget_ads_plafon: number;
  tracked_creator_gmv: number;
  // Field mati. daily_performance tidak pernah diisi, jadi selalu 0.
  // Jangan dipakai untuk decision atau perhitungan apa pun.
  total_daily_organic: number;
  total_daily_vsa: number;
  official_daily_gmv: number;
  total_gmv_achievement: number;
  // Pecahan total_gmv_achievement berdasarkan content_type di sales.
  // Dari order_id: live masuk ke live, selain itu video.
  total_gmv_video: number;
  total_gmv_live: number;
  // Informasi iklan dari Ads Manager. TIDAK ikut dijumlahkan ke total_gmv
  // karena mengukur revenue shop yang sama dengan sales.
  total_ads_gmv: number;
  total_ads_spend: number;
  achievement_video: number;
  achievement_creator: number;
  budget_ads_terpakai: number;
  sisa_budget_ads: number;
  total_pembayaran_kreator: number;
  require_client_approval: boolean;
};

export type PayoutRequest = {
  id: number;
  campaign_id: number;
  jenis_topup: 'creator' | 'ads';
  nominal: number;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
};

export type PayoutCreator = {
  id: number;
  payout_id: number;
  campaign_creator_id: number;
  nominal: number;
  tanggal_transfer: string | null;
  bukti_transfer_url: string | null;
};

export type CreatorPayment = {
  id: number;
  campaign_creator_id: number;
  rate_card: number;
  pelunasan: number;
  status_bayar: 'no_payment' | 'not_yet' | 'half_paid' | 'pay_off';
  tgl_pembayaran: string | null;
  created_at: string;
};

export type AdsSpend = {
  id: number;
  campaign_id: number;
  detail: string | null;
  nominal: number;
  status_bayar: 'not_yet' | 'half_paid' | 'pay_off';
  tanggal: string | null;
  last_updated_by: string | null;
  last_updated_at: string | null;
  created_at: string;
};

export type CreatorAddress = {
  id: number;
  campaign_creator_id: number;
  nama_penerima: string | null;
  nama_jalan: string | null;
  provinsi: string | null;
  kabupaten_kota: string | null;
  kecamatan: string | null;
  kelurahan: string | null;
  kode_pos: string | null;
  produk_dikirim: string | null;
  proses: string | null;
  tanggal_kirim: string | null;
  resi: string | null;
  ekspedisi: string | null;
  notes: string | null;
  is_cancel: boolean;
  created_at: string;
};

export type LiveSchedule = {
  id: number;
  campaign_creator_id: number;
  tanggal_live: string;
  created_at: string;
};

export type LiveSession = {
  id: number;
  livestream_room_id: string;
  creator_username: string;
  tt_campaign_id: string | null;
  livestream_name: string | null;
  start_time: string | null;
  end_time: string | null;
  duration_str: string | null;
  live_views: number;
  live_likes: number;
  live_product_rpm: number;
  created_at: string;
};

export type LiveSessionProduct = {
  id: number;
  livestream_room_id: string;
  product_id: string | null;
  product_name: string | null;
  shop_id: string | null;
  shop_name: string | null;
  category_1: string | null;
  category_2: string | null;
  gmv: number;
  orders: number;
  items_sold: number;
  commission: number;
  actual_commission: number;
  created_at: string;
};

export type CreatorAddressBook = {
  id: number;
  creator_id: number;
  label: string | null;
  nama_penerima: string | null;
  alamat_jalan: string | null;
  kecamatan: string | null;
  kota: string | null;
  provinsi: string | null;
  kodepos: string | null;
  is_primary: boolean;
  created_at: string;
};

export interface DatabaseSchema {
  brands: Brand[];
  campaigns: Campaign[];
  creators: Creator[];
  creator_snapshots: CreatorSnapshot[];
  creator_contacts: CreatorContact[];
  niches: Niche[];
  creator_niches: CreatorNiche[];
  creator_notes: CreatorNote[];
  campaign_creators: CampaignCreator[];
  videos: Video[];
  audit_logs: AuditLog[];
  skus: Sku[];
  vw_campaign_summary: CampaignSummary[];
  daily_performance: DailyPerformance[];
  payout_requests: PayoutRequest[];
  payout_creator: PayoutCreator[];
  creator_payments: CreatorPayment[];
  ads_spends: AdsSpend[];
  creator_addresses: CreatorAddress[];
  creator_address_book: CreatorAddressBook[];
  live_schedules: LiveSchedule[];
  live_sessions: LiveSession[];
  live_session_products: LiveSessionProduct[];
  sales: Sales[];
  organic_videos: OrganicVideo[];
  ads_performance: AdsPerformance[];
  ad_name_mapping: AdNameMapping[];
}

export interface DailyPerformance {
  id: number;
  campaign_id: number;
  date: string;
  organic_sales: number;
  vsa_sales: number;
  created_at: string;
}

export type Sales = {
  id: number;
  campaign_id: number | null;
  creator_username: string | null;
  content_uid: string | null;
  sku_id: number | null;
  product_id: string | null;
  tanggal: string;
  price: number;
  quantity: number | null;
  gmv: number;
  is_refund: boolean;
  content_type: string | null;
  order_id: string | null;
  order_status: string | null;
  commission_rate: string | null;
  attribution_type: string | null;
  tiktok_campaign_id?: string | null;
  shop_code?: string | null;
  raw_data: any | null;
  created_at: string;
};

export type OrganicVideo = {
  id: number;
  content_uid: string;
  creator_username: string;
  post_time: string | null;
  video_views: number;
  video_likes: number;
  duration_str: string | null;
  video_product_rpm: number;
  campaign_id?: number | null;
  product_id?: string | null;
  tiktok_campaign_id?: string | null;
  raw_data?: any | null;
  created_at: string;
};

export type AdsPerformance = {
  id: number;
  ad_id: string;
  campaign_id: number | null;
  ad_name: string;
  creator_id: number | null;
  tanggal: string | null;
  cost_usd: number;
  gross_revenue_usd: number;
  purchases: number | null;
  impressions: number;
  clicks: number;
  kurs: number;
  created_at: string;
};

export type AdNameMapping = {
  ad_name: string;
  creator_id: number;
  created_at: string;
};
