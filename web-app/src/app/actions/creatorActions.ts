'use server';

import { db, sqlInList } from '@/db';
import { sql } from 'drizzle-orm';
import { auth } from '@/auth';
import { revalidatePath } from 'next/cache';

export async function searchCreatorUsernames(query: string) {
  const trimmed = query.trim().replace(/\s+/g, '').replace(/^@/, '');
  if (!trimmed) return [];

  const fuzzyPattern = '%' + trimmed.split('').join('%') + '%';
  const rows = await db.execute(sql`
    SELECT username 
    FROM creators 
    WHERE username ILIKE ${fuzzyPattern}
    ORDER BY LENGTH(username) ASC
    LIMIT 10
  `);

  return (rows as any[]).map((r: any) => r.username);
}

export async function fetchStaffProfiles() {
  const rows = await db.execute(sql`
    SELECT id, nama, role 
    FROM profiles 
    ORDER BY nama ASC
  `);
  return (rows as unknown as any[]) || [];
}

export async function fetchCreatorsPaginated(params: {
  pageNum: number;
  pageSize?: number;
  search?: string;
  filterCampaign?: string;
  filterNiche?: string;
  filterTier?: string;
  filterLevel?: string;
  filterAddedBy?: string;
  filterLastUpdatedBy?: string;
}) {
  const {
    pageNum,
    pageSize = 48,
    search = '',
    filterCampaign = '',
    filterNiche = '',
    filterTier = '',
    filterLevel = '',
    filterAddedBy = '',
    filterLastUpdatedBy = '',
  } = params;

  const offset = pageNum * pageSize;
  const whereConditions: any[] = [];

  if (search && search.trim()) {
    const s = `%${search.trim().replace(/^@/, '')}%`;
    whereConditions.push(sql`(cr.username ILIKE ${s} OR cr.nama_asli ILIKE ${s})`);
  }

  if (filterAddedBy) {
    whereConditions.push(sql`cr.added_by = ${filterAddedBy}`);
  }

  if (filterLastUpdatedBy) {
    whereConditions.push(sql`cr.last_updated_by = ${filterLastUpdatedBy}`);
  }

  if (filterCampaign) {
    whereConditions.push(sql`EXISTS (
      SELECT 1 FROM campaign_creators cc 
      WHERE cc.creator_id = cr.id AND cc.campaign_id = ${Number(filterCampaign)}
    )`);
  }

  if (filterNiche) {
    whereConditions.push(sql`EXISTS (
      SELECT 1 FROM creator_niches cn 
      WHERE cn.creator_id = cr.id AND cn.niche_id = ${Number(filterNiche)}
    )`);
  }

  if (filterTier) {
    const t = `%${filterTier}%`;
    whereConditions.push(sql`EXISTS (
      SELECT 1 FROM creator_snapshots cs 
      WHERE cs.creator_id = cr.id AND cs.tier ILIKE ${t}
    )`);
  }

  if (filterLevel) {
    whereConditions.push(sql`EXISTS (
      SELECT 1 FROM creator_snapshots cs 
      WHERE cs.creator_id = cr.id AND cs.level = ${Number(filterLevel)}
    )`);
  }

  const whereClause = whereConditions.length > 0
    ? sql`WHERE ${sql.join(whereConditions, sql` AND `)}`
    : sql``;

  const [rows, countRes] = await Promise.all([
    db.execute(sql`
      SELECT 
        cr.id, cr.username, cr.nama_asli, cr.link_account, cr.created_at, cr.added_by, cr.last_updated_by,
        (
          SELECT json_agg(json_build_object(
            'id', cs.id, 'audience_age', cs.audience_age, 'level', cs.level,
            'tanggal_update', cs.tanggal_update, 'followers', cs.followers, 'tier', cs.tier
          ) ORDER BY cs.tanggal_update DESC, cs.id DESC)
          FROM creator_snapshots cs
          WHERE cs.creator_id = cr.id
        ) as creator_snapshots,
        (
          SELECT json_agg(json_build_object('niche_id', cn.niche_id))
          FROM creator_niches cn
          WHERE cn.creator_id = cr.id
        ) as creator_niches,
        (
          SELECT json_agg(json_build_object('campaign_id', cc.campaign_id))
          FROM campaign_creators cc
          WHERE cc.creator_id = cr.id
        ) as campaign_creators
      FROM creators cr
      ${whereClause}
      ORDER BY cr.id DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `),
    db.execute(sql`
      SELECT COUNT(*)::int as count 
      FROM creators cr 
      ${whereClause}
    `)
  ]);

  const total = (countRes as any[])[0]?.count || 0;
  return {
    data: (rows as unknown as any[]) || [],
    total,
    hasMore: offset + pageSize < total,
  };
}

