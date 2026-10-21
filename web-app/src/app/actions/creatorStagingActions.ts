'use server';

import { db, sqlInList } from '@/db';
import { sql, type SQL } from 'drizzle-orm';
import { auth } from '@/auth';
import { revalidatePath } from 'next/cache';

export interface StagingCreatorRecord {
  id?: number;
  username: string;
  display_name?: string | null;
  tiktok_cid?: string | null;
  link_account?: string | null;
  avatar_url?: string | null;
  mcn?: string | null;
  no_whatsapp?: string | null;
  level?: number | string | null;
  followers?: number | string | null;
  primary_niche?: string | null;
  niche?: string | null;
  gmv_30d?: number | string | null;
  gmv_status?: string | null;
  gmv_30d_live?: number | string | null;
  gmv_30d_video?: number | string | null;
  gmv_30d_showcase?: number | string | null;
  pct_live?: number | string | null;
  pct_video?: number | string | null;
  pct_showcase?: number | string | null;
  items_sold_30d?: number | string | null;
  gpm_30d?: number | string | null;
  gmv_per_customer_min?: number | string | null;
  gmv_per_customer_max?: number | string | null;
  avg_commission_rate?: number | string | null;
  products_promoted_count?: number | string | null;
  brand_collaborations_count?: number | string | null;
  product_price_min?: number | string | null;
  product_price_max?: number | string | null;
  video_gpm?: number | string | null;
  videos_count_30d?: number | string | null;
  avg_video_views?: number | string | null;
  avg_video_engagement_rate?: number | string | null;
  live_gpm?: number | string | null;
  live_streams_count_30d?: number | string | null;
  avg_live_views?: number | string | null;
  avg_live_engagement_rate?: number | string | null;
  audience_male_pct?: number | string | null;
  audience_female_pct?: number | string | null;
  audience_age?: string | null;
  age_18_24_pct?: number | string | null;
  age_25_34_pct?: number | string | null;
  age_35_44_pct?: number | string | null;
  age_45_54_pct?: number | string | null;
  age_55_plus_pct?: number | string | null;
  top_locations?: Array<{ loc: string; pct: number }> | string | null;
  gmv_by_category?: Array<{ category: string; pct: number }> | string | null;
  status_staging?: string | null;
  promoted_creator_id?: number | null;
  scraped_by?: string | null;
  scraper_name?: string | null;
  exists_in_pool?: boolean;
  scraped_at?: string | null;
  updated_at?: string | null;
}

let schemaEnsured = false;

async function requireAuthenticatedUser() {
  const session = await auth();
  if (!session?.user) {
    throw new Error('Unauthorized: Silakan login terlebih dahulu.');
  }
  return session.user;
}

