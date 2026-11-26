import { supabase } from '../supabase.js';
import { runFix } from './autoFix.js';

// Watches every API request. A failed (5xx) or very slow request is counted per route and kind of problem;
// each kind comes with its likely cause and the fix. When one kind repeats quickly (a real outage, not a one-off),
// the matching automatic repair runs (see autoFix.js). Counts are saved to the api_errors table every minute and
// shown in Admin → System health → API errors.

const SLOW_MS = Number(process.env.SLOW_REQUEST_MS || 8000);
const BURST = Number(process.env.AUTO_FIX_ERROR_BURST || 20);      // errors of one kind …
const BURST_WINDOW = 5 * 60e3;                                      // … within 5 minutes → automatic fix

// kind → how to recognise it, what it means, what fixes it, and the automatic repair (if one is safe)
const KINDS = [
  { kind: 'database_down', test: /ECONNREFUSED|ECONNRESET|fetch failed|socket hang up|ENOTFOUND|EAI_AGAIN|502|503|Bad Gateway|upstream connect/i,
    cause: 'The API could not reach the database service (Supabase gateway / PostgREST not answering).',
    fix: 'Usually recovers by restarting the database API; if it keeps happening, check the Supabase containers (docker compose ps in /opt/collegeolo-supabase) and free memory.',
    action: 'restart-rest' },
  { kind: 'database_slow', test: /statement timeout|canceling statement|timeout|timed out|no answer in|too many connections|remaining connection slots/i,
    cause: 'The database was too busy to answer in time (heavy traffic, a big import or a slow query).',
    fix: 'Background jobs are paused automatically to free the database. If one route keeps timing out, it needs an index or caching.',
    action: 'pause-jobs' },
  { kind: 'schema_out_of_date', test: /does not exist|Could not find the (function|table)|schema cache|PGRST20\d|PGRST116/i,
    cause: 'The code expects a table, column or function that the database does not have yet (a migration was not applied).',
    fix: 'Run the newest database migrations: bash deploy/db-migrate.sh supabase/migrations/0XX_….sql (auto-deploy does this on every push; check /root/collegeolo-deploy.log for "MIGRATION FAILED").',
    action: 'restart-rest' },   // PostgREST reloads its schema cache on restart
  { kind: 'permission', test: /permission denied|row-level security|violates row-level|not allowed|42501/i,
    cause: 'The database refused the request because of its access rules (RLS / grants).',
    fix: 'A code or migration fix is needed: give the role access to that table/function, or make the function security definer.',
    action: null },
  { kind: 'login_service', test: /AuthApiError|AuthRetryableFetchError|gotrue|auth\/v1|invalid JWT|JWSError|jwt/i,
    cause: 'The login service (Supabase Auth) failed or rejected a token.',
    fix: 'The login service is restarted automatically when this repeats. Expired tokens are normal; many in a row mean the login service is down.',
    action: 'restart-auth' },
  { kind: 'ai_limit', test: /429|quota|rate.?limit|RESOURCE_EXHAUSTED|overloaded/i,
    cause: 'The AI provider refused because of its usage limit.',
    fix: 'Choose a lighter model or add a second AI key (Admin → AI providers). Requests retry by themselves later.',
    action: null },
  { kind: 'email', test: /SMTP|EAUTH|535|Invalid login|mail/i,
    cause: 'Sending email failed (mail server login or limit).',
    fix: 'Re-run Admin → System health → Email set-up with a fresh Gmail app password.',
    action: null },
  { kind: 'memory', test: /heap out of memory|ENOMEM|JavaScript heap|Cannot allocate memory/i,
    cause: 'The server ran out of memory.',
    fix: 'The API restarts itself. If it repeats, lower background work (AUTOFILL_BATCH) or add memory.',
    action: 'restart-api' },
  { kind: 'bad_input', test: /invalid input syntax|violates (not-null|check|foreign key|unique)|duplicate key|22P02|23505|23503|23502/i,
    cause: 'The request had data the database rejected (missing or duplicate value).',
    fix: 'A code fix is needed so the API checks the input and answers 400 instead of 500.',
    action: null },
];
const SLOW = { kind: 'slow', cause: `The request took longer than ${SLOW_MS / 1000}s.`, fix: 'Usually the server or database is busy; if one route is always slow it needs caching or an index.', action: null };
const OTHER = { kind: 'code_error', cause: 'An error in the API code.', fix: 'Look at the message and the API log (pm2 logs collegeolo-api); it needs a code fix.', action: null };

