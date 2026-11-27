import { supabase } from '../supabase.js';
import { whenIdle } from './loadGuard.js';
import { USER_AGENT, throttle } from './http.js';
import { titleKey } from './examNews.js';

// Student visa news (migration 051)
//  1. Official: the governments' own news feeds — UK Visas and Immigration (GOV.UK), USCIS, Canada IRCC, Irish
//     Immigration Service. These feeds carry everything the department publishes, so an item is kept only when it is
//     about students / study / fees / post-study work.
//  2. News: GDELT DOC 2.0 (free, any use with attribution — same as exam news), one query per country for
//     "student visa", "study permit", "international students", "post-study work" …; a headline is kept only when it
//     names the country and a student-visa phrase.
//  Only headline, source and link are stored. Runs every VISA_NEWS_EVERY_HOURS (6) when the server is idle.

const env = (k, d) => process.env[k] ?? d;
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; } };

export const COUNTRIES = [
  { cc: 'GB', name: 'UK', terms: ['UK', 'U.K.', 'Britain', 'British', 'United Kingdom', 'England', 'Home Office'],
    feeds: [{ url: 'https://www.gov.uk/government/organisations/uk-visas-and-immigration.atom', source: 'gov.uk — UK Visas and Immigration' }] },
  { cc: 'US', name: 'USA', terms: ['US', 'U.S.', 'USA', 'United States', 'America', 'American', 'USCIS'],
    feeds: [{ url: 'https://www.uscis.gov/news/rss-feed/59144', source: 'uscis.gov' }] },
  { cc: 'CA', name: 'Canada', terms: ['Canada', 'Canadian', 'IRCC'],
    feeds: [{ url: 'https://api.io.canada.ca/io-server/gc/news/en/v2?dept=departmentofcitizenshipandimmigration&type=newsreleases&sort=publishedDate&orderBy=desc&pick=50&format=atom', source: 'canada.ca — IRCC' }] },
  { cc: 'AU', name: 'Australia', terms: ['Australia', 'Australian', 'Home Affairs'], feeds: [] },
  { cc: 'IE', name: 'Ireland', terms: ['Ireland', 'Irish'],
    feeds: [{ url: 'https://www.irishimmigration.ie/feed/', source: 'irishimmigration.ie' }] },
  { cc: 'NZ', name: 'New Zealand', terms: ['New Zealand', 'NZ', 'Kiwi'], feeds: [] },
  { cc: 'DE', name: 'Germany', terms: ['Germany', 'German'], feeds: [] },
  { cc: 'FR', name: 'France', terms: ['France', 'French'], feeds: [] },
  { cc: 'NL', name: 'Netherlands', terms: ['Netherlands', 'Dutch'], feeds: [] },
  { cc: 'SG', name: 'Singapore', terms: ['Singapore'], feeds: [] },
  { cc: 'AE', name: 'UAE', terms: ['UAE', 'Dubai', 'Emirates'], feeds: [] },
  { cc: 'JP', name: 'Japan', terms: ['Japan', 'Japanese'], feeds: [] },
];

const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wordRe = (w, cs) => new RegExp(`(^|[^\\p{L}\\p{N}])${reEsc(w)}(?=$|[^\\p{L}\\p{N}])`, cs ? 'u' : 'iu');
export const has = (list, text) => list.some((w) => wordRe(w, /^[A-Z.]{2,5}$/.test(w)).test(text));   // "US", "UK" in capitals only

// what makes an item about student visas
const STUDENT = ['student visa', 'student visas', 'study visa', 'study permit', 'study permits', 'international student', 'international students',
  'foreign student', 'foreign students', 'overseas students', 'student route', 'graduate route', 'post-study', 'post study', 'post-graduation work permit',
  'PGWP', 'F-1', 'F1 visa', 'OPT', 'STEM OPT', 'J-1', 'M-1', 'SEVIS', 'subclass 500', 'subclass 485', 'temporary graduate', 'CAS', 'Stamp 2',
  'student', 'students', 'study', 'university', 'universities', 'college', 'tuition', 'scholar', 'scholars', 'education provider', 'education providers'];
const STRONG = STUDENT.slice(0, 28);   // for news headlines a real student-visa phrase is required (not just "student")
const OFFICIAL_ALSO = ['visa fee', 'visa fees', 'immigration health surcharge', 'health surcharge', 'fees and charges', 'financial requirement',
  'English language requirement', 'dependants', 'dependents', 'work permit', 'work permits', 'skilled worker', 'H-1B', 'visa bulletin', 'premium processing'];