export async function ensureCreatorStagingSchema() {
  if (schemaEnsured) return;
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS creator_staging (
          id serial PRIMARY KEY,
          username text NOT NULL UNIQUE,
          display_name text,
          tiktok_cid text,
          link_account text,
          avatar_url text,
          mcn text,
          no_whatsapp text,
          level integer,
          followers bigint,
          primary_niche text,
          gmv_30d bigint NOT NULL DEFAULT 0,
          gmv_status text NOT NULL DEFAULT 'RIIL' CHECK (gmv_status IN ('RIIL', 'ESTIMASI')),
          gmv_30d_live bigint NOT NULL DEFAULT 0,
          gmv_30d_video bigint NOT NULL DEFAULT 0,
          gmv_30d_showcase bigint NOT NULL DEFAULT 0,
          pct_live numeric(5,2) DEFAULT 0,
          pct_video numeric(5,2) DEFAULT 0,
          pct_showcase numeric(5,2) DEFAULT 0,
          items_sold_30d bigint DEFAULT 0,
          gpm_30d bigint DEFAULT 0,
          gmv_per_customer_min bigint,
          gmv_per_customer_max bigint,
          avg_commission_rate numeric(5,2),
          products_promoted_count integer DEFAULT 0,
          brand_collaborations_count integer DEFAULT 0,
          product_price_min bigint,
          product_price_max bigint,
          video_gpm bigint DEFAULT 0,
          videos_count_30d integer DEFAULT 0,
          avg_video_views bigint DEFAULT 0,
          avg_video_engagement_rate numeric(5,2),
          live_gpm bigint DEFAULT 0,
          live_streams_count_30d integer DEFAULT 0,
          avg_live_views bigint DEFAULT 0,
          avg_live_engagement_rate numeric(5,2),
          audience_male_pct numeric(5,2),
          audience_female_pct numeric(5,2),
          audience_age text,
          age_18_24_pct numeric(5,2),
          age_25_34_pct numeric(5,2),
          age_35_44_pct numeric(5,2),
          age_45_54_pct numeric(5,2),
          age_55_plus_pct numeric(5,2),
          top_locations jsonb DEFAULT '[]'::jsonb,
          gmv_by_category jsonb DEFAULT '[]'::jsonb,
          status_staging text NOT NULL DEFAULT 'staged' CHECK (status_staging IN ('staged', 'promoted', 'archived')),
          promoted_creator_id integer REFERENCES creators(id) ON DELETE SET NULL,
          scraped_by text REFERENCES profiles(id) ON DELETE SET NULL,
          scraped_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_creator_staging_username_lower ON creator_staging (LOWER(username));`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_creator_staging_status ON creator_staging (status_staging);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_creator_staging_gmv ON creator_staging (gmv_30d DESC);`);

    await db.execute(sql`ALTER TABLE creators ADD COLUMN IF NOT EXISTS display_name text;`);
    await db.execute(sql`ALTER TABLE creators ADD COLUMN IF NOT EXISTS tiktok_cid text;`);

    await db.execute(sql`ALTER TABLE creator_snapshots ADD COLUMN IF NOT EXISTS gmv_status text DEFAULT 'RIIL';`);
    await db.execute(sql`ALTER TABLE creator_snapshots ADD COLUMN IF NOT EXISTS gmv_30d_showcase bigint DEFAULT 0;`);
    await db.execute(sql`ALTER TABLE creator_snapshots ADD COLUMN IF NOT EXISTS pct_live numeric(5,2) DEFAULT 0;`);
    await db.execute(sql`ALTER TABLE creator_snapshots ADD COLUMN IF NOT EXISTS pct_video numeric(5,2) DEFAULT 0;`);
    await db.execute(sql`ALTER TABLE creator_snapshots ADD COLUMN IF NOT EXISTS pct_showcase numeric(5,2) DEFAULT 0;`);
    await db.execute(sql`ALTER TABLE creator_snapshots ADD COLUMN IF NOT EXISTS items_sold_30d bigint DEFAULT 0;`);
    await db.execute(sql`ALTER TABLE creator_snapshots ADD COLUMN IF NOT EXISTS gpm_30d bigint DEFAULT 0;`);
    await db.execute(sql`ALTER TABLE creator_snapshots ADD COLUMN IF NOT EXISTS gmv_per_customer_min bigint;`);
    await db.execute(sql`ALTER TABLE creator_snapshots ADD COLUMN IF NOT EXISTS gmv_per_customer_max bigint;`);
    await db.execute(sql`ALTER TABLE creator_snapshots ADD COLUMN IF NOT EXISTS avg_commission_rate numeric(5,2);`);
    await db.execute(sql`ALTER TABLE creator_snapshots ADD COLUMN IF NOT EXISTS products_promoted_count integer DEFAULT 0;`);
    await db.execute(sql`ALTER TABLE creator_snapshots ADD COLUMN IF NOT EXISTS brand_collaborations_count integer DEFAULT 0;`);
    await db.execute(sql`ALTER TABLE creator_snapshots ADD COLUMN IF NOT EXISTS product_price_min bigint;`);
    await db.execute(sql`ALTER TABLE creator_snapshots ADD COLUMN IF NOT EXISTS product_price_max bigint;`);
    await db.execute(sql`ALTER TABLE creator_snapshots ADD COLUMN IF NOT EXISTS video_gpm bigint DEFAULT 0;`);
    await db.execute(sql`ALTER TABLE creator_snapshots ADD COLUMN IF NOT EXISTS videos_count_30d integer DEFAULT 0;`);
    await db.execute(sql`ALTER TABLE creator_snapshots ADD COLUMN IF NOT EXISTS avg_video_views bigint DEFAULT 0;`);
    await db.execute(sql`ALTER TABLE creator_snapshots ADD COLUMN IF NOT EXISTS avg_video_engagement_rate numeric(5,2);`);
    await db.execute(sql`ALTER TABLE creator_snapshots ADD COLUMN IF NOT EXISTS live_gpm bigint DEFAULT 0;`);
    await db.execute(sql`ALTER TABLE creator_snapshots ADD COLUMN IF NOT EXISTS live_streams_count_30d integer DEFAULT 0;`);
    await db.execute(sql`ALTER TABLE creator_snapshots ADD COLUMN IF NOT EXISTS avg_live_views bigint DEFAULT 0;`);
    await db.execute(sql`ALTER TABLE creator_snapshots ADD COLUMN IF NOT EXISTS avg_live_engagement_rate numeric(5,2);`);
    await db.execute(sql`ALTER TABLE creator_snapshots ADD COLUMN IF NOT EXISTS audience_male_pct numeric(5,2);`);
    await db.execute(sql`ALTER TABLE creator_snapshots ADD COLUMN IF NOT EXISTS audience_female_pct numeric(5,2);`);
    await db.execute(sql`ALTER TABLE creator_snapshots ADD COLUMN IF NOT EXISTS age_18_24_pct numeric(5,2);`);
    await db.execute(sql`ALTER TABLE creator_snapshots ADD COLUMN IF NOT EXISTS age_25_34_pct numeric(5,2);`);
    await db.execute(sql`ALTER TABLE creator_snapshots ADD COLUMN IF NOT EXISTS age_35_44_pct numeric(5,2);`);
    await db.execute(sql`ALTER TABLE creator_snapshots ADD COLUMN IF NOT EXISTS age_45_54_pct numeric(5,2);`);
    await db.execute(sql`ALTER TABLE creator_snapshots ADD COLUMN IF NOT EXISTS age_55_plus_pct numeric(5,2);`);
    await db.execute(sql`ALTER TABLE creator_snapshots ADD COLUMN IF NOT EXISTS top_locations jsonb DEFAULT '[]'::jsonb;`);
    await db.execute(sql`ALTER TABLE creator_snapshots ADD COLUMN IF NOT EXISTS gmv_by_category jsonb DEFAULT '[]'::jsonb;`);

    schemaEnsured = true;
  } catch (err) {
    console.error('ensureCreatorStagingSchema error:', err);
  }
}

