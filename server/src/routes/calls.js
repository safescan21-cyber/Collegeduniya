import { Router } from 'express';
import { requireUser } from '../middleware/auth.js';

// GET /api/calls/ice → ICE servers for WebRTC calls. STUN is free; a TURN relay is needed for calls on some
// mobile / college networks. Options (server/.env):
//   CLOUDFLARE_TURN_KEY_ID + CLOUDFLARE_TURN_API_TOKEN   → short-lived Cloudflare TURN credentials (1,000 GB/month free)
//   TURN_URLS=turn:turn.example.com:3478,turns:turn.example.com:5349 + TURN_USERNAME + TURN_CREDENTIAL  (e.g. your own coturn)
const router = Router();
const STUN = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }];
let cache = { at: 0, servers: null };

router.get('/ice', requireUser, async (_req, res) => {
  const env = (k) => (process.env[k] || '').trim();
  try {
    if (env('CLOUDFLARE_TURN_KEY_ID') && env('CLOUDFLARE_TURN_API_TOKEN')) {
      if (!cache.servers || Date.now() - cache.at > 3600e3) {
        const r = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${env('CLOUDFLARE_TURN_KEY_ID')}/credentials/generate-ice-servers`, {
          method: 'POST', headers: { authorization: `Bearer ${env('CLOUDFLARE_TURN_API_TOKEN')}`, 'content-type': 'application/json' },
          body: JSON.stringify({ ttl: 4 * 3600 }),
        });
        const d = await r.json();
        if (!r.ok || !d.iceServers) throw new Error(d?.errors?.[0]?.message || `TURN HTTP ${r.status}`);
        cache = { at: Date.now(), servers: Array.isArray(d.iceServers) ? d.iceServers : [d.iceServers] };
      }
      return res.json({ iceServers: [...STUN, ...cache.servers], turn: true });
    }
    if (env('TURN_URLS')) {
      return res.json({ iceServers: [...STUN, { urls: env('TURN_URLS').split(',').map((s) => s.trim()), username: env('TURN_USERNAME'), credential: env('TURN_CREDENTIAL') }], turn: true });
    }
  } catch (e) { console.warn('[calls] TURN:', e.message); }
  res.json({ iceServers: STUN, turn: false });
});

export default router;
