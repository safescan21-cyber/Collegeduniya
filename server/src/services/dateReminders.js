// Hourly: queue "3 days / 1 day before" notifications for followed exam dates and students' own application deadlines.
// The database function is idempotent (it skips anyone already reminded for that date), so restarts are harmless.
import { supabase } from '../supabase.js';
import { serverBusy } from './loadGuard.js';

export async function runDateReminders() {
  const { data, error } = await supabase.rpc('queue_date_reminders');
  if (error) { console.warn('[reminders]', error.message); return 0; }
  if (data) console.log(`[reminders] queued ${data}`);
  return data || 0;
}

export function startDateReminders() {
  const tick = () => { if (!serverBusy()) runDateReminders().catch(() => {}); };
  setTimeout(tick, 4 * 60 * 1000);
  setInterval(tick, 60 * 60 * 1000);
}