export async function fetchKnownCreatorUsernamesAction() {
  await requireAuthenticatedUser();
  await ensureCreatorStagingSchema();

  const [stagingRows, poolRows, aliasRows] = await Promise.all([
    db.execute(sql`SELECT LOWER(TRIM(username)) as u FROM creator_staging WHERE username IS NOT NULL`).catch(() => []),
    db.execute(sql`SELECT LOWER(TRIM(username)) as u FROM creators WHERE username IS NOT NULL`).catch(() => []),
    db.execute(sql`SELECT LOWER(TRIM(alias_username)) as u FROM creator_aliases WHERE alias_username IS NOT NULL`).catch(() => []),
  ]);

  const stagingUsernames = (stagingRows as unknown as Array<{ u?: string }>).map((r) => r.u || '').filter(Boolean);
  const poolUsernames = (poolRows as unknown as Array<{ u?: string }>).map((r) => r.u || '').filter(Boolean);
  const aliasUsernames = (aliasRows as unknown as Array<{ u?: string }>).map((r) => r.u || '').filter(Boolean);

  const allSet = new Set<string>([...stagingUsernames, ...poolUsernames, ...aliasUsernames]);

  return {
    stagingCount: stagingUsernames.length,
    poolCount: poolUsernames.length,
    totalKnown: allSet.size,
    usernames: Array.from(allSet),
  };
}

