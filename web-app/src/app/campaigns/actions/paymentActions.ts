"use server";

import { requireUserOrError, requireRoleOrError } from '@/lib/guards';
import { db, sqlInList } from '@/db';
import { sql } from 'drizzle-orm';
import { auth } from '@/auth';
import { revalidatePath } from 'next/cache';
import { getPaymentBatchesRpc } from '@/lib/db-queries';

// ==========================================
// READ ACTIONS
// ==========================================

export async function getPaymentBatches(campaignId?: number, status?: string) {
  try {
    let whereConditions: any[] = [];
    if (campaignId) {
      whereConditions.push(sql`pb.campaign_id = ${campaignId}`);
    }
    if (status) {
      whereConditions.push(sql`pb.status = ${status}`);
    }

    const whereClause = whereConditions.length > 0
      ? sql`WHERE ${sql.join(whereConditions, sql` AND `)}`
      : sql``;

    const rows = await db.execute(sql`
      SELECT 
        pb.*,
        json_build_object('id', c.id, 'nama', c.nama) as campaigns,
        (
          SELECT json_agg(jsonb_build_object(
            'id', pi.id,
            'batch_id', pi.batch_id,
            'campaign_creator_id', pi.campaign_creator_id,
            'payment_type', pi.payment_type,
            'ratecard_awal', pi.ratecard_awal,
            'nominal', pi.nominal,
            'actual_transfer', pi.actual_transfer,
            'biaya_transfer', pi.biaya_transfer,
            'bank_account_id', pi.bank_account_id,
            'metode_pembayaran', pi.metode_pembayaran,
            'nomor_rekening', pi.nomor_rekening,
            'nama_penerima', pi.nama_penerima,
            'nama_wa_pic', pi.nama_wa_pic,
            'nomor_wa_dealing', pi.nomor_wa_dealing,
            'alamat_ktp', pi.alamat_ktp,
            'nik', pi.nik,
            'link_ktp', pi.link_ktp,
            'link_kontrak', pi.link_kontrak,
            'manager_status', pi.manager_status,
            'manager_note', pi.manager_note,
            'manager_acted_by', pi.manager_acted_by,
            'manager_acted_at', pi.manager_acted_at,
            'executive_1_status', pi.executive_1_status,
            'executive_1_note', pi.executive_1_note,
            'executive_1_acted_by', pi.executive_1_acted_by,
            'executive_1_acted_at', pi.executive_1_acted_at,
            'finance_selected', pi.finance_selected,
            'executive_status', pi.executive_status,
            'executive_note', pi.executive_note,
            'executive_acted_by', pi.executive_acted_by,
            'executive_acted_at', pi.executive_acted_at,
            'final_status', pi.final_status,
            'transaction_id', pi.transaction_id,
            'notes', pi.notes,
            'created_at', pi.created_at,
            'campaign_creators', (
              SELECT jsonb_build_object(
                'id', cc.id,
                'tier', cc.tier,
                'price', cc.price,
                'qty_vt', cc.qty_vt,
                'creators', jsonb_build_object(
                  'id', cr.id,
                  'username', cr.username,
                  'nama_asli', cr.nama_asli,
                  'avatar_url', cr.avatar_url
                )
              )
              FROM campaign_creators cc
              LEFT JOIN creators cr ON cc.creator_id = cr.id
              WHERE cc.id = pi.campaign_creator_id
            ),
            'creator_bank_accounts', (
              SELECT jsonb_build_object(
                'bank_name', cba.bank_name,
                'account_number', cba.account_number,
                'account_holder', cba.account_holder
              )
              FROM creator_bank_accounts cba WHERE cba.id = pi.bank_account_id
            )
          ) ORDER BY pi.id ASC)
          FROM payment_items pi
          WHERE pi.batch_id = pb.id
        ) as payment_items,
        -- Kolom "PIC Submit" di halaman Keuangan membaca b.submitter?.nama.
        -- Subquery ini TIDAK ADA sebelumnya, jadi kolomnya selalu undefined dan
        -- tampil "-" untuk SEMUA batch - termasuk batch yang submitted_by-nya
        -- sudah terisi. Bug lama, baru ketahuan setelah impor historis
        -- (3 Okt 2026) karena jumlah batch suddenly banyak.
        (SELECT json_build_object('nama', p.nama, 'role', p.role)
           FROM profiles p WHERE p.id = pb.submitted_by) as submitter
      FROM payment_batches pb
      LEFT JOIN campaigns c ON pb.campaign_id = c.id
      ${whereClause}
      ORDER BY pb.id DESC
    `);

    return (rows as unknown as any[]) || [];
  } catch (err: any) {
    console.error("Error getPaymentBatches:", err);
    return [];
  }
}

export async function fetchPendingAdsTopUp() {
  const rows = await db.execute(sql`
    SELECT 
      pi.*,
      json_build_object(
        'batch_label', pb.batch_label,
        'status', pb.status,
        'campaigns', json_build_object('nama', c.nama)
      ) as payment_batches
    FROM payment_items pi
    INNER JOIN payment_batches pb ON pi.batch_id = pb.id
    INNER JOIN campaigns c ON pb.campaign_id = c.id
    WHERE pi.payment_type = 'ads'
      AND pi.final_status NOT IN ('paid', 'rejected', 'cancelled')
    ORDER BY pi.created_at DESC
  `);
  return (rows as unknown as any[]) || [];
}

export async function fetchCampaignCreatorMutations(campaignId: number) {
  const rows = await db.execute(sql`
    SELECT 
      pi.*,
      json_build_object(
        'campaign_id', pb.campaign_id,
        'batch_label', pb.batch_label,
        'paid_at', pb.paid_at,
        'bukti_transfer_url', pb.bukti_transfer_url
      ) as payment_batches,
      json_build_object(
        'creators', json_build_object('username', cr.username, 'nama_asli', cr.nama_asli)
      ) as campaign_creators,
      json_build_object('bank_name', cb.bank_name) as creator_bank_accounts
    FROM payment_items pi
    INNER JOIN payment_batches pb ON pi.batch_id = pb.id
    LEFT JOIN campaign_creators cc ON pi.campaign_creator_id = cc.id
    LEFT JOIN creators cr ON cc.creator_id = cr.id
    LEFT JOIN creator_bank_accounts cb ON pi.bank_account_id = cb.id
    WHERE pb.campaign_id = ${campaignId}
      AND pi.final_status = 'paid'
      AND pi.payment_type != 'ads'
    ORDER BY pi.created_at DESC
  `);
  return (rows as unknown as any[]) || [];
}

export async function fetchUnpaidCreators(campaignId: number) {
  try {
    const rows = await db.execute(sql`
      SELECT 
        cc.id, cc.price, cc.tier, cc.qty_vt, cc.content_type, cc.approval, cc.creator_id,
        json_build_object(
          'id', cr.id,
          'username', cr.username,
          'nama_asli', cr.nama_asli,
          'avatar_url', cr.avatar_url,
          'creator_snapshots', (
            SELECT json_agg(jsonb_build_object(
              'id', cs.id, 'followers', cs.followers, 'level', cs.level,
              'gmv_30d', cs.gmv_30d, 'gmv_30d_video', cs.gmv_30d_video, 'gmv_30d_live', cs.gmv_30d_live,
              'ratecard', cs.ratecard, 'tanggal_update', cs.tanggal_update
            ))
            FROM creator_snapshots cs WHERE cs.creator_id = cr.id
          ),
          'creator_bank_accounts', (
            SELECT json_agg(jsonb_build_object(
              'id', cba.id, 'bank_name', cba.bank_name, 'account_number', cba.account_number, 'account_holder', cba.account_holder
            ))
            FROM creator_bank_accounts cba WHERE cba.creator_id = cr.id
          ),
          'creator_pic_contacts', (
            SELECT json_agg(jsonb_build_object(
              'id', cpc.id, 'nama_pic', cpc.nama_pic, 'nomor_wa', cpc.nomor_wa, 'is_primary', cpc.is_primary
            ) ORDER BY cpc.is_primary DESC, cpc.id DESC)
            FROM creator_pic_contacts cpc WHERE cpc.creator_id = cr.id
          ),
          'creator_identities', (
            SELECT json_agg(jsonb_build_object(
              'id', ci.id, 'nik', ci.nik, 'nama_ktp', ci.nama_ktp, 'alamat_ktp', ci.alamat_ktp, 'link_ktp', ci.link_ktp, 'is_primary', ci.is_primary
            ) ORDER BY ci.is_primary DESC, ci.id DESC)
            FROM creator_identities ci WHERE ci.creator_id = cr.id
          ),
          'creator_contracts', (
            SELECT json_agg(jsonb_build_object(
              'id', ccon.id, 'campaign_id', ccon.campaign_id, 'judul_kontrak', ccon.judul_kontrak, 'link_kontrak', ccon.link_kontrak
            ) ORDER BY ccon.created_at DESC, ccon.id DESC)
            FROM creator_contracts ccon WHERE ccon.creator_id = cr.id
          )
        ) as creators,
        (
          SELECT json_agg(jsonb_build_object(
            'id', v.id, 'link_video', v.link_video, 'content_uid', v.content_uid, 'urutan', v.urutan, 'vt_approval', v.vt_approval
          ))
          FROM videos v WHERE v.campaign_creator_id = cc.id
        ) as videos,
        (
          SELECT json_agg(jsonb_build_object(
            'id', pi.id, 'final_status', pi.final_status, 'payment_type', pi.payment_type, 'nominal', pi.nominal
          ))
          FROM payment_items pi WHERE pi.campaign_creator_id = cc.id
        ) as payment_items
      FROM campaign_creators cc
      JOIN creators cr ON cc.creator_id = cr.id
      WHERE cc.campaign_id = ${campaignId}
        AND LOWER(cc.approval) = 'approved'
      ORDER BY cc.created_at DESC
      LIMIT 5000
    `);

    // Cross-check live activity from sales and organic_videos
    const liveRows = await db.execute(sql`
      SELECT DISTINCT LOWER(TRIM(LEADING '@' FROM creator_username)) as username
      FROM (
        SELECT creator_username FROM sales WHERE campaign_id = ${campaignId} AND (content_type ILIKE '%live%' OR content_type ILIKE '%livestream%')
        UNION
        SELECT creator_username FROM organic_videos WHERE campaign_id = ${campaignId} AND (content_type ILIKE '%live%' OR content_type ILIKE '%livestream%')
      ) sub
      WHERE creator_username IS NOT NULL
    `);

    const liveUsernames = new Set((liveRows as any[]).map(r => r.username));

    const enriched = ((rows as unknown as any[]) || []).map(cc => {
      const u = (cc.creators?.username || '').toLowerCase().replace(/^@/, '').trim();
      return {
        ...cc,
        has_live_activity: liveUsernames.has(u)
      };
    });

    return enriched;
  } catch (err: any) {
    console.error("Exception in fetchUnpaidCreators:", err);
    throw err;
  }
}

