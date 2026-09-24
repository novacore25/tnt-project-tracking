export const dynamic = 'force-static';

import React from 'react';
import TikTokCallbackClient from './TikTokCallbackClient';

export default function TikTokCallbackPage() {
  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <TikTokCallbackClient />
    </div>
  );
}
