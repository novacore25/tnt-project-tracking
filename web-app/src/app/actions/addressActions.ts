'use server';

import { db, sqlInList } from '@/db';
import { sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function fetchCampaignAddressesAction(campaignId: number) {
  const rows = await db.execute(sql`
    SELECT 
      ca.*,
      cc.creator_id,
      cr.username as creator_username,
      cr.nama_asli as creator_nama_asli,
      (SELECT nomor FROM creator_contacts WHERE creator_id = cc.creator_id AND status = 'aktif' LIMIT 1) as creator_phone
    FROM creator_addresses ca
    JOIN campaign_creators cc ON ca.campaign_creator_id = cc.id
    JOIN creators cr ON cc.creator_id = cr.id
    WHERE cc.campaign_id = ${campaignId}
    ORDER BY ca.id DESC
  `);

  return (rows as unknown as any[]) || [];
}

export async function fetchCampaignCreatorsForAddressAction(campaignId: number, requireClientApproval?: boolean) {
  let query = sql`
    SELECT 
      cc.id,
      cc.campaign_id,
      cc.creator_id,
      cc.approval,
      cc.client_approval,
      cc.assigned_sku_ids,
      json_build_object(
        'id', cr.id,
        'username', cr.username,
        'nama_asli', cr.nama_asli,
        'alamat_penerima', cr.alamat_penerima,
        'alamat_jalan', cr.alamat_jalan,
        'alamat_provinsi', cr.alamat_provinsi,
        'alamat_kota', cr.alamat_kota,
        'alamat_kecamatan', cr.alamat_kecamatan,
        'alamat_kodepos', cr.alamat_kodepos,
        'creator_contacts', COALESCE(
          (
            SELECT json_agg(json_build_object('nomor', cco.nomor, 'status', cco.status) ORDER BY cco.id DESC)
            FROM creator_contacts cco
            WHERE cco.creator_id = cr.id
          ),
          '[]'::json
        )
      ) as creators
    FROM campaign_creators cc
    JOIN creators cr ON cc.creator_id = cr.id
    WHERE cc.campaign_id = ${campaignId}
      AND LOWER(cc.approval) IN ('approved', 'approve')
  `;

  if (requireClientApproval) {
    query = sql`${query} AND LOWER(cc.client_approval) IN ('approved', 'not_required', 'approve')`;
  }

  query = sql`${query} ORDER BY cc.id ASC`;

  const rows = await db.execute(query);
  return (rows as unknown as any[]) || [];
}

export async function fetchCreatorAddressBookAction(creatorId: number) {
  const rows = await db.execute(sql`
    SELECT * FROM creator_address_book
    WHERE creator_id = ${creatorId}
    ORDER BY is_primary DESC, id DESC
  `);
  return (rows as unknown as any[]) || [];
}

export async function updateCampaignAddressAction(
  addressId: number,
  data: any,
  creatorId?: number,
  whatsapp?: string
) {
  const sets: any[] = [];
  if (data.nama_penerima !== undefined) sets.push(sql`nama_penerima = ${data.nama_penerima}`);
  if (data.nomor_telepon !== undefined) sets.push(sql`nomor_telepon = ${data.nomor_telepon}`);
  if (data.alamat_lengkap !== undefined) sets.push(sql`alamat_lengkap = ${data.alamat_lengkap}`);
  if (data.nama_jalan !== undefined) sets.push(sql`nama_jalan = ${data.nama_jalan}`);
  if (data.provinsi !== undefined) sets.push(sql`provinsi = ${data.provinsi}`);
  if (data.kabupaten_kota !== undefined) sets.push(sql`kabupaten_kota = ${data.kabupaten_kota}`);
  if (data.kota !== undefined) sets.push(sql`kota = ${data.kota}`);
  if (data.kecamatan !== undefined) sets.push(sql`kecamatan = ${data.kecamatan}`);
  if (data.kelurahan !== undefined) sets.push(sql`kelurahan = ${data.kelurahan}`);
  if (data.kode_pos !== undefined) sets.push(sql`kode_pos = ${data.kode_pos}`);
  if (data.ekspedisi !== undefined) sets.push(sql`ekspedisi = ${data.ekspedisi}`);
  if (data.nomor_resi !== undefined) sets.push(sql`nomor_resi = ${data.nomor_resi}`);
  if (data.resi !== undefined) sets.push(sql`resi = ${data.resi}`);
  if (data.resi_updated_at !== undefined) sets.push(sql`resi_updated_at = ${data.resi_updated_at}`);
  if (data.resi_updated_by !== undefined) sets.push(sql`resi_updated_by = ${data.resi_updated_by}`);
  if (data.proses !== undefined) sets.push(sql`proses = ${data.proses}`);
  if (data.tanggal_kirim !== undefined) sets.push(sql`tanggal_kirim = ${data.tanggal_kirim}`);
  if (data.sku_dikirim !== undefined) sets.push(sql`sku_dikirim = ${data.sku_dikirim}`);
  if (data.notes !== undefined) sets.push(sql`notes = ${data.notes}`);
  if (data.catatan !== undefined) sets.push(sql`catatan = ${data.catatan}`);
  if (data.is_cancel !== undefined) sets.push(sql`is_cancel = ${data.is_cancel}`);

  if (sets.length > 0) {
    await db.execute(sql`
      UPDATE creator_addresses
      SET ${sql.join(sets, sql`, `)}
      WHERE id = ${addressId}
    `);
  }

  if (creatorId && whatsapp) {
    await db.execute(sql`UPDATE creator_contacts SET status = 'arsip' WHERE creator_id = ${creatorId} AND status = 'aktif'`);
    await db.execute(sql`
      INSERT INTO creator_contacts (creator_id, nomor, status, tanggal_mulai)
      VALUES (${creatorId}, ${whatsapp}, 'aktif', CURRENT_DATE)
    `);
  }
}

export async function saveAddressDetailsAction(params: {
  campaignCreatorId: number;
  existingAddressId?: number | null;
  formData: any;
  assignedSkuIds?: number[];
  whatsapp?: string;
  creatorId?: number;
  saveToBook?: boolean;
  campaignName?: string;
}) {
  const { campaignCreatorId, existingAddressId, formData, assignedSkuIds, whatsapp, creatorId, saveToBook, campaignName } = params;

  let addressId = existingAddressId;

  if (addressId && addressId > 0) {
    const sets: any[] = [];
    if (formData.nama_penerima !== undefined) sets.push(sql`nama_penerima = ${formData.nama_penerima}`);
    if (formData.nama_jalan !== undefined) sets.push(sql`nama_jalan = ${formData.nama_jalan}`);
    if (formData.kecamatan !== undefined) sets.push(sql`kecamatan = ${formData.kecamatan}`);
    if (formData.kelurahan !== undefined) sets.push(sql`kelurahan = ${formData.kelurahan}`);
    if (formData.kabupaten_kota !== undefined) sets.push(sql`kabupaten_kota = ${formData.kabupaten_kota}`);
    if (formData.provinsi !== undefined) sets.push(sql`provinsi = ${formData.provinsi}`);
    if (formData.kode_pos !== undefined) sets.push(sql`kode_pos = ${formData.kode_pos}`);
    if (formData.proses !== undefined) sets.push(sql`proses = ${formData.proses}`);
    if (formData.resi !== undefined) sets.push(sql`resi = ${formData.resi}`);
    if (formData.resi_updated_at !== undefined) sets.push(sql`resi_updated_at = ${formData.resi_updated_at}`);
    if (formData.resi_updated_by !== undefined) sets.push(sql`resi_updated_by = ${formData.resi_updated_by}`);
    if (formData.ekspedisi !== undefined) sets.push(sql`ekspedisi = ${formData.ekspedisi}`);
    if (formData.notes !== undefined) sets.push(sql`notes = ${formData.notes}`);
    if (formData.tanggal_kirim !== undefined) sets.push(sql`tanggal_kirim = ${formData.tanggal_kirim}`);

    if (sets.length > 0) {
      await db.execute(sql`
        UPDATE creator_addresses
        SET ${sql.join(sets, sql`, `)}
        WHERE id = ${addressId}
      `);
    }
  } else {
    const insertRes = await db.execute(sql`
      INSERT INTO creator_addresses (
        campaign_creator_id, nama_penerima, nama_jalan, kecamatan, kelurahan,
        kabupaten_kota, provinsi, kode_pos, proses, resi, ekspedisi, notes, tanggal_kirim
      ) VALUES (
        ${campaignCreatorId},
        ${formData.nama_penerima || ''},
        ${formData.nama_jalan || ''},
        ${formData.kecamatan || ''},
        ${formData.kelurahan || ''},
        ${formData.kabupaten_kota || ''},
        ${formData.provinsi || ''},
        ${formData.kode_pos || ''},
        ${formData.proses || 'Belum diproses'},
        ${formData.resi || ''},
        ${formData.ekspedisi || ''},
        ${formData.notes || ''},
        ${formData.tanggal_kirim || null}
      )
      RETURNING id
    `);
    addressId = (insertRes as any[])[0]?.id;
  }

  // Update assigned_sku_ids if provided
  if (assignedSkuIds !== undefined) {
    const jsonSkus = JSON.stringify(assignedSkuIds);
    await db.execute(sql`
      UPDATE campaign_creators
      SET assigned_sku_ids = ${jsonSkus}::jsonb
      WHERE id = ${campaignCreatorId}
    `);
  }

  // Update WhatsApp
  if (creatorId && whatsapp) {
    let cleanWa = whatsapp.replace(/\D/g, '');
    if (cleanWa.startsWith('62')) cleanWa = '0' + cleanWa.substring(2);
    else if (cleanWa.startsWith('8')) cleanWa = '0' + cleanWa;

    if (cleanWa) {
      await db.execute(sql`UPDATE creator_contacts SET status = 'arsip' WHERE creator_id = ${creatorId} AND status = 'aktif'`);
      await db.execute(sql`
        INSERT INTO creator_contacts (creator_id, nomor, status, tanggal_mulai)
        VALUES (${creatorId}, ${cleanWa}, 'aktif', CURRENT_DATE)
      `);
    }
  }

  // Auto-save to address book
  if (saveToBook && creatorId && formData.nama_jalan) {
    const exists = await db.execute(sql`
      SELECT id FROM creator_address_book 
      WHERE creator_id = ${creatorId} AND LOWER(alamat_jalan) = LOWER(${formData.nama_jalan})
      LIMIT 1
    `);
    if ((exists as any[]).length === 0) {
      await db.execute(sql`
        INSERT INTO creator_address_book (
          creator_id, label, nama_penerima, alamat_jalan, kecamatan, kota, provinsi, kodepos
        ) VALUES (
          ${creatorId},
          ${'Alamat Campaign ' + (campaignName || '')},
          ${formData.nama_penerima || ''},
          ${formData.nama_jalan || ''},
          ${formData.kecamatan || ''},
          ${formData.kabupaten_kota || ''},
          ${formData.provinsi || ''},
          ${formData.kode_pos || ''}
        )
      `);
    }
  }

  return { success: true, addressId };
}

export async function syncMissingCampaignAddressesAction(campaignId: number) {
  const rows = await db.execute(sql`
    SELECT cc.id as cc_id, cc.creator_id, cr.username, cr.nama_asli,
      cr.alamat_penerima, cr.alamat_jalan, cr.alamat_provinsi, cr.alamat_kota,
      cr.alamat_kecamatan, cr.alamat_kodepos
    FROM campaign_creators cc
    JOIN creators cr ON cc.creator_id = cr.id
    WHERE cc.campaign_id = ${campaignId}
      AND LOWER(cc.approval) IN ('approved', 'approve')
      AND NOT EXISTS (
        SELECT 1 FROM creator_addresses ca WHERE ca.campaign_creator_id = cc.id
      )
  `);

  const missing = rows as any[];
  if (missing.length === 0) return { inserted: 0 };

  let inserted = 0;
  for (const cc of missing) {
    const bookRows = await db.execute(sql`
      SELECT * FROM creator_address_book 
      WHERE creator_id = ${cc.creator_id}
      ORDER BY is_primary DESC, id DESC 
      LIMIT 1
    `);
    const book = (bookRows as any[])[0];

    const contactRows = await db.execute(sql`
      SELECT nomor FROM creator_contacts WHERE creator_id = ${cc.creator_id} AND status = 'aktif' LIMIT 1
    `);
    const phone = (contactRows as any[])[0]?.nomor || '';

    const namaPenerima = book?.nama_penerima || cc.alamat_penerima || cc.nama_asli || cc.username;
    const alamatJalan = book?.alamat_jalan || cc.alamat_jalan || '';
    const provinsi = book?.provinsi || cc.alamat_provinsi || '';
    const kota = book?.kota || cc.alamat_kota || '';
    const kecamatan = book?.kecamatan || cc.alamat_kecamatan || '';
    const kodepos = book?.kodepos || cc.alamat_kodepos || '';

    if (alamatJalan || namaPenerima) {
      await db.execute(sql`
        INSERT INTO creator_addresses (
          campaign_creator_id, nama_penerima, nomor_telepon, alamat_lengkap, nama_jalan,
          provinsi, kabupaten_kota, kecamatan, kelurahan, kode_pos, proses
        ) VALUES (
          ${cc.cc_id},
          ${namaPenerima},
          ${book?.nomor_telepon || phone},
          ${alamatJalan},
          ${alamatJalan},
          ${provinsi},
          ${kota},
          ${kecamatan},
          '',
          ${kodepos},
          'Belum diproses'
        )
      `);
      inserted++;
    }
  }

  return { inserted };
}

export async function bulkAutoDetectAddressCreatorsAction(campaignId: number, usernames: string[]) {
  const cleanUsernames = usernames.map(u => u.replace(/^@/, '').trim().toLowerCase()).filter(Boolean);
  if (cleanUsernames.length === 0) return [];

  const rows = await db.execute(sql`
    SELECT cc.id as cc_id, cr.id as creator_id, cr.username
    FROM campaign_creators cc
    JOIN creators cr ON cc.creator_id = cr.id
    WHERE cc.campaign_id = ${campaignId}
      AND LOWER(cr.username) IN ${sqlInList(cleanUsernames)}
  `);

  return (rows as unknown as any[]) || [];
}

export async function importSpreadsheetAddressesAction(campaignId: number, campaignName: string, rows: any[]) {
  let successCount = 0;
  let failCount = 0;

  for (const row of rows) {
    if (!row.ccId) continue;
    try {
      const existingRows = await db.execute(sql`
        SELECT id, resi FROM creator_addresses WHERE campaign_creator_id = ${row.ccId} LIMIT 1
      `);
      const existing = (existingRows as any[])[0];

      const resiUpdated = row.resi && (!existing || existing.resi !== row.resi);

      if (existing) {
        await db.execute(sql`
          UPDATE creator_addresses
          SET 
            nama_penerima = COALESCE(${row.nama_penerima || null}, nama_penerima),
            nama_jalan = COALESCE(${row.nama_jalan || null}, nama_jalan),
            provinsi = COALESCE(${row.provinsi || null}, provinsi),
            kabupaten_kota = COALESCE(${row.kabupaten_kota || null}, kabupaten_kota),
            kecamatan = COALESCE(${row.kecamatan || null}, kecamatan),
            kelurahan = COALESCE(${row.kelurahan || null}, kelurahan),
            kode_pos = COALESCE(${row.kode_pos || null}, kode_pos),
            tanggal_kirim = COALESCE(${row.tanggal_kirim || null}, tanggal_kirim),
            resi = COALESCE(${row.resi || null}, resi),
            ekspedisi = COALESCE(${row.ekspedisi || null}, ekspedisi),
            notes = COALESCE(${row.notes || null}, notes),
            proses = COALESCE(${row.proses || null}, proses),
            resi_updated_at = ${resiUpdated ? new Date().toISOString() : sql`resi_updated_at`},
            resi_updated_by = ${resiUpdated ? 'Internal TNT' : sql`resi_updated_by`}
          WHERE id = ${existing.id}
        `);
      } else {
        await db.execute(sql`
          INSERT INTO creator_addresses (
            campaign_creator_id, nama_penerima, nama_jalan, provinsi, kabupaten_kota,
            kecamatan, kelurahan, kode_pos, tanggal_kirim, resi, ekspedisi, notes, proses,
            resi_updated_at, resi_updated_by
          ) VALUES (
            ${row.ccId},
            ${row.nama_penerima || ''},
            ${row.nama_jalan || ''},
            ${row.provinsi || ''},
            ${row.kabupaten_kota || ''},
            ${row.kecamatan || ''},
            ${row.kelurahan || ''},
            ${row.kode_pos || ''},
            ${row.tanggal_kirim || null},
            ${row.resi || ''},
            ${row.ekspedisi || ''},
            ${row.notes || ''},
            ${row.proses || 'Belum diproses'},
            ${resiUpdated ? new Date().toISOString() : null},
            ${resiUpdated ? 'Internal TNT' : null}
          )
        `);
      }

      // Address book check
      if (row.nama_jalan && row.creatorId) {
        const bookExists = await db.execute(sql`
          SELECT id FROM creator_address_book 
          WHERE creator_id = ${row.creatorId} AND LOWER(alamat_jalan) = LOWER(${row.nama_jalan})
          LIMIT 1
        `);
        if ((bookExists as any[]).length === 0) {
          await db.execute(sql`
            INSERT INTO creator_address_book (
              creator_id, label, nama_penerima, alamat_jalan, provinsi, kota, kecamatan, kodepos
            ) VALUES (
              ${row.creatorId},
              ${`Alamat Campaign ${campaignName || ''}`},
              ${row.nama_penerima || ''},
              ${row.nama_jalan || ''},
              ${row.provinsi || ''},
              ${row.kabupaten_kota || ''},
              ${row.kecamatan || ''},
              ${row.kode_pos || ''}
            )
          `);
        }
      }

      // Contact check
      if (row.whatsapp && row.creatorId) {
        let cleanWa = row.whatsapp.replace(/\D/g, '');
        if (cleanWa.startsWith('62')) cleanWa = '0' + cleanWa.substring(2);
        else if (cleanWa.startsWith('8')) cleanWa = '0' + cleanWa;

        if (cleanWa) {
          const contactExists = await db.execute(sql`
            SELECT id FROM creator_contacts WHERE creator_id = ${row.creatorId} AND nomor = ${cleanWa} LIMIT 1
          `);
          if ((contactExists as any[]).length === 0) {
            await db.execute(sql`UPDATE creator_contacts SET status = 'arsip' WHERE creator_id = ${row.creatorId} AND status = 'aktif'`);
            await db.execute(sql`
              INSERT INTO creator_contacts (creator_id, nomor, status, tanggal_mulai)
              VALUES (${row.creatorId}, ${cleanWa}, 'aktif', CURRENT_DATE)
            `);
          }
        }
      }

      successCount++;
    } catch (err) {
      console.error('Import error for row:', row, err);
      failCount++;
    }
  }

  revalidatePath(`/campaigns/${campaignId}/alamat`);
  return { success: true, successCount, failCount };
}

export async function syncAddressBatchAction(campaignId: number, previewRows: any[], skipUsernames: string[]) {
  const skipSet = new Set(skipUsernames.map(u => u.toLowerCase().replace(/^@/, '')));
  const errorLog: any[] = [];
  let processed = 0;

  // 1. Fetch SKUs for campaign
  const skuRows = await db.execute(sql`SELECT id, nama_produk FROM skus WHERE campaign_id = ${campaignId}`);
  const campaignSkus = (skuRows as any[]) || [];

  // 2. Fetch existing campaign_creators
  const ccRows = await db.execute(sql`
    SELECT cc.id as cc_id, cc.creator_id, LOWER(cr.username) as username
    FROM campaign_creators cc
    JOIN creators cr ON cc.creator_id = cr.id
    WHERE cc.campaign_id = ${campaignId}
  `);
  const usernameToCcMap = new Map<string, { cc_id: number; creator_id: number }>();
  (ccRows as any[]).forEach(r => usernameToCcMap.set(r.username, { cc_id: r.cc_id, creator_id: r.creator_id }));

  // 3. Process each row
  for (const row of previewRows) {
    const rawUsername = (row.username || '').trim();
    const cleanUsername = rawUsername.toLowerCase().replace(/^@/, '');
    if (!cleanUsername) continue;

    if (skipSet.has(cleanUsername)) {
      errorLog.push({ username: rawUsername, pesan_error: 'Kreator dilewati (skip)', data_mentah: row });
      continue;
    }

    try {
      let ccData = usernameToCcMap.get(cleanUsername);

      // If not in campaign, find creator in DB or create creator
      if (!ccData) {
        const creatorRows = await db.execute(sql`
          SELECT id FROM creators WHERE LOWER(username) = ${cleanUsername} LIMIT 1
        `);
        let creatorId = (creatorRows as any[])[0]?.id;

        if (!creatorId) {
          const newCreatorRes = await db.execute(sql`
            INSERT INTO creators (username, link_account)
            VALUES (${rawUsername}, ${`https://tiktok.com/@${cleanUsername}`})
            RETURNING id
          `);
          creatorId = (newCreatorRes as any[])[0]?.id;
        }

        if (!creatorId) {
          errorLog.push({ username: rawUsername, pesan_error: 'Gagal membuat kreator baru di database', data_mentah: row });
          continue;
        }

        // Insert into campaign_creators
        const newCcRes = await db.execute(sql`
          INSERT INTO campaign_creators (
            campaign_id, creator_id, approval, client_approval, status_bayar, qty_vt, price
          ) VALUES (
            ${campaignId}, ${creatorId}, 'pending', 'not_required', 'belum', 1, 0
          )
          RETURNING id
        `);
        const newCcId = (newCcRes as any[])[0]?.id;
        if (!newCcId) {
          errorLog.push({ username: rawUsername, pesan_error: 'Gagal menambahkan kreator ke campaign', data_mentah: row });
          continue;
        }

        ccData = { cc_id: newCcId, creator_id: creatorId };
        usernameToCcMap.set(cleanUsername, ccData);
      }

      // Upsert into creator_addresses
      const existingAddrRows = await db.execute(sql`
        SELECT id FROM creator_addresses WHERE campaign_creator_id = ${ccData.cc_id} LIMIT 1
      `);
      const existingAddr = (existingAddrRows as any[])[0];

      if (existingAddr) {
        await db.execute(sql`
          UPDATE creator_addresses
          SET 
            nama_penerima = COALESCE(${row.nama_penerima || null}, nama_penerima),
            nama_jalan = COALESCE(${row.nama_jalan || null}, nama_jalan),
            kecamatan = COALESCE(${row.kecamatan || null}, kecamatan),
            kelurahan = COALESCE(${row.kelurahan || null}, kelurahan),
            kabupaten_kota = COALESCE(${row.kabupaten_kota || null}, kabupaten_kota),
            provinsi = COALESCE(${row.provinsi || null}, provinsi),
            kode_pos = COALESCE(${row.kode_pos || null}, kode_pos),
            resi = COALESCE(${row.resi || null}, resi),
            proses = COALESCE(${row.proses || null}, proses),
            tanggal_kirim = COALESCE(${row.tanggal_kirim || null}, tanggal_kirim),
            ekspedisi = COALESCE(${row.ekspedisi || null}, ekspedisi),
            notes = COALESCE(${row.notes || null}, notes)
          WHERE id = ${existingAddr.id}
        `);
      } else {
        await db.execute(sql`
          INSERT INTO creator_addresses (
            campaign_creator_id, nama_penerima, nama_jalan, kecamatan, kelurahan,
            kabupaten_kota, provinsi, kode_pos, resi, proses, tanggal_kirim, ekspedisi, notes
          ) VALUES (
            ${ccData.cc_id},
            ${row.nama_penerima || ''},
            ${row.nama_jalan || ''},
            ${row.kecamatan || ''},
            ${row.kelurahan || ''},
            ${row.kabupaten_kota || ''},
            ${row.provinsi || ''},
            ${row.kode_pos || ''},
            ${row.resi || ''},
            ${row.proses || 'Belum diproses'},
            ${row.tanggal_kirim || null},
            ${row.ekspedisi || ''},
            ${row.notes || ''}
          )
        `);
      }

      // Product/SKU match
      if (row.produk) {
        const inputSkus = row.produk.split(',').map((p: string) => p.trim().toLowerCase()).filter(Boolean);
        const matchedSkuIds: number[] = [];
        inputSkus.forEach((skuName: string) => {
          const match = campaignSkus.find(s => s.nama_produk.toLowerCase().includes(skuName) || skuName.includes(s.nama_produk.toLowerCase()));
          if (match) matchedSkuIds.push(match.id);
        });

        if (matchedSkuIds.length > 0) {
          const jsonSkus = JSON.stringify(matchedSkuIds);
          await db.execute(sql`
            UPDATE campaign_creators
            SET assigned_sku_ids = ${jsonSkus}::jsonb
            WHERE id = ${ccData.cc_id}
          `);
        }
      }

      processed++;
    } catch (err: any) {
      console.error('Error syncing address row:', row, err);
      errorLog.push({ username: rawUsername, pesan_error: err?.message || 'Error executing sync', data_mentah: row });
    }
  }

  revalidatePath(`/campaigns/${campaignId}/alamat`);
  return { success: true, processed, errorLog };
}