const TOPICS = [
  ['fees', ['fee', 'fees', 'surcharge', 'cost', 'costs', 'funds', 'financial requirement', 'proof of funds', 'living costs', 'maintenance']],
  ['rules', ['cap', 'caps', 'ban', 'banned', 'bans', 'pause', 'paused', 'pauses', 'suspend', 'suspended', 'suspends', 'crackdown', 'restrict', 'restricts', 'restrictions', 'tighten', 'tightens', 'cut', 'cuts']],
  ['work', ['work', 'working', 'job', 'jobs', 'graduate route', 'post-study', 'post study', 'PGWP', 'OPT', 'STEM OPT', 'subclass 485', 'temporary graduate', 'H-1B', 'work permit', 'hours']],
  ['family', ['dependant', 'dependants', 'dependent', 'dependents', 'spouse', 'spouses', 'partner', 'partners', 'family', 'families', 'children']],
  ['processing', ['processing', 'appointment', 'appointments', 'interview', 'interviews', 'wait', 'waiting', 'backlog', 'slots', 'delay', 'delays', 'biometrics']],
  ['rules', ['rule', 'rules', 'change', 'changes', 'new', 'cap', 'caps', 'limit', 'limits', 'ban', 'pause', 'paused', 'suspend', 'suspended', 'policy',
    'requirement', 'requirements', 'reform', 'reforms', 'crackdown', 'restrict', 'restrictions', 'tighten', 'tightens', 'announce', 'announces', 'law', 'bill']],
];
export const topicOf = (t) => (TOPICS.find(([, w]) => has(w, t)) || ['news'])[0];

// ---------------------------------------------------------------- official feeds (RSS / Atom, parsed with plain regex — the feeds are simple)
const decode = (s) => String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;|&#8217;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/\s+/g, ' ').trim();
const tag = (block, name) => (block.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, 'i')) || [])[1] || '';

export function parseFeed(xml) {
  const out = [];
  for (const m of String(xml).matchAll(/<(item|entry)\b[\s\S]*?<\/\1>/gi)) {
    const b = m[0];
    const title = decode(tag(b, 'title'));
    const link = decode(tag(b, 'link')) || (b.match(/<link\b[^>]*href="([^"]+)"/i) || [])[1] || '';
    const date = decode(tag(b, 'pubDate') || tag(b, 'published') || tag(b, 'updated') || tag(b, 'dc:date'));
    const summary = decode(tag(b, 'description') || tag(b, 'summary') || tag(b, 'content')).slice(0, 600);
    const t = Date.parse(date);
    if (title && /^https?:\/\//.test(link)) out.push({ title, url: link, summary, published_at: Number.isFinite(t) ? new Date(t).toISOString() : new Date().toISOString() });
  }
  return out;
}

export async function getText(url, accept, tries = 3) {
  for (let i = 0; ; i++) {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 25000);
    try {
      const r = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: accept }, signal: ctl.signal, redirect: 'follow' });
      const body = await r.text();
      // GDELT asks for one request every 5 s and answers 429 (or a plain-text "please limit" note) when busy: wait and retry
      const busy = r.status === 429 || (/gdeltproject/.test(url) && /limit requests|one every 5 seconds/i.test(body.slice(0, 300)));
      if (busy && i < tries - 1) { await new Promise((ok) => setTimeout(ok, 15000 * (i + 1))); continue; }
      if (!r.ok || busy) throw new Error(busy ? 'rate limited' : `HTTP ${r.status}`);
      return body.slice(0, 3_000_000);
    } finally { clearTimeout(t); }
  }
}

export function keepOfficial(item) {
  const text = `${item.title} ${item.summary || ''}`;
  if (/^(Transparency data|Research and analysis|Statistics|Corporate report|FOI release|Correspondence|Policy paper: .*country policy)/i.test(item.title)) return false;
  if (/caseworker guidance|country policy and information|returns? (guide|preparation)|asylum|deport|removal|fraud|criminal|naturaliz|citizenship ceremon/i.test(item.title)) return false;
  return has(STUDENT, text) || has(OFFICIAL_ALSO, text);
}

