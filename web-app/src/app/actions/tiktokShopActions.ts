'use server';

import { exchangeTikTokAuthCode, callTikTokShopApi, TIKTOK_CONFIG } from '@/utils/tiktokShopApi';

export async function exchangeAuthCodeAction(authCode: string) {
  try {
    const res = await exchangeTikTokAuthCode(authCode);
    return res;
  } catch (error: any) {
    return { code: -1, message: error.message };
  }
}

export async function testFetchShopsAction(accessToken: string) {
  try {
    const res = await callTikTokShopApi(
      '/authorization/202309/shops',
      'GET',
      accessToken
    );
    return res;
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function testFetchAffiliateOrdersAction(accessToken: string, shopCipher?: string) {
  try {
    const now = Math.floor(Date.now() / 1000);
    const sevenDaysAgo = now - 7 * 24 * 3600;

    const queryParams: Record<string, any> = {};
    if (shopCipher) {
      queryParams['shop_cipher'] = shopCipher;
    }

    // Try affiliate partner order endpoint first
    const res = await callTikTokShopApi(
      '/affiliate_partner/202409/orders/search',
      'POST',
      accessToken,
      queryParams,
      {
        page_size: 20,
        create_time_ge: sevenDaysAgo,
        create_time_lt: now
      }
    );

    return res;
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function testFetchSellerOrdersAction(accessToken: string, shopCipher: string) {
  try {
    const now = Math.floor(Date.now() / 1000);
    const sevenDaysAgo = now - 7 * 24 * 3600;

    const res = await callTikTokShopApi(
      '/order/202309/orders/search',
      'POST',
      accessToken,
      { shop_cipher: shopCipher },
      {
        page_size: 20,
        create_time_ge: sevenDaysAgo,
        create_time_lt: now
      }
    );

    return res;
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