export async function fetchApprovedCreatorsForBatch(campaignId: number) {
  try {
    const rows = await db.execute(sql`
      SELECT 
        cc.id, cc.campaign_id, cc.creator_id, cc.tier, cc.price, cc.qty_vt, cc.content_type, cc.approval, cc.status_bayar, cc.created_at,
        json_build_object(
          'id', cr.id,
          'username', cr.username,
          'nama_asli', cr.nama_asli,
          'avatar_url', cr.avatar_url,
          'nik', cr.nik,
          'alamat_ktp', cr.alamat_ktp,
          'link_ktp', cr.link_ktp,
          'link_kontrak', cr.link_kontrak,
          'nama_wa_pic', cr.nama_wa_pic,
          'nomor_wa_dealing', cr.nomor_wa_dealing,
          'creator_bank_accounts', (
            SELECT json_agg(json_build_object(
              'id', cba.id, 'bank_name', cba.bank_name, 'account_number', cba.account_number, 'account_holder', cba.account_holder, 'is_primary', cba.is_primary
            ) ORDER BY cba.is_primary DESC, cba.id ASC)
            FROM creator_bank_accounts cba WHERE cba.creator_id = cr.id
          ),
          'creator_pic_contacts', (
            SELECT json_agg(jsonb_build_object(
              'id', cpc.id, 'nama_pic', cpc.nama_pic, 'nomor_wa', cpc.nomor_wa, 'is_primary', cpc.is_primary
            ) ORDER BY cpc.is_primary DESC, cpc.id DESC)
            FROM creator_pic_contacts cpc WHERE cpc.creator_id = cr.id
          ),
          'creator_identities', (
            SELECT json_agg(jsonb_build_object(
              'id', ci.id, 'nik', ci.nik, 'nama_ktp', ci.nama_ktp, 'alamat_ktp', ci.alamat_ktp, 'link_ktp', ci.link_ktp, 'is_primary', ci.is_primary
            ) ORDER BY ci.is_primary DESC, ci.id DESC)
            FROM creator_identities ci WHERE ci.creator_id = cr.id
          ),
          'creator_contracts', (
            SELECT json_agg(jsonb_build_object(
              'id', ccon.id, 'campaign_id', ccon.campaign_id, 'judul_kontrak', ccon.judul_kontrak, 'link_kontrak', ccon.link_kontrak
            ) ORDER BY ccon.created_at DESC, ccon.id DESC)
            FROM creator_contracts ccon WHERE ccon.creator_id = cr.id
          )
        ) as creators
      FROM campaign_creators cc
      JOIN creators cr ON cc.creator_id = cr.id
      WHERE cc.campaign_id = ${campaignId}
      ORDER BY cc.id ASC
      LIMIT 5000
    `);
    return (rows as unknown as any[]) || [];
  } catch (err: any) {
    console.error("Exception in fetchApprovedCreatorsForBatch:", err);
    throw err;
  }
}

export async function fetchMutationsPaginated(page: number, limit: number, month: string, search: string, paymentType: string = 'all') {
  const offset = (page - 1) * limit;
  
  let whereConditions: any[] = [];
  if (month !== 'all') {
    whereConditions.push(sql`paid_month = ${month}`);
  }
  if (paymentType === 'ads') {
    whereConditions.push(sql`payment_type = 'ads'`);
  } else if (paymentType === 'kreator') {
    whereConditions.push(sql`payment_type != 'ads'`);
  }
  if (search && search.trim()) {
    const s = `%${search.trim()}%`;
    whereConditions.push(sql`(nama_penerima ILIKE ${s} OR username ILIKE ${s} OR campaign_nama ILIKE ${s})`);
  }

  const whereClause = whereConditions.length > 0
    ? sql`WHERE ${sql.join(whereConditions, sql` AND `)}`
    : sql``;

  const [rows, countRes] = await Promise.all([
    db.execute(sql`
      SELECT * FROM public.vw_payment_mutations
      ${whereClause}
      ORDER BY paid_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `),
    db.execute(sql`
      SELECT COUNT(*)::int as count FROM public.vw_payment_mutations
      ${whereClause}
    `)
  ]);

  const count = (countRes as any[])[0]?.count || 0;
  return { data: (rows as unknown as any[]) || [], count };
}

export async function fetchMutationsExport(month: string, search: string, paymentType: string = 'all') {
  let whereConditions: any[] = [];
  if (month !== 'all') {
    whereConditions.push(sql`paid_month = ${month}`);
  }
  if (paymentType === 'ads') {
    whereConditions.push(sql`payment_type = 'ads'`);
  } else if (paymentType === 'kreator') {
    whereConditions.push(sql`payment_type != 'ads'`);
  }
  if (search && search.trim()) {
    const s = `%${search.trim()}%`;
    whereConditions.push(sql`(nama_penerima ILIKE ${s} OR username ILIKE ${s} OR campaign_nama ILIKE ${s})`);
  }

  const whereClause = whereConditions.length > 0
    ? sql`WHERE ${sql.join(whereConditions, sql` AND `)}`
    : sql``;

  const rows = await db.execute(sql`
    SELECT * FROM public.vw_payment_mutations
    ${whereClause}
    ORDER BY paid_at DESC
    LIMIT 5000
  `);

  return (rows as unknown as any[]) || [];
}

export async function getPaymentBatchDetail(batchId: number) {
  try {
    const rows = await db.execute(sql`
      SELECT 
        pb.*,
        (SELECT json_build_object('nama', p.nama, 'role', p.role) FROM profiles p WHERE p.id = pb.submitted_by) as submitter,
        (SELECT json_build_object('nama', p.nama, 'role', p.role) FROM profiles p WHERE p.id = pb.manager_reviewed_by) as manager,
        (SELECT json_build_object('nama', p.nama, 'role', p.role) FROM profiles p WHERE p.id = pb.executive_reviewed_1_by) as executive1,
        (SELECT json_build_object('nama', p.nama, 'role', p.role) FROM profiles p WHERE p.id = pb.finance_reviewed_by) as finance,
        (SELECT json_build_object('nama', p.nama, 'role', p.role) FROM profiles p WHERE p.id = pb.executive_reviewed_by) as executive,
        (SELECT json_build_object('nama', p.nama, 'role', p.role) FROM profiles p WHERE p.id = pb.paid_by) as payer,
        json_build_object('nama', c.nama) as campaigns,
        (
          SELECT json_agg(json_build_object(
            'id', pi.id,
            'batch_id', pi.batch_id,
            'campaign_creator_id', pi.campaign_creator_id,
            'payment_type', pi.payment_type,
            'ratecard_awal', pi.ratecard_awal,
            'nominal', pi.nominal,
            'actual_transfer', pi.actual_transfer,
            'biaya_transfer', pi.biaya_transfer,
            'bank_account_id', pi.bank_account_id,
            'metode_pembayaran', pi.metode_pembayaran,
            'nomor_rekening', pi.nomor_rekening,
            'nama_penerima', pi.nama_penerima,
            'nama_wa_pic', pi.nama_wa_pic,
            'nomor_wa_dealing', pi.nomor_wa_dealing,
            'alamat_ktp', pi.alamat_ktp,
            'nik', pi.nik,
            'link_ktp', pi.link_ktp,
            'link_kontrak', pi.link_kontrak,
            'notes', pi.notes,
            'manager_status', pi.manager_status,
            'manager_note', pi.manager_note,
            'executive_1_status', pi.executive_1_status,
            'executive_1_note', pi.executive_1_note,
            'finance_selected', pi.finance_selected,
            'executive_status', pi.executive_status,
            'executive_note', pi.executive_note,
            'final_status', pi.final_status,
            'transaction_id', pi.transaction_id,
            'created_at', pi.created_at,
            'campaign_creators', (
              SELECT json_build_object(
                'id', cc.id,
                'tier', cc.tier,
                'price', cc.price,
                'qty_vt', cc.qty_vt,
                'creators', json_build_object('id', cr.id, 'username', cr.username, 'nama_asli', cr.nama_asli),
                'profiles', (SELECT json_build_object('nama', prf.nama, 'role', prf.role) FROM profiles prf WHERE prf.id = cc.added_by)
              )
              FROM campaign_creators cc
              LEFT JOIN creators cr ON cc.creator_id = cr.id
              WHERE cc.id = pi.campaign_creator_id
            ),
            'creator_bank_accounts', (
              SELECT json_build_object(
                'bank_name', cba.bank_name,
                'account_number', cba.account_number,
                'account_holder', cba.account_holder
              )
              FROM creator_bank_accounts cba WHERE cba.id = pi.bank_account_id
            )
          ) ORDER BY pi.id ASC)
          FROM payment_items pi
          WHERE pi.batch_id = pb.id
        ) as payment_items
      FROM payment_batches pb
      LEFT JOIN campaigns c ON pb.campaign_id = c.id
      WHERE pb.id = ${batchId}
    `);

    const data = (rows as any[])[0] || null;
    return data;
  } catch (err: any) {
    console.error("Error getPaymentBatchDetail:", err);
    return null;
  }
}

