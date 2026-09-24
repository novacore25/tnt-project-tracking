import React from 'react';
import TikTokCallbackClient from './TikTokCallbackClient';

export default async function TikTokCallbackPage({
  searchParams
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams;
  const code = typeof params.code === 'string' ? params.code : '';
  const state = typeof params.state === 'string' ? params.state : '';
  const error = typeof params.error === 'string' ? params.error : '';

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <TikTokCallbackClient code={code} state={state} urlError={error} />
    </div>
  );
}
