import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function check() {
  const possibleTables = [
    'live_sessions',
    'live_session_products',
    'livestreams',
    'livestream_products',
    'campaign_creators',
    'sales',
    'organic_videos'
  ];

  for (const t of possibleTables) {
    const { data, error } = await supabase.from(t).select('*').limit(2);
    if (error) {
      console.log(`Table ${t}: NOT FOUND or ERROR: ${error.message}`);
    } else {
      console.log(`Table ${t}: FOUND (${data.length} sample rows). Columns:`, Object.keys(data[0] || {}));
      if (data.length > 0) {
        console.log(`Sample row for ${t}:`, data[0]);
      }
    }
  }
}

check();
