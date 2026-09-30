import crypto from 'crypto';

/**
 * Ambil kredensial wajib dari environment. Tidak ada nilai cadangan di kode ini:
 * repository ini public, jadi nilai cadangan berarti kredensial bocor ke semua orang.
 *
 * Dipakai lewat getter supaya aplikasi tidak gagal total saat modul ini di-import -
 * error baru muncul kalau fitur TikTok benar-benar dipakai.
 */
function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `[tiktok] ${name} belum diset di environment.\n` +
      `Set di Coolify -> Application -> Environment Variables, lalu redeploy.\n` +
      `Jangan pernah menuliskan nilai cadangan di kode ini - repository ini public.`
    );
  }
  return value;
}

export const TIKTOK_CONFIG = {
  // app_key bukan rahasia - nilainya terlihat publik di Partner Center.
  get appKey() { return process.env.TIKTOK_APP_KEY || '6lcrat92ht0kd'; },
  // app_secret WAJIB dari environment. Nilai lamanya sempat tertulis di repo
  // public dan karena itu wajib dirotasi di TikTok Shop Developer Center.
  get appSecret() { return requiredEnv('TIKTOK_APP_SECRET'); },
  serviceId: '7688709827098347271',
  get redirectUri() { return process.env.TIKTOK_REDIRECT_URI || 'https://campaign.tntkreatif.com/auth/tiktok-shop/callback'; },
  authBaseUrl: 'https://auth.tiktok-shops.com',
  partnerAuthBaseUrl: 'https://partner.tiktokshop.com/open/authorize',
  apiBaseUrl: 'https://open-api.tiktokglobalshop.com'
};

/**
 * Generate HMAC-SHA256 signature according to TikTok Shop OpenAPI v2 specs
 */
export function generateTtsSignature(
  path: string,
  params: Record<string, string | number>,
  body: string = '',
  appSecret: string = TIKTOK_CONFIG.appSecret
): string {
  const keys = Object.keys(params)
    .filter(k => k !== 'sign' && k !== 'access_token')
    .sort();

  let paramString = '';
  for (const k of keys) {
    paramString += `${k}${params[k]}`;
  }

  // Official TikTok Shop OpenAPI signature: appSecret + path + paramString + body + appSecret
  const signString = `${appSecret}${path}${paramString}${body}${appSecret}`;
  return crypto.createHmac('sha256', appSecret).update(signString).digest('hex');
}

/**
 * Exchange auth_code for access_token & refresh_token
 */
export async function exchangeTikTokAuthCode(authCode: string) {
  try {
    const url = new URL(`${TIKTOK_CONFIG.authBaseUrl}/api/v2/token/get`);
    url.searchParams.append('app_key', TIKTOK_CONFIG.appKey);
    url.searchParams.append('app_secret', TIKTOK_CONFIG.appSecret);
    url.searchParams.append('auth_code', authCode);
    url.searchParams.append('grant_type', 'authorized_code');

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const data = await res.json();
    return data;
  } catch (error: any) {
    console.error('Error exchanging TikTok auth code:', error);
    return { code: -1, message: error.message };
  }
}

/**
 * Refresh an expired or expiring access_token using refresh_token
 */
export async function refreshTikTokAccessToken(refreshToken: string) {
  try {
    const url = new URL(`${TIKTOK_CONFIG.authBaseUrl}/api/v2/token/refresh`);
    url.searchParams.append('app_key', TIKTOK_CONFIG.appKey);
    url.searchParams.append('app_secret', TIKTOK_CONFIG.appSecret);
    url.searchParams.append('refresh_token', refreshToken);
    url.searchParams.append('grant_type', 'refresh_token');

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const data = await res.json();
    return data;
  } catch (error: any) {
    console.error('Error refreshing TikTok access token:', error);
    return { code: -1, message: error.message };
  }
}

/**
 * Save or update TikTok Authorization in Database
 */
