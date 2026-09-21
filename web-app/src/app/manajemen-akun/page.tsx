import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { sql } from 'drizzle-orm';
import ManajemenAkunClient from './ManajemenAkunClient';

export default async function ManajemenAkunPage() {
  const session = await auth();

  if (!session?.user?.email) {
    redirect('/login');
  }

  // Cek apakah user adalah manager / executive
  const [profile] = await db.execute(sql`
    SELECT id, role FROM profiles WHERE LOWER(email) = ${session.user.email.toLowerCase()} LIMIT 1
  `) as any[];

  if (!['manager', 'executive'].includes(profile?.role)) {
    redirect('/'); // Lempar ke dashboard jika bukan manager/executive
  }

  // Ambil data users dan campaigns untuk initial state
  const [profiles, campaigns, userCampaigns, whitelist] = await Promise.all([
    db.execute(sql`SELECT * FROM profiles ORDER BY created_at DESC`).catch(() => []),
    db.execute(sql`SELECT id, nama as name FROM campaigns ORDER BY nama`).catch(() => []),
    db.execute(sql`SELECT * FROM user_campaigns`).catch(() => []),
    db.execute(sql`SELECT * FROM whitelisted_emails ORDER BY created_at DESC`).catch(() => [])
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Manajemen Akun</h1>
        <p className="text-slate-500">Kelola persetujuan akun, whitelist email, dan hak akses campaign anggota tim.</p>
      </div>

      <ManajemenAkunClient 
        initialProfiles={(profiles as any[]) || []} 
        campaigns={(campaigns as any[]) || []}
        initialUserCampaigns={(userCampaigns as any[]) || []}
        initialWhitelist={(whitelist as any[]) || []}
      />
    </div>
  );
}
