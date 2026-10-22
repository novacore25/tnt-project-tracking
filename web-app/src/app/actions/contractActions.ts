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

let hasEnsuredTipeDokumenCol = false;
async function ensureTipeDokumenCol() {
  if (hasEnsuredTipeDokumenCol) return;
  try {
    await db.execute(sql`
      ALTER TABLE creator_contracts ADD COLUMN IF NOT EXISTS tipe_dokumen TEXT DEFAULT 'perjanjian_kerjasama';
      CREATE INDEX IF NOT EXISTS idx_creator_contracts_tipe_dokumen ON creator_contracts(tipe_dokumen);
    `);
    hasEnsuredTipeDokumenCol = true;
  } catch (e) {
    // ignore
  }
}

/**
 * 1. Ambil list kontrak (Bisa global atau difilter per campaignId)
 */
export async function fetchContractsAction(params?: {
  campaignId?: number;
  status?: string;
  search?: string;
  tipeDokumen?: string;
}) {
  try {
    const { sessionUser, profile } = await requireUser();
    await ensureTipeDokumenCol();
    if (params?.campaignId) {
      await syncApprovedCreatorDraftsInternal(
        params.campaignId,
        profile.id,
        profile.fullName || sessionUser.email?.split('@')[0]
      );
    }

    const conditions: any[] = [];
    if (params?.campaignId) {
      conditions.push(sql`ct.campaign_id = ${params.campaignId}`);
    }
    if (params?.status && params.status !== 'all') {
      conditions.push(sql`ct.status = ${params.status}`);
    }
    if (params?.tipeDokumen && params.tipeDokumen !== 'all') {
      conditions.push(sql`(ct.tipe_dokumen = ${params.tipeDokumen} OR (${params.tipeDokumen} = 'perjanjian_kerjasama' AND ct.tipe_dokumen IS NULL))`);
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

    const limit = params?.campaignId ? 2500 : 1000;

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
      LIMIT ${limit}
    `) as any[];

    return { success: true, data: rows };
  } catch (err: any) {
    console.error('fetchContractsAction error:', err);
    return { success: false, error: err.message, data: [] };
  }
}

/**
 * Internal Sync: Pastikan seluruh kreator approved otomatis memiliki draft kontrak
 */
async function syncApprovedCreatorDraftsInternal(campaignId: number, picId?: string, picName?: string) {
  try {
    const campRows = await db.execute(sql`
      SELECT c.*, b.nama as brand_nama
      FROM campaigns c
      LEFT JOIN brands b ON c.brand_id = b.id
      WHERE c.id = ${campaignId}
      LIMIT 1
    `) as any[];
    if (!campRows || campRows.length === 0) return;
    const camp = campRows[0];
    const brandName = camp.brand_nama || 'Brand Partner';

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
        AND LOWER(TRIM(COALESCE(cc.approval, ''))) = 'approved'
      ORDER BY cc.id ASC
    `) as any[];

    if (!ccRows || ccRows.length === 0) return { createdCount: 0, existingCount: 0 };

    const today = new Date();
    const curYear = today.getFullYear();
    const curRomanMonth = getRomanMonth(today.getMonth());

    // Ambil semua kontrak yang sudah ada di campaign ini sekaligus (Fast Map)
    const existingContracts = await db.execute(sql`
      SELECT creator_id, campaign_creator_id
      FROM creator_contracts
      WHERE campaign_id = ${campaignId}
    `) as any[];

    const existCreatorIds = new Set(existingContracts.map((c: any) => c.creator_id));
    const existCcIds = new Set(existingContracts.map((c: any) => c.campaign_creator_id).filter(Boolean));

    const seenCreatorIds = new Set(existCreatorIds);
    const seenCcIds = new Set(existCcIds);
    const rowsToInsert: any[] = [];

    for (const cc of ccRows) {
      if (seenCcIds.has(cc.cc_id) || seenCreatorIds.has(cc.creator_id)) continue;
      seenCcIds.add(cc.cc_id);
      seenCreatorIds.add(cc.creator_id);
      rowsToInsert.push(cc);
    }

    if (rowsToInsert.length === 0) {
      return { createdCount: 0, existingCount: existingContracts.length };
    }

    // Insert concurrently dalam batch chunk 25 untuk performa tinggi & zero-timeout
    const chunkSize = 25;
    for (let i = 0; i < rowsToInsert.length; i += chunkSize) {
      const chunk = rowsToInsert.slice(i, i + chunkSize);
      await Promise.all(
        chunk.map(async (cc: any) => {
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
            namaPicTNT: picName || 'Safira',
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

          return db.execute(sql`
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
              ${'#draft-' + cc.cc_id},
              ${draftNumber},
              ${initialContractData.statusBinding},
              ${'Ruben Arianto'},
              ${'Manajer Umum'},
              'draft',
              ${picId || null},
              ${picName || 'System'},
              ${JSON.stringify(initialContractData)}::jsonb,
              now(),
              now()
            )
          `).catch((err) => {
            console.error('Error insert single creator contract:', err);
          });
        })
      );
    }

    return { createdCount: rowsToInsert.length, existingCount: existingContracts.length };
  } catch (err) {
    console.error('syncApprovedCreatorDraftsInternal error:', err);
    return { createdCount: 0, existingCount: 0 };
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

    const res = await syncApprovedCreatorDraftsInternal(campaignId, picId, picName);

    revalidatePath(`/campaigns/${campaignId}/dokumen`);
    revalidatePath('/dokumen');

    return { 
      success: true, 
      createdCount: res.createdCount, 
      existingCount: res.existingCount,
      message: res.createdCount > 0
        ? `Berhasil membuat ${res.createdCount} draft kontrak otomatis baru (${res.existingCount} sudah ada).`
        : `Semua kreator approved (${res.existingCount}) sudah memiliki dokumen/draft.`
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

    const chunkSize = 20;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      await Promise.all(
        chunk.map(async (r) => {
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
        })
      );
    }

    revalidatePath('/dokumen');
    return { success: true, message: 'Data dokumen berhasil diperbarui dari tabel excel.' };
  } catch (err: any) {
    console.error('batchUpdateContractsAction error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * 7. Lookup data kreator di campaign untuk instant autofill di Mini Excel
 */
export async function fetchCampaignCreatorsLookupForDokumenAction(campaignId: number) {
  try {
    await requireUser();

    const rows = await db.execute(sql`
      SELECT 
        cc.id as campaign_creator_id,
        cc.creator_id,
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
        COALESCE(c.status_binding, 'Non-Binding') as status_binding,
        cc.qty_vt,
        cc.price,
        cc.approval,
        ct.id as contract_id,
        ct.status as contract_status,
        ct.nomor_kontrak,
        ct.contract_data
      FROM campaign_creators cc
      JOIN creators c ON cc.creator_id = c.id
      LEFT JOIN creator_contracts ct ON (ct.campaign_creator_id = cc.id OR (ct.campaign_id = cc.campaign_id AND ct.creator_id = c.id))
      WHERE cc.campaign_id = ${campaignId}
      ORDER BY cc.id ASC
    `) as any[];

    return { success: true, data: rows };
  } catch (err: any) {
    console.error('fetchCampaignCreatorsLookupForDokumenAction error:', err);
    return { success: false, error: err.message, data: [] };
  }
}

/**
 * 8. Upsert Batch Kontrak dari Mini Excel Spreadsheet
 */
export async function upsertContractsBatchFromSpreadsheetAction(params: {
  campaignId: number;
  tipeDokumen?: string;
  rows: Array<{
    username: string;
    namaKreator?: string;
    statusBinding?: string;
    tiktokUid?: string;
    nikKtp?: string;
    alamatKreator?: string;
    tanggalLahir?: string;
    tempatLahir?: string;
    teleponKreator?: string;
    emailKreator?: string;
    npwpKreator?: string;
    namaBank?: string;
    nomorRekening?: string;
    atasNamaRekening?: string;
    namaBrand?: string;
    jenisCampaign?: string;
    qtyVt?: number;
    qtyPhotoSlide?: number;
    qtyLive?: number;
    durasiKonten?: string;
    durasiKontenTerbilang?: string;
    hashtagCampaign?: string;
    tanggalKirimDraft?: string;
    tanggalMulaiPosting?: string;
    tanggalBatasPosting?: string;
    biayaHonor?: number;
    feePerDeliverable?: number;
    skemaPembayaran?: string;
    batasWaktuRevisi?: string;
    jangkaWaktuTayang?: string;
    rawKontrakMulai?: string;
    rawKontrakBerakhir?: string;
    catatanTambahan?: string;
    namaDirekturTNT?: string;
    jabatanDirekturTNT?: string;
    namaPicTNT?: string;
    inisialPicTNT?: string;
    namaSignerTNT?: string;
    jabatanSignerTNT?: string;
    namaPerusahaan?: string;
    alamatPerusahaan?: string;
    nomorKontrak?: string;
    tanggalPerjanjian?: string;
    tempatPerjanjian?: string;
  }>;
}) {
  try {
    const { sessionUser, profile } = await requireUser();
    const defaultPicName = profile.fullName || sessionUser.email?.split('@')[0] || 'PIC TNT';
    const picId = profile.id;
    const { campaignId, rows } = params;
    const tipeDokumen = params.tipeDokumen || 'perjanjian_kerjasama';

    await ensureTipeDokumenCol();

    if (!campaignId || !rows || rows.length === 0) {
      return { success: false, error: 'Data baris tidak boleh kosong' };
    }

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
    const defaultBrandName = camp.brand_nama || 'Brand Partner';

    const today = new Date();
    const curYear = today.getFullYear();
    const curRomanMonth = getRomanMonth(today.getMonth());

    let updatedCount = 0;
    let createdCount = 0;
    let skippedCount = 0;

    // Filter baris yang memiliki username
    const validRows = rows.filter(r => r.username && r.username.trim() !== '');

    const chunkSize = 20;
    for (let i = 0; i < validRows.length; i += chunkSize) {
      const chunk = validRows.slice(i, i + chunkSize);
      await Promise.all(
        chunk.map(async (row) => {
          const cleanUsername = row.username.trim().replace(/^@+/, '').trim().toLowerCase();
          if (!cleanUsername) return;

          // 1. Cari atau buat kreator di creators
          let creatorId: number;
          const cExist = await db.execute(sql`
            SELECT id, username, nama_lengkap, status_binding FROM creators WHERE LOWER(username) = ${cleanUsername} LIMIT 1
          `) as any[];

          const creatorRealName = row.namaKreator || cleanUsername;
          const bindingStatus = (row.statusBinding || '').toLowerCase().includes('binding') && !(row.statusBinding || '').toLowerCase().includes('non')
            ? 'KREATOR Binding'
            : 'KREATOR Non-Binding';

          if (cExist.length > 0) {
            creatorId = cExist[0].id;
            await db.execute(sql`
              UPDATE creators
              SET 
                nama_lengkap = COALESCE(NULLIF(${row.namaKreator || ''}, ''), nama_lengkap),
                status_binding = ${bindingStatus},
                nik = COALESCE(NULLIF(${row.nikKtp || ''}, ''), nik),
                alamat_ktp = COALESCE(NULLIF(${row.alamatKreator || ''}, ''), alamat_ktp),
                no_whatsapp = COALESCE(NULLIF(${row.teleponKreator || ''}, ''), no_whatsapp),
                email = COALESCE(NULLIF(${row.emailKreator || ''}, ''), email),
                npwp = COALESCE(NULLIF(${row.npwpKreator || ''}, ''), npwp),
                updated_at = now()
              WHERE id = ${creatorId}
            `);
          } else {
            const [newC] = await db.execute(sql`
              INSERT INTO creators (
                username, nama_lengkap, status_binding, nik, alamat_ktp, no_whatsapp, email, npwp, created_at, updated_at
              ) VALUES (
                ${cleanUsername}, ${creatorRealName}, ${bindingStatus}, ${row.nikKtp || null}, ${row.alamatKreator || null}, ${row.teleponKreator || null}, ${row.emailKreator || null}, ${row.npwpKreator || null}, now(), now()
              ) RETURNING id
            `) as any[];
            creatorId = newC.id;
          }

          // 2. Pastikan campaign_creators ada
          let ccId: number;
          const ccExist = await db.execute(sql`
            SELECT id FROM campaign_creators WHERE campaign_id = ${campaignId} AND creator_id = ${creatorId} LIMIT 1
          `) as any[];

          const honorVal = row.biayaHonor !== undefined ? Number(row.biayaHonor) : 0;
          const vtVal = row.qtyVt !== undefined ? Number(row.qtyVt) : 1;
          const liveVal = row.qtyLive !== undefined ? Number(row.qtyLive) : 0;

          if (ccExist.length > 0) {
            ccId = ccExist[0].id;
            await db.execute(sql`
              UPDATE campaign_creators
              SET 
                price = COALESCE(${row.biayaHonor}, price),
                qty_vt = COALESCE(${row.qtyVt}, qty_vt),
                qty_live = COALESCE(${row.qtyLive}, qty_live),
                updated_at = now()
              WHERE id = ${ccId}
            `);
          } else {
            const [newCc] = await db.execute(sql`
              INSERT INTO campaign_creators (
                campaign_id, creator_id, approval, price, qty_vt, qty_live, created_at, updated_at
              ) VALUES (
                ${campaignId}, ${creatorId}, 'approved', ${honorVal}, ${vtVal}, ${liveVal}, now(), now()
              ) RETURNING id
            `) as any[];
            ccId = newCc.id;
          }

          // 3. Cek apakah ada kontrak di creator_contracts
          const ctExist = await db.execute(sql`
            SELECT id, status, contract_data, tipe_dokumen, nomor_kontrak
            FROM creator_contracts
            WHERE (campaign_creator_id = ${ccId} OR (campaign_id = ${campaignId} AND creator_id = ${creatorId}))
            LIMIT 1
          `) as any[];

          const currentBrandName = row.namaBrand || defaultBrandName;
          const currentPicName = row.namaPicTNT || defaultPicName;
          const creatorInitials = getInitials(creatorRealName);
          const defaultDraftNumber = `[DRAFT]/JC-TNT/${creatorInitials}/${curRomanMonth}/${curYear}`;

          if (ctExist.length > 0) {
            const existingContract = ctExist[0];
            if (existingContract.status === 'released') {
              // Terkunci, jangan ubah
              skippedCount++;
              return;
            }

            const prevData = existingContract.contract_data || {};
            const mergedContractData = {
              ...prevData,
              nomorKontrak: row.nomorKontrak || existingContract.nomor_kontrak || prevData.nomorKontrak || defaultDraftNumber,
              statusBinding: bindingStatus,
              namaKreator: row.namaKreator || prevData.namaKreator || creatorRealName,
              usernameTikTok: cleanUsername,
              tiktokUid: row.tiktokUid !== undefined ? row.tiktokUid : (prevData.tiktokUid || ''),
              nikKtp: row.nikKtp !== undefined && row.nikKtp !== '' ? row.nikKtp : prevData.nikKtp,
              alamatKreator: row.alamatKreator !== undefined && row.alamatKreator !== '' ? row.alamatKreator : prevData.alamatKreator,
              tanggalLahir: row.tanggalLahir !== undefined ? row.tanggalLahir : (prevData.tanggalLahir || ''),
              tempatLahir: row.tempatLahir !== undefined ? row.tempatLahir : (prevData.tempatLahir || ''),
              teleponKreator: row.teleponKreator !== undefined && row.teleponKreator !== '' ? row.teleponKreator : prevData.teleponKreator,
              emailKreator: row.emailKreator !== undefined ? row.emailKreator : (prevData.emailKreator || ''),
              npwpKreator: row.npwpKreator !== undefined ? row.npwpKreator : (prevData.npwpKreator || ''),
              namaBank: row.namaBank !== undefined && row.namaBank !== '' ? row.namaBank : prevData.namaBank,
              nomorRekening: row.nomorRekening !== undefined && row.nomorRekening !== '' ? row.nomorRekening : prevData.nomorRekening,
              atasNamaRekening: row.atasNamaRekening !== undefined && row.atasNamaRekening !== '' ? row.atasNamaRekening : (prevData.atasNamaRekening || creatorRealName),
              namaCampaign: camp.nama,
              namaBrand: currentBrandName,
              jenisCampaign: row.jenisCampaign || prevData.jenisCampaign || 'Fee',
              qtyVt: row.qtyVt !== undefined ? Number(row.qtyVt) : (prevData.qtyVt || 1),
              qtyPhotoSlide: row.qtyPhotoSlide !== undefined ? Number(row.qtyPhotoSlide) : (prevData.qtyPhotoSlide || 0),
              qtyLive: row.qtyLive !== undefined ? Number(row.qtyLive) : (prevData.qtyLive || 0),
              durasiKonten: row.durasiKonten || prevData.durasiKonten || '30 - 60',
              durasiKontenTerbilang: row.durasiKontenTerbilang || prevData.durasiKontenTerbilang || 'tiga puluh sampai enam puluh',
              hashtagCampaign: row.hashtagCampaign || prevData.hashtagCampaign || '',
              tanggalKirimDraft: row.tanggalKirimDraft || prevData.tanggalKirimDraft || '',
              tanggalMulaiPosting: row.tanggalMulaiPosting || prevData.tanggalMulaiPosting || '',
              tanggalBatasPosting: row.tanggalBatasPosting || prevData.tanggalBatasPosting || '',
              biayaHonor: row.biayaHonor !== undefined ? Number(row.biayaHonor) : (prevData.biayaHonor || 0),
              feePerDeliverable: row.feePerDeliverable !== undefined ? Number(row.feePerDeliverable) : (prevData.feePerDeliverable || 0),
              skemaPembayaran: row.skemaPembayaran || prevData.skemaPembayaran || 'H+14 dari selesai Campaign sampai dengan H+21 dari selesai Campaign',
              batasWaktuRevisi: row.batasWaktuRevisi || prevData.batasWaktuRevisi || '2 (dua)',
              jangkaWaktuTayang: row.jangkaWaktuTayang || prevData.jangkaWaktuTayang || '60 (enam puluh)',
              rawKontrakMulai: row.rawKontrakMulai || prevData.rawKontrakMulai || '',
              rawKontrakBerakhir: row.rawKontrakBerakhir || prevData.rawKontrakBerakhir || '',
              catatanTambahan: row.catatanTambahan !== undefined ? row.catatanTambahan : (prevData.catatanTambahan || ''),
              namaDirekturTNT: row.namaDirekturTNT || prevData.namaDirekturTNT || 'Stevani',
              jabatanDirekturTNT: row.jabatanDirekturTNT || prevData.jabatanDirekturTNT || 'Direktur',
              namaPicTNT: currentPicName,
              inisialPicTNT: row.inisialPicTNT || prevData.inisialPicTNT || getInitials(currentPicName),
              namaSignerTNT: row.namaSignerTNT || prevData.namaSignerTNT || 'Ruben Arianto',
              jabatanSignerTNT: row.jabatanSignerTNT || prevData.jabatanSignerTNT || 'Manajer Umum',
              namaPerusahaan: row.namaPerusahaan || prevData.namaPerusahaan || 'PT TNT KREATIF DIGITAL',
              alamatPerusahaan: row.alamatPerusahaan || prevData.alamatPerusahaan || 'Jalan Kavling Perkebunan Raya, RT 006 / RW 013, Panunggangan Barat, Kecamatan Cibodas, Kota Tangerang, Banten 15139',
              tanggalPerjanjian: row.tanggalPerjanjian || prevData.tanggalPerjanjian || '',
              tempatPerjanjian: row.tempatPerjanjian || prevData.tempatPerjanjian || 'Tangerang'
            };

            await db.execute(sql`
              UPDATE creator_contracts
              SET 
                status_binding = ${bindingStatus},
                contract_data = ${JSON.stringify(mergedContractData)}::jsonb,
                tipe_dokumen = ${tipeDokumen},
                updated_at = now()
              WHERE id = ${existingContract.id}
            `);
            updatedCount++;
          } else {
            // Buat draft baru
            const draftNumber = row.nomorKontrak || defaultDraftNumber;
            const contractTitle = `Kontrak Join Campaign - @${cleanUsername} (${currentBrandName})`;

            const newContractData = {
              nomorKontrak: draftNumber,
              statusBinding: bindingStatus,
              namaPerusahaan: row.namaPerusahaan || 'PT TNT KREATIF DIGITAL',
              alamatPerusahaan: row.alamatPerusahaan || 'Jalan Kavling Perkebunan Raya, RT 006 / RW 013, Panunggangan Barat, Kecamatan Cibodas, Kota Tangerang, Banten 15139',
              namaDirekturTNT: row.namaDirekturTNT || 'Stevani',
              jabatanDirekturTNT: row.jabatanDirekturTNT || 'Direktur',
              namaSignerTNT: row.namaSignerTNT || 'Ruben Arianto',
              jabatanSignerTNT: row.jabatanSignerTNT || 'Manajer Umum',
              namaPicTNT: currentPicName,
              inisialPicTNT: row.inisialPicTNT || getInitials(currentPicName),
              jabatanPicTNT: 'Project Manager',
              namaKreator: creatorRealName,
              usernameTikTok: cleanUsername,
              tiktokUid: row.tiktokUid || '',
              nikKtp: row.nikKtp || '',
              alamatKreator: row.alamatKreator || '',
              tanggalLahir: row.tanggalLahir || '',
              tempatLahir: row.tempatLahir || '',
              teleponKreator: row.teleponKreator || '',
              emailKreator: row.emailKreator || '',
              npwpKreator: row.npwpKreator || '',
              namaBank: row.namaBank || '',
              nomorRekening: row.nomorRekening || '',
              atasNamaRekening: row.atasNamaRekening || creatorRealName,
              namaCampaign: camp.nama,
              namaBrand: currentBrandName,
              jenisCampaign: row.jenisCampaign || 'Fee',
              qtyVt: vtVal,
              qtyPhotoSlide: row.qtyPhotoSlide !== undefined ? Number(row.qtyPhotoSlide) : 0,
              qtyLive: liveVal,
              biayaHonor: honorVal,
              feePerDeliverable: row.feePerDeliverable !== undefined ? Number(row.feePerDeliverable) : 0,
              durasiKonten: row.durasiKonten || '30 - 60',
              durasiKontenTerbilang: row.durasiKontenTerbilang || 'tiga puluh sampai enam puluh',
              hashtagCampaign: row.hashtagCampaign || '',
              tanggalKirimDraft: row.tanggalKirimDraft || '',
              tanggalMulaiPosting: row.tanggalMulaiPosting || '',
              tanggalBatasPosting: row.tanggalBatasPosting || '',
              skemaPembayaran: row.skemaPembayaran || 'H+14 dari selesai Campaign sampai dengan H+21 dari selesai Campaign',
              batasWaktuRevisi: row.batasWaktuRevisi || '2 (dua)',
              jangkaWaktuTayang: row.jangkaWaktuTayang || '60 (enam puluh)',
              rawKontrakMulai: row.rawKontrakMulai || '',
              rawKontrakBerakhir: row.rawKontrakBerakhir || '',
              catatanTambahan: row.catatanTambahan || '',
              tanggalPerjanjian: row.tanggalPerjanjian || '',
              tempatPerjanjian: row.tempatPerjanjian || 'Tangerang'
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
                tipe_dokumen,
                created_by_id,
                created_by_name,
                contract_data,
                created_at,
                updated_at
              ) VALUES (
                ${creatorId},
                ${campaignId},
                ${ccId},
                ${contractTitle},
                ${'#draft-' + ccId},
                ${draftNumber},
                ${bindingStatus},
                ${row.namaSignerTNT || 'Ruben Arianto'},
                ${row.jabatanSignerTNT || 'Manajer Umum'},
                'draft',
                ${tipeDokumen},
                ${picId || null},
                ${currentPicName},
                ${JSON.stringify(newContractData)}::jsonb,
                now(),
                now()
              )
            `);
            createdCount++;
          }
        })
      );
    }

    revalidatePath(`/campaigns/${campaignId}/dokumen`);
    revalidatePath('/dokumen');

    return {
      success: true,
      updatedCount,
      createdCount,
      skippedCount,
      message: `Berhasil memproses data: ${createdCount} draft baru dibuat, ${updatedCount} draft diperbarui${skippedCount > 0 ? `, ${skippedCount} dokumen yang sudah dirilis dilewati (terkunci)` : ''}.`
    };
  } catch (err: any) {
    console.error('upsertContractsBatchFromSpreadsheetAction error:', err);
    return { success: false, error: err.message };
  }
}
