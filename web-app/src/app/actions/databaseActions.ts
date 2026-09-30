'use server';

import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { auth } from '@/auth';
import { revalidatePath } from 'next/cache';
import { requireRole, requireUserOrError, requireRoleOrError, requireCampaignAccessOrError } from '@/lib/guards';

// ============================================================
// AUDIT LOG
// ============================================================
export async function addAuditLogAction(log: {
  user_id?: string | null;
  user_name?: string | null;
  action: string;
  table_name: string;
  record_id: string;
  old_data?: any;
  new_data?: any;
  description?: string;
}) {
  try {
    let userId = log.user_id;
    let userName = log.user_name;

    if (!userId || !userName) {
      const session = await auth();
      if (session?.user?.email) {
        const [profile] = await db.execute(sql`
          SELECT id, full_name, email FROM profiles WHERE LOWER(email) = ${session.user.email.toLowerCase()} LIMIT 1
        `) as any[];
        if (profile) {
          userId = userId || profile.id;
          userName = userName || profile.full_name || session.user.email;
        }
      }
    }

    const [data] = await db.execute(sql`
      INSERT INTO audit_logs (user_id, user_name, action, table_name, record_id, old_data, new_data, description)
      VALUES (${userId || null}, ${userName || null}, ${log.action}, ${log.table_name}, ${log.record_id},
              ${log.old_data ? JSON.stringify(log.old_data) : null}::jsonb,
              ${log.new_data ? JSON.stringify(log.new_data) : null}::jsonb,
              ${log.description || null})
      RETURNING *
    `) as any[];
    return { success: true, data };
  } catch (err) {
    console.error('Error adding audit log:', err);
    return { success: false, error: String(err) };
  }
}

// ============================================================
// CREATOR POOL
// ============================================================
export async function addCreatorFullAction(
  creator: any,
  snapshot?: any,
  contact?: string,
  nicheIds?: number[]
) {
  const denied = await requireUserOrError();
  if (denied) return { success: false, error: denied.message } as any;
  try {
    // Insert Creator
    const namaAsli = creator.nama_asli || creator.nama_lengkap || null;
    const linkAccount = creator.link_account || (creator.username ? `https://www.tiktok.com/@${creator.username.replace(/^@/, '')}` : null);
    const [cData] = await db.execute(sql`
      INSERT INTO creators (username, nama_asli, link_account, added_by)
      VALUES (${creator.username}, ${namaAsli}, ${linkAccount}, ${creator.added_by || null})
      RETURNING *
    `) as any[];
    if (!cData) throw new Error('Failed to insert creator');

    const newCreatorId = cData.id;

    // Insert Snapshot
    let sData = null;
    if (snapshot) {
      const [s] = await db.execute(sql`
        INSERT INTO creator_snapshots (creator_id, tanggal_update, followers, level, gmv_30d, gmv_30d_video, gmv_30d_live, tier, audience_age, ratecard, updated_by)
        VALUES (${newCreatorId}, ${snapshot.tanggal_update || new Date().toISOString().split('T')[0]},
                ${snapshot.followers || null}, ${snapshot.level || null}, ${snapshot.gmv_30d || null},
                ${snapshot.gmv_30d_video || null}, ${snapshot.gmv_30d_live || null},
                ${snapshot.tier || null}, ${snapshot.audience_age || null}, ${snapshot.ratecard || null},
                ${snapshot.updated_by || null})
        RETURNING *
      `) as any[];
      sData = s;
    }

    // Insert Contact
    let ctData = null;
    if (contact) {
      const [ct] = await db.execute(sql`
        INSERT INTO creator_contacts (creator_id, nomor, status, tanggal_mulai)
        VALUES (${newCreatorId}, ${contact}, 'aktif', ${new Date().toISOString().split('T')[0]})
        RETURNING *
      `) as any[];
      ctData = ct;
    }

    // Insert Niches
    let nData: any[] = [];
    if (nicheIds && nicheIds.length > 0) {
      for (let idx = 0; idx < nicheIds.length; idx++) {
        const [n] = await db.execute(sql`
          INSERT INTO creator_niches (creator_id, niche_id, peringkat)
          VALUES (${newCreatorId}, ${nicheIds[idx]}, ${idx + 1})
          RETURNING *
        `) as any[];
        if (n) nData.push(n);
      }
    }

    return { success: true, creator: cData, snapshot: sData, contact: ctData, niches: nData };
  } catch (err: any) {
    console.error('Error adding creator full:', err);
    return { success: false, error: err.message };
  }
}

export async function updateCreatorAction(id: number, updates: any) {
  const denied = await requireUserOrError();
  if (denied) return { success: false, error: denied.message } as any;
  try {
    const sets: any[] = [];
    if (updates.username !== undefined) sets.push(sql`username = ${updates.username}`);
    if (updates.nama_asli !== undefined || updates.nama_lengkap !== undefined) {
      sets.push(sql`nama_asli = ${updates.nama_asli ?? updates.nama_lengkap}`);
    }
    if (updates.link_account !== undefined || updates.link_portofolio !== undefined) {
      sets.push(sql`link_account = ${updates.link_account ?? updates.link_portofolio}`);
    }
    if (updates.rekening !== undefined) sets.push(sql`rekening = ${updates.rekening}`);
    if (updates.mcn !== undefined) sets.push(sql`mcn = ${updates.mcn}`);
    if (updates.avatar_url !== undefined) sets.push(sql`avatar_url = ${updates.avatar_url}`);
    if (updates.nik !== undefined) sets.push(sql`nik = ${updates.nik}`);
    if (updates.link_ktp !== undefined) sets.push(sql`link_ktp = ${updates.link_ktp}`);
    if (updates.link_npwp !== undefined) sets.push(sql`link_npwp = ${updates.link_npwp}`);
    if (updates.link_kontrak !== undefined) sets.push(sql`link_kontrak = ${updates.link_kontrak}`);
    if (updates.last_updated_by !== undefined) sets.push(sql`last_updated_by = ${updates.last_updated_by}`);
    sets.push(sql`last_updated_at = NOW()`);

    if (sets.length === 0) return { success: true, data: null };

    const [result] = await db.execute(sql`
      UPDATE creators
      SET ${sql.join(sets, sql`, `)}
      WHERE id = ${id}
      RETURNING *
    `) as any[];

    return { success: true, data: result };
  } catch (err: any) {
    console.error('Error updating creator:', err);
    return { success: false, error: err.message };
  }
}

export async function addCreatorSnapshotAction(snapshot: any) {
  const denied = await requireUserOrError();
  if (denied) return { success: false, error: denied.message } as any;
  try {
    // Check for same-date snapshot
    const snapshotDate = snapshot.tanggal_update ? new Date(snapshot.tanggal_update).toISOString().split('T')[0] : null;

    if (snapshotDate) {
      const existing = await db.execute(sql`
        SELECT * FROM creator_snapshots
        WHERE creator_id = ${snapshot.creator_id}
          AND DATE(tanggal_update) = ${snapshotDate}
        LIMIT 1
      `) as any[];

      if (existing.length > 0) {
        const sameDateSnapshot = existing[0];
        // Update existing
        const [updated] = await db.execute(sql`
          UPDATE creator_snapshots SET
            followers = COALESCE(${snapshot.followers ?? null}, followers),
            level = COALESCE(${snapshot.level ?? null}, level),
            gmv_30d = COALESCE(${snapshot.gmv_30d ?? null}, gmv_30d),
            gmv_30d_video = COALESCE(${snapshot.gmv_30d_video ?? null}, gmv_30d_video),
            gmv_30d_live = COALESCE(${snapshot.gmv_30d_live ?? null}, gmv_30d_live),
            tier = COALESCE(${snapshot.tier ?? null}, tier),
            audience_age = COALESCE(${snapshot.audience_age ?? null}, audience_age),
            ratecard = COALESCE(${snapshot.ratecard ?? null}, ratecard),
            updated_by = COALESCE(${snapshot.updated_by ?? null}, updated_by)
          WHERE id = ${sameDateSnapshot.id}
          RETURNING *
        `) as any[];
        return { success: true, data: updated, mode: 'updated' };
      }
    }

    // Insert new snapshot
    const [data] = await db.execute(sql`
      INSERT INTO creator_snapshots (creator_id, tanggal_update, followers, level, gmv_30d, gmv_30d_video, gmv_30d_live, tier, audience_age, ratecard, updated_by)
      VALUES (${snapshot.creator_id}, ${snapshot.tanggal_update || new Date().toISOString().split('T')[0]},
              ${snapshot.followers || null}, ${snapshot.level || null}, ${snapshot.gmv_30d || null},
              ${snapshot.gmv_30d_video || null}, ${snapshot.gmv_30d_live || null},
              ${snapshot.tier || null}, ${snapshot.audience_age || null}, ${snapshot.ratecard || null},
              ${snapshot.updated_by || null})
      RETURNING *
    `) as any[];

    return { success: true, data, mode: 'inserted' };
  } catch (err: any) {
    console.error('Error adding creator snapshot:', err);
    return { success: false, error: err.message };
  }
}

