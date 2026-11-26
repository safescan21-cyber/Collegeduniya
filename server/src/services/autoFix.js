import { execFile } from 'node:child_process';
import { supabase } from '../supabase.js';
import { cleanEnv } from './emailSetup.js';
import { pauseJobs } from './loadGuard.js';

// Automatic repairs. Each one is safe to repeat, has a cool-down (no restart loops) and a daily cap, and is logged
// (Admin → System health → Automatic fixes) and announced to admins. AUTO_FIX=off turns automatic repairs off
// (they can still be started by hand from the admin panel).

const SUPABASE_DIR = process.env.SUPABASE_DIR || '/opt/collegeolo-supabase';
const COOLDOWN_MS = Number(process.env.AUTO_FIX_COOLDOWN_MIN || 15) * 60e3;
const DAILY_CAP = Number(process.env.AUTO_FIX_DAILY_CAP || 6);

const sh = (cmd, args, opts = {}) => new Promise((resolve, reject) =>
  execFile(cmd, args, { timeout: 120000, env: cleanEnv(), ...opts }, (e, out, err) =>
    (e ? reject(new Error(String(err || e.message).trim().slice(-300))) : resolve(String(out).trim().slice(-300)))));
const compose = (...args) => sh('docker', ['compose', ...args], { cwd: SUPABASE_DIR });

export const ACTIONS = {
  'restart-web': { label: 'Restart the website (no downtime)', run: () => sh('pm2', ['reload', 'collegeolo-web']) },
  'restart-api': { label: 'Restart the API', run: async () => { setTimeout(() => process.exit(1), 1500); return 'restarting (PM2 starts it again)'; } },
  'restart-auth': { label: 'Restart the login service', run: () => compose('restart', 'auth') },
  'restart-rest': { label: 'Restart the database API (PostgREST)', run: () => compose('restart', 'rest') },
  'restart-realtime': { label: 'Restart live chat & calls (Realtime)', run: () => compose('restart', 'realtime') },
  'restart-storage': { label: 'Restart file storage', run: () => compose('restart', 'storage') },
  'pause-jobs': { label: 'Pause background jobs for 30 minutes', run: async (why) => { pauseJobs(30 * 60e3, why); return 'background jobs paused for 30 min'; } },
};

const history = new Map();   // action → [timestamps]
const recent = [];           // last 50 fixes (also in the auto_fixes table)
let notify = null;           // set by health.js (emails + in-app notifications to admins)
export const setFixNotifier = (fn) => { notify = fn; };

export async function runFix(action, reason, { manual = false } = {}) {
  const a = ACTIONS[action];
  if (!a) throw Object.assign(new Error(`unknown action ${action}`), { status: 400 });
  const now = Date.now();
  const times = (history.get(action) || []).filter((t) => now - t < 24 * 3600e3);
  if (!manual) {
    if (process.env.AUTO_FIX === 'off') return { action, skipped: 'automatic fixes are off (AUTO_FIX=off)' };
    if (times.length && now - times[times.length - 1] < COOLDOWN_MS) return { action, skipped: 'tried a few minutes ago — waiting before trying again' };
    if (times.length >= DAILY_CAP) return { action, skipped: `already tried ${DAILY_CAP}× today — needs a person to look` };
  }
  times.push(now); history.set(action, times);
  let ok = true; let detail;
  try { detail = await a.run(reason); } catch (e) { ok = false; detail = e.message; }
  const row = { action, reason: String(reason || '').slice(0, 300), ok, detail: String(detail || '').slice(0, 300), created_at: new Date().toISOString(), manual };
  recent.unshift(row); recent.length = Math.min(recent.length, 50);
  console.warn(`[auto-fix] ${a.label} — ${ok ? 'done' : 'FAILED'} (${reason})${detail ? `: ${detail}` : ''}`);
  supabase.from('auto_fixes').insert({ action, reason: row.reason, ok, detail: row.detail }).then(() => {}, () => {});
  if (notify && !manual) notify(`${ok ? '🔧 Fixed automatically' : '⚠ Automatic fix failed'}: ${a.label}`, [`Problem: ${reason}`, `Result: ${ok ? 'done' : 'failed'}${detail ? ` — ${detail}` : ''}`]).catch(() => {});
  return { action, label: a.label, ok, detail };
}

export async function fixHistory(limit = 50) {
  const { data } = await supabase.from('auto_fixes').select('*').order('created_at', { ascending: false }).limit(limit);
  return data?.length ? data : recent;
}
export const actionList = () => Object.entries(ACTIONS).map(([id, a]) => ({ id, label: a.label }));

// what is using the CPU right now (shown when the server is very busy)
export async function topProcesses() {
  try {
    const out = await new Promise((resolve, reject) => execFile('ps', ['-eo', 'pcpu,rss,args', '--sort=-pcpu'], { timeout: 5000 }, (e, o) => (e ? reject(e) : resolve(o))));
    return out.split('\n').slice(1, 6).map((l) => l.trim()).filter(Boolean).map((l) => {
      const [cpu, rss, ...cmd] = l.split(/\s+/);
      const c = cmd.join(' ');
      const name = /next build/.test(c) ? 'website build' : /next.*start|next-server/.test(c) ? 'website' : /collegeolo\/server|src\/index\.js/.test(c) ? 'API'
        : /postgres/.test(c) ? 'database' : /foodpharma/i.test(c) ? 'foodpharma app' : c.split('/').pop().slice(0, 40);
      return `${name} ${cpu}% CPU ${Math.round(Number(rss) / 1024)} MB`;
    });
  } catch { return []; }
}
