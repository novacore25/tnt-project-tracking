"use server";

import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/guards';
import { toNum } from '@/utils/computed';

export interface MilestoneItem {
  id: number;
  campaign_id: number;
  pic_name: string;
  week_number: number;
  week_label: string;
  month_label: string;
  start_date: string | null;
  end_date: string | null;
  target_creator: number;
  target_creator_delta: number;
  target_video: number;
  target_video_delta: number;
  target_gmv: number;
  target_gmv_delta: number;
  target_live_session: number;
  how_to_achieve: string | null;
  action_plan: string | null;
  kendala: string | null;
  problem_solving: string | null;
  status: 'on_track' | 'need_attention' | 'at_risk' | 'completed';
  notes: string | null;
  updated_by: string | null;
  updated_at: string | null;
}

export interface ControllingCampaign {
  id: number;
  nama: string;
  brand_nama: string;
  pic: string;
  tipe_campaign: string;
  status: string;
  start_date: string;
  end_date: string;
  target_creator: number;
  target_video: number;
  target_gmv: number;
  current_creator: number;
  current_video: number;
  current_gmv: number;
  milestones: MilestoneItem[];
}

export interface PICControllingDataResponse {
  campaigns: ControllingCampaign[];
  pics: string[];
  overall: {
    totalTargetCreator: number;
    totalCurrentCreator: number;
    creatorPercentage: number;
    totalTargetVideo: number;
    totalCurrentVideo: number;
    videoPercentage: number;
    totalTargetGMV: number;
    totalCurrentGMV: number;
    gmvPercentage: number;
    totalCampaigns: number;
  };
}

export async function getPICControllingData(selectedPic?: string): Promise<PICControllingDataResponse> {
  await requireUser();

  // 1. Fetch campaigns dengan actual dari view vw_campaign_summary
  const rawCampaigns = await db.execute(sql`
    SELECT 
      c.id,
      c.nama,
      COALESCE(b.nama, c.nama) as brand_nama,
      c.pic,
      c.tipe_campaign,
      c.status,
      c.start_date,
      c.end_date,
      COALESCE(c.target_creator, 0) as target_creator,
      COALESCE(c.target_video, 0) as target_video,
      COALESCE(c.target_gmv, 0) as target_gmv,
      COALESCE(v.achievement_creator, 0) as current_creator,
      COALESCE(v.achievement_video, 0) as current_video,
      COALESCE(v.total_gmv, 0) as current_gmv
    FROM campaigns c
    LEFT JOIN brands b ON c.brand_id = b.id
    LEFT JOIN vw_campaign_summary v ON c.id = v.campaign_id
    WHERE c.company = 'TNT' AND c.pic IS NOT NULL
    ORDER BY c.pic ASC, c.nama ASC
  `) as any[];

  // 2. Fetch all milestones
  const rawMilestones = await db.execute(sql`
    SELECT 
      id,
      campaign_id,
      pic_name,
      week_number,
      week_label,
      month_label,
      start_date,
      end_date,
      COALESCE(target_creator, 0) as target_creator,
      COALESCE(target_creator_delta, 0) as target_creator_delta,
      COALESCE(target_video, 0) as target_video,
      COALESCE(target_video_delta, 0) as target_video_delta,
      COALESCE(target_gmv, 0) as target_gmv,
      COALESCE(target_gmv_delta, 0) as target_gmv_delta,
      COALESCE(target_live_session, 0) as target_live_session,
      how_to_achieve,
      action_plan,
      kendala,
      problem_solving,
      status,
      notes,
      updated_by,
      updated_at
    FROM campaign_weekly_milestones
    ORDER BY campaign_id ASC, week_number ASC
  `) as any[];

  // Map milestones by campaign_id
  const milestonesByCampaign: Record<number, MilestoneItem[]> = {};
  for (const m of rawMilestones) {
    const cid = Number(m.campaign_id);
    if (!milestonesByCampaign[cid]) {
      milestonesByCampaign[cid] = [];
    }
    milestonesByCampaign[cid].push({
      id: Number(m.id),
      campaign_id: cid,
      pic_name: String(m.pic_name || ''),
      week_number: Number(m.week_number || 1),
      week_label: String(m.week_label || ''),
      month_label: String(m.month_label || 'November 2026'),
      start_date: m.start_date ? String(m.start_date) : null,
      end_date: m.end_date ? String(m.end_date) : null,
      target_creator: toNum(m.target_creator),
      target_creator_delta: toNum(m.target_creator_delta),
      target_video: toNum(m.target_video),
      target_video_delta: toNum(m.target_video_delta),
      target_gmv: toNum(m.target_gmv),
      target_gmv_delta: toNum(m.target_gmv_delta),
      target_live_session: toNum(m.target_live_session),
      how_to_achieve: m.how_to_achieve ? String(m.how_to_achieve) : null,
      action_plan: m.action_plan ? String(m.action_plan) : null,
      kendala: m.kendala ? String(m.kendala) : null,
      problem_solving: m.problem_solving ? String(m.problem_solving) : null,
      status: (m.status || 'on_track') as any,
      notes: m.notes ? String(m.notes) : null,
      updated_by: m.updated_by ? String(m.updated_by) : null,
      updated_at: m.updated_at ? String(m.updated_at) : null,
    });
  }

  // Format campaigns
  const campaigns: ControllingCampaign[] = rawCampaigns.map(row => ({
    id: Number(row.id),
    nama: String(row.nama || ''),
    brand_nama: String(row.brand_nama || ''),
    pic: String(row.pic || ''),
    tipe_campaign: String(row.tipe_campaign || 'sales'),
    status: String(row.status || 'aktif'),
    start_date: String(row.start_date || ''),
    end_date: String(row.end_date || ''),
    target_creator: toNum(row.target_creator),
    target_video: toNum(row.target_video),
    target_gmv: toNum(row.target_gmv),
    current_creator: toNum(row.current_creator),
    current_video: toNum(row.current_video),
    current_gmv: toNum(row.current_gmv),
    milestones: milestonesByCampaign[Number(row.id)] || []
  }));

  // Filter campaigns jika ada selectedPic
  const filteredCampaigns = selectedPic && selectedPic !== 'all'
    ? campaigns.filter(c => c.pic.toLowerCase().includes(selectedPic.toLowerCase()))
    : campaigns;

  // Aggregate stats
  let totalTargetCreator = 0;
  let totalCurrentCreator = 0;
  let totalTargetVideo = 0;
  let totalCurrentVideo = 0;
  let totalTargetGMV = 0;
  let totalCurrentGMV = 0;

  for (const c of filteredCampaigns) {
    totalTargetCreator += c.target_creator;
    totalCurrentCreator += c.current_creator;
    totalTargetVideo += c.target_video;
    totalCurrentVideo += c.current_video;
    totalTargetGMV += c.target_gmv;
    totalCurrentGMV += c.current_gmv;
  }

  const creatorPercentage = totalTargetCreator > 0 
    ? Math.min(100, Math.round((totalCurrentCreator / totalTargetCreator) * 1000) / 10) 
    : 0;

  const videoPercentage = totalTargetVideo > 0 
    ? Math.min(100, Math.round((totalCurrentVideo / totalTargetVideo) * 1000) / 10) 
    : 0;

  const gmvPercentage = totalTargetGMV > 0 
    ? Math.min(100, Math.round((totalCurrentGMV / totalTargetGMV) * 1000) / 10) 
    : 0;

  const pics = ['Rija', 'April', 'Maria', 'Wahyu', 'Jerry', 'Samara'];

  return {
    campaigns: filteredCampaigns,
    pics,
    overall: {
      totalTargetCreator,
      totalCurrentCreator,
      creatorPercentage,
      totalTargetVideo,
      totalCurrentVideo,
      videoPercentage,
      totalTargetGMV,
      totalCurrentGMV,
      gmvPercentage,
      totalCampaigns: filteredCampaigns.length
    }
  };
}