export async function saveTikTokAuthTokens(tokenData: {
  access_token: string;
  refresh_token: string;
  access_token_expire_in?: number;
  refresh_token_expire_in?: number;
  seller_name?: string;
  open_id?: string;
  category_asset_cipher?: string;
  seller_base_region?: string;
}) {
  const { db } = await import('@/db');
  const { sql } = await import('drizzle-orm');

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS tiktok_authorizations (
      id SERIAL PRIMARY KEY,
      seller_name TEXT,
      open_id TEXT,
      access_token TEXT NOT NULL,
      refresh_token TEXT NOT NULL,
      access_token_expire_in BIGINT,
      refresh_token_expire_in BIGINT,
      category_asset_cipher TEXT,
      seller_base_region TEXT,
      status TEXT DEFAULT 'active',
      last_synced_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS tiktok_sync_logs (
      id SERIAL PRIMARY KEY,
      trigger_type TEXT NOT NULL,
      status TEXT NOT NULL,
      sales_count INT DEFAULT 0,
      videos_count INT DEFAULT 0,
      campaigns_count INT DEFAULT 0,
      message TEXT,
      details JSONB,
      duration_ms INT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const nowSec = Math.floor(Date.now() / 1000);
  const accExpireAt = tokenData.access_token_expire_in 
    ? (tokenData.access_token_expire_in > 1000000000 ? tokenData.access_token_expire_in : nowSec + tokenData.access_token_expire_in)
    : nowSec + (7 * 24 * 3600);
  const refExpireAt = tokenData.refresh_token_expire_in
    ? (tokenData.refresh_token_expire_in > 1000000000 ? tokenData.refresh_token_expire_in : nowSec + tokenData.refresh_token_expire_in)
    : nowSec + (365 * 24 * 3600);

  const existing = await db.execute(sql`
    SELECT id FROM tiktok_authorizations WHERE status = 'active' ORDER BY id DESC LIMIT 1
  `);
  const existingId = (existing as any[])[0]?.id;

  if (existingId) {
    await db.execute(sql`
      UPDATE tiktok_authorizations
      SET
        access_token = ${tokenData.access_token},
        refresh_token = ${tokenData.refresh_token},
        access_token_expire_in = ${accExpireAt},
        refresh_token_expire_in = ${refExpireAt},
        seller_name = COALESCE(${tokenData.seller_name || null}, seller_name),
        open_id = COALESCE(${tokenData.open_id || null}, open_id),
        category_asset_cipher = COALESCE(${tokenData.category_asset_cipher || null}, category_asset_cipher),
        seller_base_region = COALESCE(${tokenData.seller_base_region || null}, seller_base_region),
        updated_at = NOW()
      WHERE id = ${existingId}
    `);
  } else {
    await db.execute(sql`
      INSERT INTO tiktok_authorizations (
        access_token, refresh_token, access_token_expire_in, refresh_token_expire_in,
        seller_name, open_id, category_asset_cipher, seller_base_region, status
      ) VALUES (
        ${tokenData.access_token}, ${tokenData.refresh_token}, ${accExpireAt}, ${refExpireAt},
        ${tokenData.seller_name || 'TNT Agency'}, ${tokenData.open_id || null},
        ${tokenData.category_asset_cipher || null}, ${tokenData.seller_base_region || 'ID'}, 'active'
      )
    `);
  }

  return { success: true };
}

/**
 * Retrieve a valid, active access_token from database, auto-refreshing if expired
 */
export async function getValidTikTokToken() {
  const { db } = await import('@/db');
  const { sql } = await import('drizzle-orm');

  // Ensure table exists
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS tiktok_authorizations (
      id SERIAL PRIMARY KEY,
      seller_name TEXT,
      open_id TEXT,
      access_token TEXT NOT NULL,
      refresh_token TEXT NOT NULL,
      access_token_expire_in BIGINT,
      refresh_token_expire_in BIGINT,
      category_asset_cipher TEXT,
      seller_base_region TEXT,
      status TEXT DEFAULT 'active',
      last_synced_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const rows = await db.execute(sql`
    SELECT * FROM tiktok_authorizations 
    WHERE status = 'active' 
    ORDER BY id DESC 
    LIMIT 1
  `);
  const record = (rows as any[])[0];

  if (!record || !record.access_token) {
    return {
      isValid: false,
      error: "Belum ada otorisasi TikTok Partner Center yang tersimpan di sistem. Silakan hubungkan akun di menu Sinkronisasi TikTok."
    };
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const expireSec = Number(record.access_token_expire_in) || 0;
  
  // If access token expires within 12 hours or is already expired, auto-refresh it
  if (expireSec > 0 && expireSec - nowSec < 12 * 3600) {
    console.log(`[TikTok AutoSync] Access token expiring soon (in ${Math.round((expireSec - nowSec) / 3600)}h). Refreshing...`);
    const refreshRes = await refreshTikTokAccessToken(record.refresh_token);
    
    if (refreshRes.code === 0 && refreshRes.data?.access_token) {
      const newAccess = refreshRes.data.access_token;
      const newRefresh = refreshRes.data.refresh_token || record.refresh_token;
      const newExpIn = refreshRes.data.access_token_expire_in || (7 * 24 * 3600);
      const newExpAt = nowSec + newExpIn;

      await db.execute(sql`
        UPDATE tiktok_authorizations
        SET 
          access_token = ${newAccess},
          refresh_token = ${newRefresh},
          access_token_expire_in = ${newExpAt},
          updated_at = NOW()
        WHERE id = ${record.id}
      `);

      return {
        isValid: true,
        accessToken: newAccess,
        categoryAssetCipher: record.category_asset_cipher,
        sellerName: record.seller_name,
        refreshed: true
      };
    } else {
      console.warn('[TikTok AutoSync] Failed to refresh token:', refreshRes.message);
    }
  }

  return {
    isValid: true,
    accessToken: record.access_token,
    categoryAssetCipher: record.category_asset_cipher,
    sellerName: record.seller_name,
    refreshed: false
  };
}

/**
 * Make an authorized call to TikTok Shop OpenAPI
 */
export async function callTikTokShopApi(
  path: string,
  method: 'GET' | 'POST' = 'GET',
  accessToken: string,
  queryParams: Record<string, string | number> = {},
  bodyData?: any
) {
  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const bodyStr = bodyData ? JSON.stringify(bodyData) : '';

    const paramsWithAuth: Record<string, string | number> = {
      ...queryParams,
      app_key: TIKTOK_CONFIG.appKey,
      timestamp
    };

    const signature = generateTtsSignature(path, paramsWithAuth, bodyStr, TIKTOK_CONFIG.appSecret);
    paramsWithAuth['sign'] = signature;

    const url = new URL(`${TIKTOK_CONFIG.apiBaseUrl}${path}`);
    Object.keys(paramsWithAuth).forEach(key => {
      url.searchParams.append(key, String(paramsWithAuth[key]));
    });

    const headers: Record<string, string> = {
      'x-tts-access-token': accessToken,
      'Content-Type': 'application/json'
    };

    const fetchOptions: RequestInit = {
      method,
      headers
    };

    if (method === 'POST' && bodyStr) {
      fetchOptions.body = bodyStr;
    }

    const res = await fetch(url.toString(), fetchOptions);
    const result = await res.json();
    return {
      success: res.ok && result.code === 0,
      status: res.status,
      data: result
    };
  } catch (error: any) {
    console.error(`Error calling TikTok API ${path}:`, error);
    return {
      success: false,
      status: 500,
      data: { code: -1, message: error.message }
    };
  }
}
