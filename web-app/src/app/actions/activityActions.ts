'use server';

import { db } from '@/db';
import { sql } from 'drizzle-orm';

export async function fetchActivityLogsAction(limit: number = 500) {
  const rows = await db.execute(sql`
    SELECT * 
    FROM audit_logs 
    ORDER BY created_at DESC 
    LIMIT ${limit}
  `);

  return (rows as unknown as any[]) || [];
}