export async function updateWeeklyMilestone(params: {
  id: number;
  kendala?: string;
  problem_solving?: string;
  action_plan?: string;
  how_to_achieve?: string;
  status?: 'on_track' | 'need_attention' | 'at_risk' | 'completed';
  notes?: string;
}) {
  const { profile } = await requireUser();
  const userName = profile?.email ? profile.email.split('@')[0] : 'PIC';

  const updates: any[] = [];

  if (params.kendala !== undefined) {
    updates.push(sql`kendala = ${params.kendala}`);
  }
  if (params.problem_solving !== undefined) {
    updates.push(sql`problem_solving = ${params.problem_solving}`);
  }
  if (params.action_plan !== undefined) {
    updates.push(sql`action_plan = ${params.action_plan}`);
  }
  if (params.how_to_achieve !== undefined) {
    updates.push(sql`how_to_achieve = ${params.how_to_achieve}`);
  }
  if (params.status !== undefined) {
    updates.push(sql`status = ${params.status}`);
  }
  if (params.notes !== undefined) {
    updates.push(sql`notes = ${params.notes}`);
  }

  updates.push(sql`updated_by = ${userName}`);
  updates.push(sql`updated_at = NOW()`);

  if (updates.length > 0) {
    // Bangun SET clause secara aman
    await db.execute(sql`
      UPDATE campaign_weekly_milestones
      SET 
        kendala = COALESCE(${params.kendala ?? null}, kendala),
        problem_solving = COALESCE(${params.problem_solving ?? null}, problem_solving),
        action_plan = COALESCE(${params.action_plan ?? null}, action_plan),
        how_to_achieve = COALESCE(${params.how_to_achieve ?? null}, how_to_achieve),
        status = COALESCE(${params.status ?? null}, status),
        notes = COALESCE(${params.notes ?? null}, notes),
        updated_by = ${userName},
        updated_at = NOW()
      WHERE id = ${params.id}
    `);
  }

  revalidatePath('/pic-controlling');
  return { success: true };
}