async function fromFeeds(c) {
  const out = [];
  for (const f of c.feeds) {
    try {
      await throttle(host(f.url), 3000);
      const items = parseFeed(await getText(f.url, 'application/atom+xml, application/rss+xml, application/xml;q=0.9, */*;q=0.5'));
      for (const it of items) if (keepOfficial(it)) out.push({ ...it, source: f.source, official: true, provider: 'official' });
    } catch (e) { console.warn(`[visa-news] ${c.cc} feed:`, e.message); }
  }
  return out;
}

// ---------------------------------------------------------------- GDELT news headlines
export const gdeltDate = (s) => { const m = /^(\d{4})(\d\d)(\d\d)T(\d\d)(\d\d)(\d\d)Z$/.exec(s || ''); return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z` : new Date().toISOString(); };
export function gdeltVisaQuery(c) {
  const phrases = ['"student visa"', '"student visas"', '"study permit"', '"international students"', '"post-study work"', '"graduate route"', '"F-1 visa"'];
  const place = c.terms.filter((t) => t.length >= 3 && !/[.]/.test(t)).slice(0, 4).map((t) => (t.includes(' ') ? `"${t}"` : t));
  return `(${phrases.join(' OR ')}) (${place.join(' OR ')}) sourcelang:english`;
}
export function keepNews(c, title) {
  if (!title || title.length < 20 || title.length > 300) return false;
  return has(STRONG, title) && has(c.terms, title);
}
async function fromGdelt(c) {
  await throttle('api.gdeltproject.org', Number(env('GDELT_GAP_MS', 6000)));
  const url = `https://api.gdeltproject.org/api/v2/doc/doc?${new URLSearchParams({ query: gdeltVisaQuery(c), mode: 'artlist', format: 'json', maxrecords: '75', sort: 'datedesc', timespan: `${Number(env('VISA_NEWS_HOURS', 168))}h` })}`;
  const body = await getText(url, 'application/json');
  let j; try { j = JSON.parse(body); } catch { throw new Error(`GDELT: ${body.slice(0, 120)}`); }
  return (j.articles || []).filter((a) => keepNews(c, a.title))
    .map((a) => ({ title: a.title, url: a.url, source: (a.domain || host(a.url)).replace(/^www\./, ''), official: false, provider: 'gdelt', published_at: gdeltDate(a.seendate) }));
}

// ---------------------------------------------------------------- collect + save
export async function collectVisaNews({ only = null } = {}) {
  const stats = { countries: 0, found: 0, saved: 0, official: 0, errors: 0 };
  for (const c of COUNTRIES.filter((x) => !only || x.cc === only)) {
    stats.countries++;
    let items = [];
    const [a, b] = await Promise.allSettled([fromFeeds(c), fromGdelt(c)]);
    if (a.status === 'fulfilled') items.push(...a.value); else stats.errors++;
    if (b.status === 'fulfilled') items.push(...b.value); else { stats.errors++; console.warn(`[visa-news] ${c.cc} gdelt:`, b.reason?.message); }
    const cutoff = Date.now() - 120 * 864e5;   // nothing older than 4 months
    const seen = new Set();
    const rows = [];
    for (const it of items.sort((x, y) => Number(y.official) - Number(x.official))) {
      const key = titleKey(it.title);
      if (!key || seen.has(key) || Date.parse(it.published_at) < cutoff) continue;
      seen.add(key);
      const ageH = (Date.now() - Date.parse(it.published_at)) / 3600e3;
      rows.push({ country_code: c.cc, title: it.title.slice(0, 400), url: it.url, source: it.source, official: it.official, provider: it.provider,
        topic: topicOf(it.title), published_at: it.published_at, title_key: key, score: (it.official ? 10 : 3) + (ageH < 48 ? 1 : 0) });
    }
    stats.found += rows.length;
    for (const r of rows) {   // one by one: duplicates (same link or headline) are simply skipped
      const { error } = await supabase.from('visa_news').insert(r);
      if (!error) { stats.saved++; if (r.official) stats.official++; }
      else if (error.code !== '23505') { stats.errors++; console.warn('[visa-news] save:', error.message); }
    }
  }
  return stats;
}

export function startVisaNews() {
  if (env('VISA_NEWS', 'on') === 'off') return;
  const every = Math.max(1, Number(env('VISA_NEWS_EVERY_HOURS', 6))) * 3600e3;
  const run = whenIdle('visa news', () => collectVisaNews().then((s) => console.log('[visa-news]', s)).catch((e) => console.warn('[visa-news]', e.message)));
  setTimeout(run, 6 * 60e3); setInterval(run, every).unref();
}
