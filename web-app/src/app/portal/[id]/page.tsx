import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from "@supabase/supabase-js";
import PortalLoginForm from './PortalLoginForm';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder-project.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function PortalLogin({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const campaignId = parseInt(id, 10);
  
  if (isNaN(campaignId)) {
    return <div className="p-8 text-center text-red-500">ID Campaign tidak valid.</div>;
  }

  // Cek apakah cookie sudah ada dan valid
  const cookieStore = await cookies();
  const pinCookie = cookieStore.get(`portal_pin_${campaignId}`)?.value;
  
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('nama, pin')
    .eq('id', campaignId)
    .single();

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
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 space-y-6 border border-slate-100">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Brand Portal</h1>
          <p className="text-gray-500 text-sm">
            Silakan masukkan PIN akses untuk memantau performa campaign <br/>
            <strong className="text-blue-600 block mt-2 text-lg">{campaign.nama}</strong>
          </p>
        </div>
        
        <PortalLoginForm campaignId={campaignId} />
      </div>
    </div>
  );
}
