import os from 'node:os';
import fs from 'node:fs/promises';
import tls from 'node:tls';
import { supabase } from '../supabase.js';
import { sendMail, mailEnabled } from './mailer.js';
import { llmReady } from './llm.js';
import { runFix, setFixNotifier, topProcesses } from './autoFix.js';
import { loadStatus } from './loadGuard.js';

// System health: every HEALTH_EVERY_MIN (5) minutes the API checks the website, database, login service, file storage,
// live chat, email, disk, memory, SSL certificates and background jobs. A check that fails twice in a row alerts every
// admin by email (ALERT_EMAILS, or all admins' emails) and with an in-app notification; recovery is announced too.
// Admin → System health shows the live status. HEALTH_MONITOR=off disables the schedule.

const env = (k, d) => process.env[k] ?? d;
const SITE = env('SITE_URL', 'https://www.collegeolo.com').replace(/\/$/, '');
const SB = env('SUPABASE_URL', '').replace(/\/$/, '');
const KEY = env('SUPABASE_SERVICE_ROLE_KEY', '');

const state = new Map();   // name → { ok, level, detail, ms, checkedAt, since, fails, alerted }
let lastRun = null; let running = null;

async function timed(fn, timeoutMs = 10000) {
  const t0 = Date.now();
  const timer = new Promise((_, rej) => setTimeout(() => rej(new Error(`no answer in ${timeoutMs / 1000}s`)), timeoutMs));
  try { const detail = await Promise.race([fn(), timer]); return { ok: true, ms: Date.now() - t0, detail: detail || 'OK' }; }
  catch (e) { return { ok: false, ms: Date.now() - t0, detail: e.message || String(e) }; }
}
async function http(url, opts = {}, expect = (s) => s >= 200 && s < 400) {
  const r = await fetch(url, { ...opts, redirect: 'manual', signal: AbortSignal.timeout(9000) });
  if (!expect(r.status)) throw new Error(`HTTP ${r.status}`);
  return `HTTP ${r.status}`;
}

function certDays(host) {
  return new Promise((resolve, reject) => {
    const s = tls.connect({ host, port: 443, servername: host, timeout: 8000 }, () => {
      const c = s.getPeerCertificate(); s.end();
      if (!c?.valid_to) return reject(new Error('no certificate'));
      resolve(Math.floor((Date.parse(c.valid_to) - Date.now()) / 86400e3));
    });
    s.on('error', reject); s.on('timeout', () => { s.destroy(); reject(new Error('timeout')); });
  });
}

