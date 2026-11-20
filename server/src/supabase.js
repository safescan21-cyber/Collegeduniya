import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.warn('[supabase] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing — copy .env.example to .env');
}

// Service-role client: bypasses RLS. Only ever used after requireAdmin, or for
// server-side writes like visit tracking.
export const supabase = createClient(url || 'http://localhost:54321', serviceKey || 'missing-key', {
  auth: { persistSession: false, autoRefreshToken: false },
});