export async function fetchCreatorProfile(creatorId: number) {
  const crRows = await db.execute(sql`SELECT * FROM creators WHERE id = ${creatorId}`);
  const creator = (crRows as any[])[0];
  if (!creator) return null;

  const aliasRows = await db.execute(sql`
    SELECT LOWER(alias_username) as alias, alias_username, is_primary, notes 
    FROM creator_aliases 
    WHERE creator_id = ${creatorId}
  `).catch(() => []) as any[];

  const aliasList = (aliasRows as any[]).map(a => a.alias).filter(Boolean);
  if (!aliasList.includes(creator.username.toLowerCase())) {
    aliasList.push(creator.username.toLowerCase());
  }

  const matchingCreatorRows = await db.execute(sql`
    SELECT id FROM creators WHERE id = ${creatorId} OR LOWER(username) IN ${sqlInList(aliasList)}
  `).catch(() => []) as any[];
  const associatedCreatorIds = Array.from(new Set([
    creatorId,
    ...(matchingCreatorRows as any[]).map(r => Number(r.id)).filter(n => !isNaN(n))
  ]));

  const [
    snapshots,
    contacts,
    creatorNiches,
    notes,
    ccs,
    ads,
    addressBook,
    auditLogs,
    liveSessions,
    organicVideos,
    sales,
  ] = await Promise.all([
    db.execute(sql`SELECT * FROM creator_snapshots WHERE creator_id IN ${sqlInList(associatedCreatorIds)} ORDER BY tanggal_update DESC, id DESC`).catch(() => []),
    db.execute(sql`SELECT * FROM creator_contacts WHERE creator_id IN ${sqlInList(associatedCreatorIds)} ORDER BY id ASC`).catch(() => []),
    db.execute(sql`SELECT * FROM creator_niches WHERE creator_id IN ${sqlInList(associatedCreatorIds)} ORDER BY peringkat ASC`).catch(() => []),
    db.execute(sql`SELECT * FROM creator_notes WHERE creator_id IN ${sqlInList(associatedCreatorIds)} ORDER BY created_at DESC`).catch(() => []),
    db.execute(sql`SELECT * FROM campaign_creators WHERE creator_id IN ${sqlInList(associatedCreatorIds)} ORDER BY created_at DESC`).catch(() => []),
    db.execute(sql`SELECT * FROM ads_performance WHERE creator_id IN ${sqlInList(associatedCreatorIds)} ORDER BY tanggal DESC`).catch(() => []),
    db.execute(sql`SELECT * FROM creator_address_book WHERE creator_id IN ${sqlInList(associatedCreatorIds)} ORDER BY id DESC`).catch(() => []),
    db.execute(sql`SELECT * FROM audit_logs WHERE table_name = 'creators' AND record_id = ${creatorId.toString()} ORDER BY created_at DESC LIMIT 100`).catch(() => []),
    // organic_videos memuat satu baris per (content_uid, tanggal import). Video
    // yang sama bisa muncul puluhan baris (terverifikasi 1 Okt 2026: satu
    // content_uid punya 70 baris). Tanpa dedup, tab "Data Video Organik" di
    // profil kreator menampilkan video yang sama berulang-ulang.
    //
    // `video_views`/`video_likes` bersifat KUMULATIF (snapshot total, bukan
    // delta harian) - 70 baris untuk satu video semuanya punya nilai identik.
    // Jadi ambil baris terbaru per content_uid.
    db.execute(sql`
      SELECT DISTINCT ON (content_uid) *
      FROM organic_videos
      WHERE LOWER(creator_username) IN ${sqlInList(aliasList)}
      ORDER BY content_uid, created_at DESC, id DESC
    `).catch((err) => {
      console.error('fetchCreatorProfile: query organic_videos gagal:', err);
      return [];
    }),

    // live_sessions juga didedup per ruang live, alasan yang sama.
    db.execute(sql`
      SELECT DISTINCT ON (livestream_room_id) *
      FROM live_sessions
      WHERE LOWER(creator_username) IN ${sqlInList(aliasList)}
      ORDER BY livestream_room_id, start_time DESC, id DESC
    `).catch((err) => {
      console.error('fetchCreatorProfile: query live_sessions gagal:', err);
      return [];
    }),

    // Catatan: kolom yang dipakai urut adalah `tanggal`, bukan `order_time`.
    // Tabel `sales` tidak punya kolom `order_time` (lihat migration
    // 20260610000001_phase_2.sql), jadi ORDER BY order_time selalu error dan
    // hasil query ini kosong. Error sengaja dicatat, tidak lagi diam-diam.
    db.execute(sql`
      SELECT * FROM sales
      WHERE LOWER(creator_username) IN ${sqlInList(aliasList)}
      ORDER BY tanggal DESC
      LIMIT 5000
    `).catch((err) => {
      console.error('fetchCreatorProfile: query sales gagal untuk creator', creatorId, err);
      return [];
    }),
  ]);

  const ccList = (ccs as unknown as any[]) || [];
  let videos: any[] = [];
  if (ccList.length > 0) {
    const ccIds = ccList.map(c => c.id);
    const vRows = await db.execute(sql`SELECT * FROM videos WHERE campaign_creator_id IN ${sqlInList(ccIds)}`).catch(() => []);
    videos = (vRows as unknown as any[]) || [];
  }

  const liveList = (liveSessions as unknown as any[]) || [];
  let liveProducts: any[] = [];
  if (liveList.length > 0) {
    const roomIds = liveList.map(l => l.livestream_room_id).filter(Boolean);
    if (roomIds.length > 0) {
      const lpRows = await db.execute(sql`SELECT * FROM live_session_products WHERE livestream_room_id IN ${sqlInList(roomIds)}`).catch(() => []);
      liveProducts = (lpRows as unknown as any[]) || [];
    }
  }

  return {
    creator,
    aliases: (aliasRows as any[]) || [],
    snapshots: (snapshots as unknown as any[]) || [],
    contacts: (contacts as unknown as any[]) || [],
    creatorNiches: (creatorNiches as unknown as any[]) || [],
    notes: (notes as unknown as any[]) || [],
    ccs: ccList,
    videos,
    sales: (sales as unknown as any[]) || [],
    ads: (ads as unknown as any[]) || [],
    addressBook: (addressBook as unknown as any[]) || [],
    auditLogs: (auditLogs as unknown as any[]) || [],
    liveSessions: liveList,
    liveProducts,
    organicVideos: (organicVideos as unknown as any[]) || [],
  };
}

