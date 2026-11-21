import { supabase } from '../supabase.js';
import { enrichMany } from './wikimedia.js';

// Keeps college pages filling up on their own:
//  • every few hours: newly imported colleges get Wikipedia "About" text, logo, campus photos (Wikimedia Commons,
//    with author + licence credit), website, founding year, location and student count from Wikidata
//  • colleges that failed are retried after 14 days
//  • afterwards, page-quality scores are refreshed so finished pages reach Google (migration 018)
//  • once a day: real students are invited to review their own college (migration 020) — reviews are never generated
// Settings (server/.env): AUTOFILL=off to stop · AUTOFILL_EVERY_HOURS=6 · AUTOFILL_BATCH=300 · REVIEW_INVITES=off
const env = (k, d) => (process.env[k] ?? d);
let running = false; let last = null; let lastInvites = null;

export async function runAutofill({ reason = 'schedule' } = {}) {
  if (running) return { skipped: 'already running' };
  const { data: busy } = await supabase.from('import_runs').select('id').eq('status', 'running').in('kind', ['enrich', 'universities', 'sheet', 'scorecard'])
    .gte('created_at', new Date(Date.now() - 3 * 3600e3).toISOString()).limit(1);
  if (busy?.length) return { skipped: 'an import is running' };
  running = true;
  try {
    // give errored lookups another chance after two weeks
    await supabase.from('colleges').update({ enriched_at: null, enrich_status: null })
      .eq('enrich_status', 'error').lt('enriched_at', new Date(Date.now() - 14 * 86400e3).toISOString());
    const r = await enrichMany({ limit: Number(env('AUTOFILL_BATCH', 300)), onlyMissingPhotos: false, log: (m) => console.log(`[autofill] ${m}`) });
    const { data: seo } = await supabase.rpc('refresh_seo', {});
    last = { at: new Date().toISOString(), reason, ...r, indexable: seo?.[0]?.colleges_indexable ?? null };
    if (r.checked) console.log('[autofill]', last);
    return last;
  } catch (e) {
    last = { at: new Date().toISOString(), reason, error: e.message };
    console.warn('[autofill]', e.message);
    return last;
  } finally { running = false; }
}

export async function runReviewInvites() {
  const { data, error } = await supabase.rpc('queue_review_invites', { p_limit: Number(env('REVIEW_INVITES_BATCH', 500)) });
  lastInvites = { at: new Date().toISOString(), ...(error ? { error: error.message } : (data?.[0] || {})) };
  if (error) console.warn('[review invites]', error.message); else if (data?.[0]?.invited || data?.[0]?.reminded) console.log('[review invites]', lastInvites);
  return lastInvites;
}

export const autofillStatus = () => ({ enabled: env('AUTOFILL', 'on') !== 'off', every_hours: Number(env('AUTOFILL_EVERY_HOURS', 6)), batch: Number(env('AUTOFILL_BATCH', 300)),
  running, last, invites: { enabled: env('REVIEW_INVITES', 'on') !== 'off', last: lastInvites } });

// called after an import finishes so new colleges start filling right away
export const kickAutofill = () => { if (env('AUTOFILL', 'on') !== 'off') setTimeout(() => runAutofill({ reason: 'after import' }), 30_000); };

export function startCollegeAutofill() {
  if (env('AUTOFILL', 'on') !== 'off') {
    const every = Math.max(1, Number(env('AUTOFILL_EVERY_HOURS', 6))) * 3600e3;
    setTimeout(() => runAutofill(), 5 * 60e3);
    setInterval(() => runAutofill(), every);
  }
  if (env('REVIEW_INVITES', 'on') !== 'off') {
    setTimeout(runReviewInvites, 10 * 60e3);
    setInterval(runReviewInvites, 24 * 3600e3);
  }
}
