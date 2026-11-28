import { supabase } from '../supabase.js';
import { whenIdle } from './loadGuard.js';
import { USER_AGENT } from './http.js';

// College website check (migration 056). Every WEBSITE_CHECK_EVERY_MINUTES (30) when the server is idle, it opens the next
// WEBSITE_CHECK_PER_RUN (150) college websites, 6 at a time, follows redirects itself (max 6 hops) and records:
//   ok       same site (www / https / a page on it, or a sub-site of the same domain)
//   moved    now goes to a different domain — could be the college's new address, could be a takeover → admin decides
//   blocked  the site refuses servers (403/401/429) or times out — not judged, checked again later
//   dead     the domain doesn't exist / no server / page gone (404/410) — only after 2 checks in a row
//   bad      parked, "domain for sale", or spam (betting, casino, adult) — hidden from the public page at once
// Honest User-Agent, one small GET per hop, nothing else downloaded.

const env = (k, d) => process.env[k] ?? d;
const MAX_HTML = 400_000;

// registrable domain, good enough for comparing: iitb.ac.in, du.ac.in, harvard.edu, example.co.uk
const SLD2 = /^(ac|co|edu|gov|org|net|res|nic|mil|com)$/;
export function baseDomain(host) {
  const parts = String(host || '').toLowerCase().replace(/^www\d?\./, '').split('.').filter(Boolean);
  if (parts.length <= 2) return parts.join('.');
  const [sld] = parts.slice(-2);
  return (SLD2.test(sld) && parts.at(-1).length === 2 ? parts.slice(-3) : parts.slice(-2)).join('.');
}

const PARKED = /(this domain (name )?(is|may be) for sale|buy this domain|domain (is )?for sale|domain has expired|this domain has been registered|parked (free|domain)|is parked|sedoparking|parkingcrew|bodis\.com|dan\.com\/buy|afternic|hugedomains|godaddy\.com\/domains|domain may be for sale|renew (this|your) domain|account (has been )?suspended|this account has been suspended|website is (currently )?(under construction|coming soon)|default web site page|welcome to nginx|it works!|apache2? (ubuntu )?default page|index of \/)/i;
const SPAM = /\b(casino|slots?\s*(online|gacor)|judi|togel|poker online|sportsbook|betting (site|tips)|bet365|1xbet|satta|matka|porn|xxx|escort|viagra|cialis|crypto (casino|gambling)|gacor|maxwin|situs)\b/i;
const PARK_HOSTS = /(sedoparking|parkingcrew|bodis|dan\.com|afternic|hugedomains|domainmarket|undeveloped|parklogic|above\.com|namebright|domainlore)/i;

async function hop(url) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 15000);
  try {
    const r = await fetch(url, { method: 'GET', redirect: 'manual', signal: ctl.signal,
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,*/*;q=0.5', 'Accept-Language': 'en-IN,en;q=0.8' } });
    let body = '';
    if (r.status >= 200 && r.status < 300 && /html|text/i.test(r.headers.get('content-type') || 'text/html')) {
      const reader = r.body?.getReader(); let got = 0; const dec = new TextDecoder();
      while (reader && got < MAX_HTML) { const { value, done } = await reader.read(); if (done) break; got += value.length; body += dec.decode(value, { stream: true }); }
      try { await reader?.cancel(); } catch { /* ignore */ }
    } else { try { await r.body?.cancel(); } catch { /* ignore */ } }
    return { status: r.status, location: r.headers.get('location'), body };
  } finally { clearTimeout(t); }
}

