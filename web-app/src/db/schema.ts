import {
  pgTable,
  serial,
  text,
  integer,
  bigint,
  date,
  timestamp,
  boolean,
  numeric,
  jsonb,
  primaryKey,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ==========================================
// AUTH.JS (NEXTAUTH) TABLES
// ==========================================
export const users = pgTable('users', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name'),
  email: text('email').unique(),
  emailVerified: timestamp('emailVerified', { mode: 'date' }),
  image: text('image'),
  role: text('role').default('user'),
  brandId: integer('brand_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const accounts = pgTable(
  'accounts',
  {
    userId: text('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('providerAccountId').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ]
);

export const sessions = pgTable('sessions', {
  sessionToken: text('sessionToken').primaryKey(),
  userId: text('userId')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
});

export const verificationTokens = pgTable(
  'verificationToken',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { mode: 'date' }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })]
);

// ==========================================
// CORE APPLICATION TABLES
// ==========================================

// Brands
export const brands = pgTable('brands', {
  id: serial('id').primaryKey(),
  nama: text('nama').notNull(),
  status: text('status').default('aktif').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Niches
export const niches = pgTable('niches', {
  id: serial('id').primaryKey(),
  nama: text('nama').notNull().unique(),
});

// Campaigns
export const campaigns = pgTable('campaigns', {
  id: serial('id').primaryKey(),
  brandId: integer('brand_id')
    .notNull()
    .references(() => brands.id, { onDelete: 'cascade' }),
  nama: text('nama').notNull(),
  tipeCampaign: text('tipe_campaign').notNull(), // 'sales' | 'awareness'
  persiapan14hari: text('persiapan_14hari'),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  targetGmv: bigint('target_gmv', { mode: 'number' }),
  targetVideo: integer('target_video'),
  targetCreator: integer('target_creator'),
  targetViews: bigint('target_views', { mode: 'number' }),
  targetCreatorTier1: integer('target_creator_tier1'),
  targetCreatorTier2: integer('target_creator_tier2'),
  targetCreatorTier3: integer('target_creator_tier3'),
  targetCreatorTier4: integer('target_creator_tier4'),
  targetCreatorLive: integer('target_creator_live'),
  budgetCrewPlafon: bigint('budget_creator_plafon', { mode: 'number' }).notNull().default(0),
  budgetAdsPlafon: bigint('budget_ads_plafon', { mode: 'number' }).notNull().default(0),
  vsaGmvMax: bigint('vsa_gmv_max', { mode: 'number' }),
  pic: text('pic'),
  assist: text('assist'),
  fileConceptUrl: text('file_concept_url'),
  status: text('status').default('aktif').notNull(), // 'aktif' | 'selesai'
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// SKUs
export const skus = pgTable('skus', {
  id: serial('id').primaryKey(),
  campaignId: integer('campaign_id')
    .notNull()
    .references(() => campaigns.id, { onDelete: 'cascade' }),
  namaProduk: text('nama_produk').notNull(),
  productId: text('product_id'),
  komisi: numeric('komisi'),
  link: text('link'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Creators
export const creators = pgTable('creators', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  namaAsli: text('nama_asli'),
  linkAccount: text('link_account'),
  rekening: text('rekening'),
  bankAccountName: text('bank_account_name'),
  bankAccountNumber: text('bank_account_number'),
  bankName: text('bank_name'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Creator Snapshots
export const creatorSnapshots = pgTable('creator_snapshots', {
  id: serial('id').primaryKey(),
  creatorId: integer('creator_id')
    .notNull()
    .references(() => creators.id, { onDelete: 'cascade' }),
  tanggalUpdate: date('tanggal_update').notNull(),
  followers: integer('followers'),
  level: integer('level'),
  gmv30d: bigint('gmv_30d', { mode: 'number' }),
  gmv30dOrganic: bigint('gmv_30d_organic', { mode: 'number' }),
  gmv30dLive: bigint('gmv_30d_live', { mode: 'number' }),
  updatedBy: text('updated_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Creator Contacts
export const creatorContacts = pgTable('creator_contacts', {
  id: serial('id').primaryKey(),
  creatorId: integer('creator_id')
    .notNull()
    .references(() => creators.id, { onDelete: 'cascade' }),
  nomor: text('nomor').notNull(),
  status: text('status').notNull(), // 'aktif' | 'arsip'
  tanggalMulai: date('tanggal_mulai').notNull(),
  tanggalDiganti: date('tanggal_diganti'),
});

// Creator Niches
export const creatorNiches = pgTable(
  'creator_niches',
  {
    creatorId: integer('creator_id')
      .notNull()
      .references(() => creators.id, { onDelete: 'cascade' }),
    nicheId: integer('niche_id')
      .notNull()
      .references(() => niches.id, { onDelete: 'cascade' }),
    peringkat: integer('peringkat').notNull(),
  },
  (table) => [primaryKey({ columns: [table.creatorId, table.nicheId] })]
);

// Creator Notes
export const creatorNotes = pgTable('creator_notes', {
  id: serial('id').primaryKey(),
  creatorId: integer('creator_id')
    .notNull()
    .references(() => creators.id, { onDelete: 'cascade' }),
  isi: text('isi').notNull(),
  penulis: text('penulis').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Campaign Creators (Pivot)
export const campaignCreators = pgTable('campaign_creators', {
  id: serial('id').primaryKey(),
  campaignId: integer('campaign_id')
    .notNull()
    .references(() => campaigns.id, { onDelete: 'cascade' }),
  creatorId: integer('creator_id')
    .notNull()
    .references(() => creators.id, { onDelete: 'cascade' }),
  tier: text('tier'),
  price: bigint('price', { mode: 'number' }).notNull().default(0),
  qtyVt: integer('qty_vt').notNull().default(1),
  approval: text('approval').notNull().default('pending'), // 'pending' | 'approved' | 'alternate' | 'not_approved'
  picAssist: text('pic_assist'),
  notesManager: text('notes_manager'),
  notesPic: text('notes_pic'),
  notesClient: text('notes_client'),
  sampleProgress: text('sample_progress'),
  gmvOrganicLegacy: bigint('gmv_organic_legacy', { mode: 'number' }),
  gmvAdsLegacy: bigint('gmv_ads_legacy', { mode: 'number' }),
  rateCard: bigint('rate_card', { mode: 'number' }),
  statusBayar: text('status_bayar').default('Not Yet'),
  pelunasan: bigint('pelunasan', { mode: 'number' }),
  tglBayar: date('tgl_bayar'),
  slotAllocated: integer('slot_allocated'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Campaign Concepts
export const campaignConcepts = pgTable('campaign_concepts', {
  id: serial('id').primaryKey(),
  campaignId: integer('campaign_id')
    .notNull()
    .references(() => campaigns.id, { onDelete: 'cascade' }),
  conceptNumber: integer('concept_number').notNull(),
  conceptName: text('concept_name').notNull(),
  briefLink: text('brief_link'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Campaign Creator Notes
export const campaignCreatorNotes = pgTable('campaign_creator_notes', {
  id: serial('id').primaryKey(),
  campaignCreatorId: integer('campaign_creator_id')
    .notNull()
    .references(() => campaignCreators.id, { onDelete: 'cascade' }),
  fieldName: text('field_name').notNull(),
  notes: text('notes'),
  updatedBy: text('updated_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Videos
export const videos = pgTable('videos', {
  id: serial('id').primaryKey(),
  campaignCreatorId: integer('campaign_creator_id')
    .notNull()
    .references(() => campaignCreators.id, { onDelete: 'cascade' }),
  urutan: integer('urutan').notNull().default(1),
  link: text('link'),
  concept: text('concept'),
  conceptId: integer('concept_id').references(() => campaignConcepts.id, { onDelete: 'set null' }),
  contentUid: text('content_uid'),
  skuId: integer('sku_id').references(() => skus.id, { onDelete: 'set null' }),
  isLivestream: boolean('is_livestream').default(false),
  views: bigint('views', { mode: 'number' }).default(0),
  likes: bigint('likes', { mode: 'number' }).default(0),
  draftUrl: text('draft_url'),
  approvalDraft: text('approval_draft'),
  approvalLink: text('approval_link'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Organic Videos
export const organicVideos = pgTable('organic_videos', {
  id: serial('id').primaryKey(),
  campaignId: integer('campaign_id')
    .notNull()
    .references(() => campaigns.id, { onDelete: 'cascade' }),
  videoId: text('video_id').notNull(),
  creatorUsername: text('creator_username').notNull(),
  publishTime: timestamp('publish_time', { withTimezone: true }),
  postUrl: text('post_url'),
  videoTitle: text('video_title'),
  views: bigint('views', { mode: 'number' }).default(0),
  likes: bigint('likes', { mode: 'number' }).default(0),
  comments: bigint('comments', { mode: 'number' }).default(0),
  shares: bigint('shares', { mode: 'number' }).default(0),
  isLivestream: boolean('is_livestream').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Sales
export const sales = pgTable('sales', {
  id: serial('id').primaryKey(),
  campaignId: integer('campaign_id')
    .notNull()
    .references(() => campaigns.id, { onDelete: 'cascade' }),
  skuId: integer('sku_id').references(() => skus.id, { onDelete: 'set null' }),
  orderId: text('order_id').notNull(),
  orderTime: timestamp('order_time', { withTimezone: true }),
  skuName: text('sku_name'),
  productId: text('product_id'),
  skuIdStr: text('sku_id_str'),
  contentUid: text('content_uid'),
  creatorUsername: text('creator_username'),
  creatorType: text('creator_type'),
  grossSale: numeric('gross_sale'),
  quantity: integer('quantity').default(1),
  refund: numeric('refund'),
  buyerPayment: numeric('buyer_payment'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Daily Performance
export const dailyPerformance = pgTable('daily_performance', {
  id: serial('id').primaryKey(),
  campaignId: integer('campaign_id')
    .notNull()
    .references(() => campaigns.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  videoCount: integer('video_count').default(0),
  totalViews: bigint('total_views', { mode: 'number' }).default(0),
  totalLikes: bigint('total_likes', { mode: 'number' }).default(0),
  totalOrders: integer('total_orders').default(0),
  organicGmv: numeric('organic_gmv').default('0'),
  adsGmv: numeric('ads_gmv').default('0'),
  unattributedGmv: numeric('unattributed_gmv').default('0'),
  totalGmv: numeric('total_gmv').default('0'),
  adsSpend: numeric('ads_spend').default('0'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Ads Spends
export const adsSpends = pgTable('ads_spends', {
  id: serial('id').primaryKey(),
  campaignId: integer('campaign_id')
    .notNull()
    .references(() => campaigns.id, { onDelete: 'cascade' }),
  tanggal: date('tanggal').notNull(),
  nominal: bigint('nominal', { mode: 'number' }).notNull().default(0),
  status: text('status').default('Pending'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Ads Topups
export const adsTopups = pgTable('ads_topups', {
  id: serial('id').primaryKey(),
  campaignId: integer('campaign_id')
    .notNull()
    .references(() => campaigns.id, { onDelete: 'cascade' }),
  tanggal: date('tanggal').notNull(),
  nominal: bigint('nominal', { mode: 'number' }).notNull().default(0),
  senderAccountId: integer('sender_account_id'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Payment Batches
export const paymentBatches = pgTable('payment_batches', {
  id: serial('id').primaryKey(),
  batchCode: text('batch_code').notNull(),
  campaignId: integer('campaign_id').references(() => campaigns.id, { onDelete: 'set null' }),
  batchType: text('batch_type').notNull(), // 'CREATOR' | 'ADS' | 'OPERATIONAL'
  expenseType: text('expense_type'),
  status: text('status').notNull().default('DRAFT'), // 'DRAFT' | 'PENDING' | 'APPROVED' | 'PAID' | 'REJECTED'
  totalAmount: numeric('total_amount').default('0'),
  itemCount: integer('item_count').default(0),
  notes: text('notes'),
  approvedBy: text('approved_by'),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  processedBy: text('processed_by'),
  processedAt: timestamp('processed_at', { withTimezone: true }),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Payment Items
export const paymentItems = pgTable('payment_items', {
  id: serial('id').primaryKey(),
  batchId: integer('batch_id')
    .notNull()
    .references(() => paymentBatches.id, { onDelete: 'cascade' }),
  campaignCreatorId: integer('campaign_creator_id').references(() => campaignCreators.id, {
    onDelete: 'set null',
  }),
  paymentType: text('payment_type').notNull(), // 'DOWN_PAYMENT' | 'FULL_PAYMENT' | 'SETTLEMENT'
  expenseType: text('expense_type'),
  amount: numeric('amount').notNull().default('0'),
  bankName: text('bank_name'),
  bankAccountNumber: text('bank_account_number'),
  bankAccountName: text('bank_account_name'),
  notes: text('notes'),
  status: text('status').notNull().default('PENDING'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Profiles (App user role & brand mapping)
export const profiles = pgTable('profiles', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  fullName: text('nama'),
  avatarUrl: text('avatar_url'),
  role: text('role').default('staff').notNull(), // 'admin' | 'staff' | 'client' | 'kol_lead'
  status: text('status').default('active'),
  brandId: integer('brand_id').references(() => brands.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Whitelisted Emails
export const whitelistedEmails = pgTable('whitelisted_emails', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  role: text('role').default('staff').notNull(),
  brandId: integer('brand_id').references(() => brands.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Creator Addresses
export const creatorAddresses = pgTable('creator_addresses', {
  id: serial('id').primaryKey(),
  campaignCreatorId: integer('campaign_creator_id')
    .notNull()
    .references(() => campaignCreators.id, { onDelete: 'cascade' }),
  namaPenerima: text('nama_penerima'),
  nomorTelepon: text('nomor_telepon'),
  alamatLengkap: text('alamat_lengkap'),
  provinsi: text('provinsi'),
  kota: text('kota'),
  kecamatan: text('kecamatan'),
  kodePos: text('kode_pos'),
  ekspedisi: text('ekspedisi'),
  nomorResi: text('nomor_resi'),
  isCancel: boolean('is_cancel').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Creator Address Book
export const creatorAddressBook = pgTable('creator_address_book', {
  id: serial('id').primaryKey(),
  creatorId: integer('creator_id')
    .notNull()
    .references(() => creators.id, { onDelete: 'cascade' }),
  namaPenerima: text('nama_penerima'),
  nomorTelepon: text('nomor_telepon'),
  alamatLengkap: text('alamat_lengkap'),
  provinsi: text('provinsi'),
  kota: text('kota'),
  kecamatan: text('kecamatan'),
  kodePos: text('kode_pos'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Creator Bank Accounts
export const creatorBankAccounts = pgTable('creator_bank_accounts', {
  id: serial('id').primaryKey(),
  creatorId: integer('creator_id')
    .notNull()
    .references(() => creators.id, { onDelete: 'cascade' }),
  bankName: text('bank_name').notNull(),
  accountNumber: text('account_number').notNull(),
  accountName: text('account_name').notNull(),
  isPrimary: boolean('is_primary').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Sender Accounts
export const senderAccounts = pgTable('sender_accounts', {
  id: serial('id').primaryKey(),
  accountName: text('account_name').notNull(),
  bankName: text('bank_name').notNull(),
  accountNumber: text('account_number').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Audit Logs
export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  userId: text('user_id'),
  userEmail: text('user_email'),
  action: text('action').notNull(),
  tableName: text('table_name').notNull(),
  recordId: text('record_id'),
  oldData: jsonb('old_data'),
  newData: jsonb('new_data'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Ad Name Mapping
export const adNameMapping = pgTable('ad_name_mapping', {
  id: serial('id').primaryKey(),
  pattern: text('pattern'),
  creatorUsername: text('creator_username'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Ads Performance
export const adsPerformance = pgTable('ads_performance', {
  id: serial('id').primaryKey(),
  campaignId: integer('campaign_id').references(() => campaigns.id, { onDelete: 'cascade' }),
  adId: text('ad_id'),
  adName: text('ad_name'),
  cost: numeric('cost'),
  gmv: numeric('gmv'),
  orders: integer('orders'),
  impressions: bigint('impressions', { mode: 'number' }),
  clicks: bigint('clicks', { mode: 'number' }),
  date: date('date'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// User Campaigns Mapping
export const userCampaigns = pgTable('user_campaigns', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  campaignId: integer('campaign_id')
    .notNull()
    .references(() => campaigns.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// TikTok Shop OpenAPI Authorizations
export const tiktokAuthorizations = pgTable('tiktok_authorizations', {
  id: serial('id').primaryKey(),
  sellerName: text('seller_name'),
  openId: text('open_id'),
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token').notNull(),
  accessTokenExpireIn: bigint('access_token_expire_in', { mode: 'number' }),
  refreshTokenExpireIn: bigint('refresh_token_expire_in', { mode: 'number' }),
  categoryAssetCipher: text('category_asset_cipher'),
  sellerBaseRegion: text('seller_base_region'),
  status: text('status').default('active'),
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// TikTok Shop Auto-Sync Execution Logs
export const tiktokSyncLogs = pgTable('tiktok_sync_logs', {
  id: serial('id').primaryKey(),
  triggerType: text('trigger_type').notNull(), // 'cron' | 'manual'
  status: text('status').notNull(), // 'success' | 'failed' | 'partial'
  salesCount: integer('sales_count').default(0),
  videosCount: integer('videos_count').default(0),
  campaignsCount: integer('campaigns_count').default(0),
  message: text('message'),
  details: jsonb('details'),
  durationMs: integer('duration_ms'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ==========================================
// RELATIONS
// ==========================================
export const brandsRelations = relations(brands, ({ many }) => ({
  campaigns: many(campaigns),
  profiles: many(profiles),
}));

export const campaignsRelations = relations(campaigns, ({ one, many }) => ({
  brand: one(brands, { fields: [campaigns.brandId], references: [brands.id] }),
  skus: many(skus),
  campaignCreators: many(campaignCreators),
  concepts: many(campaignConcepts),
  organicVideos: many(organicVideos),
  sales: many(sales),
  dailyPerformances: many(dailyPerformance),
  adsSpends: many(adsSpends),
  adsTopups: many(adsTopups),
  paymentBatches: many(paymentBatches),
}));

export const creatorsRelations = relations(creators, ({ many }) => ({
  snapshots: many(creatorSnapshots),
  contacts: many(creatorContacts),
  niches: many(creatorNiches),
  notes: many(creatorNotes),
  campaignCreators: many(campaignCreators),
  addressBook: many(creatorAddressBook),
  bankAccounts: many(creatorBankAccounts),
}));

export const campaignCreatorsRelations = relations(campaignCreators, ({ one, many }) => ({
  campaign: one(campaigns, { fields: [campaignCreators.campaignId], references: [campaigns.id] }),
  creator: one(creators, { fields: [campaignCreators.creatorId], references: [creators.id] }),
  videos: many(videos),
  creatorNotes: many(campaignCreatorNotes),
  addresses: many(creatorAddresses),
  paymentItems: many(paymentItems),
}));

export const videosRelations = relations(videos, ({ one }) => ({
  campaignCreator: one(campaignCreators, {
    fields: [videos.campaignCreatorId],
    references: [campaignCreators.id],
  }),
  concept: one(campaignConcepts, {
    fields: [videos.conceptId],
    references: [campaignConcepts.id],
  }),
  sku: one(skus, {
    fields: [videos.skuId],
    references: [skus.id],
  }),
}));

export const paymentBatchesRelations = relations(paymentBatches, ({ one, many }) => ({
  campaign: one(campaigns, { fields: [paymentBatches.campaignId], references: [campaigns.id] }),
  items: many(paymentItems),
}));

export const paymentItemsRelations = relations(paymentItems, ({ one }) => ({
  batch: one(paymentBatches, { fields: [paymentItems.batchId], references: [paymentBatches.id] }),
  campaignCreator: one(campaignCreators, {
    fields: [paymentItems.campaignCreatorId],
    references: [campaignCreators.id],
  }),
}));
