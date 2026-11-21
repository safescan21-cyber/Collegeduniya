import { NextResponse } from 'next/server';
import { supabasePublic, hasSupabase } from '@/lib/supabase/server';

// One-click unsubscribe (RFC 8058): mail apps POST here from the List-Unsubscribe header.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  let t = new URL(req.url).searchParams.get('t') || '';
  if (!t) { try { t = String((await req.json())?.t || ''); } catch { /* form post */ } }
  if (!UUID.test(t) || !hasSupabase) return NextResponse.json({ error: 'Invalid link' }, { status: 400 });
  const { data, error } = await supabasePublic().rpc('exam_news_unsubscribe', { p_token: t });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, exam: data || null });
}