export async function addCreatorFull(formData: {
  username: string;
  nama?: string;
  followers?: string;
  level?: string;
  gmv_30d?: string;
  niche?: string;
  whatsapp?: string;
  email?: string;
  ratecard?: string;
}) {
  const session = await auth();
  const profileId = session?.user?.id;

  const username = formData.username.trim().toLowerCase().replace(/^@/, '');
  const link_account = `https://www.tiktok.com/@${username}`;

  const cRows = await db.execute(sql`
    INSERT INTO creators (username, nama_asli, link_account, added_by, status)
    VALUES (${username}, ${formData.nama || username}, ${link_account}, ${profileId || null}, 'active')
    ON CONFLICT (lower(username)) DO UPDATE 
    SET 
      nama_asli = EXCLUDED.nama_asli,
      link_account = EXCLUDED.link_account,
      last_updated_by = ${profileId || null}
    RETURNING id
  `);

  const creatorId = (cRows as any[])[0]?.id;
  if (!creatorId) throw new Error('Gagal menyimpan creator');

  const followersNum = formData.followers ? parseInt(formData.followers.replace(/\D/g, '')) || null : null;
  let calculatedLevel = formData.level ? parseInt(formData.level.replace(/\D/g, '')) || null : null;

  if (!calculatedLevel && followersNum) {
    if (followersNum < 10000) calculatedLevel = 1;
    else if (followersNum < 100000) calculatedLevel = 2;
    else if (followersNum < 500000) calculatedLevel = 3;
    else if (followersNum < 1000000) calculatedLevel = 4;
    else calculatedLevel = 5;
  }

  await db.execute(sql`
    INSERT INTO creator_snapshots (creator_id, followers, level, gmv_30d, ratecard, tanggal_update)
    VALUES (
      ${creatorId},
      ${followersNum},
      ${calculatedLevel},
      ${formData.gmv_30d ? parseInt(formData.gmv_30d.replace(/\D/g, '')) || null : null},
      ${formData.ratecard ? parseInt(formData.ratecard.replace(/\D/g, '')) || null : null},
      CURRENT_DATE
    )
  `);

  if (formData.whatsapp) {
    await db.execute(sql`DELETE FROM creator_contacts WHERE creator_id = ${creatorId}`);
    await db.execute(sql`
      INSERT INTO creator_contacts (creator_id, nomor, status, tanggal_mulai)
      VALUES (${creatorId}, ${formData.whatsapp}, 'aktif', CURRENT_DATE)
    `);
  }

  if (formData.niche) {
    const nichesArray = formData.niche.split(',').map(n => n.trim()).filter(Boolean);
    await db.execute(sql`DELETE FROM creator_niches WHERE creator_id = ${creatorId}`);
    for (const [idx, nicheName] of nichesArray.entries()) {
      const nRows = await db.execute(sql`
        INSERT INTO niches (nama) VALUES (${nicheName})
        ON CONFLICT (nama) DO UPDATE SET nama = EXCLUDED.nama
        RETURNING id
      `);
      const nicheId = (nRows as any[])[0]?.id;
      if (nicheId) {
        await db.execute(sql`
          INSERT INTO creator_niches (creator_id, niche_id, peringkat)
          VALUES (${creatorId}, ${nicheId}, ${idx + 1})
          ON CONFLICT DO NOTHING
        `);
      }
    }
  }

  revalidatePath('/creator-pool');
  return creatorId;
}