export async function fetchStagingCreatorsAction(params: {
  pageNum?: number;
  pageSize?: number;
  search?: string;
  filterNiche?: string;
  filterGmvStatus?: string;
  filterStatusStaging?: string;
  filterLevel?: string;
  sortBy?: string;
}) {
  await requireAuthenticatedUser();
  await ensureCreatorStagingSchema();

  const {
    pageNum = 0,
    pageSize = 50,
    search = '',
    filterNiche = '',
    filterGmvStatus = '',
    filterStatusStaging = 'all',
    filterLevel = '',
    sortBy = 'scraped_at_desc',
  } = params;

  const offset = pageNum * pageSize;
  const whereConditions: SQL[] = [];

  if (search && search.trim()) {
    const s = `%${search.trim().replace(/^@/, '')}%`;
    whereConditions.push(
      sql`(cs.username ILIKE ${s} OR cs.display_name ILIKE ${s} OR cs.mcn ILIKE ${s})`
    );
  }

  if (filterNiche) {
    whereConditions.push(sql`cs.primary_niche = ${filterNiche}`);
  }

  if (filterGmvStatus && (filterGmvStatus === 'RIIL' || filterGmvStatus === 'ESTIMASI')) {
    whereConditions.push(sql`cs.gmv_status = ${filterGmvStatus}`);
  }

  if (filterStatusStaging && filterStatusStaging !== 'all') {
    whereConditions.push(sql`cs.status_staging = ${filterStatusStaging}`);
  }

  if (filterLevel) {
    whereConditions.push(sql`cs.level = ${Number(filterLevel)}`);
  }

  const whereClause =
    whereConditions.length > 0
      ? sql`WHERE ${sql.join(whereConditions, sql` AND `)}`
      : sql``;

  let orderClause = sql`ORDER BY cs.scraped_at DESC, cs.id DESC`;
  if (sortBy === 'gmv_desc') orderClause = sql`ORDER BY cs.gmv_30d DESC NULLS LAST, cs.id DESC`;
  else if (sortBy === 'followers_desc') orderClause = sql`ORDER BY cs.followers DESC NULLS LAST, cs.id DESC`;
  else if (sortBy === 'video_views_desc') orderClause = sql`ORDER BY cs.avg_video_views DESC NULLS LAST, cs.id DESC`;
  else if (sortBy === 'live_views_desc') orderClause = sql`ORDER BY cs.avg_live_views DESC NULLS LAST, cs.id DESC`;

  const [rows, countRes, summaryRes, nichesRes] = await Promise.all([
    db.execute(sql`
      SELECT
        cs.*,
        p.nama as scraper_name,
        EXISTS (
          SELECT 1 FROM creators cr WHERE LOWER(cr.username) = LOWER(cs.username)
        ) as exists_in_pool
      FROM creator_staging cs
      LEFT JOIN profiles p ON cs.scraped_by = p.id
      ${whereClause}
      ${orderClause}
      LIMIT ${pageSize} OFFSET ${offset}
    `),
    db.execute(sql`
      SELECT COUNT(*)::int as count
      FROM creator_staging cs
      ${whereClause}
    `),
    db.execute(sql`
      SELECT
        COUNT(*)::int as total_all,
        COUNT(*) FILTER (WHERE status_staging = 'staged')::int as total_staged,
        COUNT(*) FILTER (WHERE status_staging = 'promoted')::int as total_promoted,
        COUNT(*) FILTER (WHERE gmv_status = 'RIIL')::int as total_riil,
        COUNT(*) FILTER (WHERE gmv_status = 'ESTIMASI')::int as total_estimasi
      FROM creator_staging
    `),
    db.execute(sql`
      SELECT DISTINCT primary_niche
      FROM creator_staging
      WHERE primary_niche IS NOT NULL AND primary_niche != ''
      ORDER BY primary_niche ASC
    `),
  ]);

  const countRows = countRes as unknown as Array<{ count?: number }>;
  const summaryRows = summaryRes as unknown as Array<{
    total_all: number;
    total_staged: number;
    total_promoted: number;
    total_riil: number;
    total_estimasi: number;
  }>;
  const nicheRows = nichesRes as unknown as Array<{ primary_niche?: string }>;

  const total = countRows[0]?.count || 0;
  const stats = summaryRows[0] || {
    total_all: 0,
    total_staged: 0,
    total_promoted: 0,
    total_riil: 0,
    total_estimasi: 0,
  };
  const distinctNiches = nicheRows.map((r) => r.primary_niche || '').filter(Boolean);

  return {
    data: (rows as unknown as StagingCreatorRecord[]) || [],
    total,
    hasMore: offset + pageSize < total,
    stats,
    distinctNiches,
  };
}

