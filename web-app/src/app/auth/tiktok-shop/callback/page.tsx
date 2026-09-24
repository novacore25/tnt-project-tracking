import React, { Suspense } from 'react';
import TikTokCallbackClient from './TikTokCallbackClient';

export default function TikTokCallbackPage() {
  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <Suspense fallback={<div className="p-8 text-center text-slate-500 font-medium">Memuat konsol integrasi TikTok Shop...</div>}>
        <TikTokCallbackClient />
      </Suspense>
    </div>
  );
}