export async function getCreatorBankAccounts(creatorId: number) {
  const rows = await db.execute(sql`SELECT * FROM creator_bank_accounts WHERE creator_id = ${creatorId} ORDER BY is_primary DESC, id ASC`);
  return (rows as unknown as any[]) || [];
}

export async function getCreatorPicContacts(creatorId: number) {
  try {
    const rows = await db.execute(sql`
      SELECT * FROM creator_pic_contacts 
      WHERE creator_id = ${creatorId} 
      ORDER BY is_primary DESC, id DESC
    `);
    return (rows as unknown as any[]) || [];
  } catch {
    return [];
  }
}

export async function getCreatorIdentities(creatorId: number) {
  try {
    const rows = await db.execute(sql`
      SELECT * FROM creator_identities 
      WHERE creator_id = ${creatorId} 
      ORDER BY is_primary DESC, id DESC
    `);
    return (rows as unknown as any[]) || [];
  } catch {
    return [];
  }
}

export async function getCreatorContracts(creatorId: number) {
  try {
    const rows = await db.execute(sql`
      SELECT cc.*, c.nama as campaign_nama
      FROM creator_contracts cc
      LEFT JOIN campaigns c ON cc.campaign_id = c.id
      WHERE cc.creator_id = ${creatorId}
      ORDER BY cc.created_at DESC, cc.id DESC
    `);
    return (rows as unknown as any[]) || [];
  } catch {
    return [];
  }
}

export async function getSenderAccounts() {
  const rows = await db.execute(sql`SELECT * FROM sender_accounts ORDER BY id ASC`);
  return (rows as unknown as any[]) || [];
}

// ==========================================
// PIC ACTIONS
// ==========================================

export async function createPaymentBatch(campaignId: number, batchLabel: string) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error('Not authenticated');

  const rows = await db.execute(sql`
    INSERT INTO payment_batches (campaign_id, batch_label, status, submitted_by, submitted_at)
    VALUES (${campaignId}, ${batchLabel}, 'draft', ${userId}, NOW())
    RETURNING id
  `);

  const batchId = (rows as any[])[0]?.id;
  revalidatePath(`/campaigns/${campaignId}/keuangan`);
  return batchId;
}

export async function addPaymentItem(batchId: number, itemData: any) {
  const denied = await requireUserOrError();
  if (denied) return { success: false, error: denied.message } as any;

  let bankAccountId = itemData.bank_account_id ? Number(itemData.bank_account_id) : null;
  let bankName = itemData.metode_pembayaran ? String(itemData.metode_pembayaran).trim() : null;
  let bankNumber = itemData.nomor_rekening ? String(itemData.nomor_rekening).trim() : null;
  let bankHolder = itemData.nama_penerima ? String(itemData.nama_penerima).trim() : null;

  if (bankAccountId) {
    const bRows = await db.execute(sql`SELECT * FROM creator_bank_accounts WHERE id = ${bankAccountId}`);
    const bankData = (bRows as any[])[0];
    if (bankData) {
      bankName = bankData.bank_name;
      bankNumber = bankData.account_number;
      bankHolder = bankData.account_holder;
    }
  } else if (bankName && bankNumber && itemData.campaign_creator_id) {
    const ccRows = await db.execute(sql`SELECT creator_id FROM campaign_creators WHERE id = ${itemData.campaign_creator_id}`);
    const ccData = (ccRows as any[])[0];
    if (ccData?.creator_id) {
      const existBank = await db.execute(sql`
        SELECT id, bank_name, account_number, account_holder 
        FROM creator_bank_accounts 
        WHERE creator_id = ${ccData.creator_id} AND LOWER(bank_name) = LOWER(${bankName}) AND account_number = ${bankNumber}
        LIMIT 1
      `);
      const existing = (existBank as any[])[0];
      if (existing) {
        bankAccountId = existing.id;
        bankName = existing.bank_name;
        bankNumber = existing.account_number;
        bankHolder = existing.account_holder || bankHolder;
      } else {
        try {
          const insBank = await db.execute(sql`
            INSERT INTO creator_bank_accounts (creator_id, bank_name, account_number, account_holder)
            VALUES (${ccData.creator_id}, ${bankName}, ${bankNumber}, ${bankHolder || ''})
            RETURNING id
          `);
          if ((insBank as any[])[0]?.id) bankAccountId = (insBank as any[])[0].id;
        } catch (e) {
          console.warn('Could not insert creator_bank_account:', e);
        }
      }
    }
  }

  // Server-side double claim and termin validation
  if (itemData.campaign_creator_id) {
    const existingItemsRes = await db.execute(sql`
      SELECT pi.id, pi.payment_type, pi.final_status, pb.batch_label, pb.status as batch_status
      FROM payment_items pi
      JOIN payment_batches pb ON pi.batch_id = pb.id
      WHERE pi.campaign_creator_id = ${Number(itemData.campaign_creator_id)}
        AND pi.final_status NOT IN ('rejected', 'cancelled')
        AND pb.status NOT IN ('cancelled')
    `);
    const existing = existingItemsRes as any[];

    const paidTypes = existing.filter(e => e.final_status === 'paid').map(e => e.payment_type);
    const pendingItems = existing.filter(e => e.final_status !== 'paid');

    const reqType = itemData.payment_type || '100_akhir';

    // 1. Cegah jika kreator masih memiliki pengajuan aktif di batch lain yang belum selesai (pending)
    if (pendingItems.length > 0) {
      const activeBatch = pendingItems[0].batch_label;
      throw new Error(`Kreator ini masih memiliki pengajuan aktif di batch "${activeBatch}". Tunggu hingga selesai diproses sebelum mengajukan pembayaran berikutnya.`);
    }

    // 2. Logika Termin Berpasangan (Pairing Logic):
    // Hitung jumlah DP 50% Awal vs Pelunasan 50% Akhir yang sudah berstatus 'paid'
    const count50Awal = paidTypes.filter(t => t === '50_awal').length;
    const count50Akhir = paidTypes.filter(t => t === '50_akhir').length;

    // Jika masih ada termin DP 50% Awal yang belum dilunasi, pembayaran berikutnya WAJIB 50% Akhir
    if (count50Awal > count50Akhir) {
      if (reqType !== '50_akhir') {
        throw new Error(`Kreator ini memiliki termin DP 50% Awal yang belum dilunasi. Pengajuan berikutnya harus berupa Pelunasan 50% Akhir.`);
      }
    }

    // Jika seluruh termin sebelumnya sudah lunas/seimbang, tidak boleh memilih 50% Akhir tanpa adanya DP 50% Awal
    if (count50Awal === count50Akhir && reqType === '50_akhir') {
      throw new Error(`Tidak dapat memilih Pelunasan 50% Akhir karena tidak ada termin DP 50% Awal yang menggantung untuk kreator ini.`);
    }
  }

  const transactionId = `${itemData.payment_type === 'ads' ? 'ADS' : (itemData.payment_type === 'ops' ? 'OPS' : 'RC')}-${new Date().toISOString().slice(2,7).replace('-','')}-${Math.floor(1000 + Math.random() * 9000)}`;

  await db.execute(sql`
    INSERT INTO payment_items (
      batch_id, campaign_creator_id, payment_type, ratecard_awal, nominal, biaya_transfer,
      bank_account_id, metode_pembayaran, nomor_rekening, nama_penerima, nama_wa_pic, nomor_wa_dealing,
      alamat_ktp, nik, link_ktp, link_kontrak, notes, manager_status, executive_status, final_status, transaction_id
    ) VALUES (
      ${Number(batchId)},
      ${itemData.campaign_creator_id ? Number(itemData.campaign_creator_id) : null},
      ${itemData.payment_type || '100_akhir'},
      ${itemData.ratecard_awal ? Number(itemData.ratecard_awal) : null},
      ${Number(itemData.nominal) || 0},
      ${Number(itemData.biaya_transfer) || 0},
      ${bankAccountId},
      ${bankName},
      ${bankNumber},
      ${bankHolder},
      ${itemData.nama_wa_pic || null},
      ${itemData.nomor_wa_dealing || null},
      ${itemData.alamat_ktp || null},
      ${itemData.nik || null},
      ${itemData.link_ktp || null},
      ${itemData.link_kontrak || null},
      ${itemData.notes_dari_pic || itemData.notes || null},
      'pending',
      'pending',
      'pending',
      ${transactionId}
    )
  `);

  // Update creator master data if supplied
  if (itemData.campaign_creator_id) {
    try {
      const ccRows = await db.execute(sql`SELECT creator_id FROM campaign_creators WHERE id = ${itemData.campaign_creator_id}`);
      const creatorId = (ccRows as any[])[0]?.creator_id;
      if (creatorId) {
        // 1. Legacy update ke tabel creators (backward compatibility)
        if (itemData.nik) await db.execute(sql`UPDATE creators SET nik = ${itemData.nik} WHERE id = ${creatorId}`);
        if (itemData.link_ktp) await db.execute(sql`UPDATE creators SET link_ktp = ${itemData.link_ktp} WHERE id = ${creatorId}`);
        if (itemData.link_kontrak) await db.execute(sql`UPDATE creators SET link_kontrak = ${itemData.link_kontrak} WHERE id = ${creatorId}`);
        if (itemData.nama_wa_pic) await db.execute(sql`UPDATE creators SET nama_wa_pic = ${itemData.nama_wa_pic} WHERE id = ${creatorId}`);
        if (itemData.nomor_wa_dealing) await db.execute(sql`UPDATE creators SET nomor_wa_dealing = ${itemData.nomor_wa_dealing} WHERE id = ${creatorId}`);
        if (itemData.alamat_ktp) await db.execute(sql`UPDATE creators SET alamat_ktp = ${itemData.alamat_ktp} WHERE id = ${creatorId}`);

        // 2. Master Relasional: creator_pic_contacts (Nama PIC + No WA sebagai satu kesatuan)
        const cleanPic = itemData.nama_wa_pic ? String(itemData.nama_wa_pic).trim() : '';
        const cleanWa = itemData.nomor_wa_dealing ? String(itemData.nomor_wa_dealing).trim() : '';
        if (cleanPic && cleanWa) {
          await db.execute(sql`
            INSERT INTO creator_pic_contacts (creator_id, nama_pic, nomor_wa)
            VALUES (${creatorId}, ${cleanPic}, ${cleanWa})
            ON CONFLICT (creator_id, nama_pic, nomor_wa) DO NOTHING
          `).catch(() => {});
        }

        // 3. Master Relasional: creator_identities (NIK, Link KTP, Alamat KTP)
        const cleanNik = itemData.nik ? String(itemData.nik).trim() : '';
        if (cleanNik) {
          await db.execute(sql`
            INSERT INTO creator_identities (creator_id, nik, link_ktp, alamat_ktp)
            VALUES (${creatorId}, ${cleanNik}, ${itemData.link_ktp || null}, ${itemData.alamat_ktp || null})
            ON CONFLICT (creator_id, nik) DO UPDATE SET
              link_ktp = COALESCE(EXCLUDED.link_ktp, creator_identities.link_ktp),
              alamat_ktp = COALESCE(EXCLUDED.alamat_ktp, creator_identities.alamat_ktp)
          `).catch(() => {});
        }

        // 4. Master Relasional: creator_contracts (Link Kontrak GDrive)
        const cleanKontrak = itemData.link_kontrak ? String(itemData.link_kontrak).trim() : '';
        if (cleanKontrak) {
          const batchRows = await db.execute(sql`SELECT campaign_id FROM payment_batches WHERE id = ${batchId}`).catch(() => []);
          const cId = (batchRows as any[])[0]?.campaign_id || null;
          await db.execute(sql`
            INSERT INTO creator_contracts (creator_id, campaign_id, judul_kontrak, link_kontrak)
            VALUES (${creatorId}, ${cId}, 'Kontrak Pengajuan Pembayaran', ${cleanKontrak})
          `).catch(() => {});
        }
      }
    } catch (e) {
      console.warn('Silent fallback for creator metadata update:', e);
    }
  }
}

