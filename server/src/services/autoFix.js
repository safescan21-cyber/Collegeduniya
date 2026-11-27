import fs from 'node:fs/promises';
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
// What is using the server RIGHT NOW. `ps` shows each process's average CPU since it started (so `ps` itself always
// looks like 100% and long-running busy processes look idle) — instead we read /proc twice, 1 second apart, and
// report the real current CPU per program, plus disk wait (load can be high while CPU is idle if the disk is slow).
const nameOf = (c) => /next build|next-build|\.next-[ab].*build/.test(c) ? 'website build' : /npm (ci|install)/.test(c) ? 'npm install'
  : /next.*start|next-server/.test(c) ? 'website' : /collegeolo\/server|src\/index\.js/.test(c) ? 'API'
  : /postgres/.test(c) ? 'database' : /foodpharma/i.test(c) ? 'foodpharma app' : /imgproxy/.test(c) ? 'imgproxy'
  : /dockerd|containerd/.test(c) ? 'docker' : /kworker|kswapd|jbd2|ksoftirq/.test(c) ? 'system (disk/memory)' : (c.split(/\s+/)[0] || '').split('/').pop().slice(0, 30);
// which Docker container a process belongs to (so two Supabase databases on one server are shown separately)
let containerNames = { at: 0, map: new Map() };
async function containerOf(pid) {
  try {
    const cg = await fs.readFile(`/proc/${pid}/cgroup`, 'utf8');
    const id = cg.match(/([0-9a-f]{64})/)?.[1]; if (!id) return null;
    if (Date.now() - containerNames.at > 5 * 60_000) {
      const { execFile } = await import('node:child_process');
      const out = await new Promise((res) => execFile('docker', ['ps', '--no-trunc', '--format', '{{.ID}} {{.Names}}'], { timeout: 5000 }, (e, so) => res(e ? '' : so)));
      containerNames = { at: Date.now(), map: new Map(out.split('\n').filter(Boolean).map((l) => l.split(' '))) };
    }
    return containerNames.map.get(id) || null;
  } catch { return null; }
}
async function procSnapshot() {
  const snap = new Map(); let dState = 0;
  for (const pid of (await fs.readdir('/proc')).filter((d) => /^\d+$/.test(d))) {
    try {
      const st = await fs.readFile(`/proc/${pid}/stat`, 'utf8');
      const rest = st.slice(st.lastIndexOf(')') + 2).split(' ');
      if (rest[0] === 'D') dState++;
      const ticks = Number(rest[11]) + Number(rest[12]);              // utime + stime
      const rss = Number(rest[21]) * 4096;
      let cmd = (await fs.readFile(`/proc/${pid}/cmdline`, 'utf8')).replace(/\0/g, ' ').trim();
      if (!cmd) cmd = `[${st.slice(st.indexOf('(') + 1, st.lastIndexOf(')'))}]`;
      snap.set(pid, { ticks, rss, cmd, pid });
    } catch { /* process ended */ }
  }
  return { snap, dState };
}
async function cpuTimes() {
  const l = (await fs.readFile('/proc/stat', 'utf8')).split('\n')[0].trim().split(/\s+/).slice(1).map(Number);
  return { total: l.reduce((a, b) => a + b, 0), idle: l[3], iowait: l[4] || 0 };
}
export async function topProcesses() {
  try {
    const [a, c0] = await Promise.all([procSnapshot(), cpuTimes()]);
    await new Promise((r) => setTimeout(r, 1000));
    const [b, c1] = await Promise.all([procSnapshot(), cpuTimes()]);
    const HZ = 100; const groups = new Map();
    for (const [pid, p] of b.snap) {
      const before = a.snap.get(pid); if (!before) continue;
      const cpu = ((p.ticks - before.ticks) / HZ) * 100;            // % of one CPU over the 1 s sample
      let n = nameOf(p.cmd);
      if (cpu >= 1 && (n === 'database' || n === 'imgproxy')) { const c = await containerOf(p.pid); if (c) n = `${n} (${c.replace(/[-_]?(db|imgproxy)[-_]?\d*$/i, '').replace(/^supabase[-_]?/i, '') || c})`; }
      const g = groups.get(n) || { cpu: 0, rss: 0 };
      g.cpu += cpu; g.rss += p.rss; groups.set(n, g);
    }
    const dt = c1.total - c0.total || 1;
    const busy = Math.round(100 * (1 - (c1.idle - c0.idle + c1.iowait - c0.iowait) / dt));
    const iow = Math.round(100 * (c1.iowait - c0.iowait) / dt);
    const list = [...groups].filter(([, g]) => g.cpu >= 1).sort((x, y) => y[1].cpu - x[1].cpu).slice(0, 5)
      .map(([n, g]) => `${n} ${Math.round(g.cpu)}% CPU ${Math.round(g.rss / 1048576)} MB`);
    return [`CPU ${busy}% busy, disk wait ${iow}%${b.dState ? `, ${b.dState} waiting on disk` : ''}`, ...list];
  } catch { return []; }
}