export async function updateCreatorContactAction(creatorId: number, newNomor: string) {
  const denied = await requireUserOrError();
  if (denied) return { success: false, error: denied.message } as any;
  try {
    const today = new Date().toISOString().split('T')[0];

    // Check if the new number already exists (archived or active)
    const existingRows = await db.execute(sql`
      SELECT * FROM creator_contacts WHERE creator_id = ${creatorId} AND nomor = ${newNomor} LIMIT 1
    `) as any[];

    // Archive all current active contacts
    await db.execute(sql`
      UPDATE creator_contacts SET status = 'arsip', tanggal_diganti = ${today}
      WHERE creator_id = ${creatorId} AND status = 'aktif'
    `);

    let result;
    if (existingRows.length > 0) {
      // Reactivate old number
      const [reactivated] = await db.execute(sql`
        UPDATE creator_contacts SET status = 'aktif', tanggal_mulai = ${today}, tanggal_diganti = NULL
        WHERE id = ${existingRows[0].id}
        RETURNING *
      `) as any[];
      result = reactivated;
    } else {
      // Insert new active number
      const [inserted] = await db.execute(sql`
        INSERT INTO creator_contacts (creator_id, nomor, status, tanggal_mulai)
        VALUES (${creatorId}, ${newNomor}, 'aktif', ${today})
        RETURNING *
      `) as any[];
      result = inserted;
    }

    // Return all contacts for this creator
    const allContacts = await db.execute(sql`
      SELECT * FROM creator_contacts WHERE creator_id = ${creatorId} ORDER BY id
    `) as any[];

    return { success: true, result, allContacts };
  } catch (err: any) {
    console.error('Error updating contact:', err);
    return { success: false, error: err.message };
  }
}

export async function updateCreatorNichesAction(creatorId: number, nicheIds: number[]) {
  const denied = await requireUserOrError();
  if (denied) return { success: false, error: denied.message } as any;
  try {
    // Delete old niches
    await db.execute(sql`DELETE FROM creator_niches WHERE creator_id = ${creatorId}`);

    const inserted: any[] = [];
    if (nicheIds.length > 0) {
      for (let idx = 0; idx < nicheIds.length; idx++) {
        const [row] = await db.execute(sql`
          INSERT INTO creator_niches (creator_id, niche_id, peringkat)
          VALUES (${creatorId}, ${nicheIds[idx]}, ${idx + 1})
          RETURNING *
        `) as any[];
        if (row) inserted.push(row);
      }
    }

    return { success: true, data: inserted };
  } catch (err: any) {
    console.error('Error updating creator niches:', err);
    return { success: false, error: err.message };
  }
}

export async function addCreatorNoteAction(note: any) {
  const denied = await requireUserOrError();
  if (denied) return { success: false, error: denied.message } as any;
  try {
    const [data] = await db.execute(sql`
      INSERT INTO creator_notes (creator_id, user_name, isi)
      VALUES (${note.creator_id}, ${note.user_name || null}, ${note.isi || ''})
      RETURNING *
    `) as any[];
    return { success: true, data };
  } catch (err: any) {
    console.error('Error adding creator note:', err);
    return { success: false, error: err.message };
  }
}

export async function fetchCreatorNotesAction(creatorId: number) {
  const denied = await requireUserOrError();
  if (denied) return { success: false, error: denied.message } as any;
  try {
    const data = await db.execute(sql`
      SELECT * FROM creator_notes WHERE creator_id = ${creatorId} ORDER BY created_at DESC
    `) as any[];
    return { success: true, data: data || [] };
  } catch (err: any) {
    return { success: false, data: [], error: err.message };
  }
}