export async function updatePaymentItem(itemId: number, itemData: any) {
  try {
    const denied = await requireUserOrError();
    if (denied) return { success: false, error: denied.message } as any;

    const itemRows = await db.execute(sql`
      SELECT 
        pi.id,
        pi.campaign_creator_id, 
        pi.batch_id, 
        pi.manager_status, 
        pi.final_status,
        pb.status as batch_status,
        pb.campaign_id
      FROM payment_items pi
      LEFT JOIN payment_batches pb ON pi.batch_id = pb.id
      WHERE pi.id = ${itemId}
    `);
    const item = (itemRows as any[])[0];

    if (!item) {
      return { success: false, error: 'Item pembayaran tidak ditemukan.' };
    }

    // Guard: Hanya boleh diedit jika batch masih draft, cancelled, atau pending_manager
    const allowedBatchStatuses = ['draft', 'cancelled', 'pending_manager'];
    if (!allowedBatchStatuses.includes(item.batch_status)) {
      return { 
        success: false, 
        error: 'Batch sudah diproses lebih lanjut dan tagihan tidak dapat diubah lagi.' 
      };
    }

    // Guard Opsi A: Jika item SUDAH disetujui Manager, dikunci permanen
    const isManagerApproved = 
      item.manager_status === 'approved' || 
      item.final_status === 'manager_approved' || 
      ['executive_1_approved', 'ready_to_pay', 'executive_approved', 'finance_selected', 'paid'].includes(item.final_status);

    if (isManagerApproved) {
      return { 
        success: false, 
        error: 'Tagihan sudah disetujui oleh Manager dan tidak dapat diedit lagi.' 
      };
    }

    let bankAccountId = itemData.bank_account_id ? Number(itemData.bank_account_id) : null;
    let bankName = itemData.metode_pembayaran ? String(itemData.metode_pembayaran).trim() : null;
    let bankNumber = itemData.nomor_rekening ? String(itemData.nomor_rekening).trim() : null;
    let bankHolder = itemData.nama_penerima ? String(itemData.nama_penerima).trim() : null;

    if (item?.campaign_creator_id && bankName && bankNumber && !bankAccountId) {
      const ccRows = await db.execute(sql`SELECT creator_id FROM campaign_creators WHERE id = ${item.campaign_creator_id}`);
      const ccData = (ccRows as any[])[0];
      if (ccData?.creator_id) {
        const existBank = await db.execute(sql`
          SELECT id FROM creator_bank_accounts 
          WHERE creator_id = ${ccData.creator_id} AND LOWER(bank_name) = LOWER(${bankName}) AND account_number = ${bankNumber}
          LIMIT 1
        `);
        const existing = (existBank as any[])[0];
        if (existing) {
          bankAccountId = existing.id;
        } else {
          try {
            const insBank = await db.execute(sql`
              INSERT INTO creator_bank_accounts (creator_id, bank_name, account_number, account_holder)
              VALUES (${ccData.creator_id}, ${bankName}, ${bankNumber}, ${bankHolder || ''})
              RETURNING id
            `);
            if ((insBank as any[])[0]?.id) bankAccountId = (insBank as any[])[0].id;
          } catch (e) {
            console.warn('Could not insert new bank on update:', e);
          }
        }
      }
    }

    const safePaymentType = itemData.payment_type !== undefined ? itemData.payment_type : null;
    const safeNominal = (itemData.nominal !== undefined && itemData.nominal !== null && !isNaN(Number(itemData.nominal))) ? Number(itemData.nominal) : null;
    const safeRatecard = (itemData.ratecard_awal !== undefined && itemData.ratecard_awal !== null && !isNaN(Number(itemData.ratecard_awal))) ? Number(itemData.ratecard_awal) : null;
    const safeBiayaTransfer = (itemData.biaya_transfer !== undefined && itemData.biaya_transfer !== null && !isNaN(Number(itemData.biaya_transfer))) ? Number(itemData.biaya_transfer) : null;
    const safeBankAccountId = bankAccountId ?? null;
    const safeBankName = bankName ?? null;
    const safeBankNumber = bankNumber ?? null;
    const safeBankHolder = bankHolder ?? null;
    const safeNotes = itemData.notes !== undefined ? itemData.notes : (itemData.notes_dari_pic !== undefined ? itemData.notes_dari_pic : null);
    const safeNamaPic = itemData.nama_wa_pic !== undefined ? itemData.nama_wa_pic : null;
    const safeNomorPic = itemData.nomor_wa_dealing !== undefined ? itemData.nomor_wa_dealing : null;
    const safeAlamatKtp = itemData.alamat_ktp !== undefined ? itemData.alamat_ktp : null;
    const safeNik = itemData.nik !== undefined ? itemData.nik : null;
    const safeLinkKtp = itemData.link_ktp !== undefined ? itemData.link_ktp : null;
    const safeLinkKontrak = itemData.link_kontrak !== undefined ? itemData.link_kontrak : null;

    await db.execute(sql`
      UPDATE payment_items
      SET 
        payment_type = COALESCE(${safePaymentType}, payment_type),
        nominal = COALESCE(${safeNominal}, nominal),
        ratecard_awal = COALESCE(${safeRatecard}, ratecard_awal),
        biaya_transfer = COALESCE(${safeBiayaTransfer}, biaya_transfer),
        bank_account_id = COALESCE(${safeBankAccountId}, bank_account_id),
        metode_pembayaran = COALESCE(${safeBankName}, metode_pembayaran),
        nomor_rekening = COALESCE(${safeBankNumber}, nomor_rekening),
        nama_penerima = COALESCE(${safeBankHolder}, nama_penerima),
        notes = COALESCE(${safeNotes}, notes),
        nama_wa_pic = COALESCE(${safeNamaPic}, nama_wa_pic),
        nomor_wa_dealing = COALESCE(${safeNomorPic}, nomor_wa_dealing),
        alamat_ktp = COALESCE(${safeAlamatKtp}, alamat_ktp),
        nik = COALESCE(${safeNik}, nik),
        link_ktp = COALESCE(${safeLinkKtp}, link_ktp),
        link_kontrak = COALESCE(${safeLinkKontrak}, link_kontrak)
      WHERE id = ${itemId}
    `);

    if (item?.campaign_creator_id) {
      try {
        const ccRows = await db.execute(sql`SELECT creator_id FROM campaign_creators WHERE id = ${item.campaign_creator_id}`);
        const creatorId = (ccRows as any[])[0]?.creator_id;
        if (creatorId) {
          // Sync ke master PIC
          if (safeNamaPic && safeNomorPic) {
            await db.execute(sql`
              INSERT INTO creator_pic_contacts (creator_id, nama_pic, nomor_wa)
              VALUES (${creatorId}, ${String(safeNamaPic).trim()}, ${String(safeNomorPic).trim()})
              ON CONFLICT (creator_id, nama_pic, nomor_wa) DO NOTHING
            `);
          }
          // Sync ke master Identitas
          if (safeNik && String(safeNik).trim() !== '' && String(safeNik).trim() !== '-') {
            await db.execute(sql`
              INSERT INTO creator_identities (creator_id, nik, nama_ktp, alamat_ktp, link_ktp)
              VALUES (${creatorId}, ${String(safeNik).trim()}, ${safeBankHolder || ''}, ${safeAlamatKtp || ''}, ${safeLinkKtp || ''})
              ON CONFLICT (creator_id, nik) DO UPDATE SET
                alamat_ktp = COALESCE(EXCLUDED.alamat_ktp, creator_identities.alamat_ktp),
                link_ktp = COALESCE(EXCLUDED.link_ktp, creator_identities.link_ktp)
            `);
          }
          // Sync ke master Kontrak
          if (safeLinkKontrak && String(safeLinkKontrak).trim() !== '' && String(safeLinkKontrak).trim() !== '-') {
            await db.execute(sql`
              INSERT INTO creator_contracts (creator_id, campaign_id, link_kontrak)
              VALUES (${creatorId}, ${item.campaign_id ? Number(item.campaign_id) : null}, ${String(safeLinkKontrak).trim()})
            `);
          }
        }
      } catch (e) {
        console.warn('Silent fallback for creator metadata update on updatePaymentItem:', e);
      }
    }

    if (item.campaign_id) {
      revalidatePath(`/campaigns/${item.campaign_id}/keuangan`);
    }
    revalidatePath('/budgeting');

    return { success: true };
  } catch (err: any) {
    console.error('Error in updatePaymentItem:', err);
    return { success: false, error: err.message || 'Gagal menyimpan perubahan tagihan.' };
  }
}