export async function upsertStagingCreatorsBatchAction(items: StagingCreatorRecord[]) {
  const user = await requireAuthenticatedUser();
  await ensureCreatorStagingSchema();

  if (!Array.isArray(items) || items.length === 0) {
    return { success: true, upsertedCount: 0, usernames: [] };
  }

  const profileId = user.id || null;
  let upsertedCount = 0;
  const processedUsernames: string[] = [];

  for (const raw of items) {
    if (!raw || !raw.username) continue;
    const username = String(raw.username).trim().toLowerCase().replace(/^@/, '');
    if (!username) continue;

    const displayName = raw.display_name ? String(raw.display_name).trim() : null;
    const tiktokCid = raw.tiktok_cid ? String(raw.tiktok_cid).trim() : null;
    const linkAccount = `https://www.tiktok.com/@${username}`;
    const avatarUrl = raw.avatar_url ? String(raw.avatar_url).trim() : null;
    const mcn = raw.mcn && String(raw.mcn).trim() !== '--' ? String(raw.mcn).trim() : null;
    const noWhatsapp = raw.no_whatsapp ? String(raw.no_whatsapp).trim() : null;
    const level = raw.level ? parseInt(String(raw.level).replace(/\D/g, ''), 10) || null : null;
    const followers = raw.followers ? Math.round(Number(raw.followers)) || 0 : 0;
    const primaryNiche = raw.primary_niche || raw.niche ? String(raw.primary_niche || raw.niche).trim() : null;

    const gmv30d = Math.round(Number(raw.gmv_30d) || 0);
    const gmvStatus = raw.gmv_status === 'ESTIMASI' ? 'ESTIMASI' : 'RIIL';
    const gmv30dLive = Math.round(Number(raw.gmv_30d_live) || 0);
    const gmv30dVideo = Math.round(Number(raw.gmv_30d_video) || 0);
    const gmv30dShowcase = Math.round(Number(raw.gmv_30d_showcase) || 0);
    const pctLive = Number(raw.pct_live) || 0;
    const pctVideo = Number(raw.pct_video) || 0;
    const pctShowcase = Number(raw.pct_showcase) || 0;

    const itemsSold30d = Math.round(Number(raw.items_sold_30d) || 0);
    const gpm30d = Math.round(Number(raw.gpm_30d) || 0);
    const gmvPerCustomerMin = raw.gmv_per_customer_min != null ? Math.round(Number(raw.gmv_per_customer_min)) : null;
    const gmvPerCustomerMax = raw.gmv_per_customer_max != null ? Math.round(Number(raw.gmv_per_customer_max)) : null;
    const avgCommissionRate = raw.avg_commission_rate != null ? Number(raw.avg_commission_rate) : null;

    const productsPromotedCount = parseInt(String(raw.products_promoted_count || 0), 10) || 0;
    const brandCollaborationsCount = parseInt(String(raw.brand_collaborations_count || 0), 10) || 0;
    const productPriceMin = raw.product_price_min != null ? Math.round(Number(raw.product_price_min)) : null;
    const productPriceMax = raw.product_price_max != null ? Math.round(Number(raw.product_price_max)) : null;

    const videoGpm = Math.round(Number(raw.video_gpm) || 0);
    const videosCount30d = parseInt(String(raw.videos_count_30d || 0), 10) || 0;
    const avgVideoViews = Math.round(Number(raw.avg_video_views) || 0);
    const avgVideoEngagementRate = raw.avg_video_engagement_rate != null ? Number(raw.avg_video_engagement_rate) : null;

    const liveGpm = Math.round(Number(raw.live_gpm) || 0);
    const liveStreamsCount30d = parseInt(String(raw.live_streams_count_30d || 0), 10) || 0;
    const avgLiveViews = Math.round(Number(raw.avg_live_views) || 0);
    const avgLiveEngagementRate = raw.avg_live_engagement_rate != null ? Number(raw.avg_live_engagement_rate) : null;

    const audienceMalePct = raw.audience_male_pct != null ? Number(raw.audience_male_pct) : null;
    const audienceFemalePct = raw.audience_female_pct != null ? Number(raw.audience_female_pct) : null;
    const audienceAge = raw.audience_age ? String(raw.audience_age).trim() : null;
    const age18_24 = raw.age_18_24_pct != null ? Number(raw.age_18_24_pct) : null;
    const age25_34 = raw.age_25_34_pct != null ? Number(raw.age_25_34_pct) : null;
    const age35_44 = raw.age_35_44_pct != null ? Number(raw.age_35_44_pct) : null;
    const age45_54 = raw.age_45_54_pct != null ? Number(raw.age_45_54_pct) : null;
    const age55Plus = raw.age_55_plus_pct != null ? Number(raw.age_55_plus_pct) : null;

    const topLocationsJson = JSON.stringify(Array.isArray(raw.top_locations) ? raw.top_locations.slice(0, 5) : []);
    const gmvByCategoryJson = JSON.stringify(Array.isArray(raw.gmv_by_category) ? raw.gmv_by_category : []);

    await db.execute(sql`
      INSERT INTO creator_staging (
        username, display_name, tiktok_cid, link_account, avatar_url, mcn, no_whatsapp,
        level, followers, primary_niche,
        gmv_30d, gmv_status, gmv_30d_live, gmv_30d_video, gmv_30d_showcase,
        pct_live, pct_video, pct_showcase,
        items_sold_30d, gpm_30d, gmv_per_customer_min, gmv_per_customer_max, avg_commission_rate,
        products_promoted_count, brand_collaborations_count, product_price_min, product_price_max,
        video_gpm, videos_count_30d, avg_video_views, avg_video_engagement_rate,
        live_gpm, live_streams_count_30d, avg_live_views, avg_live_engagement_rate,
        audience_male_pct, audience_female_pct, audience_age,
        age_18_24_pct, age_25_34_pct, age_35_44_pct, age_45_54_pct, age_55_plus_pct,
        top_locations, gmv_by_category,
        scraped_by, scraped_at, updated_at
      ) VALUES (
        ${username}, ${displayName}, ${tiktokCid}, ${linkAccount}, ${avatarUrl}, ${mcn}, ${noWhatsapp},
        ${level}, ${followers}, ${primaryNiche},
        ${gmv30d}, ${gmvStatus}, ${gmv30dLive}, ${gmv30dVideo}, ${gmv30dShowcase},
        ${pctLive}, ${pctVideo}, ${pctShowcase},
        ${itemsSold30d}, ${gpm30d}, ${gmvPerCustomerMin}, ${gmvPerCustomerMax}, ${avgCommissionRate},
        ${productsPromotedCount}, ${brandCollaborationsCount}, ${productPriceMin}, ${productPriceMax},
        ${videoGpm}, ${videosCount30d}, ${avgVideoViews}, ${avgVideoEngagementRate},
        ${liveGpm}, ${liveStreamsCount30d}, ${avgLiveViews}, ${avgLiveEngagementRate},
        ${audienceMalePct}, ${audienceFemalePct}, ${audienceAge},
        ${age18_24}, ${age25_34}, ${age35_44}, ${age45_54}, ${age55Plus},
        ${topLocationsJson}::jsonb, ${gmvByCategoryJson}::jsonb,
        ${profileId}, NOW(), NOW()
      )
      ON CONFLICT (username) DO UPDATE SET
        display_name = COALESCE(EXCLUDED.display_name, creator_staging.display_name),
        tiktok_cid = COALESCE(EXCLUDED.tiktok_cid, creator_staging.tiktok_cid),
        link_account = EXCLUDED.link_account,
        avatar_url = COALESCE(EXCLUDED.avatar_url, creator_staging.avatar_url),
        mcn = EXCLUDED.mcn,
        no_whatsapp = COALESCE(EXCLUDED.no_whatsapp, creator_staging.no_whatsapp),
        level = COALESCE(EXCLUDED.level, creator_staging.level),
        followers = EXCLUDED.followers,
        primary_niche = COALESCE(EXCLUDED.primary_niche, creator_staging.primary_niche),
        gmv_30d = EXCLUDED.gmv_30d,
        gmv_status = EXCLUDED.gmv_status,
        gmv_30d_live = EXCLUDED.gmv_30d_live,
        gmv_30d_video = EXCLUDED.gmv_30d_video,
        gmv_30d_showcase = EXCLUDED.gmv_30d_showcase,
        pct_live = EXCLUDED.pct_live,
        pct_video = EXCLUDED.pct_video,
        pct_showcase = EXCLUDED.pct_showcase,
        items_sold_30d = EXCLUDED.items_sold_30d,
        gpm_30d = EXCLUDED.gpm_30d,
        gmv_per_customer_min = EXCLUDED.gmv_per_customer_min,
        gmv_per_customer_max = EXCLUDED.gmv_per_customer_max,
        avg_commission_rate = EXCLUDED.avg_commission_rate,
        products_promoted_count = EXCLUDED.products_promoted_count,
        brand_collaborations_count = EXCLUDED.brand_collaborations_count,
        product_price_min = EXCLUDED.product_price_min,
        product_price_max = EXCLUDED.product_price_max,
        video_gpm = EXCLUDED.video_gpm,
        videos_count_30d = EXCLUDED.videos_count_30d,
        avg_video_views = EXCLUDED.avg_video_views,
        avg_video_engagement_rate = EXCLUDED.avg_video_engagement_rate,
        live_gpm = EXCLUDED.live_gpm,
        live_streams_count_30d = EXCLUDED.live_streams_count_30d,
        avg_live_views = EXCLUDED.avg_live_views,
        avg_live_engagement_rate = EXCLUDED.avg_live_engagement_rate,
        audience_male_pct = EXCLUDED.audience_male_pct,
        audience_female_pct = EXCLUDED.audience_female_pct,
        audience_age = EXCLUDED.audience_age,
        age_18_24_pct = EXCLUDED.age_18_24_pct,
        age_25_34_pct = EXCLUDED.age_25_34_pct,
        age_35_44_pct = EXCLUDED.age_35_44_pct,
        age_45_54_pct = EXCLUDED.age_45_54_pct,
        age_55_plus_pct = EXCLUDED.age_55_plus_pct,
        top_locations = EXCLUDED.top_locations,
        gmv_by_category = EXCLUDED.gmv_by_category,
        scraped_by = COALESCE(EXCLUDED.scraped_by, creator_staging.scraped_by),
        updated_at = NOW()
    `);

    upsertedCount++;
    processedUsernames.push(username);
  }

  revalidatePath('/creator-pool/staging');
  return {
    success: true,
    upsertedCount,
    usernames: processedUsernames,
  };
}