export async function updateCreatorMaster(creatorId: number, updateData: any) {
  const session = await auth();
  const profileId = session?.user?.id;

  const sets: any[] = [];
  if (updateData.nama_asli !== undefined) sets.push(sql`nama_asli = ${updateData.nama_asli}`);
  if (updateData.nik !== undefined) sets.push(sql`nik = ${updateData.nik}`);
  if (updateData.alamat_ktp !== undefined) sets.push(sql`alamat_ktp = ${updateData.alamat_ktp}`);
  if (updateData.link_ktp !== undefined) sets.push(sql`link_ktp = ${updateData.link_ktp}`);
  if (updateData.link_kontrak !== undefined) sets.push(sql`link_kontrak = ${updateData.link_kontrak}`);
  if (updateData.nama_wa_pic !== undefined) sets.push(sql`nama_wa_pic = ${updateData.nama_wa_pic}`);
  if (updateData.nomor_wa_dealing !== undefined) sets.push(sql`nomor_wa_dealing = ${updateData.nomor_wa_dealing}`);
  if (profileId) sets.push(sql`last_updated_by = ${profileId}`);

  if (sets.length > 0) {
    await db.execute(sql`
      UPDATE creators
      SET ${sql.join(sets, sql`, `)}
      WHERE id = ${creatorId}
    `);
  }

  revalidatePath(`/creator-pool/${creatorId}`);
}

export async function addCreatorSnapshot(creatorId: number, snapshot: any) {
  await db.execute(sql`
    INSERT INTO creator_snapshots (
      creator_id, followers, level, gmv_30d, gmv_30d_organic, gmv_30d_live, ratecard, tanggal_update, audience_age, tier
    ) VALUES (
      ${creatorId}, ${snapshot.followers || null}, ${snapshot.level || null}, ${snapshot.gmv_30d || null},
      ${snapshot.gmv_30d_organic || null}, ${snapshot.gmv_30d_live || null}, ${snapshot.ratecard || null},
      ${snapshot.tanggal_update || sql`CURRENT_DATE`}, ${snapshot.audience_age || null}, ${snapshot.tier || null}
    )
  `);
  revalidatePath(`/creator-pool/${creatorId}`);
}

export async function updateCreatorContact(creatorId: number, nomor: string) {
  await db.execute(sql`DELETE FROM creator_contacts WHERE creator_id = ${creatorId}`);
  await db.execute(sql`
    INSERT INTO creator_contacts (creator_id, nomor, status, tanggal_mulai)
    VALUES (${creatorId}, ${nomor}, 'aktif', CURRENT_DATE)
  `);
  revalidatePath(`/creator-pool/${creatorId}`);
}

export async function addCreatorNote(creatorId: number, isi: string, penulis: string) {
  await db.execute(sql`
    INSERT INTO creator_notes (creator_id, isi, penulis)
    VALUES (${creatorId}, ${isi}, ${penulis})
  `);
  revalidatePath(`/creator-pool/${creatorId}`);
}

export async function bulkImportCreatorsAction(creatorsList: any[]) {
  const session = await auth();
  const profileId = session?.user?.id;

  let insertedCount = 0;
  for (const item of creatorsList) {
    if (!item.username) continue;
    const username = item.username.trim().toLowerCase().replace(/^@/, '');
    const link_account = `https://www.tiktok.com/@${username}`;

    const cRes = await db.execute(sql`
      INSERT INTO creators (username, nama_asli, link_account, added_by, status)
      VALUES (${username}, ${item.nama || username}, ${link_account}, ${profileId || null}, 'active')
      ON CONFLICT (lower(username)) DO UPDATE 
      SET 
        nama_asli = COALESCE(EXCLUDED.nama_asli, creators.nama_asli),
        last_updated_by = ${profileId || null}
      RETURNING id
    `);

    const creatorId = (cRes as any[])[0]?.id;
    if (creatorId) {
      insertedCount++;
      if (item.followers || item.gmv_30d || item.ratecard || item.level) {
        await db.execute(sql`
          INSERT INTO creator_snapshots (
            creator_id, followers, gmv_30d, ratecard, level, catatan, updated_by
          ) VALUES (
            ${creatorId},
            ${item.followers ? Number(item.followers) : 0},
            ${item.gmv_30d ? Number(item.gmv_30d) : 0},
            ${item.ratecard ? Number(item.ratecard) : 0},
            ${item.level || null},
            ${item.catatan || null},
            ${profileId || null}
          )
        `);
      }
    }
  }

  revalidatePath('/creator-pool');
  return { success: true, count: insertedCount };
}

