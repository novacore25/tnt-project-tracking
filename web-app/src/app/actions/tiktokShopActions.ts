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

export async function testFetchCategoryAssetsAction(accessToken: string) {
  try {
    const res = await callTikTokShopApi(
      '/authorization/202405/category_assets',
      'GET',
      accessToken
    );
    return res;
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function testFetchTapCampaignsAction(
  accessToken: string, 
  categoryAssetCipher: string,
  status: string = 'ONGOING'
) {
  try {
    const res = await callTikTokShopApi(
      '/affiliate_partner/202405/campaigns',
      'GET',
      accessToken,
      {
        category_asset_cipher: categoryAssetCipher,
        page_size: 20,
        status: status || 'ONGOING'
      }
    );
    return res;
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function testFetchCampaignProductsAction(
  accessToken: string,
  categoryAssetCipher: string,
  campaignId: string
) {
  try {
    const res = await callTikTokShopApi(
      `/affiliate_partner/202405/campaigns/${campaignId}/products`,
      'GET',
      accessToken,
      {
        category_asset_cipher: categoryAssetCipher,
        page_size: 20
      }
    );
    return res;
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function testFetchCampaignPerformanceAction(
  accessToken: string,
  categoryAssetCipher: string,
  campaignId: string
) {
  try {
    const res = await callTikTokShopApi(
      `/affiliate_partner/202501/campaigns/${campaignId}/products/performance`,
      'GET',
      accessToken,
      {
        category_asset_cipher: categoryAssetCipher,
        page_size: 20
      }
    );
    return res;
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function testFetchCampaignCreatorsAction(
  accessToken: string,
  categoryAssetCipher: string,
  campaignId: string,
  productId: string
) {
  try {
    const res = await callTikTokShopApi(
      `/affiliate_partner/202501/campaigns/${campaignId}/products/${productId}/performance`,
      'GET',
      accessToken,
      {
        category_asset_cipher: categoryAssetCipher,
        page_size: 20
      }
    );
    return res;
  } catch (error: any) {
    return { success: false, error: error.message };
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

export async function testFetchAffiliateOrdersAction(
  accessToken: string,
  categoryAssetCipher?: string
) {
  try {
    const now = Math.floor(Date.now() / 1000);
    const thirtyDaysAgo = now - 30 * 24 * 3600;

    const queryParams: Record<string, any> = {
      page_size: 20
    };
    
    if (categoryAssetCipher) {
      queryParams['category_asset_cipher'] = categoryAssetCipher;
    }

    // Official TAP OpenAPI v202411 for affiliate orders
    const res = await callTikTokShopApi(
      '/affiliate_partner/202411/orders/search',
      'POST',
      accessToken,
      queryParams,
      {
        create_time_ge: thirtyDaysAgo,
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
