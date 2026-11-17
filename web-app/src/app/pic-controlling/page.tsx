import { Metadata } from 'next';
import { getPICControllingData } from './actions';
import PICControllingClient from './PICControllingClient';

export const metadata: Metadata = {
  title: 'Controlling Progress PIC — Blueprint Campaign',
  description: 'Monitoring progress target, weekly roadmap, how to achieve, dan evaluasi kendala & problem solving mingguan PIC.',
};

export const dynamic = 'force-dynamic';

export default async function PICControllingPage() {
  const initialData = await getPICControllingData();

  return (
    <div className="min-h-screen bg-[#0d1117] text-slate-100 p-4 md:p-8">
      <PICControllingClient initialData={initialData} />
    </div>
  );
}