export async function verifySpreadsheetCreatorsAction(usernames: string[]) {
  if (!usernames || usernames.length === 0) return [];
  const cleanUsernames = usernames.map(u => u.trim().toLowerCase().replace(/^@/, ''));

  const rows = await db.execute(sql`
    SELECT 
      cr.id, cr.username, cr.added_by, cr.created_at, cr.last_updated_by, cr.last_updated_at,
      p_add.nama as adder_name,
      p_upd.nama as updater_name
    FROM creators cr
    LEFT JOIN profiles p_add ON cr.added_by = p_add.id
    LEFT JOIN profiles p_upd ON cr.last_updated_by = p_upd.id
    WHERE LOWER(cr.username) IN ${sqlInList(cleanUsernames)}
  `);

  return (rows as unknown as any[]) || [];
}

export async function executeSpreadsheetImportAction(rows: any[]) {
  const session = await auth();
  const profileId = session?.user?.id;

  let processed = 0;
  for (const r of rows) {
    if (!r.username) continue;
    const username = r.username.trim().toLowerCase().replace(/^@/, '');
    const link_account = `https://www.tiktok.com/@${username}`;

    const cRes = await db.execute(sql`
      INSERT INTO creators (username, nama_asli, link_account, added_by, status, mcn, avatar_url)
      VALUES (${username}, ${r.nama || username}, ${link_account}, ${profileId || null}, 'active', ${r.mcn || null}, ${r.avatar_url || null})
      ON CONFLICT (lower(username)) DO UPDATE 
      SET 
        mcn = COALESCE(EXCLUDED.mcn, creators.mcn),
        avatar_url = COALESCE(EXCLUDED.avatar_url, creators.avatar_url),
        last_updated_by = ${profileId || null},
        last_updated_at = NOW()
      RETURNING id
    `);

    const creatorId = (cRes as any[])[0]?.id;
    if (!creatorId) continue;
    processed++;

    const followersNum = r.followers ? parseInt(String(r.followers).replace(/\D/g, '')) || null : null;
    let calculatedLevel = r.level ? parseInt(String(r.level).replace(/\D/g, '')) || null : null;

    if (!calculatedLevel && followersNum) {
      if (followersNum < 10000) calculatedLevel = 1;
      else if (followersNum < 100000) calculatedLevel = 2;
      else if (followersNum < 500000) calculatedLevel = 3;
      else if (followersNum < 1000000) calculatedLevel = 4;
      else calculatedLevel = 5;
    }

    if (followersNum || calculatedLevel || r.gmv_30d || r.ratecard || r.audience_age) {
      await db.execute(sql`
        INSERT INTO creator_snapshots (creator_id, followers, level, gmv_30d, ratecard, audience_age, tanggal_update)
        VALUES (
          ${creatorId},
          ${followersNum},
          ${calculatedLevel},
          ${r.gmv_30d ? parseInt(String(r.gmv_30d).replace(/\D/g, '')) || null : null},
          ${r.ratecard ? parseInt(String(r.ratecard).replace(/\D/g, '')) || null : null},
          ${r.audience_age || null},
          CURRENT_DATE
        )
      `);
    }

    if (r.whatsapp) {
      await db.execute(sql`DELETE FROM creator_contacts WHERE creator_id = ${creatorId}`);
      await db.execute(sql`
        INSERT INTO creator_contacts (creator_id, nomor, status, tanggal_mulai)
        VALUES (${creatorId}, ${r.whatsapp}, 'aktif', CURRENT_DATE)
      `);
    }

    if (r.niche) {
      const nichesArray = String(r.niche).split(',').map(n => n.trim()).filter(Boolean);
      await db.execute(sql`DELETE FROM creator_niches WHERE creator_id = ${creatorId}`);
      for (const [idx, nicheName] of nichesArray.entries()) {
        const nRes = await db.execute(sql`
          INSERT INTO niches (nama) VALUES (${nicheName})
          ON CONFLICT (nama) DO UPDATE SET nama = EXCLUDED.nama
          RETURNING id
        `);
        const nicheId = (nRes as any[])[0]?.id;
        if (nicheId) {
          await db.execute(sql`
            INSERT INTO creator_niches (creator_id, niche_id, peringkat)
            VALUES (${creatorId}, ${nicheId}, ${idx + 1})
            ON CONFLICT DO NOTHING
          `);
        }
      }
    }
  }

  revalidatePath('/creator-pool');
  return { success: true, processed };
}