export async function deletePaymentItem(itemId: number) {
  const denied = await requireUserOrError();
  if (denied) return { success: false, error: denied.message } as any;

  const itemRows = await db.execute(sql`
    SELECT 
      pi.id,
      pi.batch_id, 
      pi.manager_status, 
      pi.final_status,
      pb.status as batch_status,
      pb.campaign_id
    FROM payment_items pi
    LEFT JOIN payment_batches pb ON pi.batch_id = pb.id
    WHERE pi.id = ${itemId}
  `);
  const item = (itemRows as any[])[0];

  if (!item) {
    return { success: false, error: 'Item pembayaran tidak ditemukan.' };
  }

  // Guard: Hanya boleh dihapus jika batch masih draft, cancelled, atau pending_manager
  const allowedBatchStatuses = ['draft', 'cancelled', 'pending_manager'];
  if (!allowedBatchStatuses.includes(item.batch_status)) {
    return { 
      success: false, 
      error: 'Batch sudah diproses lebih lanjut dan item tidak dapat dihapus.' 
    };
  }

  // Guard Opsi A: Jika item SUDAH disetujui Manager, dikunci permanen
  const isManagerApproved = 
    item.manager_status === 'approved' || 
    item.final_status === 'manager_approved' || 
    ['executive_1_approved', 'ready_to_pay', 'executive_approved', 'finance_selected', 'paid'].includes(item.final_status);

  if (isManagerApproved) {
    return { 
      success: false, 
      error: 'Tagihan sudah disetujui oleh Manager dan tidak dapat dihapus.' 
    };
  }

  await db.execute(sql`DELETE FROM payment_items WHERE id = ${itemId}`);

  if (item.campaign_id) {
    revalidatePath(`/campaigns/${item.campaign_id}/keuangan`);
  }
  revalidatePath('/budgeting');

  return { success: true };
}

export async function deletePaymentBatch(batchId: number) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error('Not authenticated');

  const batchRows = await db.execute(sql`SELECT status, campaign_id FROM payment_batches WHERE id = ${batchId}`) as any[];
  const batch = batchRows[0];
  if (!batch) throw new Error('Batch tidak ditemukan');

  if (batch.status === 'paid') {
    const profileRows = await db.execute(sql`SELECT role FROM profiles WHERE id = ${userId}`) as any[];
    const role = (profileRows[0]?.role || '').toLowerCase();
    if (role !== 'executive' && role !== 'admin') {
      throw new Error('Akses Ditolak: Batch yang sudah berstatus PAID hanya dapat dihapus oleh Executive atau Admin.');
    }
  }

  await db.execute(sql`DELETE FROM payment_items WHERE batch_id = ${batchId}`);
  await db.execute(sql`DELETE FROM payment_batches WHERE id = ${batchId}`);

  if (batch.campaign_id) {
    revalidatePath(`/campaigns/${batch.campaign_id}/keuangan`);
  }
  revalidatePath('/budgeting');
}

export async function submitBatchToManager(batchId: number) {
  const denied = await requireUserOrError();
  if (denied) return { success: false, error: denied.message } as any;

  await db.execute(sql`
    UPDATE payment_batches
    SET status = 'pending_manager', submitted_at = NOW()
    WHERE id = ${batchId}
  `);
  revalidatePath('/budgeting');
}

export async function revertBatchStatus(batchId: number) {
  const denied = await requireRoleOrError('executive');
  if (denied) return { success: false, error: denied.message } as any;

  const rows = await db.execute(sql`SELECT status FROM payment_batches WHERE id = ${batchId}`);
  const batch = (rows as any[])[0];
  if (!batch) throw new Error('Batch tidak ditemukan');

  let newStatus = '';
  if (batch.status === 'ready_to_pay') newStatus = 'pending_executive';
  else if (batch.status === 'pending_executive') newStatus = 'pending_finance';
  else if (batch.status === 'pending_finance') newStatus = 'pending_executive_1';
  else if (batch.status === 'pending_executive_1') newStatus = 'pending_manager';
  else throw new Error('Status tidak dapat dikembalikan lagi');

  await db.execute(sql`UPDATE payment_batches SET status = ${newStatus} WHERE id = ${batchId}`);
  revalidatePath('/budgeting');
}

// ==========================================
// MIGRATION ACTIONS
// ==========================================

export async function resolveCreatorForMigration(username: string, campaignId: number, uploaderId: string, rowData: any) {
  const denied = await requireUserOrError();
  if (denied) return { success: false, error: denied.message } as any;

  let creatorId: number;
  let campaignCreatorId: number;
  let picId = uploaderId;

  if (rowData.pic_name) {
    const cleanPicName = rowData.pic_name.trim();
    const picRows = await db.execute(sql`SELECT id FROM profiles WHERE nama ILIKE ${`%${cleanPicName}%`} LIMIT 1`);
    if ((picRows as any[]).length > 0) {
      picId = (picRows as any[])[0].id;
    }
  }

  let cleanUsername = username.replace('@', '').trim();
  const existCr = await db.execute(sql`SELECT id FROM creators WHERE LOWER(username) = LOWER(${cleanUsername}) LIMIT 1`);
  if ((existCr as any[]).length > 0) {
    creatorId = (existCr as any[])[0].id;
  } else {
    const insCr = await db.execute(sql`
      INSERT INTO creators (username, nama_asli, status)
      VALUES (${cleanUsername}, ${rowData.nama_penerima || cleanUsername}, 'active')
      ON CONFLICT (lower(username)) DO UPDATE
        SET nama_asli = COALESCE(EXCLUDED.nama_asli, creators.nama_asli),
            status    = COALESCE(EXCLUDED.status, creators.status)
      RETURNING id
    `);
    creatorId = (insCr as any[])[0].id;
  }

  const existCc = await db.execute(sql`
    SELECT id FROM campaign_creators WHERE campaign_id = ${campaignId} AND creator_id = ${creatorId} LIMIT 1
  `);
  if ((existCc as any[]).length > 0) {
    campaignCreatorId = (existCc as any[])[0].id;
  } else {
    const insCc = await db.execute(sql`
      INSERT INTO campaign_creators (
        campaign_id, creator_id, added_by, approval, tier, price, nomor_wa_dealing, nama_wa, alamat_ktp, nik, link_ktp, link_kontrak, notes
      ) VALUES (
        ${campaignId}, ${creatorId}, ${picId || null}, 'approved', 'Nano', ${rowData.ratecard_awal || rowData.nominal || 0},
        ${rowData.nomor_wa_dealing || null}, ${rowData.nama_wa_pic || null}, ${rowData.alamat_ktp || null}, ${rowData.nik || null},
        ${rowData.link_ktp || null}, ${rowData.link_kontrak || null}, 'Di-import otomatis via Migrasi'
      )
      RETURNING id
    `);
    campaignCreatorId = (insCc as any[])[0].id;
  }

  return campaignCreatorId;
}

export async function importHistoricalBatch(campaignId: number, batchLabel: string, items: any[]) {
  const session = await auth();
  const profileId = session?.user?.id;
  if (!profileId) throw new Error('Not authenticated');

  const batchDate = items.length > 0 && items[0].tanggal_pengajuan ? new Date(items[0].tanggal_pengajuan).toISOString() : new Date().toISOString();
  const actualDate = items.length > 0 && items[0].tanggal_aktual ? new Date(items[0].tanggal_aktual).toISOString() : new Date().toISOString();

  const bRows = await db.execute(sql`
    INSERT INTO payment_batches (
      campaign_id, batch_label, status, submitted_by, manager_reviewed_by, executive_reviewed_1_by,
      finance_reviewed_by, executive_reviewed_by, paid_by, submitted_at, manager_reviewed_at,
      executive_reviewed_1_at, finance_reviewed_at, executive_reviewed_at, paid_at
    ) VALUES (
      ${campaignId}, ${batchLabel}, 'paid', ${profileId}, ${profileId}, ${profileId},
      ${profileId}, ${profileId}, ${profileId}, ${batchDate}, ${batchDate},
      ${batchDate}, ${batchDate}, ${batchDate}, ${actualDate}
    )
    RETURNING id
  `);

  const batchId = (bRows as any[])[0]?.id;
  if (!batchId) throw new Error("Gagal membuat batch migrasi");

  for (const item of items) {
    await db.execute(sql`
      INSERT INTO payment_items (
        batch_id, campaign_creator_id, payment_type, ratecard_awal, nominal, biaya_transfer,
        metode_pembayaran, nomor_rekening, nama_penerima, notes, manager_status, executive_1_status,
        finance_selected, executive_status, final_status, created_at, actual_payment_date, bukti_transfer_url, sender_account_id
      ) VALUES (
        ${batchId}, ${item.campaign_creator_id}, ${item.payment_type}, ${item.ratecard_awal || null},
        ${item.nominal}, ${item.biaya_transfer || 0}, ${item.metode_pembayaran}, ${item.nomor_rekening},
        ${item.nama_penerima}, ${item.notes || null}, 'approved', 'approved', true, 'approved', 'paid',
        ${item.tanggal_pengajuan || batchDate}, ${item.tanggal_aktual || actualDate}, ${item.bukti_transfer_url || null}, 1
      )
    `);
  }

  revalidatePath(`/campaigns/${campaignId}/keuangan`);
  return batchId;
}

