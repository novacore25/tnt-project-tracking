import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const creators = await db.execute(sql`
      SELECT id, username, nama_asli, created_at 
      FROM creators 
      WHERE id = 23475 OR username ILIKE '%aliabdulazizzzz%' OR username ILIKE '%aliabdulaziz%'
    `);
    
    const ccs = await db.execute(sql`
      SELECT cc.id, cc.campaign_id, cc.creator_id, cc.price, cc.approval, cc.status_bayar, cc.created_at,
             c.nama as campaign_nama, cr.username as creator_username
      FROM campaign_creators cc
      LEFT JOIN campaigns c ON cc.campaign_id = c.id
      LEFT JOIN creators cr ON cc.creator_id = cr.id
      WHERE cc.creator_id IN (
        SELECT id FROM creators WHERE id = 23475 OR username ILIKE '%aliabdulazizzzz%' OR username ILIKE '%aliabdulaziz%'
      )
      OR (cc.campaign_id = 42 AND cr.username ILIKE '%aliabdul%')
    `);

    const aliases = await db.execute(sql`
      SELECT * FROM creator_aliases 
      WHERE creator_id = 23475 OR alias_username ILIKE '%aliabdul%'
    `).catch(() => []);

    return NextResponse.json({ creators, ccs, aliases });
  } catch (err: any) {
    return NextResponse.json({ error: err.message });
  }
}