export async function bulkAutoDetectCreatorsAction(usernames: string[]) {
  if (!usernames || usernames.length === 0) return [];
  const cleanUsernames = usernames.map(u => u.trim().toLowerCase().replace(/^@/, ''));

  const rows = await db.execute(sql`
    SELECT 
      cr.id, cr.username,
      (
        SELECT json_agg(json_build_object('nomor', cc.nomor, 'status', cc.status))
        FROM creator_contacts cc WHERE cc.creator_id = cr.id
      ) as creator_contacts,
      (
        SELECT json_agg(json_build_object(
          'id', cs.id, 'ratecard', cs.ratecard, 'followers', cs.followers,
          'level', cs.level, 'audience_age', cs.audience_age, 'gmv_30d', cs.gmv_30d,
          'tanggal_update', cs.tanggal_update
        ) ORDER BY cs.id DESC)
        FROM creator_snapshots cs WHERE cs.creator_id = cr.id
      ) as creator_snapshots,
      (
        SELECT json_agg(json_build_object(
          'niche_id', cn.niche_id,
          'niches', json_build_object('nama', n.nama)
        ))
        FROM creator_niches cn
        JOIN niches n ON cn.niche_id = n.id
        WHERE cn.creator_id = cr.id
      ) as creator_niches
    FROM creators cr
    WHERE LOWER(cr.username) IN ${sqlInList(cleanUsernames)}
  `);

  return (rows as unknown as any[]) || [];
}