// ==========================================
// MANAGER ACTIONS
// ==========================================

export async function managerApproveItem(itemId: number) {
  const session = await auth();
  const userId = session?.user?.id;
  await db.execute(sql`
    UPDATE payment_items
    SET manager_status = 'approved', final_status = 'manager_approved', manager_acted_by = ${userId || null}, manager_acted_at = NOW()
    WHERE id = ${itemId}
  `);
}

export async function managerRejectItem(itemId: number, reason: string) {
  const session = await auth();
  const userId = session?.user?.id;
  await db.execute(sql`
    UPDATE payment_items
    SET manager_status = 'rejected', final_status = 'rejected', manager_note = ${reason}, manager_acted_by = ${userId || null}, manager_acted_at = NOW()
    WHERE id = ${itemId}
  `);
}

export async function managerFinalizeReview(batchId: number) {
  const session = await auth();
  const userId = session?.user?.id;

  const items = await db.execute(sql`SELECT id, final_status FROM payment_items WHERE batch_id = ${batchId}`);
  const pendingItems = (items as any[]).filter(i => i.final_status === 'pending');
  if (pendingItems.length > 0) {
    throw new Error(`Masih ada ${pendingItems.length} tagihan yang belum direview (berstatus pending). Harap setujui atau tolak semua tagihan terlebih dahulu sebelum melakukan Finalize.`);
  }

  await db.execute(sql`
    UPDATE payment_batches
    SET status = 'pending_executive_1', manager_reviewed_by = ${userId || null}, manager_reviewed_at = NOW()
    WHERE id = ${batchId}
  `);
  revalidatePath('/budgeting');
}

// ==========================================
// EXECUTIVE REVIEW 1 ACTIONS
// ==========================================

export async function executiveApproveItem1(itemId: number) {
  const session = await auth();
  const userId = session?.user?.id;
  await db.execute(sql`
    UPDATE payment_items
    SET executive_1_status = 'approved', final_status = 'executive_1_approved', executive_1_acted_by = ${userId || null}, executive_1_acted_at = NOW()
    WHERE id = ${itemId}
  `);
}

export async function executiveRejectItem1(itemId: number, reason: string) {
  const session = await auth();
  const userId = session?.user?.id;
  await db.execute(sql`
    UPDATE payment_items
    SET executive_1_status = 'rejected', final_status = 'rejected', executive_1_note = ${reason}, executive_1_acted_by = ${userId || null}, executive_1_acted_at = NOW()
    WHERE id = ${itemId}
  `);
}

export async function executiveFinalizeReview1(batchId: number) {
  const session = await auth();
  const userId = session?.user?.id;

  const items = await db.execute(sql`SELECT id, final_status FROM payment_items WHERE batch_id = ${batchId}`);
  const unreviewed = (items as any[]).filter(i => ['pending', 'manager_approved'].includes(i.final_status));
  if (unreviewed.length > 0) {
    throw new Error(`Masih ada ${unreviewed.length} tagihan yang belum selesai direview. Harap setujui atau tolak semua tagihan terlebih dahulu sebelum submit ke Finance.`);
  }

  await db.execute(sql`
    UPDATE payment_batches
    SET status = 'pending_finance', executive_reviewed_1_by = ${userId || null}, executive_reviewed_1_at = NOW()
    WHERE id = ${batchId}
  `);
  revalidatePath('/budgeting');
}

// ==========================================
// FINANCE ACTIONS
// ==========================================

export async function financeToggleItem(itemId: number, selected: boolean) {
  const denied = await requireUserOrError();
  if (denied) return { success: false, error: denied.message } as any;

  const finalStatus = selected ? 'finance_selected' : 'executive_1_approved';
  await db.execute(sql`
    UPDATE payment_items
    SET finance_selected = ${selected}, final_status = ${finalStatus}
    WHERE id = ${itemId}
  `);
}

export async function financeSubmitToExecutive(batchId: number) {
  const session = await auth();
  const userId = session?.user?.id;
  await db.execute(sql`
    UPDATE payment_batches
    SET status = 'pending_executive', finance_reviewed_by = ${userId || null}, finance_reviewed_at = NOW()
    WHERE id = ${batchId}
  `);
  revalidatePath('/budgeting');
}

async function syncPaidItemsToCampaignCreators(paymentItemIds: number[], actualPaymentDate?: string) {
  if (!paymentItemIds || paymentItemIds.length === 0) return;
  try {
    const paidItemsRes = (await db.execute(sql`
      SELECT campaign_creator_id, payment_type, nominal, actual_transfer
      FROM payment_items
      WHERE id IN ${sqlInList(paymentItemIds)} AND campaign_creator_id IS NOT NULL
    `)) as any[];

    const dateStr = actualPaymentDate || new Date().toISOString();

    for (const item of paidItemsRes) {
      const finalNominal = item.actual_transfer != null ? Number(item.actual_transfer) : Number(item.nominal || 0);
      const pType = String(item.payment_type || '').toLowerCase();

      if (pType === '100_akhir' || pType === '50_akhir') {
        await db.execute(sql`
          UPDATE campaign_creators
          SET status_bayar = 'lunas',
              nominal_pelunasan = COALESCE(nominal_pelunasan, 0) + ${finalNominal},
              tgl_pembayaran = ${dateStr}
          WHERE id = ${item.campaign_creator_id}
        `);
      } else if (pType === '50_awal') {
        await db.execute(sql`
          UPDATE campaign_creators
          SET status_bayar = 'sebagian',
              nominal_pelunasan = COALESCE(nominal_pelunasan, 0) + ${finalNominal},
              tgl_pembayaran = ${dateStr}
          WHERE id = ${item.campaign_creator_id}
        `);
      }
    }
  } catch (err) {
    console.error('Error in syncPaidItemsToCampaignCreators:', err);
  }
}

export async function autoSplitUnpaidBatchItems(batchId: number) {
  const denied = await requireUserOrError();
  if (denied) return { success: false, error: denied.message } as any;

  const batchRows = await db.execute(sql`SELECT * FROM payment_batches WHERE id = ${batchId}`);
  const batch = (batchRows as any[])[0];
  if (!batch) return;

  const unpaidItemsRes = await db.execute(sql`
    SELECT id, final_status FROM payment_items 
    WHERE batch_id = ${batchId} AND final_status NOT IN ('paid', 'rejected', 'cancelled')
  `);
  const unpaidItems = unpaidItemsRes as any[];
  if (!unpaidItems || unpaidItems.length === 0) return;

  let baseLabel = batch.batch_label || `Batch #${batch.id}`;
  let nextTermin = 2;
  const terminMatch = baseLabel.match(/\s*-\s*Termin\s*(\d+)$/i);
  if (terminMatch) {
    nextTermin = parseInt(terminMatch[1], 10) + 1;
    baseLabel = baseLabel.replace(/\s*-\s*Termin\s*(\d+)$/i, '').trim();
  }
  const newBatchLabel = `${baseLabel} - Termin ${nextTermin}`;

  const hasPendingManager = unpaidItems.some(i => i.final_status === 'pending');
  const hasPendingExec1 = unpaidItems.some(i => i.final_status === 'manager_approved');

  // Termin 2 returned to pending_finance so Finance can review budget and re-select payable items
  let newBatchStatus = 'pending_finance';
  if (hasPendingManager) newBatchStatus = 'pending_manager';
  else if (hasPendingExec1) newBatchStatus = 'pending_executive_1';

  const newNotes = batch.notes ? `${batch.notes} (Pemisahan sisa dari ${batch.batch_label})` : `Pemisahan sisa dari ${batch.batch_label}`;

  const newBatchRes = await db.execute(sql`
    INSERT INTO payment_batches (
      campaign_id, batch_label, status, submitted_by, submitted_at, manager_reviewed_by, manager_reviewed_at, notes
    ) VALUES (
      ${batch.campaign_id}, ${newBatchLabel}, ${newBatchStatus}, ${batch.submitted_by}, ${batch.submitted_at || sql`NOW()`},
      ${batch.manager_reviewed_by}, ${batch.manager_reviewed_at}, ${newNotes}
    )
    RETURNING id
  `);
  const newBatchId = (newBatchRes as any[])[0]?.id;
  if (!newBatchId) return;

  const unpaidItemIds = unpaidItems.map(i => i.id);

  // Move items to new batch. If returning to pending_finance, reset items to executive_1_approved
  // and finance_selected = false so Finance can toggle which ones are payable in this new Termin!
  //
  // CATATAN: kolom executive_* ikut dikosongkan kalau approval executive akhir
  // dibatalkan oleh pemecahan ini. Kalau tidak, final_status sudah kembali ke
  // executive_1_approved (artinya "belum disetujui executive akhir") tapi
  // executive_acted_by masih menunjuk nama executive dari Termin sebelumnya.
  // Itu menyesatkan kalau nanti ada sengketa "saya tidak pernah menyetujui ini".
  //
  // executive_1_* sengaja TIDAK disentuh: approval executive tahap 1 tetap sah,
  // itu sebabnya statusnya kembali ke executive_1_approved dan bukan ke pending.
  await db.execute(sql`
    UPDATE payment_items
    SET batch_id = ${newBatchId},
        finance_selected = false,
        final_status = CASE
          WHEN final_status IN ('ready_to_pay', 'executive_approved', 'finance_selected', 'pending_finance_outstanding') THEN 'executive_1_approved'
          ELSE final_status
        END,
        executive_status    = CASE WHEN final_status IN ('ready_to_pay', 'executive_approved', 'finance_selected', 'pending_finance_outstanding') THEN NULL ELSE executive_status    END,
        executive_acted_by  = CASE WHEN final_status IN ('ready_to_pay', 'executive_approved', 'finance_selected', 'pending_finance_outstanding') THEN NULL ELSE executive_acted_by  END,
        executive_acted_at  = CASE WHEN final_status IN ('ready_to_pay', 'executive_approved', 'finance_selected', 'pending_finance_outstanding') THEN NULL ELSE executive_acted_at  END,
        executive_note      = CASE WHEN final_status IN ('ready_to_pay', 'executive_approved', 'finance_selected', 'pending_finance_outstanding') THEN NULL ELSE executive_note      END
    WHERE id IN ${sqlInList(unpaidItemIds)}
  `);
}

