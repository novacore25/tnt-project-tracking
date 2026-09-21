import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { sql } from 'drizzle-orm';
import PortalLoginForm from './PortalLoginForm';

export default async function PortalLogin({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const campaignId = parseInt(id, 10);
  
  if (isNaN(campaignId)) {
    return <div className="p-8 text-center text-red-500">ID Campaign tidak valid.</div>;
  }

  // Cek apakah cookie sudah ada dan valid
  const cookieStore = await cookies();
  const pinCookie = cookieStore.get(`portal_pin_${campaignId}`)?.value;
  
  const [campaign] = await db.execute(sql`
    SELECT nama, pin FROM campaigns WHERE id = ${campaignId} LIMIT 1
  `) as any[];

  if (!campaign) {
    return <div className="p-8 text-center text-red-500">Campaign tidak ditemukan.</div>;
  }

  // Jika belum diset PIN, tampilkan pesan
  if (!campaign.pin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow text-center max-w-md">
          <h2 className="text-xl font-bold text-slate-800 mb-2">Akses Belum Dibuka</h2>
          <p className="text-slate-600">Portal brand untuk campaign ini belum dikonfigurasi dengan PIN akses Klien oleh Manajer TNT.</p>
        </div>
      </div>
    );
  }

  if (pinCookie && pinCookie === campaign.pin) {
    // Sudah terotentikasi, langsung arahkan ke dashboard
    redirect(`/portal/${campaignId}/dashboard`);
  }

  // Jika belum punya PIN yang valid, render form
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 mb-2">
            <span className="font-black text-xl">TNT</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Brand Portal</h1>
          <p className="text-sm text-slate-500">
            Akses dashboard pemantauan untuk campaign <span className="font-semibold text-slate-700">{campaign.nama}</span>
          </p>
        </div>

        <PortalLoginForm campaignId={campaignId} />
      </div>
    </div>
  );
}