// each check returns { ok, detail } or throws; `warn: true` means "show, but don't email"
const CHECKS = [
  { name: 'Website', group: 'Site', run: () => http(`${SITE}/`) },
  // the page's own JavaScript must load too — a missing file breaks buttons and login even though the page shows
  { name: 'Website scripts', group: 'Site', run: async () => {
    const html = await (await fetch(`${SITE}/`, { signal: AbortSignal.timeout(9000) })).text();
    const chunks = [...new Set(html.match(/\/_next\/static\/[^"'\s]+\.js/g) || [])].slice(0, 3);
    if (!chunks.length) return 'no scripts on the page';
    for (const c of chunks) {
      const r = await fetch(`${SITE}${c}`, { method: 'HEAD', signal: AbortSignal.timeout(9000) });
      if (r.status !== 200) throw new Error(`script ${c.split('/').pop()} answers ${r.status} — pages cannot run (login, buttons)`);
    }
    return `${chunks.length} scripts load`;
  } },
  { name: 'API server', group: 'Site', run: async () => `up ${Math.round(process.uptime() / 60)} min, ${Math.round(process.memoryUsage().rss / 1048576)} MB` },
  { name: 'Database', group: 'Supabase', run: async () => {
    const { count, error } = await supabase.from('colleges').select('id', { count: 'estimated', head: true });   // estimated: cheap even when busy
    if (error) throw new Error(error.message);
    return `about ${(count || 0).toLocaleString('en-IN')} colleges`;
  } },
  { name: 'Login service', group: 'Supabase', run: () => http(`${SB}/auth/v1/health`, { headers: { apikey: KEY } }) },
  { name: 'File storage', group: 'Supabase', run: async () => {
    const { data, error } = await supabase.storage.listBuckets();
    if (error) throw new Error(error.message);
    return `${data.length} buckets`;
  } },
  { name: 'Live chat & calls', group: 'Supabase', run: () => new Promise((resolve, reject) => {
    // a real realtime connection, the same way chat and calls connect
    const ch = supabase.channel(`health-${Date.now()}`);
    const done = (fn, v) => { supabase.removeChannel(ch).catch(() => {}); fn(v); };
    const t = setTimeout(() => done(reject, new Error('no realtime connection in 8s')), 8000);
    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') { clearTimeout(t); done(resolve, 'connected'); }
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { clearTimeout(t); done(reject, new Error(`realtime ${status.toLowerCase()}`)); }
    });
  }) },
  { name: 'Outgoing email', group: 'Services', warn: true, run: async () => {
    if (!mailEnabled()) throw new Error('not set up — run deploy/set-smtp.sh');
    return 'configured';
  } },
  { name: 'AI assistant', group: 'Services', warn: true, run: async () => { if (!llmReady()) throw new Error('no AI key configured'); return 'configured'; } },
  { name: 'Disk space', group: 'Server', run: async () => {
    const s = await fs.statfs('/');
    const freeGb = (s.bavail * s.bsize) / 1073741824; const pct = 100 - (s.bavail / s.blocks) * 100;
    if (freeGb < 3) throw new Error(`only ${freeGb.toFixed(1)} GB free`);
    return `${freeGb.toFixed(0)} GB free (${pct.toFixed(0)}% used)`;
  } },
  { name: 'Memory', group: 'Server', run: async () => {
    const freePct = (os.freemem() / os.totalmem()) * 100;
    const load = os.loadavg()[0] / os.cpus().length;
    if (load > 3) {
      const top = await topProcesses();
      throw new Error(`server very busy (load ${os.loadavg()[0].toFixed(1)} on ${os.cpus().length} CPUs)${top.length ? ` — ${top.slice(0, 4).join(', ')}` : ''}`);
    }
    if (freePct < 5) throw new Error(`memory almost full (${(os.freemem() / 1073741824).toFixed(1)} GB free)`);
    return `${(os.freemem() / 1073741824).toFixed(1)} GB free of ${(os.totalmem() / 1073741824).toFixed(0)} GB · load ${os.loadavg()[0].toFixed(1)}`;
  } },
  { name: 'Database queries', group: 'Server', warn: true, run: async () => {
    // what the database is busy with right now (slowest first); the watchdog stops app queries over 5 minutes
    const { data, error } = await supabase.rpc('admin_db_activity');
    if (error) throw new Error(error.message);
    const slow = (data || []).filter((q) => q.seconds >= 10);
    if (!slow.length) {
      // nothing slow right now — if the server is busy, show which queries used the most database time overall
      if (os.loadavg()[0] / os.cpus().length > 2) {
        const { data: top } = await supabase.rpc('admin_top_queries', { p_lim: 4 });
        if (top?.length) throw new Error(`${(data || []).length} running, none slow — most database time so far: ${top.map((t) => `${t.total_seconds}s total, ${t.calls}× avg ${t.avg_ms}ms: ${t.query.slice(0, 120)}`).join(' · ')}`);
      }
      return `${(data || []).length} running, none slow`;
    }
    const fmt = (q) => `${q.seconds >= 60 ? `${Math.floor(q.seconds / 60)}m${q.seconds % 60}s` : `${q.seconds}s`} [${q.role}${q.app ? `/${q.app}` : ''}${q.waiting ? `, waiting ${q.waiting}` : ''}] ${q.query.slice(0, 160)}`;
    throw new Error(`${slow.length} slow: ${slow.slice(0, 4).map(fmt).join(' · ')}`);
  } },
  ...['www.collegeolo.com', 'db.collegeolo.com'].map((h) => ({ name: `SSL ${h}`, group: 'Server', run: async () => {
    const d = await certDays(h);
    if (d < 10) throw new Error(`certificate expires in ${d} days`);
    return `valid ${d} more days`;
  } })),
  { name: 'Background jobs', group: 'Jobs', warn: true, run: async () => {
    const { data, error } = await supabase.from('import_runs').select('kind, status, message, created_at')
      .gte('created_at', new Date(Date.now() - 24 * 3600e3).toISOString()).order('created_at', { ascending: false }).limit(50);
    if (error) throw new Error(error.message);
    const failed = (data || []).filter((r) => r.status === 'failed');
    if (failed.length) throw new Error(`${failed.length} failed in 24h (latest: ${failed[0].kind}${failed[0].message ? ` — ${String(failed[0].message).slice(0, 80)}` : ''})`);
    return `${(data || []).length} runs in 24h, none failed`;
  } },
];

// which automatic repair fixes which failing check
const HEAL = {
  Website: 'restart-web',
  'Website scripts': 'restart-web',
  'Login service': 'restart-auth',
  Database: 'restart-rest',
  'File storage': 'restart-storage',
  'Live chat & calls': 'restart-realtime',
  Memory: 'pause-jobs',
};

async function adminRecipients() {
  const list = env('ALERT_EMAILS', '').split(',').map((s) => s.trim()).filter(Boolean);
  const { data } = await supabase.from('profiles').select('id, email').in('role', ['admin', 'super_admin']).eq('is_blocked', false);
  return { emails: list.length ? list : (data || []).map((p) => p.email).filter(Boolean), ids: (data || []).map((p) => p.id) };
}

async function alert(kind, items) {
  if (!items.length) return;
  const down = kind === 'down';
  const subject = down ? `⚠ Collegeolo: ${items.map((i) => i.name).join(', ')} not working` : `✓ Collegeolo: ${items.map((i) => i.name).join(', ')} working again`;
  const lines = items.map((i) => `• ${i.name}: ${i.detail}`);
  const text = `${down ? 'A problem was found' : 'Fixed'} at ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} (India time).\n\n${lines.join('\n')}\n\nLive status: ${SITE}/admin/health`;
  try {
    const { emails, ids } = await adminRecipients();
    if (ids.length) {
      await supabase.from('notifications').insert(ids.map((id) => ({ user_id: id, kind: 'system_alert', title: subject.slice(0, 200), body: lines.join(' ').slice(0, 500), link: '/admin/health', status: 'sent' })));
    }
    if (mailEnabled() && emails.length) await sendMail({ to: emails.join(','), subject, text });
  } catch (e) {
    // database itself may be down — still try email to ALERT_EMAILS
    const fallback = env('ALERT_EMAILS', '').split(',').map((s) => s.trim()).filter(Boolean);
    if (mailEnabled() && fallback.length) await sendMail({ to: fallback.join(','), subject, text }).catch(() => {});
    console.warn('[health] alert:', e.message);
  }
}

export async function runHealthChecks({ notify = true } = {}) {
  if (running) return running;
  running = (async () => {
    const results = await Promise.all(CHECKS.map(async (c) => ({ c, r: await timed(c.run) })));
    const now = new Date().toISOString();
    const wentDown = []; const cameBack = [];
    for (const { c, r } of results) {
      const prev = state.get(c.name) || { ok: true, since: now, fails: 0, alerted: false };
      const fails = r.ok ? 0 : prev.fails + 1;
      const cur = { name: c.name, group: c.group, warn: !!c.warn, ok: r.ok, detail: r.detail, ms: r.ms, checkedAt: now,
        since: prev.ok === r.ok && state.has(c.name) ? prev.since : now, fails, alerted: prev.alerted };
      if (!c.warn) {
        if (!r.ok && fails >= 2 && !prev.alerted) { wentDown.push(cur); cur.alerted = true; }
        if (r.ok && prev.alerted) { cameBack.push(cur); cur.alerted = false; }
      }
      state.set(c.name, cur);
    }
    lastRun = now;
    // automatic repair for parts that failed twice in a row (cool-down and daily cap in autoFix.js)
    for (const { c } of results) {
      const cur = state.get(c.name);
      if (!cur || cur.ok || cur.warn || cur.fails < 2) continue;
      const action = HEAL[c.name];
      if (action) runFix(action, `${c.name}: ${cur.detail}`).then((f) => { if (f && !f.skipped) cur.fix = `${f.label}: ${f.ok ? 'done' : 'failed'}`; }).catch(() => {});
    }
    if (notify) { await alert('down', wentDown); await alert('up', cameBack); }
    if (wentDown.length) console.warn('[health] DOWN:', wentDown.map((x) => `${x.name}: ${x.detail}`).join(' | '));
    return healthStatus();
  })().finally(() => { running = null; });
  return running;
}

export function healthStatus() {
  const checks = CHECKS.map((c) => state.get(c.name)).filter(Boolean);
  const bad = checks.filter((c) => !c.ok && !c.warn);
  return { lastRun, overall: !checks.length ? 'unknown' : bad.length ? 'down' : checks.some((c) => !c.ok) ? 'warning' : 'ok',
    every_min: Number(env('HEALTH_EVERY_MIN', 3)), load: loadStatus(), auto_fix: env('AUTO_FIX', 'on') !== 'off', email_alerts: mailEnabled(), alert_emails: env('ALERT_EMAILS', '') || 'all admins', checks };
}

// short message to all admins (used for automatic fixes)
async function notifyAdmins(subject, lines) {
  const text = `${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} (India time)\n\n${lines.join('\n')}\n\nDetails: ${SITE}/admin/health`;
  try {
    const { emails, ids } = await adminRecipients();
    if (ids.length) await supabase.from('notifications').insert(ids.map((id) => ({ user_id: id, kind: 'system_alert', title: `Collegeolo: ${subject}`.slice(0, 200), body: lines.join(' ').slice(0, 500), link: '/admin/health', status: 'sent' })));
    if (mailEnabled() && emails.length) await sendMail({ to: emails.join(','), subject: `Collegeolo: ${subject}`, text });
  } catch (e) { console.warn('[health] notify:', e.message); }
}

export async function sendTestAlert() {
  await alert('down', [{ name: 'Test alert', detail: 'This is a test from Admin → System health. Nothing is wrong.' }]);
  return { ok: true, email: mailEnabled() };
}

export function startHealthMonitor() {
  setFixNotifier(notifyAdmins);
  if (env('HEALTH_MONITOR', 'on') === 'off') return;
  const every = Math.max(1, Number(env('HEALTH_EVERY_MIN', 3))) * 60e3;   // a broken part is repaired within ~6 minutes
  setTimeout(() => runHealthChecks().catch((e) => console.warn('[health]', e.message)), 20e3);
  setInterval(() => runHealthChecks().catch((e) => console.warn('[health]', e.message)), every).unref();
}