// follow redirects ourselves (also <meta refresh> and simple JS location jumps that parked pages use)
export async function checkWebsite(start) {
  let url = start; const chain = [start];
  for (let i = 0; i < 6; i++) {
    let res;
    try { res = await hop(url); }
    catch (e) {
      const code = e.cause?.code || e.name || e.message;
      if (/ENOTFOUND|EAI_AGAIN/.test(code)) return { kind: 'dead', note: 'Domain does not exist (DNS)', final: url, chain };
      if (/ECONNREFUSED|EHOSTUNREACH|ENETUNREACH/.test(code)) return { kind: 'dead', note: 'No web server answers', final: url, chain };
      if (/CERT|SSL|TLS|SELF_SIGNED|UNABLE_TO_VERIFY/i.test(code)) {   // broken certificate: try the http:// version once
        if (url.startsWith('https://') && i === 0) { url = url.replace(/^https:/, 'http:'); chain.push(url); continue; }
        return { kind: 'blocked', note: `Security certificate problem (${code})`, final: url, chain };
      }
      return { kind: 'blocked', note: `No answer (${code})`, final: url, chain };
    }
    if (res.status >= 300 && res.status < 400 && res.location) {
      try { url = new URL(res.location, url).toString(); } catch { return { kind: 'dead', note: 'Broken redirect', final: url, chain }; }
      chain.push(url); continue;
    }
    if ([401, 403, 429, 503].includes(res.status)) return { kind: 'blocked', note: `Site refused the check (HTTP ${res.status})`, final: url, chain };
    if ([404, 410].includes(res.status)) return { kind: 'dead', note: `Page not found (HTTP ${res.status})`, final: url, chain };
    if (res.status >= 500) return { kind: 'blocked', note: `Site error (HTTP ${res.status})`, final: url, chain };
    const b = res.body || '';
    const meta = b.match(/<meta[^>]+http-equiv=["']?refresh["']?[^>]+content=["']?\s*\d+\s*;\s*url=([^"'>\s]+)/i)
      || b.match(/(?:window\.|document\.)?location(?:\.href)?\s*=\s*["'](https?:\/\/[^"']+)["']/i);
    if (meta && i < 5 && b.length < 20000) {   // a tiny page that only jumps somewhere else
      try { url = new URL(meta[1], url).toString(); chain.push(url); continue; } catch { /* ignore */ }
    }
    const text = b.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 20000);
    const title = (b.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]?.replace(/\s+/g, ' ').trim() || '';
    if (PARK_HOSTS.test(new URL(url).hostname) || PARKED.test(`${title} ${text.slice(0, 3000)}`)) return { kind: 'bad', note: `Parked / for sale / empty: “${(title || text.slice(0, 80)).slice(0, 100)}”`, final: url, chain };
    if (SPAM.test(title) || (text.match(new RegExp(SPAM.source, 'gi')) || []).length >= 3) return { kind: 'bad', note: `Spam content: “${title.slice(0, 100)}”`, final: url, chain };
    const same = baseDomain(new URL(url).hostname) === baseDomain(new URL(start).hostname);
    return same ? { kind: 'ok', note: null, final: url, chain, title }
      : { kind: 'moved', note: `Now opens ${new URL(url).hostname}${title ? ` — “${title.slice(0, 80)}”` : ''}`, final: url, chain, title };
  }
  return { kind: 'dead', note: 'Too many redirects', final: url, chain };
}

let running = false;
export async function runWebsiteCheck({ limit = Number(env('WEBSITE_CHECK_PER_RUN', 150)), parallel = 6 } = {}) {
  if (running) return { skipped: 'already running' };
  running = true;
  const stats = { checked: 0, ok: 0, moved: 0, blocked: 0, dead: 0, bad: 0 };
  try {
    const { data: list, error } = await supabase.rpc('website_check_targets', { p_lim: limit });
    if (error) throw new Error(error.message);
    const queue = [...(list || [])];
    const worker = async () => {
      for (let c = queue.shift(); c; c = queue.shift()) {
        let start = String(c.website).trim(); if (!/^https?:\/\//i.test(start)) start = `https://${start}`;
        let r; try { r = await checkWebsite(start); } catch (e) { r = { kind: 'blocked', note: e.message, final: start }; }
        // "dead" only after two checks in a row (a site can be down for an hour); until then it counts as blocked
        const fails = r.kind === 'dead' ? (c.website_fails || 0) + 1 : 0;
        const kind = r.kind === 'dead' && fails < 2 ? 'blocked' : r.kind;
        stats.checked++; stats[kind]++;
        await supabase.from('colleges').update({ website_status: kind, website_final: r.final !== start ? r.final : null,
          website_note: r.note ? (r.kind === 'dead' && kind === 'blocked' ? `${r.note} — will check again` : r.note).slice(0, 300) : null,
          website_checked_at: new Date().toISOString(), website_fails: fails }).eq('id', c.id);
      }
    };
    await Promise.all(Array.from({ length: parallel }, worker));
  } finally { running = false; }
  return stats;
}

export function startWebsiteCheck() {
  if (env('WEBSITE_CHECK', 'on') === 'off') return;
  const every = Math.max(10, Number(env('WEBSITE_CHECK_EVERY_MINUTES', 30))) * 60e3;
  const run = whenIdle('website check', () => runWebsiteCheck().then((s) => s.checked && console.log('[website-check]', s)).catch((e) => console.warn('[website-check]', e.message)));
  setTimeout(run, 15 * 60e3); setInterval(run, every).unref();
}