export async function addCreatorAliasAction(params: {
  creatorId: number;
  aliasUsername: string;
  notes?: string;
}) {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: 'Akses ditolak: Anda harus login terlebih dahulu.' };
  }

  const { creatorId, notes } = params;
  const cleanAlias = params.aliasUsername.trim().toLowerCase().replace(/^@/, '');
  if (!cleanAlias) {
    return { success: false, error: 'Username alias tidak boleh kosong.' };
  }

  // 1. Cek apakah kreator target ada
  const crRows = await db.execute(sql`SELECT id, username FROM creators WHERE id = ${creatorId}`);
  const targetCreator = (crRows as any[])[0];
  if (!targetCreator) {
    return { success: false, error: 'Kreator tidak ditemukan.' };
  }

  if (targetCreator.username.toLowerCase() === cleanAlias) {
    return { success: false, error: `@${cleanAlias} sudah merupakan username aktif kreator ini.` };
  }

  // 2. Cek apakah alias ini sudah terdaftar untuk kreator ini
  const existingAlias = await db.execute(sql`
    SELECT * FROM creator_aliases 
    WHERE creator_id = ${creatorId} AND LOWER(alias_username) = ${cleanAlias}
  `);
  if ((existingAlias as any[]).length > 0) {
    return { success: false, error: `@${cleanAlias} sudah terdaftar sebagai alias untuk kreator ini.` };
  }

  // 3. Cek apakah username ini terdaftar sebagai KREATOR LAIN di tabel creators
  const otherCreatorRows = await db.execute(sql`
    SELECT id, username FROM creators WHERE LOWER(username) = ${cleanAlias} AND id != ${creatorId}
  `);
  const otherCreator = (otherCreatorRows as any[])[0];

  if (otherCreator) {
    const otherId = Number(otherCreator.id);

    // Relocate campaign_creators
    const targetCcs = (await db.execute(sql`SELECT id, campaign_id, approval FROM campaign_creators WHERE creator_id = ${creatorId}`)) as any[];
    const targetCcsMap = new Map<number, any>();
    for (const cc of targetCcs) {
      targetCcsMap.set(Number(cc.campaign_id), cc);
    }

    const otherCcs = (await db.execute(sql`SELECT id, campaign_id, approval FROM campaign_creators WHERE creator_id = ${otherId}`)) as any[];
    for (const occ of otherCcs) {
      const campId = Number(occ.campaign_id);
      const match = targetCcsMap.get(campId);
      if (match) {
        // Pindahkan videos jika ada
        await db.execute(sql`UPDATE videos SET campaign_creator_id = ${match.id} WHERE campaign_creator_id = ${occ.id}`);
        // Jika baris kreator lain approved dan target belum approved, upgrade target
        if (occ.approval === 'approved' && match.approval !== 'approved') {
          await db.execute(sql`UPDATE campaign_creators SET approval = 'approved' WHERE id = ${match.id}`);
        }
        // Hapus baris duplikat dari kreator lama
        await db.execute(sql`DELETE FROM campaign_creators WHERE id = ${occ.id}`);
      } else {
        // Alihkan baris campaign_creator ke targetCreator
        await db.execute(sql`UPDATE campaign_creators SET creator_id = ${creatorId} WHERE id = ${occ.id}`);
      }
    }

    // Alihkan child tables
    await db.execute(sql`UPDATE creator_contacts SET creator_id = ${creatorId} WHERE creator_id = ${otherId}`);
    await db.execute(sql`UPDATE creator_snapshots SET creator_id = ${creatorId} WHERE creator_id = ${otherId}`);
    await db.execute(sql`UPDATE creator_niches SET creator_id = ${creatorId} WHERE creator_id = ${otherId}`);
    await db.execute(sql`UPDATE creator_notes SET creator_id = ${creatorId} WHERE creator_id = ${otherId}`);
    await db.execute(sql`UPDATE creator_address_book SET creator_id = ${creatorId} WHERE creator_id = ${otherId}`);
    await db.execute(sql`UPDATE ads_performance SET creator_id = ${creatorId} WHERE creator_id = ${otherId}`);
    await db.execute(sql`UPDATE ad_name_mapping SET creator_id = ${creatorId} WHERE creator_id = ${otherId}`).catch(() => {});
    await db.execute(sql`UPDATE ads_name_mappings SET creator_id = ${creatorId} WHERE creator_id = ${otherId}`).catch(() => {});
    await db.execute(sql`UPDATE creator_bank_accounts SET creator_id = ${creatorId} WHERE creator_id = ${otherId}`).catch(() => {});
    await db.execute(sql`UPDATE creator_aliases SET creator_id = ${creatorId}, is_primary = false WHERE creator_id = ${otherId}`);

    // Hapus record master kreator duplikat
    await db.execute(sql`DELETE FROM creators WHERE id = ${otherId}`);

    // Daftarkan/update alias di tabel creator_aliases
    await db.execute(sql`
      INSERT INTO creator_aliases (creator_id, alias_username, is_primary, notes)
      VALUES (${creatorId}, ${cleanAlias}, false, ${notes || 'Hasil penggabungan akun duplikat'})
      ON CONFLICT (alias_username) DO UPDATE
      SET creator_id = ${creatorId}, is_primary = false, notes = EXCLUDED.notes
    `);

    // Audit log
    await db.execute(sql`
      INSERT INTO audit_logs (user_name, action, table_name, record_id, description)
      VALUES (${session.user.name || session.user.email || 'System'}, 'MERGE_CREATOR_ALIAS', 'creators', ${creatorId.toString()},
              ${`Menggabungkan akun duplikat @${cleanAlias} (ID: ${otherId}) ke @${targetCreator.username} (ID: ${creatorId}) dan menjadikannya alias.`})
    `).catch(() => {});

    revalidatePath(`/creator-pool/${creatorId}`);
    revalidatePath('/creator-pool');
    return {
      success: true,
      message: `Akun @${cleanAlias} (ID ${otherId}) berhasil digabungkan ke akun ini beserta seluruh data campaign dan videonya.`,
    };
  }

  // 4. Jika bukan master kreator lain, cek apakah sudah jadi alias di kreator lain
  const otherAliasRows = await db.execute(sql`
    SELECT a.creator_id, c.username 
    FROM creator_aliases a 
    JOIN creators c ON a.creator_id = c.id 
    WHERE LOWER(a.alias_username) = ${cleanAlias} AND a.creator_id != ${creatorId}
  `);
  const otherAlias = (otherAliasRows as any[])[0];
  if (otherAlias) {
    return {
      success: false,
      error: `Username @${cleanAlias} sudah terdaftar sebagai alias milik kreator lain (@${otherAlias.username}).`,
    };
  }

  // 5. Simpan alias baru
  await db.execute(sql`
    INSERT INTO creator_aliases (creator_id, alias_username, is_primary, notes)
    VALUES (${creatorId}, ${cleanAlias}, false, ${notes || null})
    ON CONFLICT (alias_username) DO UPDATE
    SET creator_id = ${creatorId}, is_primary = false, notes = EXCLUDED.notes
  `);

  await db.execute(sql`
    INSERT INTO audit_logs (user_name, action, table_name, record_id, description)
    VALUES (${session.user.name || session.user.email || 'System'}, 'ADD_CREATOR_ALIAS', 'creator_aliases', ${creatorId.toString()},
            ${`Menambahkan alias @${cleanAlias} untuk kreator @${targetCreator.username}`})
  `).catch(() => {});

  revalidatePath(`/creator-pool/${creatorId}`);
  revalidatePath('/creator-pool');
  return { success: true, message: `Alias @${cleanAlias} berhasil ditambahkan.` };
}

