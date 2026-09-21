'use server';

import { db } from '@/db';
import { campaignConcepts } from '@/db/schema';
import { eq, asc } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function getCampaignConcepts(campaignId: number) {
  try {
    const data = await db
      .select()
      .from(campaignConcepts)
      .where(eq(campaignConcepts.campaignId, campaignId))
      .orderBy(asc(campaignConcepts.conceptNumber));

    return { success: true, data };
  } catch (error: any) {
    console.error('Error in getCampaignConcepts:', error);
    return { success: false, data: [], error: error.message };
  }
}

export async function createCampaignConcept(data: {
  campaign_id: number;
  concept_number: number;
  concept_name: string;
  brief_link?: string;
  notes?: string;
}) {
  try {
    const [newConcept] = await db
      .insert(campaignConcepts)
      .values({
        campaignId: data.campaign_id,
        conceptNumber: data.concept_number,
        conceptName: data.concept_name,
        briefLink: data.brief_link || null,
        notes: data.notes || null,
      })
      .returning();

    revalidatePath(`/campaigns/${data.campaign_id}/concepts`);
    return { success: true, data: newConcept };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateCampaignConcept(id: number, data: any, campaignId?: number) {
  try {
    await db
      .update(campaignConcepts)
      .set({
        conceptNumber: data.concept_number !== undefined ? data.concept_number : undefined,
        conceptName: data.concept_name !== undefined ? data.concept_name : undefined,
        briefLink: data.brief_link !== undefined ? data.brief_link : undefined,
        notes: data.notes !== undefined ? data.notes : undefined,
      })
      .where(eq(campaignConcepts.id, id));

    if (campaignId) revalidatePath(`/campaigns/${campaignId}/concepts`);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteCampaignConcept(id: number, campaignId?: number) {
  try {
    await db.delete(campaignConcepts).where(eq(campaignConcepts.id, id));
    if (campaignId) revalidatePath(`/campaigns/${campaignId}/concepts`);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
