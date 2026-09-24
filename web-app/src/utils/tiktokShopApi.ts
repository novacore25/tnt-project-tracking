import crypto from 'crypto';

export const TIKTOK_CONFIG = {
  appKey: process.env.TIKTOK_APP_KEY || '6lcrat92ht0kd',
  appSecret: process.env.TIKTOK_APP_SECRET || '4ca2f8f3508673ad241d3208a3a06cf303e219fb',
  serviceId: '7688709827098347271',
  redirectUri: process.env.TIKTOK_REDIRECT_URI || 'https://campaign.tntkreatif.com/auth/tiktok-shop/callback',
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