export async function financeMarkPaid(batchId: number, payload: { actualPaymentDate: string, buktiTransferUrl: string, senderAccountId: number }) {
  const session = await auth();
  const userId = session?.user?.id;

  // Support both executive_approved and ready_to_pay so items never get skipped
  const itemsToPayRes = await db.execute(sql`
    SELECT id FROM payment_items
    WHERE batch_id = ${batchId} AND (final_status = 'executive_approved' OR final_status = 'ready_to_pay' OR final_status = 'finance_selected')
  `) as any[];
  const itemIdsToPay = (itemsToPayRes || []).map(i => i.id);

  if (itemIdsToPay.length > 0) {
    await db.execute(sql`
      UPDATE payment_items
      SET final_status = 'paid'
      WHERE id IN ${sqlInList(itemIdsToPay)}
    `);

    // Auto-sync status_bayar to campaign_creators
    await syncPaidItemsToCampaignCreators(itemIdsToPay, payload.actualPaymentDate);
  }

  await autoSplitUnpaidBatchItems(batchId);

  await db.execute(sql`
    UPDATE payment_batches
    SET 
      status = 'paid',
      paid_by = ${userId || null},
      paid_at = NOW(),
      actual_payment_date = ${payload.actualPaymentDate},
      bukti_transfer_url = ${payload.buktiTransferUrl},
      sender_account_id = ${payload.senderAccountId}
    WHERE id = ${batchId}
  `);

  const batchInfo = (await db.execute(sql`SELECT campaign_id FROM payment_batches WHERE id = ${batchId}`)) as any[];
  if (batchInfo[0]?.campaign_id) {
    revalidatePath(`/campaigns/${batchInfo[0].campaign_id}/keuangan`);
    revalidatePath(`/campaigns/${batchInfo[0].campaign_id}/listing`);
  }
  revalidatePath('/budgeting');
}

export async function financeBulkMarkPaidItems(batchId: number, itemIds: number[], payload: { actualPaymentDate: string, buktiTransferUrl: string, senderAccountId: number }) {
  const session = await auth();
  const userId = session?.user?.id;

  if (itemIds && itemIds.length > 0) {
    await db.execute(sql`
      UPDATE payment_items
      SET final_status = 'paid'
      WHERE id IN ${sqlInList(itemIds)} AND batch_id = ${batchId}
    `);

    // Auto-sync status_bayar to campaign_creators
    await syncPaidItemsToCampaignCreators(itemIds, payload.actualPaymentDate);
  }

  await autoSplitUnpaidBatchItems(batchId);

  await db.execute(sql`
    UPDATE payment_batches
    SET 
      status = 'paid',
      paid_by = ${userId || null},
      paid_at = NOW(),
      actual_payment_date = ${payload.actualPaymentDate},
      bukti_transfer_url = ${payload.buktiTransferUrl},
      sender_account_id = ${payload.senderAccountId}
    WHERE id = ${batchId}
  `);

  const batchInfo = (await db.execute(sql`SELECT campaign_id FROM payment_batches WHERE id = ${batchId}`)) as any[];
  if (batchInfo[0]?.campaign_id) {
    revalidatePath(`/campaigns/${batchInfo[0].campaign_id}/keuangan`);
    revalidatePath(`/campaigns/${batchInfo[0].campaign_id}/listing`);
  }
  revalidatePath('/budgeting');
}

// ==========================================
// EXECUTIVE FINAL ACTIONS
// ==========================================

export async function executiveApproveItem(itemId: number) {
  const session = await auth();
  const userId = session?.user?.id;
  await db.execute(sql`
    UPDATE payment_items
    SET executive_status = 'approved', final_status = 'executive_approved', executive_acted_by = ${userId || null}, executive_acted_at = NOW()
    WHERE id = ${itemId}
  `);
}

export async function executiveRejectItem(itemId: number, reason: string) {
  const session = await auth();
  const userId = session?.user?.id;
  await db.execute(sql`
    UPDATE payment_items
    SET executive_status = 'rejected', final_status = 'rejected', executive_note = ${reason}, executive_acted_by = ${userId || null}, executive_acted_at = NOW()
    WHERE id = ${itemId}
  `);
}

export async function executiveFinalizeReview(batchId: number) {
  const session = await auth();
  const userId = session?.user?.id;

  const items = await db.execute(sql`SELECT id, final_status FROM payment_items WHERE batch_id = ${batchId}`);
  const unapproved = (items as any[]).filter(i => ['pending', 'manager_approved', 'finance_selected'].includes(i.final_status));
  if (unapproved.length > 0) {
    throw new Error(`Masih ada ${unapproved.length} tagihan yang belum selesai disetujui. Harap setujui atau tolak tagihan terlebih dahulu sebelum menandai batch siap bayar.`);
  }

  await db.execute(sql`
    UPDATE payment_batches
    SET status = 'ready_to_pay', executive_reviewed_by = ${userId || null}, executive_reviewed_at = NOW()
    WHERE id = ${batchId}
  `);
  revalidatePath('/budgeting');
}

// ==========================================
// READ / SUMMARY ACTIONS
// ==========================================

export async function getBudgetSummary() {
  const rows = await db.execute(sql`SELECT * FROM public.vw_campaign_budget_summary ORDER BY campaign_nama ASC`);
  return (rows as unknown as any[]) || [];
}

export async function financeUpdateAmounts(itemId: number, actualTransfer: number | null, biayaTransfer: number) {
  const denied = await requireUserOrError();
  if (denied) return { success: false, error: denied.message } as any;

  await db.execute(sql`
    UPDATE payment_items
    SET actual_transfer = ${actualTransfer}, biaya_transfer = ${biayaTransfer}
    WHERE id = ${itemId}
  `);
  revalidatePath('/budgeting');
}

export async function updateCampaignBudget(campaignId: number, field: 'budget_creator_plafon' | 'budget_ads_plafon', newValue: number) {
  const denied = await requireUserOrError();
  if (denied) return { success: false, error: denied.message } as any;

  if (field === 'budget_creator_plafon') {
    await db.execute(sql`UPDATE campaigns SET budget_creator_plafon = ${newValue} WHERE id = ${campaignId}`);
  } else {
    await db.execute(sql`UPDATE campaigns SET budget_ads_plafon = ${newValue} WHERE id = ${campaignId}`);
  }
  revalidatePath('/budgeting');
}

export async function updateItemBuktiTransfer(itemId: number, buktiUrl: string) {
  const denied = await requireUserOrError();
  if (denied) return { success: false, error: denied.message } as any;

  await db.execute(sql`
    UPDATE payment_items
    SET bukti_transfer_url = ${buktiUrl}
    WHERE id = ${itemId}
  `);
  revalidatePath('/budgeting');
}

export async function bulkSyncBudgetRows(rows: Array<{ id: number, price?: number | null, nominal_pelunasan?: number | null, status_bayar?: string | null, tgl_pembayaran?: string | null }>) {
  const denied = await requireUserOrError();
  if (denied) return { success: false, error: denied.message } as any;

  // Tanpa transaksi, gagal di baris ke-300 dari 500 akan meninggalkan
  // 300 baris pertama sudah tersimpan tanpa ada yang tahu. Satu transaksi
  // membuat semuanya batal atau semuanya tersimpan.
  const result = await db.transaction(async (tx) => {
    for (const row of rows) {
      await tx.execute(sql`
        UPDATE campaign_creators
        SET 
          price = COALESCE(${row.price ?? null}, price),
          nominal_pelunasan = COALESCE(${row.nominal_pelunasan ?? null}, nominal_pelunasan),
          status_bayar = COALESCE(${row.status_bayar ?? null}, status_bayar),
          tgl_pembayaran = COALESCE(${row.tgl_pembayaran ?? null}, tgl_pembayaran)
        WHERE id = ${row.id}
      `);
    }
      return { success: true, count: rows.length };
  });

  return result;
}

// ==========================================
// GLOBAL COMMAND CENTER ACTIONS (BULK)
// ==========================================

export async function fetchCommandCenterBatches() {
  const allBatches = await getPaymentBatches();
  const actionStatuses = ['pending_manager', 'pending_executive_1', 'pending_finance', 'pending_executive', 'ready_to_pay'];
  return (allBatches || []).filter((b: any) => 
    actionStatuses.includes(b.status) || 
    (b.payment_items || []).some((i: any) => 
      ['pending', 'manager_approved', 'executive_1_approved', 'finance_selected', 'ready_to_pay', 'executive_approved'].includes(i.final_status)
    )
  );
}

export async function bulkApproveManager(batchIds: number[]) {
  if (!batchIds || batchIds.length === 0) return;
  const session = await auth();
  const userId = session?.user?.id;

  await db.execute(sql`
    UPDATE payment_items
    SET manager_status = 'approved', final_status = 'manager_approved', manager_acted_by = ${userId || null}, manager_acted_at = NOW()
    WHERE batch_id IN ${sqlInList(batchIds)} AND final_status = 'pending'
  `);

  await db.execute(sql`
    UPDATE payment_batches
    SET status = 'pending_executive_1', manager_reviewed_by = ${userId || null}, manager_reviewed_at = NOW()
    WHERE id IN ${sqlInList(batchIds)} AND status = 'pending_manager'
  `);

  revalidatePath('/budgeting');
}