export async function removeCreatorAliasAction(params: {
  creatorId: number;
  aliasUsername: string;
}) {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: 'Akses ditolak: Anda harus login.' };
  }

  const { creatorId } = params;
  const cleanAlias = params.aliasUsername.trim().toLowerCase().replace(/^@/, '');

  const row = await db.execute(sql`
    SELECT * FROM creator_aliases 
    WHERE creator_id = ${creatorId} AND LOWER(alias_username) = ${cleanAlias}
  `);
  const aliasRecord = (row as any[])[0];
  if (!aliasRecord) {
    return { success: false, error: 'Alias tidak ditemukan.' };
  }

  if (aliasRecord.is_primary) {
    return { success: false, error: 'Tidak bisa menghapus username utama. Ganti username utama terlebih dahulu jika diperlukan.' };
  }

  await db.execute(sql`
    DELETE FROM creator_aliases 
    WHERE creator_id = ${creatorId} AND LOWER(alias_username) = ${cleanAlias}
  `);

  await db.execute(sql`
    INSERT INTO audit_logs (user_name, action, table_name, record_id, description)
    VALUES (${session.user.name || session.user.email || 'System'}, 'DELETE_CREATOR_ALIAS', 'creator_aliases', ${creatorId.toString()},
            ${`Menghapus alias @${cleanAlias} dari kreator ID ${creatorId}`})
  `).catch(() => {});

  revalidatePath(`/creator-pool/${creatorId}`);
  return { success: true, message: `Alias @${cleanAlias} berhasil dihapus.` };
}

export async function setPrimaryCreatorAliasAction(params: {
  creatorId: number;
  aliasUsername: string;
}) {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: 'Akses ditolak: Anda harus login.' };
  }

  const { creatorId } = params;
  const cleanAlias = params.aliasUsername.trim().toLowerCase().replace(/^@/, '');

  const crRows = await db.execute(sql`SELECT id, username FROM creators WHERE id = ${creatorId}`);
  const targetCreator = (crRows as any[])[0];
  if (!targetCreator) {
    return { success: false, error: 'Kreator tidak ditemukan.' };
  }

  if (targetCreator.username.toLowerCase() === cleanAlias) {
    return { success: true, message: `@${cleanAlias} sudah merupakan username utama.` };
  }

  const link_account = `https://www.tiktok.com/@${cleanAlias}`;

  // 1. Jadikan semua alias saat ini non-primary
  await db.execute(sql`UPDATE creator_aliases SET is_primary = false WHERE creator_id = ${creatorId}`);

  // 2. Update master creators
  await db.execute(sql`
    UPDATE creators 
    SET username = ${cleanAlias}, link_account = ${link_account}, last_updated_at = NOW() 
    WHERE id = ${creatorId}
  `);

  // 3. Pastikan username baru terdaftar sebagai primary di creator_aliases
  await db.execute(sql`
    INSERT INTO creator_aliases (creator_id, alias_username, is_primary, notes)
    VALUES (${creatorId}, ${cleanAlias}, true, 'Username utama aktif')
    ON CONFLICT (alias_username) DO UPDATE
    SET creator_id = ${creatorId}, is_primary = true
  `);

  // 4. Pastikan username lama tetap tercatat sebagai alias non-primary
  await db.execute(sql`
    INSERT INTO creator_aliases (creator_id, alias_username, is_primary, notes)
    VALUES (${creatorId}, ${targetCreator.username}, false, 'Username sebelumnya')
    ON CONFLICT (alias_username) DO UPDATE
    SET creator_id = ${creatorId}, is_primary = false
  `);

  await db.execute(sql`
    INSERT INTO audit_logs (user_name, action, table_name, record_id, description)
    VALUES (${session.user.name || session.user.email || 'System'}, 'SET_PRIMARY_CREATOR_ALIAS', 'creators', ${creatorId.toString()},
            ${`Mengubah username utama dari @${targetCreator.username} menjadi @${cleanAlias}`})
  `).catch(() => {});

  revalidatePath(`/creator-pool/${creatorId}`);
  revalidatePath('/creator-pool');
  return { success: true, message: `Username utama berhasil diubah menjadi @${cleanAlias}.` };
}



