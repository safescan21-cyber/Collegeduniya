import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { supabase } from '../supabase.js';
import { requireUser } from '../middleware/auth.js';

// Presence heartbeats, login history and the "came online" feed.
// Location comes from your CDN / proxy — enable ONE of:
//   • Cloudflare → Rules → Managed Transforms → "Add visitor location headers" (cf-ipcity, cf-region, cf-ipcountry)
//   • Nginx GeoIP2 module with the free MaxMind GeoLite2-City database, passing X-City / X-Region / X-Country
// Without these, logged-in students fall back to the city in their profile; guests show no city.
const router = Router();
// Many students can share one IP (campus / hostel Wi-Fi), so limit per tab, with a generous per-IP ceiling
const ipLimit = rateLimit({ windowMs: 60_000, limit: 1200, standardHeaders: true, legacyHeaders: false });
const tabLimit = rateLimit({ windowMs: 60_000, limit: 6, standardHeaders: false, legacyHeaders: false,
  keyGenerator: (req) => `tab:${String(req.body?.session_id || '').slice(0, 64) || 'none'}` });
const loginLimit = rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: true, legacyHeaders: false });

const hdr = (req, ...names) => {
  for (const n of names) {
    const v = req.headers[n];
    if (v && v !== 'XX' && v !== 'T1') { try { return decodeURIComponent(String(v)).slice(0, 80); } catch { return String(v).slice(0, 80); } }
  }
  return null;
};
export const geoFromReq = (req) => ({
  city: hdr(req, 'cf-ipcity', 'x-city', 'x-geo-city'),
  region: hdr(req, 'cf-region', 'x-region', 'x-geo-region'),
  country: hdr(req, 'cf-ipcountry', 'x-country', 'x-geo-country'),
});
export function deviceFromUA(ua = '') {
  const b = /Edg\//.test(ua) ? 'Edge' : /SamsungBrowser/.test(ua) ? 'Samsung Internet' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox'
    : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const o = /Android/.test(ua) ? 'Android' : /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Windows/.test(ua) ? 'Windows'
    : /Mac OS X/.test(ua) ? 'Mac' : /CrOS/.test(ua) ? 'ChromeOS' : /Linux/.test(ua) ? 'Linux' : 'device';
  return `${b} on ${o}`;
}

let lastGuestEvent = 0;
const beat = z.object({ session_id: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/), path: z.string().max(300).optional() });

// POST /api/presence — every ~60 s from each open tab
router.post('/presence', ipLimit, tabLimit, async (req, res) => {
  const parsed = beat.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: 'Invalid' });
  const ua = String(req.headers['user-agent'] || '');
  if (/bot|crawler|spider|preview|headless/i.test(ua)) return res.json({ ok: true });
  const { session_id, path } = parsed.data;
  const uid = req.user?.id || null;
  const geo = geoFromReq(req);
  try {
    const { data: prev } = await supabase.from('site_presence').select('user_id, last_seen').eq('session_id', session_id).maybeSingle();
    if (prev && prev.user_id && prev.user_id !== uid) return res.status(409).json({ error: 'Session belongs to someone else' });
    const now = new Date();
    const back = !prev || now - new Date(prev.last_seen) > 10 * 60_000;   // new tab, or back after 10+ minutes
    let profile = null;
    if (uid && (back || !geo.city)) {
      ({ data: profile } = await supabase.from('profiles').select('full_name, city, show_online, is_blocked').eq('id', uid).maybeSingle());
    }
    const city = geo.city || profile?.city || null;
    const up = await supabase.from('site_presence').upsert({
      session_id, user_id: uid, path: path || null, city, region: geo.region, country: geo.country, device: deviceFromUA(ua),
      last_seen: now.toISOString(), ...(prev ? {} : { first_seen: now.toISOString() }),
    }, { onConflict: 'session_id' });
    if (up.error) throw up.error;
    if (uid && back) await supabase.from('profiles').update({ last_seen_at: now.toISOString() }).eq('id', uid);

    // feed for the silent "is online" alerts
    if (back && !profile?.is_blocked) {
      if (uid) {
        const since = new Date(Date.now() - 30 * 60_000).toISOString();
        const { count } = await supabase.from('online_events').select('id', { count: 'exact', head: true }).eq('user_id', uid).gte('created_at', since);
        if (!count) {
          await supabase.from('online_events').insert({ user_id: uid, display: profile?.show_online ? (profile.full_name || '').split(' ')[0].slice(0, 30) || null : null, city: profile?.show_online ? city : (geo.city || null) });
        }
      } else if (Date.now() - lastGuestEvent > 45_000) {          // guests: anonymous, at most one alert every 45 s
        lastGuestEvent = Date.now();
        await supabase.from('online_events').insert({ user_id: null, display: null, city: geo.city });
      }
    }
    res.json({ ok: true });
  } catch (e) {
    console.error('[presence]', e.message);
    res.status(500).json({ error: 'presence failed' });
  }
});

// POST /api/session/login — called once after a successful login
router.post('/session/login', loginLimit, requireUser, async (req, res) => {
  const ua = String(req.headers['user-agent'] || '');
  const device = deviceFromUA(ua);
  const since = new Date(Date.now() - 30 * 60_000).toISOString();
  const { count } = await supabase.from('login_events').select('id', { count: 'exact', head: true }).eq('user_id', req.user.id).eq('device', device).gte('created_at', since);
  if (!count) {
    const geo = geoFromReq(req);
    await supabase.from('login_events').insert({ user_id: req.user.id, method: req.user.phone && !req.user.email ? 'phone' : 'email', device, ...geo });
  }
  res.json({ ok: true });
});

// housekeeping: presence older than a day, alert feed older than two days
export function startPresenceCleanup() {
  const tick = async () => {
    const day = new Date(Date.now() - 86400e3).toISOString();
    const two = new Date(Date.now() - 2 * 86400e3).toISOString();
    await supabase.from('site_presence').delete().lt('last_seen', day).then(() => undefined, () => undefined);
    await supabase.from('online_events').delete().lt('created_at', two).then(() => undefined, () => undefined);
  };
  setInterval(tick, 30 * 60_000).unref();
}

export default router;