export async function bulkApproveExecutive1(batchIds: number[]) {
  if (!batchIds || batchIds.length === 0) return;
  const session = await auth();
  const userId = session?.user?.id;

  await db.execute(sql`
    UPDATE payment_items
    SET manager_status = 'approved', manager_acted_by = ${userId || null}, manager_acted_at = NOW(),
        final_status = 'executive_1_approved', executive_1_status = 'approved', executive_1_acted_by = ${userId || null}, executive_1_acted_at = NOW()
    WHERE batch_id IN ${sqlInList(batchIds)} AND final_status = 'pending'
  `);

  await db.execute(sql`
    UPDATE payment_items
    SET final_status = 'executive_1_approved', executive_1_status = 'approved', executive_1_acted_by = ${userId || null}, executive_1_acted_at = NOW()
    WHERE batch_id IN ${sqlInList(batchIds)} AND final_status = 'manager_approved'
  `);

  await db.execute(sql`
    UPDATE payment_batches
    SET status = 'pending_finance', manager_reviewed_by = ${userId || null}, manager_reviewed_at = NOW(),
        executive_reviewed_1_by = ${userId || null}, executive_reviewed_1_at = NOW()
    WHERE id IN ${sqlInList(batchIds)} AND status = 'pending_manager'
  `);

  await db.execute(sql`
    UPDATE payment_batches
    SET status = 'pending_finance', executive_reviewed_1_by = ${userId || null}, executive_reviewed_1_at = NOW()
    WHERE id IN ${sqlInList(batchIds)} AND status = 'pending_executive_1'
  `);

  revalidatePath('/budgeting');
}

export async function bulkApproveExecutiveFinal(batchIds: number[]) {
  if (!batchIds || batchIds.length === 0) return;
  const session = await auth();
  const userId = session?.user?.id;

  await db.execute(sql`
    UPDATE payment_items
    SET executive_status = 'approved', final_status = 'ready_to_pay', executive_acted_by = ${userId || null}, executive_acted_at = NOW()
    WHERE batch_id IN ${sqlInList(batchIds)} AND final_status = 'finance_selected'
  `);

  await db.execute(sql`
    UPDATE payment_batches
    SET status = 'ready_to_pay', executive_reviewed_by = ${userId || null}, executive_reviewed_at = NOW()
    WHERE id IN ${sqlInList(batchIds)} AND status = 'pending_executive'
  `);

  revalidatePath('/budgeting');
}

export async function bulkProcessFinanceReview(itemIds: number[], actionType: 'approve' | 'pending' | 'reject') {
  if (!itemIds || itemIds.length === 0) return { success: false, error: 'No items provided' };
  const session = await auth();
  const userId = session?.user?.id;

  try {
    let finalStatus = 'pending';
    let financeSelected = false;

    if (actionType === 'approve') {
      finalStatus = 'finance_selected';
      financeSelected = true;
    } else if (actionType === 'pending') {
      finalStatus = 'pending_finance_outstanding';
      financeSelected = false;
    } else if (actionType === 'reject') {
      finalStatus = 'rejected';
      financeSelected = false;
    }

    await db.execute(sql`
      UPDATE payment_items
      SET finance_selected = ${financeSelected}, final_status = ${finalStatus}
      WHERE id IN ${sqlInList(itemIds)}
    `);

    const itemsRes = await db.execute(sql`SELECT DISTINCT batch_id FROM payment_items WHERE id IN ${sqlInList(itemIds)}`);
    const batchIds = (itemsRes as any[]).map(i => i.batch_id);

    if (actionType === 'approve') {
      for (const bId of batchIds) {
        const remRes = await db.execute(sql`SELECT final_status FROM payment_items WHERE batch_id = ${bId}`);
        const hasEarlierStages = (remRes as any[]).some(i => ['pending', 'manager_approved', 'executive_1_approved', 'pending_finance_outstanding'].includes(i.final_status));
        if (!hasEarlierStages) {
          await db.execute(sql`
            UPDATE payment_batches
            SET status = 'pending_executive', finance_reviewed_by = ${userId || null}, finance_reviewed_at = NOW()
            WHERE id = ${bId} AND status = 'pending_finance'
          `);
        }
      }
    }

    revalidatePath('/budgeting');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Unknown error occurred" };
  }
}

export async function bulkMarkPaidFinance(itemIds: number[], payload: { actualPaymentDate: string, buktiTransferUrl: string, senderAccountId: number }) {
  if (!itemIds || itemIds.length === 0) return;
  const session = await auth();
  const userId = session?.user?.id;

  await db.execute(sql`
    UPDATE payment_items
    SET final_status = 'paid'
    WHERE id IN ${sqlInList(itemIds)}
  `);

  // Auto-sync status_bayar to campaign_creators
  await syncPaidItemsToCampaignCreators(itemIds, payload.actualPaymentDate);

  const itemsRes = await db.execute(sql`SELECT DISTINCT batch_id FROM payment_items WHERE id IN ${sqlInList(itemIds)}`);
  const batchIds = (itemsRes as any[]).map(i => i.batch_id);

  for (const bId of batchIds) {
    await db.execute(sql`
      UPDATE payment_batches
      SET actual_payment_date = ${payload.actualPaymentDate}, bukti_transfer_url = ${payload.buktiTransferUrl}, sender_account_id = ${payload.senderAccountId}
      WHERE id = ${bId}
    `);

    await autoSplitUnpaidBatchItems(bId);

    await db.execute(sql`
      UPDATE payment_batches
      SET status = 'paid', paid_by = ${userId || null}, paid_at = NOW()
      WHERE id = ${bId}
    `);
  }

  revalidatePath('/budgeting');
}

export async function processBulkExecutive(itemIds: number[]) {
  if (!itemIds || itemIds.length === 0) return;
  const session = await auth();
  const userId = session?.user?.id;

  const itemsRes = await db.execute(sql`SELECT id, final_status, batch_id FROM payment_items WHERE id IN ${sqlInList(itemIds)}`);
  const items = itemsRes as any[];

  const toExec1FromPending = items.filter(i => i.final_status === 'pending').map(i => i.id);
  const toExec1FromMgr = items.filter(i => i.final_status === 'manager_approved').map(i => i.id);
  const toReady = items.filter(i => i.final_status === 'finance_selected').map(i => i.id);

  if (toExec1FromPending.length > 0) {
    await db.execute(sql`
      UPDATE payment_items
      SET manager_status = 'approved', manager_acted_by = ${userId || null}, manager_acted_at = NOW(),
          final_status = 'executive_1_approved', executive_1_status = 'approved', executive_1_acted_by = ${userId || null}, executive_1_acted_at = NOW()
      WHERE id IN ${sqlInList(toExec1FromPending)}
    `);
  }

  if (toExec1FromMgr.length > 0) {
    await db.execute(sql`
      UPDATE payment_items
      SET final_status = 'executive_1_approved', executive_1_status = 'approved', executive_1_acted_by = ${userId || null}, executive_1_acted_at = NOW()
      WHERE id IN ${sqlInList(toExec1FromMgr)}
    `);
  }

  if (toReady.length > 0) {
    await db.execute(sql`
      UPDATE payment_items
      SET executive_status = 'approved', final_status = 'ready_to_pay', executive_acted_by = ${userId || null}, executive_acted_at = NOW()
      WHERE id IN ${sqlInList(toReady)}
    `);
  }

  const batchIds = [...new Set(items.map(i => i.batch_id))];
  for (const bId of batchIds) {
    const remRes = await db.execute(sql`SELECT final_status FROM payment_items WHERE batch_id = ${bId}`);
    const remItems = remRes as any[];
    const hasPendingManager = remItems?.some(i => i.final_status === 'pending');
    const hasPendingExec1 = remItems?.some(i => i.final_status === 'manager_approved');
    const hasPendingFinance = remItems?.some(i => ['executive_1_approved', 'pending_finance_outstanding'].includes(i.final_status));
    const hasPendingExecFinal = remItems?.some(i => i.final_status === 'finance_selected');

    if (hasPendingManager) {
      await db.execute(sql`UPDATE payment_batches SET status = 'pending_manager' WHERE id = ${bId}`);
    } else if (hasPendingExec1) {
      await db.execute(sql`UPDATE payment_batches SET status = 'pending_executive_1', manager_reviewed_by = ${userId || null}, manager_reviewed_at = NOW() WHERE id = ${bId}`);
    } else if (hasPendingFinance) {
      await db.execute(sql`UPDATE payment_batches SET status = 'pending_finance', manager_reviewed_by = ${userId || null}, manager_reviewed_at = NOW(), executive_reviewed_1_by = ${userId || null}, executive_reviewed_1_at = NOW() WHERE id = ${bId}`);
    } else if (hasPendingExecFinal) {
      await db.execute(sql`UPDATE payment_batches SET status = 'pending_executive', finance_reviewed_by = ${userId || null}, finance_reviewed_at = NOW() WHERE id = ${bId}`);
    } else {
      await db.execute(sql`UPDATE payment_batches SET status = 'ready_to_pay', executive_reviewed_by = ${userId || null}, executive_reviewed_at = NOW() WHERE id = ${bId}`);
    }
  }

  revalidatePath('/budgeting');
}

export async function processBulkManagerItems(itemIds: number[]) {
  if (!itemIds || itemIds.length === 0) return;
  const session = await auth();
  const userId = session?.user?.id;

  await db.execute(sql`
    UPDATE payment_items
    SET manager_status = 'approved', final_status = 'manager_approved', manager_acted_by = ${userId || null}, manager_acted_at = NOW()
    WHERE id IN ${sqlInList(itemIds)} AND final_status = 'pending'
  `);

  const itemsRes = await db.execute(sql`SELECT DISTINCT batch_id FROM payment_items WHERE id IN ${sqlInList(itemIds)}`);
  const batchIds = (itemsRes as any[]).map(i => i.batch_id);

  for (const bId of batchIds) {
    const remRes = await db.execute(sql`SELECT final_status FROM payment_items WHERE batch_id = ${bId}`);
    const hasPending = (remRes as any[]).some(i => i.final_status === 'pending');
    if (!hasPending) {
      await db.execute(sql`
        UPDATE payment_batches
        SET status = 'pending_executive_1', manager_reviewed_by = ${userId || null}, manager_reviewed_at = NOW()
        WHERE id = ${bId} AND status = 'pending_manager'
      `);
    }
  }

  revalidatePath('/budgeting');
}
