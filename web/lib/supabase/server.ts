import { createClient } from '@supabase/supabase-js';

// Anonymous read-only client for public pages rendered on the server.
// RLS makes sure only published rows are returned.
export function supabasePublic() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'missing-anon-key',
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export const hasSupabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