export async function saveCreatorAddressBookAction(payload: any) {
  const denied = await requireUserOrError();
  if (denied) return { success: false, error: denied.message } as any;
  try {
    if (payload.id) {
      const [updated] = await db.execute(sql`
        UPDATE creator_address_book SET
          label = COALESCE(${payload.label ?? null}, label),
          nama_penerima = COALESCE(${payload.nama_penerima ?? null}, nama_penerima),
          alamat_jalan = COALESCE(${payload.alamat_jalan ?? null}, alamat_jalan),
          kecamatan = COALESCE(${payload.kecamatan ?? null}, kecamatan),
          kota = COALESCE(${payload.kota ?? null}, kota),
          provinsi = COALESCE(${payload.provinsi ?? null}, provinsi),
          kodepos = COALESCE(${payload.kodepos ?? null}, kodepos)
        WHERE id = ${payload.id}
        RETURNING *
      `) as any[];
      return { success: true, data: updated };
    } else {
      const [inserted] = await db.execute(sql`
        INSERT INTO creator_address_book (creator_id, label, nama_penerima, alamat_jalan, kecamatan, kota, provinsi, kodepos)
        VALUES (${payload.creator_id}, ${payload.label || null}, ${payload.nama_penerima || null},
                ${payload.alamat_jalan || null}, ${payload.kecamatan || null}, ${payload.kota || null},
                ${payload.provinsi || null}, ${payload.kodepos || null})
        RETURNING *
      `) as any[];
      return { success: true, data: inserted };
    }
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteCreatorAddressBookAction(id: number, creatorId: number) {
  const denied = await requireUserOrError();
  if (denied) return { success: false, error: denied.message } as any;
  try {
    await db.execute(sql`DELETE FROM creator_address_book WHERE id = ${id}`);
    const data = await db.execute(sql`
      SELECT * FROM creator_address_book WHERE creator_id = ${creatorId} ORDER BY id DESC
    `) as any[];
    return { success: true, data: data || [] };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ============================================================
// CAMPAIGN CREATORS
// ============================================================
let ccColumnsEnsured = false;
async function ensureCampaignCreatorColumns() {
  if (ccColumnsEnsured) return;
  try {
    await db.execute(sql`
      ALTER TABLE campaign_creators ADD COLUMN IF NOT EXISTS approved_by text;
      ALTER TABLE campaign_creators ADD COLUMN IF NOT EXISTS approved_at timestamptz;
      ALTER TABLE campaign_creators ADD COLUMN IF NOT EXISTS not_approved_by text;
      ALTER TABLE campaign_creators ADD COLUMN IF NOT EXISTS not_approved_at timestamptz;
      ALTER TABLE campaign_creators ADD COLUMN IF NOT EXISTS content_type text DEFAULT 'Video';
      ALTER TABLE campaign_creators ADD COLUMN IF NOT EXISTS qty_live integer DEFAULT 0;
      ALTER TABLE campaign_creators ADD COLUMN IF NOT EXISTS client_approval text DEFAULT 'not_required';
      ALTER TABLE campaign_creators ADD COLUMN IF NOT EXISTS assigned_sku_ids jsonb;
    `);
    ccColumnsEnsured = true;
  } catch (err) {
    console.error('ensureCampaignCreatorColumns error:', err);
  }
}

/**
 * Daftar data yang masih kurang untuk satu kreator di satu campaign.
 * Sama dengan syarat yang dipakai halaman Import Kreator, supaya kreator yang
 * ditarik lewat "Tarik ke Campaign" punya kelengkapan yang setara.
 */
async function getMissingCreatorFields(creatorId: number, qtyVt: number, qtyLive: number): Promise<string[]> {
  const rows = await db.execute(sql`
    SELECT
      (SELECT nomor FROM creator_contacts
        WHERE creator_id = ${creatorId} AND status = 'aktif' ORDER BY id DESC LIMIT 1) AS no_wa,
      (SELECT followers FROM creator_snapshots
        WHERE creator_id = ${creatorId} ORDER BY id DESC LIMIT 1) AS followers,
      (SELECT gmv_30d FROM creator_snapshots
        WHERE creator_id = ${creatorId} ORDER BY id DESC LIMIT 1) AS gmv_30d,
      (SELECT gmv_30d_video FROM creator_snapshots
        WHERE creator_id = ${creatorId} ORDER BY id DESC LIMIT 1) AS gmv_30d_video,
      (SELECT gmv_30d_live FROM creator_snapshots
        WHERE creator_id = ${creatorId} ORDER BY id DESC LIMIT 1) AS gmv_30d_live
  `) as any[];

  const d = rows[0] || {};
  const missing: string[] = [];

  if (!d.no_wa || String(d.no_wa).trim() === '') missing.push('No WA');
  if (!(Number(d.followers) > 0)) missing.push('Followers');
  if (!(Number(d.gmv_30d) > 0 || Number(d.gmv_30d_video) > 0 || Number(d.gmv_30d_live) > 0)) {
    missing.push('Minimal 1 GMV');
  }
  if (!(qtyVt > 0 || qtyLive > 0)) missing.push('Qty VT / Qty Live');

  return missing;
}

export async function addCampaignCreatorAction(cc: any) {
  const denied = await requireUserOrError();
  if (denied) return { success: false, error: denied.message } as any;
  try {
    await ensureCampaignCreatorColumns();

    const campaignId = Number(cc.campaign_id);
    const creatorId = Number(cc.creator_id);
    if (!campaignId || !creatorId) {
      return { success: false, error: 'Campaign atau kreator tidak valid.' } as any;
    }

    const accessDenied = await requireCampaignAccessOrError(campaignId);
    if (accessDenied) return { success: false, error: accessDenied.message } as any;

    // Cegah baris dobel. campaign_creators tidak punya UNIQUE(campaign_id, creator_id),
    // jadi tanpa cek ini klik dua kali menghasilkan dua listing untuk kreator yang sama.
    const dup = await db.execute(sql`
      SELECT cc.id, c.nama AS campaign_nama
      FROM campaign_creators cc
      LEFT JOIN campaigns c ON c.id = cc.campaign_id
      WHERE cc.campaign_id = ${campaignId} AND cc.creator_id = ${creatorId}
      LIMIT 1
    `) as any[];
    if (dup.length > 0) {
      const nama = dup[0].campaign_nama || `#${campaignId}`;
      return {
        success: false,
        error: `Kreator ini sudah ada di campaign "${nama}". Gunakan menu Listing untuk mengubah rate card atau qty.`
      } as any;
    }

    const contentType = cc.content_type || cc.tipe_konten || 'Video';
    const price = Number(cc.price ?? cc.rate_card ?? 0);
    const qtyVt = Number(cc.qty_vt ?? cc.slot ?? 1);
    const qtyLive = Number(cc.qty_live ?? 0);
    const tier = cc.tier || 'Nano';

    const [data] = await db.execute(sql`
      INSERT INTO campaign_creators (
        campaign_id, creator_id, price, approval, content_type, status_bayar,
        qty_vt, qty_live, tier, pic_assist, client_approval, added_by
      )
      VALUES (
        ${campaignId}, ${creatorId}, ${price}, ${cc.approval || 'pending'},
        ${contentType}, ${cc.status_bayar || 'belum'}, ${qtyVt},
        ${qtyLive}, ${tier}, ${cc.pic_assist || null},
        ${cc.client_approval || 'not_required'}, ${cc.added_by || null}
      )
      RETURNING *
    `) as any[];

    // Kembalikan data yang masih kurang supaya UI bisa memberi tahu PIC
    // apa yang perlu dilengkapi di menu Listing.
    const missing = await getMissingCreatorFields(creatorId, qtyVt, qtyLive);

    return { success: true, data, missing };
  } catch (err: any) {
    console.error('Error adding campaign creator:', err);
    return { success: false, error: err.message };
  }
}

export async function updateCampaignCreatorAction(id: number, updates: any) {
  const denied = await requireUserOrError();
  if (denied) return { success: false, error: denied.message } as any;
  try {
    await ensureCampaignCreatorColumns();
    const sets: any[] = [];
    if (updates.price !== undefined || updates.rate_card !== undefined) {
      sets.push(sql`price = ${updates.price ?? updates.rate_card}`);
    }
    if (updates.approval !== undefined) {
      sets.push(sql`approval = ${updates.approval}`);
    }
    if (updates.content_type !== undefined || updates.tipe_konten !== undefined) {
      sets.push(sql`content_type = ${updates.content_type ?? updates.tipe_konten}`);
    }
    if (updates.status_bayar !== undefined) {
      sets.push(sql`status_bayar = ${updates.status_bayar}`);
    }
    if (updates.tier !== undefined) {
      sets.push(sql`tier = ${updates.tier}`);
    }
    if (updates.qty_vt !== undefined) {
      sets.push(sql`qty_vt = ${updates.qty_vt}`);
    }
    if (updates.qty_live !== undefined) {
      sets.push(sql`qty_live = ${updates.qty_live}`);
    }
    if (updates.slot_allocated !== undefined || updates.slot !== undefined) {
      sets.push(sql`slot_allocated = ${updates.slot_allocated ?? updates.slot}`);
    }
    if (updates.pic_assist !== undefined) {
      sets.push(sql`pic_assist = ${updates.pic_assist}`);
    }
    if (updates.notes_manager !== undefined) {
      sets.push(sql`notes_manager = ${updates.notes_manager}`);
    }
    if (updates.notes_pic !== undefined) {
      sets.push(sql`notes_pic = ${updates.notes_pic}`);
    }
    if (updates.notes_client !== undefined) {
      sets.push(sql`notes_client = ${updates.notes_client}`);
    }
    if (updates.sample_progress !== undefined) {
      sets.push(sql`sample_progress = ${updates.sample_progress}`);
    }
    if (updates.client_approval !== undefined) {
      sets.push(sql`client_approval = ${updates.client_approval}`);
    }
    if (updates.assigned_sku_ids !== undefined) {
      sets.push(sql`assigned_sku_ids = ${JSON.stringify(updates.assigned_sku_ids)}::jsonb`);
    }
    if (updates.pelunasan !== undefined || updates.nominal_pelunasan !== undefined) {
      sets.push(sql`pelunasan = ${updates.pelunasan ?? updates.nominal_pelunasan}`);
    }
    if (updates.tgl_bayar !== undefined || updates.tgl_pembayaran !== undefined) {
      sets.push(sql`tgl_bayar = ${updates.tgl_bayar ?? updates.tgl_pembayaran}`);
    }
    if (updates.approved_by !== undefined) {
      sets.push(sql`approved_by = ${updates.approved_by}`);
    }
    if (updates.approved_at !== undefined) {
      sets.push(sql`approved_at = ${updates.approved_at}`);
    }
    if (updates.not_approved_by !== undefined) {
      sets.push(sql`not_approved_by = ${updates.not_approved_by}`);
    }
    if (updates.not_approved_at !== undefined) {
      sets.push(sql`not_approved_at = ${updates.not_approved_at}`);
    }

    if (sets.length === 0) {
      return { success: true, data: null };
    }

    const [data] = await db.execute(sql`
      UPDATE campaign_creators
      SET ${sql.join(sets, sql`, `)}
      WHERE id = ${id}
      RETURNING *
    `) as any[];
    return { success: true, data };
  } catch (err: any) {
    console.error('Error updating campaign creator:', err);
    return { success: false, error: err.message };
  }
}

export async function deleteCampaignCreatorAction(id: number) {
  const denied = await requireRoleOrError('manager', 'executive', 'admin');
  if (denied) return { success: false, error: denied.message } as any;
  try {
    await db.execute(sql`DELETE FROM campaign_creators WHERE id = ${id}`);
    return { success: true };
  } catch (err: any) {
    console.error('Error deleting campaign creator:', err);
    return { success: false, error: err.message };
  }
}

// ============================================================
// VIDEOS
// ============================================================
export async function addVideoAction(video: any) {
  const denied = await requireUserOrError();
  if (denied) return { success: false, error: denied.message } as any;
  try {
    const [data] = await db.execute(sql`
      INSERT INTO videos (campaign_creator_id, link, vt_approval, jenis)
      VALUES (${video.campaign_creator_id}, ${video.link || null}, ${video.vt_approval || 'pending'}, ${video.jenis || null})
      RETURNING *
    `) as any[];
    return { success: true, data };
  } catch (err: any) {
    console.error('Error adding video:', err);
    return { success: false, error: err.message };
  }
}

export async function updateVideoApprovalAction(id: number, approval: string) {
  const denied = await requireUserOrError();
  if (denied) return { success: false, error: denied.message } as any;
  try {
    await db.execute(sql`UPDATE videos SET vt_approval = ${approval} WHERE id = ${id}`);
    return { success: true };
  } catch (err: any) {
    console.error('Error updating video approval:', err);
    return { success: false, error: err.message };
  }
}

// ============================================================
// CREATOR PAYMENTS
// ============================================================
export async function updateCreatorPaymentAction(id: number | null, payment: any) {
  const denied = await requireRoleOrError('finance', 'manager', 'executive', 'admin');
  if (denied) return { success: false, error: denied.message } as any;
  try {
    if (id) {
      const [data] = await db.execute(sql`
        UPDATE creator_payments SET
          rate_card = COALESCE(${payment.rate_card ?? null}, rate_card),
          jumlah_bayar = COALESCE(${payment.jumlah_bayar ?? null}, jumlah_bayar),
          status_bayar = COALESCE(${payment.status_bayar ?? null}, status_bayar),
          metode_bayar = COALESCE(${payment.metode_bayar ?? null}, metode_bayar),
          tanggal_bayar = COALESCE(${payment.tanggal_bayar ?? null}, tanggal_bayar),
          catatan = CASE WHEN ${payment.catatan !== undefined} THEN ${payment.catatan ?? null} ELSE catatan END,
          batch_id = COALESCE(${payment.batch_id ?? null}, batch_id)
        WHERE id = ${id}
        RETURNING *
      `) as any[];

      // Sync status_bayar to campaign_creators
      if (payment.status_bayar && data?.campaign_creator_id) {
        let syncStatus = 'belum';
        if (payment.status_bayar === 'pay_off') syncStatus = 'lunas';
        else if (payment.status_bayar === 'half_paid') syncStatus = 'sebagian';
        await db.execute(sql`UPDATE campaign_creators SET status_bayar = ${syncStatus} WHERE id = ${data.campaign_creator_id}`);
      }
      return { success: true, data };
    } else if (payment.campaign_creator_id) {
      // Get rate_card from campaign_creators
      const ccRows = await db.execute(sql`SELECT price FROM campaign_creators WHERE id = ${payment.campaign_creator_id} LIMIT 1`) as any[];
      const rateCard = ccRows[0]?.price || 0;

      const [data] = await db.execute(sql`
        INSERT INTO creator_payments (campaign_creator_id, rate_card, jumlah_bayar, status_bayar, metode_bayar, tanggal_bayar, catatan, batch_id)
        VALUES (${payment.campaign_creator_id}, ${payment.rate_card || rateCard}, ${payment.jumlah_bayar || null},
                ${payment.status_bayar || 'unpaid'}, ${payment.metode_bayar || null}, ${payment.tanggal_bayar || null},
                ${payment.catatan || null}, ${payment.batch_id || null})
        RETURNING *
      `) as any[];

      if (payment.status_bayar) {
        let syncStatus = 'belum';
        if (payment.status_bayar === 'pay_off') syncStatus = 'lunas';
        else if (payment.status_bayar === 'half_paid') syncStatus = 'sebagian';
        await db.execute(sql`UPDATE campaign_creators SET status_bayar = ${syncStatus} WHERE id = ${payment.campaign_creator_id}`);
      }
      return { success: true, data };
    }
    return { success: true, data: null };
  } catch (err: any) {
    console.error('Error updating creator payment:', err);
    return { success: false, error: err.message };
  }
}

// ============================================================
// ADS SPENDS
// ============================================================
export async function addAdsSpendAction(spend: any) {
  const denied = await requireRoleOrError('finance', 'manager', 'executive', 'admin');
  if (denied) return { success: false, error: denied.message } as any;
  try {
    const [data] = await db.execute(sql`
      INSERT INTO ads_spends (campaign_id, tanggal, amount, kurs, catatan)
      VALUES (${spend.campaign_id}, ${spend.tanggal}, ${spend.amount || 0}, ${spend.kurs || 16000}, ${spend.catatan || null})
      RETURNING *
    `) as any[];
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updateAdsSpendAction(id: number, spend: any) {
  const denied = await requireRoleOrError('finance', 'manager', 'executive', 'admin');
  if (denied) return { success: false, error: denied.message } as any;
  try {
    const [data] = await db.execute(sql`
      UPDATE ads_spends SET
        tanggal = COALESCE(${spend.tanggal ?? null}, tanggal),
        amount = COALESCE(${spend.amount ?? null}, amount),
        kurs = COALESCE(${spend.kurs ?? null}, kurs),
        catatan = CASE WHEN ${spend.catatan !== undefined} THEN ${spend.catatan ?? null} ELSE catatan END
      WHERE id = ${id}
      RETURNING *
    `) as any[];
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ============================================================
// CREATOR ADDRESSES
// ============================================================
export async function fetchCreatorAddressesAction(campaignId: number) {
  const denied = await requireUserOrError();
  if (denied) return { success: false, error: denied.message } as any;
  try {
    const data = await db.execute(sql`
      SELECT ca.* FROM creator_addresses ca
      JOIN campaign_creators cc ON ca.campaign_creator_id = cc.id
      WHERE cc.campaign_id = ${campaignId}
    `) as any[];
    return { success: true, data: data || [] };
  } catch (err: any) {
    return { success: false, data: [], error: err.message };
  }
}

export async function updateCreatorAddressAction(id: number | null, address: any) {
  const denied = await requireUserOrError();
  if (denied) return { success: false, error: denied.message } as any;
  try {
    const payload = { ...address };
    delete payload.campaign_creators;

    if (id) {
      const [data] = await db.execute(sql`
        UPDATE creator_addresses SET
          campaign_creator_id = COALESCE(${payload.campaign_creator_id ?? null}, campaign_creator_id),
          nama_penerima = COALESCE(${payload.nama_penerima ?? null}, nama_penerima),
          no_hp = COALESCE(${payload.no_hp ?? null}, no_hp),
          alamat = CASE WHEN ${payload.alamat !== undefined} THEN ${payload.alamat ?? null} ELSE alamat END,
          provinsi = COALESCE(${payload.provinsi ?? null}, provinsi),
          kota = COALESCE(${payload.kota ?? null}, kota),
          kecamatan = COALESCE(${payload.kecamatan ?? null}, kecamatan),
          kode_pos = COALESCE(${payload.kode_pos ?? null}, kode_pos),
          catatan = CASE WHEN ${payload.catatan !== undefined} THEN ${payload.catatan ?? null} ELSE catatan END
        WHERE id = ${id}
        RETURNING *
      `) as any[];
      return { success: true, data };
    } else {
      const [data] = await db.execute(sql`
        INSERT INTO creator_addresses (campaign_creator_id, nama_penerima, no_hp, alamat, provinsi, kota, kecamatan, kode_pos, catatan)
        VALUES (${payload.campaign_creator_id}, ${payload.nama_penerima || null}, ${payload.no_hp || null},
                ${payload.alamat || null}, ${payload.provinsi || null}, ${payload.kota || null},
                ${payload.kecamatan || null}, ${payload.kode_pos || null}, ${payload.catatan || null})
        RETURNING *
      `) as any[];
      return { success: true, data };
    }
  } catch (err: any) {
    console.error('Error updating creator address:', err);
    return { success: false, error: err.message };
  }
}

// ============================================================
// LIVE SCHEDULES
// ============================================================
export async function fetchLiveSchedulesAction(campaignId: number) {
  const denied = await requireUserOrError();
  if (denied) return { success: false, error: denied.message } as any;
  try {
    const data = await db.execute(sql`
      SELECT ls.* FROM live_schedules ls
      JOIN campaign_creators cc ON ls.campaign_creator_id = cc.id
      WHERE cc.campaign_id = ${campaignId}
      ORDER BY ls.tanggal_live ASC
    `) as any[];
    return { success: true, data: data || [] };
  } catch (err: any) {
    return { success: false, data: [], error: err.message };
  }
}

export async function addLiveScheduleAction(schedule: any) {
  const denied = await requireUserOrError();
  if (denied) return { success: false, error: denied.message } as any;
  try {
    const [data] = await db.execute(sql`
      INSERT INTO live_schedules (campaign_creator_id, tanggal_live, jam_mulai, jam_selesai, platform, status, catatan)
      VALUES (${schedule.campaign_creator_id}, ${schedule.tanggal_live}, ${schedule.jam_mulai || null},
              ${schedule.jam_selesai || null}, ${schedule.platform || 'tiktok'}, ${schedule.status || 'terjadwal'},
              ${schedule.catatan || null})
      RETURNING *
    `) as any[];
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteLiveScheduleAction(id: number) {
  const denied = await requireUserOrError();
  if (denied) return { success: false, error: denied.message } as any;
  try {
    await db.execute(sql`DELETE FROM live_schedules WHERE id = ${id}`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ============================================================
// BRANDS & NICHES
// ============================================================
export async function updateBrandAction(id: number, updates: any) {
  const denied = await requireRoleOrError('manager', 'executive', 'admin');
  if (denied) return { success: false, error: denied.message } as any;
  try {
    await db.execute(sql`
      UPDATE brands SET
        nama = COALESCE(${updates.nama ?? null}, nama),
        status = COALESCE(${updates.status ?? null}, status)
      WHERE id = ${id}
    `);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function addNicheAction(niche: any) {
  const denied = await requireUserOrError();
  if (denied) return { success: false, error: denied.message } as any;
  try {
    const [data] = await db.execute(sql`
      INSERT INTO niches (nama) VALUES (${niche.nama}) RETURNING *
    `) as any[];
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updateNicheAction(id: number, updates: any) {
  const denied = await requireUserOrError();
  if (denied) return { success: false, error: denied.message } as any;
  try {
    await db.execute(sql`UPDATE niches SET nama = ${updates.nama} WHERE id = ${id}`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ============================================================
// DAILY PERFORMANCE
// ============================================================
export async function addDailyPerformanceAction(record: any) {
  const denied = await requireRoleOrError('finance', 'manager', 'executive', 'admin');
  if (denied) return { success: false, error: denied.message } as any;
  try {
    const [data] = await db.execute(sql`
      INSERT INTO daily_performance (campaign_creator_id, tanggal, gmv, unit_sold, views, likes, comments, shares, unique_viewers, new_followers)
      VALUES (${record.campaign_creator_id}, ${record.tanggal}, ${record.gmv || 0},
              ${record.unit_sold || 0}, ${record.views || 0}, ${record.likes || 0},
              ${record.comments || 0}, ${record.shares || 0}, ${record.unique_viewers || 0},
              ${record.new_followers || 0})
      RETURNING *
    `) as any[];
    return { success: true, data };
  } catch (err: any) {
    console.error('Error adding daily performance:', err);
    return { success: false, error: err.message };
  }
}

export async function updateDailyPerformanceAction(id: number, updates: any) {
  const denied = await requireRoleOrError('finance', 'manager', 'executive', 'admin');
  if (denied) return { success: false, error: denied.message } as any;
  try {
    const [data] = await db.execute(sql`
      UPDATE daily_performance SET
        gmv = COALESCE(${updates.gmv ?? null}, gmv),
        unit_sold = COALESCE(${updates.unit_sold ?? null}, unit_sold),
        views = COALESCE(${updates.views ?? null}, views),
        likes = COALESCE(${updates.likes ?? null}, likes),
        comments = COALESCE(${updates.comments ?? null}, comments),
        shares = COALESCE(${updates.shares ?? null}, shares),
        unique_viewers = COALESCE(${updates.unique_viewers ?? null}, unique_viewers),
        new_followers = COALESCE(${updates.new_followers ?? null}, new_followers)
      WHERE id = ${id}
      RETURNING *
    `) as any[];
    return { success: true, data };
  } catch (err: any) {
    console.error('Error updating daily performance:', err);
    return { success: false, error: err.message };
  }
}

// ============================================================
// SKU
// ============================================================
export async function updateSkuAction(id: number, updates: any) {
  const denied = await requireUserOrError();
  if (denied) return { success: false, error: denied.message } as any;
  try {
    const [data] = await db.execute(sql`
      UPDATE skus SET
        nama_produk = COALESCE(${updates.nama_produk ?? null}, nama_produk),
        product_id = COALESCE(${updates.product_id ?? null}, product_id),
        komisi = COALESCE(${updates.komisi ?? null}, komisi),
        link = CASE WHEN ${updates.link !== undefined} THEN ${updates.link ?? null} ELSE link END
      WHERE id = ${id}
      RETURNING *
    `) as any[];
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ============================================================
// SEARCH CREATORS (for SearchableSelect)
// ============================================================
export async function searchCreatorsAction(searchTerm: string) {
  const denied = await requireUserOrError();
  if (denied) return { success: false, error: denied.message } as any;
  try {
    const fuzzyPattern = '%' + searchTerm.split('').join('%') + '%';
    const data = await db.execute(sql`
      SELECT id, username FROM creators WHERE username ILIKE ${fuzzyPattern} LIMIT 20
    `) as any[];
    return { success: true, data: data || [] };
  } catch (err: any) {
    return { success: false, data: [], error: err.message };
  }
}

// ============================================================
// CAMPAIGN PAGE DATA FETCHERS
// ============================================================
export async function fetchCampaignCreatorsAction(campaignId: number) {
  const denied = await requireUserOrError();
  if (denied) return { success: false, error: denied.message } as any;
  try {
    const data = await db.execute(sql`
      SELECT cc.*, c.username, c.nama_lengkap, c.platform, c.tipe_konten AS creator_tipe_konten, c.status AS creator_status
      FROM campaign_creators cc
      LEFT JOIN creators c ON cc.creator_id = c.id
      WHERE cc.campaign_id = ${campaignId}
      ORDER BY cc.id DESC
    `) as any[];
    return { success: true, data: data || [] };
  } catch (err: any) {
    return { success: false, data: [], error: err.message };
  }
}

export async function fetchCampaignFullDataAction(campaignId: number) {
  const denied = await requireUserOrError();
  if (denied) return { success: false, error: denied.message } as any;
  try {
    const [ccData, videoData, snapshotData, contactData, noteData, nicheData, paymentData, creatorData] = await Promise.all([
      db.execute(sql`SELECT * FROM campaign_creators WHERE campaign_id = ${campaignId} ORDER BY id DESC`) as Promise<any[]>,
      db.execute(sql`SELECT v.* FROM videos v JOIN campaign_creators cc ON v.campaign_creator_id = cc.id WHERE cc.campaign_id = ${campaignId}`) as Promise<any[]>,
      db.execute(sql`SELECT cs.* FROM creator_snapshots cs JOIN campaign_creators cc ON cs.creator_id = cc.creator_id WHERE cc.campaign_id = ${campaignId}`) as Promise<any[]>,
      db.execute(sql`SELECT ct.* FROM creator_contacts ct JOIN campaign_creators cc ON ct.creator_id = cc.creator_id WHERE cc.campaign_id = ${campaignId}`) as Promise<any[]>,
      db.execute(sql`SELECT cn.* FROM creator_notes cn JOIN campaign_creators cc ON cn.creator_id = cc.creator_id WHERE cc.campaign_id = ${campaignId}`) as Promise<any[]>,
      db.execute(sql`SELECT cni.* FROM creator_niches cni JOIN campaign_creators cc ON cni.creator_id = cc.creator_id WHERE cc.campaign_id = ${campaignId}`) as Promise<any[]>,
      db.execute(sql`SELECT cp.* FROM creator_payments cp JOIN campaign_creators cc ON cp.campaign_creator_id = cc.id WHERE cc.campaign_id = ${campaignId}`) as Promise<any[]>,
      db.execute(sql`SELECT DISTINCT c.* FROM creators c JOIN campaign_creators cc ON c.id = cc.creator_id WHERE cc.campaign_id = ${campaignId}`) as Promise<any[]>,
    ]);

    return {
      success: true,
      campaign_creators: ccData || [],
      videos: videoData || [],
      creator_snapshots: snapshotData || [],
      creator_contacts: contactData || [],
      creator_notes: noteData || [],
      creator_niches: nicheData || [],
      creator_payments: paymentData || [],
      creators: creatorData || [],
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function fetchDailyPerformanceAction(campaignId: number) {
  const denied = await requireUserOrError();
  if (denied) return { success: false, error: denied.message } as any;
  try {
    const data = await db.execute(sql`
      SELECT dp.* FROM daily_performance dp
      JOIN campaign_creators cc ON dp.campaign_creator_id = cc.id
      WHERE cc.campaign_id = ${campaignId}
      ORDER BY dp.tanggal DESC
    `) as any[];
    return { success: true, data: data || [] };
  } catch (err: any) {
    return { success: false, data: [], error: err.message };
  }
}

export async function fetchLiveSessionsAction(campaignId: number) {
  const denied = await requireUserOrError();
  if (denied) return { success: false, error: denied.message } as any;
  try {
    const [sessions, products] = await Promise.all([
      db.execute(sql`
        SELECT ls.* FROM live_sessions ls
        JOIN campaign_creators cc ON ls.campaign_creator_id = cc.id
        WHERE cc.campaign_id = ${campaignId}
        ORDER BY ls.tanggal_live DESC
      `) as Promise<any[]>,
      db.execute(sql`
        SELECT lsp.* FROM live_session_products lsp
        JOIN live_sessions ls ON lsp.live_session_id = ls.id
        JOIN campaign_creators cc ON ls.campaign_creator_id = cc.id
        WHERE cc.campaign_id = ${campaignId}
      `) as Promise<any[]>,
    ]);
    return { success: true, sessions: sessions || [], products: products || [] };
  } catch (err: any) {
    return { success: false, sessions: [], products: [], error: err.message };
  }
}

export async function fetchPerformaDataAction(campaignId: number) {
  const denied = await requireUserOrError();
  if (denied) return { success: false, error: denied.message } as any;
  try {
    const [sales, organicVideos] = await Promise.all([
      db.execute(sql`
        SELECT s.* FROM sales s
        JOIN campaign_creators cc ON s.campaign_creator_id = cc.id
        WHERE cc.campaign_id = ${campaignId}
      `) as Promise<any[]>,
      db.execute(sql`
        SELECT ov.* FROM organic_videos ov
        JOIN campaign_creators cc ON ov.campaign_creator_id = cc.id
        WHERE cc.campaign_id = ${campaignId}
      `) as Promise<any[]>,
    ]);
    return { success: true, sales: sales || [], organicVideos: organicVideos || [] };
  } catch (err: any) {
    return { success: false, sales: [], organicVideos: [], error: err.message };
  }
}

// ============================================================
// REPORTING
// ============================================================
export async function fetchReportingDataAction(campaignId: number) {
  const denied = await requireUserOrError();
  if (denied) return { success: false, error: denied.message } as any;
  try {
    const data = await db.execute(sql`
      SELECT 
        cc.id as cc_id, cc.campaign_id, cc.creator_id, cc.price, cc.approval, cc.slot,
        c.username,
        cs.followers, cs.gmv_30d,
        v.id as video_id, v.link as video_link, v.vt_approval
      FROM campaign_creators cc
      LEFT JOIN creators c ON cc.creator_id = c.id
      LEFT JOIN LATERAL (
        SELECT * FROM creator_snapshots WHERE creator_id = cc.creator_id ORDER BY tanggal_update DESC LIMIT 1
      ) cs ON true
      LEFT JOIN videos v ON v.campaign_creator_id = cc.id
      WHERE cc.campaign_id = ${campaignId}
    `) as any[];
    return { success: true, data: data || [] };
  } catch (err: any) {
    return { success: false, data: [], error: err.message };
  }
}

// ============================================================
// CAMPAIGN SYNC (for CampaignSyncModal)
// ============================================================
export async function fetchCampaignSyncListingDbAction(campaignId: number) {
  const denied = await requireUserOrError();
  if (denied) return { success: false, error: denied.message } as any;
  try {
    const data = await db.execute(sql`
      SELECT 
        cc.id, cc.creator_id, cc.price, cc.slot, cc.tipe_konten, cc.status_bayar, cc.approval,
        c.username as creator_username
      FROM campaign_creators cc
      LEFT JOIN creators c ON cc.creator_id = c.id
      WHERE cc.campaign_id = ${campaignId}
    `) as any[];

    const formatted = (data || []).map(r => ({
      id: r.id,
      creator_id: r.creator_id,
      price: r.price,
      slot: r.slot,
      tipe_konten: r.tipe_konten,
      status_bayar: r.status_bayar,
      approval: r.approval,
      creators: {
        username: r.creator_username
      }
    }));

    return { success: true, data: formatted };
  } catch (err: any) {
    return { success: false, data: [], error: err.message };
  }
}

export async function executeFullCampaignSyncAction(payload: {
  campaignId: number;
  syncMode: 'excel_acuan' | 'db_acuan' | 'update_tambah';
  previewRows: Array<{
    username: string;
    followers?: number | null;
    no_whatsapp?: string | null;
    ratecard?: number | null;
    qty_vt?: number;
    qty_live?: number;
    content_type?: string | null;
    level?: string | null;
    audience_age?: string | null;
    gmv_30d?: number | null;
    tier?: string | null;
    approval?: string;
    sample_progress?: string | null;
    notes_manager?: string | null;
    notes_pic?: string | null;
  }>;
}) {
  const { campaignId, syncMode, previewRows } = payload;
  const localErrorLog: Array<{ username: string; pesan_error: string; data_mentah?: any }> = [];

  const denied = await requireRoleOrError('manager', 'executive', 'admin');
  if (denied) return { success: false, error: denied.message } as any;
  try {
    const usernamesArray = Array.from(new Set(previewRows.map(p => p.username.trim().replace(/^@/, ''))));
    
    // 1. Fetch existing creators
    const existingCreators = await db.execute(sql`
      SELECT id, username FROM creators WHERE username IN (${sql.join(usernamesArray.map(u => sql`${u}`), sql`, `)})
    `) as any[];

    const creatorMap = new Map<string, number>();
    (existingCreators || []).forEach(c => creatorMap.set(c.username.toLowerCase(), c.id));

    // 2. Insert new creators if not db_acuan
    const missingUsernames = usernamesArray.filter(u => !creatorMap.has(u.toLowerCase()));
    if (missingUsernames.length > 0 && syncMode !== 'db_acuan') {
      for (const username of missingUsernames) {
        try {
          const [newC] = await db.execute(sql`
            INSERT INTO creators (username, platform, status)
            VALUES (${username}, 'tiktok', 'aktif')
            RETURNING id, username
          `) as any[];
          if (newC) {
            creatorMap.set(newC.username.toLowerCase(), newC.id);
          }
        } catch (cErr: any) {
          localErrorLog.push({ username, pesan_error: `Gagal insert kreator: ${cErr.message}` });
        }
      }
    }

    // 3. Snapshots and Contacts
    const nowStr = new Date().toISOString();
    for (const row of previewRows) {
      const cleanUsername = row.username.trim().replace(/^@/, '');
      const creatorId = creatorMap.get(cleanUsername.toLowerCase());
      if (!creatorId) continue;

      const hasSnapshotData = row.followers !== null || row.ratecard !== null || row.level !== null || row.audience_age !== null || row.gmv_30d !== null || row.tier !== null;
      if (hasSnapshotData) {
        let finalTier = row.tier || null;
        if (!finalTier && typeof row.followers === 'number') {
          if (row.followers < 10000) finalTier = 'Nano';
          else if (row.followers < 100000) finalTier = 'Micro';
          else if (row.followers < 500000) finalTier = 'Macro';
          else finalTier = 'Mega';
        }

        await db.execute(sql`
          INSERT INTO creator_snapshots (
            creator_id, followers, tier, level, audience_age, gmv_30d, ratecard, tanggal_update, updated_by
          ) VALUES (
            ${creatorId}, ${row.followers ?? null}, ${finalTier}, ${row.level ?? null},
            ${row.audience_age ?? null}, ${row.gmv_30d ?? null}, ${row.ratecard ?? null},
            ${nowStr}, 'Super Import Listing'
          )
        `).catch(err => {
          localErrorLog.push({ username: cleanUsername, pesan_error: `Gagal simpan snapshot: ${err.message}` });
        });
      }

      if (row.no_whatsapp) {
        await db.execute(sql`
          INSERT INTO creator_contacts (creator_id, nomor, status, tanggal_mulai)
          VALUES (${creatorId}, ${row.no_whatsapp}, 'aktif', ${nowStr.split('T')[0]})
        `).catch(() => {});
      }
    }

    // 4. Fetch existing campaign_creators
    const existingCcList = await db.execute(sql`
      SELECT id, creator_id, price, slot, tipe_konten, status_bayar, approval
      FROM campaign_creators
      WHERE campaign_id = ${campaignId}
    `) as any[];

    const existingCcMap = new Map<number, any>();
    (existingCcList || []).forEach(cc => existingCcMap.set(cc.creator_id, cc));

    // 5. Upsert / Insert campaign creators
    let updatedCount = 0;
    let insertedCount = 0;

    for (const row of previewRows) {
      const cleanUsername = row.username.trim().replace(/^@/, '');
      const creatorId = creatorMap.get(cleanUsername.toLowerCase());
      if (!creatorId) {
        if (syncMode !== 'db_acuan') {
          localErrorLog.push({ username: row.username, pesan_error: 'Creator ID tidak ditemukan' });
        }
        continue;
      }

      const existingCc = existingCcMap.get(creatorId);
      if (existingCc) {
        await db.execute(sql`
          UPDATE campaign_creators SET
            approval = COALESCE(${row.approval ?? null}, approval),
            notes_manager = CASE WHEN ${row.notes_manager !== undefined} THEN ${row.notes_manager ?? null} ELSE notes_manager END,
            notes_pic = CASE WHEN ${row.notes_pic !== undefined} THEN ${row.notes_pic ?? null} ELSE notes_pic END,
            sample_progress = COALESCE(${row.sample_progress ?? null}, sample_progress),
            slot = COALESCE(${row.qty_vt ?? null}, slot),
            tipe_konten = COALESCE(${row.content_type ?? null}, tipe_konten)
          WHERE id = ${existingCc.id}
        `);
        updatedCount++;
      } else if (syncMode !== 'db_acuan') {
        await db.execute(sql`
          INSERT INTO campaign_creators (
            campaign_id, creator_id, price, approval, notes_manager, notes_pic,
            sample_progress, client_approval, slot, tipe_konten, status_bayar
          ) VALUES (
            ${campaignId}, ${creatorId}, 0, ${row.approval || 'pending'},
            ${row.notes_manager || null}, ${row.notes_pic || null},
            ${row.sample_progress || 'Belum'}, 'not_required',
            ${row.qty_vt || 1}, ${row.content_type || null}, 'belum'
          )
        `);
        insertedCount++;
      }
    }

    // 6. Handle excel_acuan: remove or pending creators not in excel
    if (syncMode === 'excel_acuan') {
      const excelUsernamesSet = new Set(usernamesArray.map(u => u.toLowerCase()));
      const sisaCc = (existingCcList || []).filter(cc => {
        const u = Array.from(creatorMap.entries()).find(([_, id]) => id === cc.creator_id)?.[0];
        return u && !excelUsernamesSet.has(u);
      });

      if (sisaCc.length > 0) {
        const sisaIds = sisaCc.map(c => c.id);
        const videosWithCc = await db.execute(sql`
          SELECT DISTINCT campaign_creator_id FROM videos WHERE campaign_creator_id IN (${sql.join(sisaIds.map(id => sql`${id}`), sql`, `)})
        `) as any[];
        const hasVideoSet = new Set((videosWithCc || []).map(v => v.campaign_creator_id));

        const toDeleteIds = sisaIds.filter(id => !hasVideoSet.has(id));
        const toPendingIds = sisaIds.filter(id => hasVideoSet.has(id));

        if (toDeleteIds.length > 0) {
          await db.execute(sql`
            DELETE FROM campaign_creators WHERE id IN (${sql.join(toDeleteIds.map(id => sql`${id}`), sql`, `)})
          `);
        }
        if (toPendingIds.length > 0) {
          await db.execute(sql`
            UPDATE campaign_creators SET approval = 'pending' WHERE id IN (${sql.join(toPendingIds.map(id => sql`${id}`), sql`, `)})
          `);
        }
      }
    }

    revalidatePath(`/campaigns/${campaignId}/listing`);
    revalidatePath(`/campaigns`);
    return { success: true, updatedCount, insertedCount, errorLog: localErrorLog };
  } catch (err: any) {
    console.error('executeFullCampaignSyncAction error:', err);
    return { success: false, error: err.message, errorLog: localErrorLog };
  }
}


// ============================================================
// LIVE SYNC (for LiveSyncModal)
// ============================================================
export async function executeLiveSyncAction(
  campaignId: number,
  sessions: Array<any>
) {
  const denied = await requireRoleOrError('manager', 'executive', 'admin');
  if (denied) return { success: false, error: denied.message } as any;
  try {
    let insertedCount = 0;

    for (const session of sessions) {
      // Find the campaign_creator
      const ccRows = await db.execute(sql`
        SELECT id FROM campaign_creators WHERE campaign_id = ${campaignId} AND creator_id = ${session.creator_id} LIMIT 1
      `) as any[];

      if (ccRows.length === 0) continue;
      const ccId = ccRows[0].id;

      // Insert live session
      const [lsData] = await db.execute(sql`
        INSERT INTO live_sessions (campaign_creator_id, tanggal_live, jam_mulai, jam_selesai, total_viewers, peak_viewers, gmv, unit_sold, avg_watch_time, catatan)
        VALUES (${ccId}, ${session.tanggal_live}, ${session.jam_mulai || null}, ${session.jam_selesai || null},
                ${session.total_viewers || 0}, ${session.peak_viewers || 0}, ${session.gmv || 0},
                ${session.unit_sold || 0}, ${session.avg_watch_time || null}, ${session.catatan || null})
        RETURNING *
      `) as any[];

      // Insert live session products if provided
      if (lsData && session.products && session.products.length > 0) {
        for (const product of session.products) {
          await db.execute(sql`
            INSERT INTO live_session_products (live_session_id, sku_id, qty_sold, gmv)
            VALUES (${lsData.id}, ${product.sku_id}, ${product.qty_sold || 0}, ${product.gmv || 0})
          `);
        }
      }

      insertedCount++;
    }

    return { success: true, insertedCount };
  } catch (err: any) {
    console.error('Error in live sync:', err);
    return { success: false, error: err.message };
  }
}

// ============================================================
// PORTAL & ACCOUNT MANAGEMENT
// ============================================================
export async function fetchPortalDataAction(campaignId: number) {
  const denied = await requireUserOrError();
  if (denied) return { success: false, error: denied.message } as any;
  try {
    const [campaign, ccData, creators, skusData, salesData, videosData] = await Promise.all([
      db.execute(sql`SELECT c.*, b.nama as brand_nama FROM campaigns c LEFT JOIN brands b ON c.brand_id = b.id WHERE c.id = ${campaignId} LIMIT 1`) as Promise<any[]>,
      db.execute(sql`SELECT * FROM campaign_creators WHERE campaign_id = ${campaignId}`) as Promise<any[]>,
      db.execute(sql`SELECT DISTINCT cr.* FROM creators cr JOIN campaign_creators cc ON cr.id = cc.creator_id WHERE cc.campaign_id = ${campaignId}`) as Promise<any[]>,
      db.execute(sql`SELECT * FROM skus WHERE campaign_id = ${campaignId}`) as Promise<any[]>,
      db.execute(sql`SELECT s.* FROM sales s JOIN campaign_creators cc ON s.campaign_creator_id = cc.id WHERE cc.campaign_id = ${campaignId}`) as Promise<any[]>,
      db.execute(sql`SELECT v.* FROM videos v JOIN campaign_creators cc ON v.campaign_creator_id = cc.id WHERE cc.campaign_id = ${campaignId}`) as Promise<any[]>,
    ]);
    return {
      success: true,
      campaign: campaign[0] || null,
      campaign_creators: ccData || [],
      creators: creators || [],
      skus: skusData || [],
      sales: salesData || [],
      videos: videosData || [],
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function fetchAllProfilesAction() {
  const denied = await requireUserOrError();
  if (denied) return { success: false, error: denied.message } as any;
  try {
    const data = await db.execute(sql`SELECT * FROM profiles ORDER BY id`) as any[];
    return { success: true, data: data || [] };
  } catch (err: any) {
    return { success: false, data: [], error: err.message };
  }
}

/**
 * Ubah profil user lain (role / nama / status).
 *
 * SEBELUMNYA: fungsi ini tanpa cek auth sama sekali. Siapa pun yang punya
 * session bisa memanggilnya dan membuat dirinya sendiri jadi admin.
 * Ditutup 30 Sep 2026.
 *
 * Hanya manager / executive / admin yang boleh. Mengubah `role` adalah
 * operasi yang mengunci fitur untuk orang lain, jadi tidak boleh tersedia
 * untuk staff.
 *
 * Catatan: nama kolomnya `nama`, bukan `full_name`. Versi lama memakai
 * `full_name` yang tidak ada di tabel — jadi selalu gagal diam-diam
 * karena tidak ada UI yang memanggil fungsi ini.
 */
export async function updateProfileAction(id: string, updates: any) {
  try {
    await requireRole('manager', 'executive', 'admin');
  } catch (err: any) {
    return { success: false, error: err?.message ?? 'Akses ditolak.' };
  }

  try {
    // Cegah admin mengunci dirinya sendiri keluar dengan mencabut role-nya,
    // kalau dia orang terakhir yang punya role tersebut.
    const roleChanges = Boolean(updates?.role);
    if (roleChanges) {
      const current = (await db.execute(sql`
        SELECT role FROM profiles WHERE id = ${id} LIMIT 1
      `)) as unknown as Array<{ role: string }>;

      if (current.length === 0) {
        return { success: false, error: 'Profil tidak ditemukan.' };
      }

      const oldRole = current[0].role;
      if (oldRole !== updates.role) {
        const remaining = (await db.execute(sql`
          SELECT count(*)::int AS c FROM profiles WHERE role = ${oldRole} AND status IS DISTINCT FROM 'disabled'
        `)) as unknown as Array<{ c: number }>;

        if ((remaining[0]?.c ?? 0) <= 1) {
          return {
            success: false,
            error: `Tidak bisa diubah: ini satu-satunya user dengan role "${oldRole}".`,
          };
        }
      }
    }

    await db.execute(sql`
      UPDATE profiles SET
        role = COALESCE(${updates.role ?? null}, role),
        nama = COALESCE(${updates.full_name ?? updates.nama ?? null}, nama),
        status = COALESCE(${updates.status ?? null}, status)
      WHERE id = ${id}
    `);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function fetchUserCampaignsAction(userId: string) {
  const denied = await requireUserOrError();
  if (denied) return { success: false, error: denied.message } as any;
  try {
    const data = await db.execute(sql`SELECT * FROM user_campaigns WHERE user_id = ${userId}::uuid`) as any[];
    return { success: true, data: data || [] };
  } catch (err: any) {
    return { success: false, data: [], error: err.message };
  }
}

export async function updateUserCampaignsAction(userId: string, campaignIds: number[], allCampaigns: boolean) {
  const denied = await requireRoleOrError('manager', 'executive', 'admin');
  if (denied) return { success: false, error: denied.message } as any;
  try {
    // Delete existing
    await db.execute(sql`DELETE FROM user_campaigns WHERE user_id = ${userId}::uuid`);
    // Insert new
    if (allCampaigns) {
      await db.execute(sql`
        INSERT INTO user_campaigns (user_id, all_campaigns) VALUES (${userId}::uuid, true)
      `);
    } else if (campaignIds.length > 0) {
      for (const cid of campaignIds) {
        await db.execute(sql`
          INSERT INTO user_campaigns (user_id, campaign_id, all_campaigns) VALUES (${userId}::uuid, ${Number(cid)}, false)
        `);
      }
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ============================================================
// CREATOR POOL DETAIL
// ============================================================
export async function fetchCreatorDetailAction(creatorId: number) {
  const denied = await requireUserOrError();
  if (denied) return { success: false, error: denied.message } as any;
  try {
    const [creator, snapshots, contacts, notes, niches, campaignCreators] = await Promise.all([
      db.execute(sql`SELECT * FROM creators WHERE id = ${creatorId} LIMIT 1`) as Promise<any[]>,
      db.execute(sql`SELECT * FROM creator_snapshots WHERE creator_id = ${creatorId} ORDER BY tanggal_update DESC`) as Promise<any[]>,
      db.execute(sql`SELECT * FROM creator_contacts WHERE creator_id = ${creatorId} ORDER BY id DESC`) as Promise<any[]>,
      db.execute(sql`SELECT * FROM creator_notes WHERE creator_id = ${creatorId} ORDER BY created_at DESC`) as Promise<any[]>,
      db.execute(sql`SELECT * FROM creator_niches WHERE creator_id = ${creatorId}`) as Promise<any[]>,
      db.execute(sql`SELECT cc.*, cam.nama as campaign_nama FROM campaign_creators cc LEFT JOIN campaigns cam ON cc.campaign_id = cam.id WHERE cc.creator_id = ${creatorId} ORDER BY cc.id DESC`) as Promise<any[]>,
    ]);
    return {
      success: true,
      creator: creator[0] || null,
      snapshots: snapshots || [],
      contacts: contacts || [],
      notes: notes || [],
      niches: niches || [],
      campaignCreators: campaignCreators || [],
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