export async function promoteStagingToCreatorPoolAction(stagingIds: number[]) {
  const user = await requireAuthenticatedUser();
  await ensureCreatorStagingSchema();

  if (!Array.isArray(stagingIds) || stagingIds.length === 0) {
    return { success: false, error: 'Pilih minimal 1 kreator untuk dipindahkan ke Creator Pool.' };
  }

  const profileId = user.id || null;
  const rows = (await db.execute(sql`
    SELECT * FROM creator_staging WHERE id IN ${sqlInList(stagingIds)}
  `)) as unknown as StagingCreatorRecord[];

  let promotedCount = 0;

  for (const s of rows) {
    const username = String(s.username).trim().toLowerCase().replace(/^@/, '');
    const linkAccount = s.link_account || `https://www.tiktok.com/@${username}`;

    const cRes = await db.execute(sql`
      INSERT INTO creators (
        username, display_name, tiktok_cid, link_account, mcn, avatar_url, no_whatsapp, added_by, status
      ) VALUES (
        ${username},
        ${s.display_name || null},
        ${s.tiktok_cid || null},
        ${linkAccount},
        ${s.mcn || null},
        ${s.avatar_url || null},
        ${s.no_whatsapp || null},
        ${profileId},
        'active'
      )
      ON CONFLICT (lower(username)) DO UPDATE SET
        display_name = COALESCE(EXCLUDED.display_name, creators.display_name),
        tiktok_cid = COALESCE(EXCLUDED.tiktok_cid, creators.tiktok_cid),
        link_account = EXCLUDED.link_account,
        mcn = COALESCE(EXCLUDED.mcn, creators.mcn),
        avatar_url = COALESCE(EXCLUDED.avatar_url, creators.avatar_url),
        no_whatsapp = COALESCE(EXCLUDED.no_whatsapp, creators.no_whatsapp),
        last_updated_by = ${profileId},
        last_updated_at = NOW()
      RETURNING id
    `);

    const cRows = cRes as unknown as Array<{ id?: number }>;
    const creatorId = cRows[0]?.id;
    if (!creatorId) continue;

    const followersNum = Number(s.followers) || 0;
    let tier = 'Nano';
    if (followersNum >= 1_000_000) tier = 'Mega';
    else if (followersNum >= 500_000) tier = 'Macro';
    else if (followersNum >= 100_000) tier = 'Mid-Tier';
    else if (followersNum >= 10_000) tier = 'Micro';

    const topLocationsStr =
      typeof s.top_locations === 'string' ? s.top_locations : JSON.stringify(s.top_locations || []);
    const gmvByCatStr =
      typeof s.gmv_by_category === 'string' ? s.gmv_by_category : JSON.stringify(s.gmv_by_category || []);

    await db.execute(sql`
      INSERT INTO creator_snapshots (
        creator_id, tanggal_update, followers, level, tier,
        gmv_30d, gmv_status, gmv_30d_video, gmv_30d_live, gmv_30d_showcase,
        pct_live, pct_video, pct_showcase,
        items_sold_30d, gpm_30d, gmv_per_customer_min, gmv_per_customer_max, avg_commission_rate,
        products_promoted_count, brand_collaborations_count, product_price_min, product_price_max,
        video_gpm, videos_count_30d, avg_video_views, avg_video_engagement_rate,
        live_gpm, live_streams_count_30d, avg_live_views, avg_live_engagement_rate,
        audience_age, audience_male_pct, audience_female_pct,
        age_18_24_pct, age_25_34_pct, age_35_44_pct, age_45_54_pct, age_55_plus_pct,
        top_locations, gmv_by_category, updated_by
      ) VALUES (
        ${creatorId}, CURRENT_DATE, ${followersNum}, ${s.level ? Number(s.level) : null}, ${tier},
        ${s.gmv_30d || 0}, ${s.gmv_status || 'RIIL'}, ${s.gmv_30d_video || 0}, ${s.gmv_30d_live || 0}, ${s.gmv_30d_showcase || 0},
        ${s.pct_live || 0}, ${s.pct_video || 0}, ${s.pct_showcase || 0},
        ${s.items_sold_30d || 0}, ${s.gpm_30d || 0}, ${s.gmv_per_customer_min ?? null}, ${s.gmv_per_customer_max ?? null}, ${s.avg_commission_rate ?? null},
        ${s.products_promoted_count || 0}, ${s.brand_collaborations_count || 0}, ${s.product_price_min ?? null}, ${s.product_price_max ?? null},
        ${s.video_gpm || 0}, ${s.videos_count_30d || 0}, ${s.avg_video_views || 0}, ${s.avg_video_engagement_rate ?? null},
        ${s.live_gpm || 0}, ${s.live_streams_count_30d || 0}, ${s.avg_live_views || 0}, ${s.avg_live_engagement_rate ?? null},
        ${s.audience_age || null}, ${s.audience_male_pct ?? null}, ${s.audience_female_pct ?? null},
        ${s.age_18_24_pct ?? null}, ${s.age_25_34_pct ?? null}, ${s.age_35_44_pct ?? null}, ${s.age_45_54_pct ?? null}, ${s.age_55_plus_pct ?? null},
        ${topLocationsStr}::jsonb, ${gmvByCatStr}::jsonb, ${profileId}
      )
    `);

    if (s.no_whatsapp) {
      await db.execute(sql`DELETE FROM creator_contacts WHERE creator_id = ${creatorId}`);
      await db.execute(sql`
        INSERT INTO creator_contacts (creator_id, nomor, status, tanggal_mulai)
        VALUES (${creatorId}, ${s.no_whatsapp}, 'aktif', CURRENT_DATE)
      `);
    }

    if (s.primary_niche) {
      const nRes = await db.execute(sql`
        INSERT INTO niches (nama) VALUES (${s.primary_niche})
        ON CONFLICT (nama) DO UPDATE SET nama = EXCLUDED.nama
        RETURNING id
      `);
      const nRows = nRes as unknown as Array<{ id?: number }>;
      const nicheId = nRows[0]?.id;
      if (nicheId) {
        await db.execute(sql`
          INSERT INTO creator_niches (creator_id, niche_id, peringkat)
          VALUES (${creatorId}, ${nicheId}, 1)
          ON CONFLICT DO NOTHING
        `);
      }
    }

    await db.execute(sql`
      UPDATE creator_staging
      SET status_staging = 'promoted', promoted_creator_id = ${creatorId}, updated_at = NOW()
      WHERE id = ${s.id}
    `);

    promotedCount++;
  }

  revalidatePath('/creator-pool/staging');
  revalidatePath('/creator-pool');
  return { success: true, promotedCount };
}

export async function deleteStagingCreatorsAction(stagingIds: number[]) {
  await requireAuthenticatedUser();
  await ensureCreatorStagingSchema();

  if (!Array.isArray(stagingIds) || stagingIds.length === 0) {
    return { success: false, error: 'Tidak ada baris yang dipilih.' };
  }

  await db.execute(sql`
    DELETE FROM creator_staging WHERE id IN ${sqlInList(stagingIds)}
  `);

  revalidatePath('/creator-pool/staging');
  return { success: true };
}
