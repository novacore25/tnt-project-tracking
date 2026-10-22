'use server';

import { db, sqlInList } from '@/db';
import { sql } from 'drizzle-orm';
import { requireUser } from '@/lib/guards';
import { revalidatePath } from 'next/cache';

function getRomanMonth(m: number): string {
  const romans = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  return romans[m] || 'X';
}

function getInitials(name: string): string {
  if (!name) return 'TNT';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * 1. Ambil list kontrak (Bisa global atau difilter per campaignId)
 */
export async function fetchContractsAction(params?: {
  campaignId?: number;
  status?: string;
  search?: string;
}) {
  try {
    await requireUser();

    const conditions: any[] = [];
    if (params?.campaignId) {
      conditions.push(sql`ct.campaign_id = ${params.campaignId}`);
    }
    if (params?.status && params.status !== 'all') {
      conditions.push(sql`ct.status = ${params.status}`);
    }
    if (params?.search && params.search.trim() !== '') {
      const q = `%${params.search.trim()}%`;
      conditions.push(sql`(
        ct.nomor_kontrak ILIKE ${q} OR 
        c.username ILIKE ${q} OR 
        c.nama_lengkap ILIKE ${q} OR 
        c.nama_asli ILIKE ${q} OR
        cmp.nama ILIKE ${q}
      )`);
    }

    const whereClause = conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``;

    const rows = await db.execute(sql`
      SELECT 
        ct.*,
        c.username as creator_username,
        COALESCE(c.nama_lengkap, c.nama_asli, c.username) as creator_nama,
        cmp.nama as campaign_nama,
        b.nama as brand_nama
      FROM creator_contracts ct
      LEFT JOIN creators c ON ct.creator_id = c.id
      LEFT JOIN campaigns cmp ON ct.campaign_id = cmp.id
      LEFT JOIN brands b ON cmp.brand_id = b.id
      ${whereClause}
      ORDER BY 
        CASE WHEN ct.status = 'released' THEN 0 ELSE 1 END,
        ct.seq_number DESC NULLS LAST,
        ct.id DESC
      LIMIT 500
    `) as any[];

    return { success: true, data: rows };
  } catch (err: any) {
    console.error('fetchContractsAction error:', err);
    return { success: false, error: err.message, data: [] };
  }
}

/**
 * 2. Generate Draft Otomatis untuk Seluruh Kreator Approved di Campaign
 * (Auto-fill data identitas, bank, deliverables jika sudah ada)
 */
export async function autoGenerateApprovedCreatorDraftsAction(campaignId: number) {
  try {
    const { sessionUser, profile } = await requireUser();
    const picName = profile.fullName || sessionUser.email?.split('@')[0] || 'PIC TNT';
    const picId = profile.id;

    // Ambil data campaign & brand
    const campRows = await db.execute(sql`
      SELECT c.*, b.nama as brand_nama
      FROM campaigns c
      LEFT JOIN brands b ON c.brand_id = b.id
      WHERE c.id = ${campaignId}
      LIMIT 1
    `) as any[];

    if (!campRows || campRows.length === 0) {
      return { success: false, error: 'Campaign tidak ditemukan' };
    }
    const camp = campRows[0];
    const brandName = camp.brand_nama || 'Brand Partner';

    // Ambil semua kreator approved di campaign ini
    const ccRows = await db.execute(sql`
      SELECT 
        cc.id as cc_id,
        cc.campaign_id,
        cc.creator_id,
        cc.price,
        cc.qty_vt,
        cc.qty_live,
        cc.approval,
        c.username,
        COALESCE(
          NULLIF(c.nama_lengkap, ''),
          NULLIF(c.nama_asli, ''),
          (
            SELECT ci.nama_ktp FROM creator_identities ci 
            WHERE ci.creator_id = c.id AND ci.nama_ktp IS NOT NULL AND ci.nama_ktp != ''
            ORDER BY ci.is_primary DESC, ci.id DESC LIMIT 1
          ),
          (
            SELECT pi.nama_penerima FROM payment_items pi
            JOIN campaign_creators cc2 ON pi.campaign_creator_id = cc2.id
            WHERE cc2.creator_id = c.id AND pi.nama_penerima IS NOT NULL AND pi.nama_penerima != ''
            ORDER BY pi.id DESC LIMIT 1
          )
        ) as nama_lengkap,
        COALESCE(
          (
            SELECT ci.nik FROM creator_identities ci 
            WHERE ci.creator_id = c.id AND ci.nik IS NOT NULL AND ci.nik != ''
            ORDER BY ci.is_primary DESC, ci.id DESC LIMIT 1
          ),
          (
            SELECT pi.nik FROM payment_items pi
            JOIN campaign_creators cc2 ON pi.campaign_creator_id = cc2.id
            WHERE cc2.creator_id = c.id AND pi.nik IS NOT NULL AND pi.nik != ''
            ORDER BY pi.id DESC LIMIT 1
          ),
          NULLIF(c.nik, '')
        ) as nik_ktp,
        COALESCE(
          (
            SELECT ci.alamat_ktp FROM creator_identities ci 
            WHERE ci.creator_id = c.id AND ci.alamat_ktp IS NOT NULL AND ci.alamat_ktp != ''
            ORDER BY ci.is_primary DESC, ci.id DESC LIMIT 1
          ),
          (
            SELECT pi.alamat_ktp FROM payment_items pi
            JOIN campaign_creators cc2 ON pi.campaign_creator_id = cc2.id
            WHERE cc2.creator_id = c.id AND pi.alamat_ktp IS NOT NULL AND pi.alamat_ktp != ''
            ORDER BY pi.id DESC LIMIT 1
          ),
          NULLIF(c.alamat_ktp, '')
        ) as alamat_ktp,
        COALESCE(
          (
            SELECT ct.nomor FROM creator_contacts ct 
            WHERE ct.creator_id = c.id AND ct.status = 'aktif' AND ct.nomor IS NOT NULL AND ct.nomor != ''
            ORDER BY ct.id DESC LIMIT 1
          ),
          (
            SELECT cpc.nomor_wa FROM creator_pic_contacts cpc
            WHERE cpc.creator_id = c.id AND cpc.nomor_wa IS NOT NULL AND cpc.nomor_wa != ''
            ORDER BY cpc.is_primary DESC, cpc.id DESC LIMIT 1
          ),
          (
            SELECT pi.nomor_wa_dealing FROM payment_items pi
            JOIN campaign_creators cc2 ON pi.campaign_creator_id = cc2.id
            WHERE cc2.creator_id = c.id AND pi.nomor_wa_dealing IS NOT NULL AND pi.nomor_wa_dealing != ''
            ORDER BY pi.id DESC LIMIT 1
          ),
          NULLIF(c.nomor_wa_dealing, ''),
          NULLIF(c.no_whatsapp, '')
        ) as contact_nomor,
        COALESCE(
          (
            SELECT cb.bank_name FROM creator_bank_accounts cb 
            WHERE cb.creator_id = c.id AND cb.bank_name IS NOT NULL AND cb.bank_name != ''
            ORDER BY cb.is_primary DESC, cb.id ASC LIMIT 1
          ),
          (
            SELECT pi.metode_pembayaran FROM payment_items pi
            JOIN campaign_creators cc2 ON pi.campaign_creator_id = cc2.id
            WHERE cc2.creator_id = c.id AND pi.metode_pembayaran IS NOT NULL AND pi.metode_pembayaran != ''
            ORDER BY pi.id DESC LIMIT 1
          )
        ) as bank_name,
        COALESCE(
          (
            SELECT cb.account_number FROM creator_bank_accounts cb 
            WHERE cb.creator_id = c.id AND cb.account_number IS NOT NULL AND cb.account_number != ''
            ORDER BY cb.is_primary DESC, cb.id ASC LIMIT 1
          ),
          (
            SELECT pi.nomor_rekening FROM payment_items pi
            JOIN campaign_creators cc2 ON pi.campaign_creator_id = cc2.id
            WHERE cc2.creator_id = c.id AND pi.nomor_rekening IS NOT NULL AND pi.nomor_rekening != ''
            ORDER BY pi.id DESC LIMIT 1
          )
        ) as account_number,
        COALESCE(
          (
            SELECT cb.account_holder FROM creator_bank_accounts cb 
            WHERE cb.creator_id = c.id AND cb.account_holder IS NOT NULL AND cb.account_holder != ''
            ORDER BY cb.is_primary DESC, cb.id ASC LIMIT 1
          ),
          (
            SELECT pi.nama_penerima FROM payment_items pi
            JOIN campaign_creators cc2 ON pi.campaign_creator_id = cc2.id
            WHERE cc2.creator_id = c.id AND pi.nama_penerima IS NOT NULL AND pi.nama_penerima != ''
            ORDER BY pi.id DESC LIMIT 1
          )
        ) as account_holder,
        c.email,
        c.npwp,
        c.tempat_lahir,
        c.tanggal_lahir,
        c.tiktok_uid,
        COALESCE(c.status_binding, 'Non-Binding') as status_binding
      FROM campaign_creators cc
      JOIN creators c ON cc.creator_id = c.id
      WHERE cc.campaign_id = ${campaignId}
        AND LOWER(cc.approval) = 'approved'
      ORDER BY cc.id ASC
    `) as any[];

    if (ccRows.length === 0) {
      return { success: false, error: 'Belum ada kreator berstatus Approved di campaign ini.' };
    }

    const today = new Date();
    const curYear = today.getFullYear();
    const curRomanMonth = getRomanMonth(today.getMonth());
    const initialPic = getInitials(picName);

    let createdCount = 0;
    let existingCount = 0;

    for (const cc of ccRows) {
      // Cek apakah sudah ada kontrak untuk campaign_creator_id ini
      const exist = await db.execute(sql`
        SELECT id, status FROM creator_contracts 
        WHERE campaign_creator_id = ${cc.cc_id} OR (campaign_id = ${campaignId} AND creator_id = ${cc.creator_id})
        LIMIT 1
      `) as any[];

      if (exist.length > 0) {
        existingCount++;
        continue;
      }

      const creatorRealName = cc.nama_lengkap || cc.username;
      const creatorInitials = getInitials(creatorRealName);
      const draftNumber = `[DRAFT]/JC-TNT/${creatorInitials}/${curRomanMonth}/${curYear}`;
      const contractTitle = `Kontrak Join Campaign - @${cc.username} (${brandName})`;

      const initialContractData = {
        nomorKontrak: draftNumber,
        statusBinding: cc.status_binding?.toLowerCase().includes('binding') && !cc.status_binding?.toLowerCase().includes('non')
          ? 'KREATOR Binding'
          : 'KREATOR Non-Binding',
        namaPerusahaan: 'PT TNT KREATIF DIGITAL',
        alamatPerusahaan: 'Jalan Kavling Perkebunan Raya, RT 006 / RW 013, Panunggangan Barat, Kecamatan Cibodas, Kota Tangerang, Banten 15139',
        namaDirekturTNT: 'Stevani',
        jabatanDirekturTNT: 'Direktur',
        namaSignerTNT: 'Ruben Arianto',
        jabatanSignerTNT: 'Manajer Umum',
        namaPicTNT: picName,
        jabatanPicTNT: 'Project Manager',
        namaKreator: creatorRealName,
        usernameTikTok: cc.username,
        tiktokUid: cc.tiktok_uid || '',
        nikKtp: cc.nik_ktp || '',
        alamatKreator: cc.alamat_ktp || '',
        teleponKreator: cc.contact_nomor || '',
        emailKreator: cc.email || '',
        namaBank: cc.bank_name || '',
        nomorRekening: cc.account_number || '',
        atasNamaRekening: cc.account_holder || creatorRealName,
        namaCampaign: camp.nama,
        namaBrand: brandName,
        jenisCampaign: 'Fee',
        qtyVt: Number(cc.qty_vt) || 1,
        qtyPhotoSlide: 0,
        qtyLive: Number(cc.qty_live) || 0,
        biayaHonor: Number(cc.price) || 0,
        durasiKonten: '30 - 60',
        durasiKontenTerbilang: 'tiga puluh sampai enam puluh',
        skemaPembayaran: 'H+14 dari selesai Campaign sampai dengan H+21 dari selesai Campaign',
        catatanTambahan: '',
        tempatPerjanjian: 'Tangerang'
      };

      await db.execute(sql`
        INSERT INTO creator_contracts (
          creator_id,
          campaign_id,
          campaign_creator_id,
          judul_kontrak,
          link_kontrak,
          nomor_kontrak,
          status_binding,
          signer_name,
          signer_role,
          status,
          created_by_id,
          created_by_name,
          contract_data,
          created_at,
          updated_at
        ) VALUES (
          ${cc.creator_id},
          ${campaignId},
          ${cc.cc_id},
          ${contractTitle},
          ${`#draft-${cc.cc_id}`},
          ${draftNumber},
          ${initialContractData.statusBinding},
          ${'Ruben Arianto'},
          ${'Manajer Umum'},
          'draft',
          ${picId},
          ${picName},
          ${JSON.stringify(initialContractData)}::jsonb,
          now(),
          now()
        )
      `);
      createdCount++;
    }

    revalidatePath(`/campaigns/${campaignId}/dokumen`);
    revalidatePath('/dokumen');

    return { 
      success: true, 
      createdCount, 
      existingCount,
      message: `Berhasil membuat ${createdCount} draft kontrak otomatis untuk kreator yang approved.` 
    };
  } catch (err: any) {
    console.error('autoGenerateApprovedCreatorDraftsAction error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * 3. Simpan / Update Kontrak (Draft)
 */
export async function saveContractDraftAction(params: {
  contractId?: number;
  campaignId: number;
  creatorId: number;
  campaignCreatorId?: number;
  contractData: any;
}) {
  try {
    const { sessionUser, profile } = await requireUser();
    const picName = profile.fullName || sessionUser.email?.split('@')[0] || 'PIC TNT';
    const picId = profile.id;

    const { contractId, campaignId, creatorId, campaignCreatorId, contractData } = params;

    if (contractId) {
      // Pastikan belum released
      const check = await db.execute(sql`
        SELECT status FROM creator_contracts WHERE id = ${contractId} LIMIT 1
      `) as any[];
      if (check.length > 0 && check[0].status === 'released') {
        return { success: false, error: 'Dokumen sudah dirilis dan terkunci resmi. Tidak dapat diubah.' };
      }

      await db.execute(sql`
        UPDATE creator_contracts
        SET 
          status_binding = ${contractData.statusBinding || 'KREATOR Non-Binding'},
          signer_name = ${contractData.namaSignerTNT || 'Ruben Arianto'},
          signer_role = ${contractData.jabatanSignerTNT || 'Manajer Umum'},
          contract_data = ${JSON.stringify(contractData)}::jsonb,
          updated_at = now()
        WHERE id = ${contractId}
      `);

      revalidatePath(`/campaigns/${campaignId}/dokumen`);
      revalidatePath('/dokumen');
      return { success: true, contractId, message: 'Draft dokumen berhasil diperbarui.' };
    } else {
      // Buat baru
      const today = new Date();
      const curYear = today.getFullYear();
      const curRomanMonth = getRomanMonth(today.getMonth());
      const creatorInit = getInitials(contractData.namaKreator || 'TNT');
      const draftNumber = `[DRAFT]/JC-TNT/${creatorInit}/${curRomanMonth}/${curYear}`;
      const title = `Kontrak Join Campaign - ${contractData.namaKreator || 'Kreator'}`;

      const [inserted] = await db.execute(sql`
        INSERT INTO creator_contracts (
          creator_id,
          campaign_id,
          campaign_creator_id,
          judul_kontrak,
          link_kontrak,
          nomor_kontrak,
          status_binding,
          signer_name,
          signer_role,
          status,
          created_by_id,
          created_by_name,
          contract_data,
          created_at,
          updated_at
        ) VALUES (
          ${creatorId},
          ${campaignId},
          ${campaignCreatorId || null},
          ${title},
          ${`#draft-${Date.now()}`},
          ${draftNumber},
          ${contractData.statusBinding || 'KREATOR Non-Binding'},
          ${contractData.namaSignerTNT || 'Ruben Arianto'},
          ${contractData.jabatanSignerTNT || 'Manajer Umum'},
          'draft',
          ${picId},
          ${picName},
          ${JSON.stringify(contractData)}::jsonb,
          now(),
          now()
        )
        RETURNING id
      `) as any[];

      revalidatePath(`/campaigns/${campaignId}/dokumen`);
      revalidatePath('/dokumen');
      return { success: true, contractId: inserted.id, message: 'Draft dokumen baru berhasil disimpan.' };
    }
  } catch (err: any) {
    console.error('saveContractDraftAction error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * 4. RILIS DOKUMEN (Nomor Terkunci Global Terakhir + 1)
 */
export async function releaseContractAction(contractId: number) {
  try {
    const { sessionUser, profile } = await requireUser();
    const picName = profile.fullName || sessionUser.email?.split('@')[0] || 'PIC TNT';
    const picId = profile.id;

    // Ambil detail kontrak
    const rows = await db.execute(sql`
      SELECT ct.*, c.username, COALESCE(c.nama_lengkap, c.nama_asli) as nama_kreator
      FROM creator_contracts ct
      LEFT JOIN creators c ON ct.creator_id = c.id
      WHERE ct.id = ${contractId}
      LIMIT 1
    `) as any[];

    if (!rows || rows.length === 0) {
      return { success: false, error: 'Dokumen kontrak tidak ditemukan' };
    }

    const doc = rows[0];
    if (doc.status === 'released') {
      return { success: false, error: `Dokumen ini sudah dirilis sebelumnya dengan nomor ${doc.nomor_kontrak}` };
    }

    // Hitung nomor urut resmi berikutnya secara global
    const maxSeqResult = await db.execute(sql`
      SELECT COALESCE(MAX(seq_number), 0) as max_seq
      FROM creator_contracts
      WHERE status = 'released'
    `) as any[];

    const nextSeq = Number(maxSeqResult[0]?.max_seq || 0) + 1;
    const seqStr = String(nextSeq).padStart(3, '0');

    const today = new Date();
    const curYear = today.getFullYear();
    const curRomanMonth = getRomanMonth(today.getMonth());
    const creatorInit = getInitials(doc.nama_kreator || doc.username || 'TNT');

    // Format Resmi: 001/JC-TNT/{Inisial Kreator}/{Bulan Romawi}/{Tahun}
    const officialContractNumber = `${seqStr}/JC-TNT/${creatorInit}/${curRomanMonth}/${curYear}`;

    // Update contract_data snapshot dengan nomor resmi dan tanggal rilis
    const updatedContractData = {
      ...(doc.contract_data || {}),
      nomorKontrak: officialContractNumber,
      tanggalPerjanjian: `${today.getDate()} ${['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'][today.getMonth()]} ${curYear}`
    };

    await db.execute(sql`
      UPDATE creator_contracts
      SET 
        status = 'released',
        seq_number = ${nextSeq},
        nomor_kontrak = ${officialContractNumber},
        released_by_id = ${picId},
        released_by_name = ${picName},
        released_at = now(),
        contract_data = ${JSON.stringify(updatedContractData)}::jsonb,
        updated_at = now()
      WHERE id = ${contractId}
    `);

    revalidatePath(`/campaigns/${doc.campaign_id}/dokumen`);
    revalidatePath('/dokumen');

    return {
      success: true,
      nomorKontrak: officialContractNumber,
      message: `Dokumen berhasil dirilis secara resmi dengan Nomor: ${officialContractNumber}`
    };
  } catch (err: any) {
    console.error('releaseContractAction error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * 5. Hapus Kontrak (Hanya bila masih DRAFT)
 */
export async function deleteContractAction(contractId: number) {
  try {
    await requireUser();

    const check = await db.execute(sql`
      SELECT id, status, campaign_id, nomor_kontrak FROM creator_contracts WHERE id = ${contractId} LIMIT 1
    `) as any[];

    if (!check || check.length === 0) {
      return { success: false, error: 'Dokumen tidak ditemukan' };
    }

    if (check[0].status === 'released') {
      return { success: false, error: 'Dokumen yang telah dirilis resmi tidak dapat dihapus.' };
    }

    await db.execute(sql`
      DELETE FROM creator_contracts WHERE id = ${contractId}
    `);

    if (check[0].campaign_id) {
      revalidatePath(`/campaigns/${check[0].campaign_id}/dokumen`);
    }
    revalidatePath('/dokumen');

    return { success: true, message: 'Draft dokumen berhasil dihapus.' };
  } catch (err: any) {
    console.error('deleteContractAction error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * 6. Batch Update Kontrak (Mini-Excel Grid Update)
 */
export async function batchUpdateContractsAction(rows: Array<{
  id: number;
  namaKreator?: string;
  nikKtp?: string;
  alamatKreator?: string;
  teleponKreator?: string;
  statusBinding?: string;
  namaBank?: string;
  nomorRekening?: string;
  atasNamaRekening?: string;
  qtyVt?: number;
  biayaHonor?: number;
}>) {
  try {
    await requireUser();

    for (const r of rows) {
      // Hanya update draft yang belum released
      const cur = await db.execute(sql`
        SELECT id, status, contract_data FROM creator_contracts WHERE id = ${r.id} LIMIT 1
      `) as any[];

      if (cur.length > 0 && cur[0].status === 'draft') {
        const existingData = cur[0].contract_data || {};
        const updatedData = {
          ...existingData,
          namaKreator: r.namaKreator ?? existingData.namaKreator,
          nikKtp: r.nikKtp ?? existingData.nikKtp,
          alamatKreator: r.alamatKreator ?? existingData.alamatKreator,
          teleponKreator: r.teleponKreator ?? existingData.teleponKreator,
          statusBinding: r.statusBinding ?? existingData.statusBinding,
          namaBank: r.namaBank ?? existingData.namaBank,
          nomorRekening: r.nomorRekening ?? existingData.nomorRekening,
          atasNamaRekening: r.atasNamaRekening ?? existingData.atasNamaRekening,
          qtyVt: r.qtyVt !== undefined ? Number(r.qtyVt) : existingData.qtyVt,
          biayaHonor: r.biayaHonor !== undefined ? Number(r.biayaHonor) : existingData.biayaHonor,
        };

        await db.execute(sql`
          UPDATE creator_contracts
          SET 
            status_binding = ${updatedData.statusBinding},
            contract_data = ${JSON.stringify(updatedData)}::jsonb,
            updated_at = now()
          WHERE id = ${r.id}
        `);
      }
    }

    revalidatePath('/dokumen');
    return { success: true, message: 'Data dokumen berhasil diperbarui dari tabel excel.' };
  } catch (err: any) {
    console.error('batchUpdateContractsAction error:', err);
    return { success: false, error: err.message };
  }
}