export function classify(message = '', status = 500) {
  if (status === 504 || status === 503) return KINDS[0];
  return KINDS.find((k) => k.test.test(message)) || OTHER;
}

// normalise /api/college/1234-abc → /api/college/:id so one route is one row
const routeOf = (req) => {
  const p = (req.baseUrl || '') + (req.route?.path || '');
  const raw = p && p !== '/' ? p : (req.originalUrl || req.url || '').split('?')[0];
  return `${req.method} ${raw.replace(/\/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, '/:id').replace(/\/\d+(?=\/|$)/g, '/:n')}`.slice(0, 160);
};

const pending = new Map();   // key → row waiting to be saved
const live = [];             // last 100 problems (newest first) for the admin page
const bursts = new Map();    // kind → [timestamps]

export function recordProblem({ route, status, message, slowMs = 0 }) {
  const k = slowMs ? SLOW : classify(message, status);
  const key = `${route}|${k.kind}`.slice(0, 200);
  const now = new Date().toISOString();
  const row = pending.get(key) || { key, route, kind: k.kind, cause: k.cause, fix: k.fix, count: 0, first_at: now };
  row.count += 1; row.status = status; row.message = String(message || (slowMs ? `${slowMs} ms` : '')).slice(0, 500); row.last_at = now;
  pending.set(key, row);
  live.unshift({ at: now, route, status, kind: k.kind, message: row.message }); live.length = Math.min(live.length, 100);
  if (k.action) {
    const t = (bursts.get(k.kind) || []).filter((x) => Date.now() - x < BURST_WINDOW);
    t.push(Date.now()); bursts.set(k.kind, t);
    if (t.length >= BURST) { bursts.set(k.kind, []); runFix(k.action, `${t.length} "${k.kind.replace('_', ' ')}" errors in 5 min (latest: ${route} — ${row.message.slice(0, 120)})`).catch(() => {}); }
  }
}

// Express middleware: put it first. It sees the final status of every request and the error text the route sent.
export function errorWatch() {
  return (req, res, next) => {
    const t0 = Date.now();
    const json = res.json.bind(res);
    res.json = (body) => { if (res.statusCode >= 500 && body && typeof body === 'object') res.locals.errMsg = body.error || body.message; return json(body); };
    res.on('finish', () => {
      const ms = Date.now() - t0;
      if (req.path === '/api/health') return;
      if (res.statusCode >= 500) recordProblem({ route: routeOf(req), status: res.statusCode, message: res.locals.errMsg || res.statusMessage });
      else if (ms > SLOW_MS && !/\/(ai|mock|import|chat|assistant|stream)/.test(req.path)) recordProblem({ route: routeOf(req), status: res.statusCode, slowMs: ms });
    });
    next();
  };
}

async function flush() {
  if (!pending.size) return;
  const rows = [...pending.values()]; pending.clear();
  const { error } = await supabase.rpc('bump_api_errors', { p_rows: rows });
  if (error) { for (const r of rows) if (!pending.has(r.key)) pending.set(r.key, r); if (pending.size > 500) pending.clear(); }
}

export function startErrorWatch() {
  setInterval(() => flush().catch(() => {}), 60e3).unref();
  setInterval(() => supabase.rpc('trim_api_errors').then(() => {}, () => {}), 24 * 3600e3).unref();
  // a crash in background code is recorded instead of silently killing the API
  process.on('unhandledRejection', (e) => { console.error('[unhandled]', e); recordProblem({ route: 'background task', status: 500, message: e?.message || String(e) }); });
  process.on('uncaughtException', (e) => {
    console.error('[crash]', e); recordProblem({ route: 'API process', status: 500, message: e?.message || String(e) });
    flush().finally(() => process.exit(1));   // PM2 starts the API again within seconds
  });
}

export async function errorReport({ limit = 100 } = {}) {
  await flush().catch(() => {});
  const { data } = await supabase.from('api_errors').select('*').order('last_at', { ascending: false }).limit(limit);
  return { errors: data || [], live: live.slice(0, 50) };
}
export async function markResolved(key) {
  const q = supabase.from('api_errors').update({ resolved: true });
  const { error } = key ? await q.eq('key', key) : await q.eq('resolved', false);
  if (error) throw new Error(error.message);
  return { ok: true };
}
