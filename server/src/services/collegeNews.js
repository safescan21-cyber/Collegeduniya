import { supabase } from '../supabase.js';
import { whenIdle } from './loadGuard.js';
import { throttle } from './http.js';
import { titleKey } from './examNews.js';
import { getText, gdeltDate } from './visaNews.js';

// News about each college (migration 053). Every COLLEGE_NEWS_EVERY_HOURS (3) the server takes the next colleges
// (NIRF-ranked → world top 300 → most viewed) and asks GDELT for headlines naming them — 5 colleges per query — then keeps a
// headline for a college only when its name or a known short form is in the headline. Crime / tragedy stories are left out.

const env = (k, d) => process.env[k] ?? d;
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; } };
const NOT = /\b(dies|died|death|dead|suicide|kill|killed|killing|murder|rape|raped|assault|arrest|arrested|stabbed|molest|harass|harassment|drown|drowned|accident|body found|ragging)\b/i;
const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// "Indian Institute of Technology, Bombay" → also "IIT Bombay", "IIT-Bombay"; "National Institute of Technology Tiruchirappalli" → "NIT Tiruchirappalli"
const SHORT = [
  [/^Indian Institute of Technology,?\s+(?:\(?(?:Indian School of Mines|ISM)\)?,?\s*)?(.+)$/i, 'IIT'],
  [/^National Institute of Technology,?\s+(.+)$/i, 'NIT'],
  [/^Indian Institute of Information Technology,?\s+(.+)$/i, 'IIIT'],
  [/^Indian Institute of Management,?\s+(.+)$/i, 'IIM'],
  [/^All India Institute of Medical Sciences,?\s+(.+)$/i, 'AIIMS'],
  [/^Indian Institute of Science Education and Research,?\s+(.+)$/i, 'IISER'],
  [/^Birla Institute of Technology and Science,?\s+(.+)$/i, 'BITS'],
];
const CITY_ALIAS = { tiruchirappalli: ['Trichy'], kozhikode: ['Calicut'], bengaluru: ['Bangalore'], mumbai: ['Bombay'], chennai: ['Madras'], prayagraj: ['Allahabad'], varanasi: ['BHU'] };
const KNOWN = { 'Indian Institute of Science': ['IISc', 'IISc Bengaluru', 'IISc Bangalore'], 'Jawaharlal Nehru University': ['JNU'], 'Banaras Hindu University': ['BHU'],
  'Aligarh Muslim University': ['AMU'], 'University of Delhi': ['Delhi University', 'DU'], 'Jamia Millia Islamia': ['Jamia'], 'University of Hyderabad': ['HCU'],
  'University of California, Berkeley': ['UC Berkeley'], 'University of California, Los Angeles': ['UCLA'] };   // no "MIT": in Indian news that is often Manipal / MIT-WPU

export function collegeAliases(c) {
  const name = String(c.name || '').replace(/\s+/g, ' ').trim();
  const out = new Set([name, name.replace(/,/g, '')]);
  if (c.short_name && c.short_name.length >= 3) out.add(c.short_name.trim());
  for (const [re, ab] of SHORT) {
    const m = name.match(re);
    if (m) {
      const place = m[1].replace(/[(),]/g, ' ').replace(/\s+/g, ' ').trim();
      out.add(`${ab} ${place}`); out.add(`${ab}-${place}`);
      for (const alt of CITY_ALIAS[place.toLowerCase()] || []) if (alt !== 'BHU') out.add(`${ab} ${alt}`);
      if (/BHU|Varanasi/i.test(place)) out.add(`${ab} BHU`);
    }
  }
  for (const k of KNOWN[name.replace(/,? (Bengaluru|Bangalore)$/, '')] || KNOWN[name] || []) out.add(k);
  for (const t of c.news_terms || []) if (String(t).trim().length >= 3) out.add(String(t).trim());
  // a bare 2-letter short form ("DU") or a one-word generic name is too ambiguous to search on its own
  return [...out].filter((a) => a.length >= 3 && !/^(University|College|Institute)$/i.test(a)).slice(0, 8);
}
// "Indian Institute of Science" must not match "Indian Institute of Science Education and Research" (IISER), "BHU" not "IIT BHU"
const aliasRe = (a) => new RegExp(`(^|[^\\p{L}\\p{N}])${a === 'BHU' ? '(?<!IIT[\\s-])' : ''}${reEsc(a).replace(/\\-|\s/g, '[\\s-]')}(?=$|[^\\p{L}\\p{N}])${/Institute of Science$/i.test(a) ? '(?![\\s-]+Education)' : ''}`, /^[A-Z]{2,6}$/.test(a) ? 'u' : 'iu');
export const matchesCollege = (c, title) => collegeAliases(c).map(aliasRe).some((re) => re.test(title));

// GDELT: one query for a group of colleges, their two most specific names each
export function groupQuery(cs) {
  const phrases = [...new Set(cs.flatMap((c) => collegeAliases(c).filter((a) => !a.includes('-')).sort((x, y) => (x.length > 30) - (y.length > 30)).slice(0, 2)))]
    .filter((a) => a.length >= 4 || /^[A-Z]{3,}$/.test(a)).map((a) => `"${a.replace(/["()]/g, '')}"`);
  return phrases.length > 1 ? `(${phrases.join(' OR ')}) sourcelang:english` : `${phrases[0]} sourcelang:english`;
}

export async function collectCollegeNews({ limit = Number(env('COLLEGE_NEWS_PER_RUN', 40)), group = 5 } = {}) {
  const stats = { colleges: 0, queries: 0, saved: 0, errors: 0 };
  const { data: targets, error } = await supabase.rpc('college_news_targets', { p_lim: limit });
  if (error) throw new Error(error.message);
  const list = targets || [];
  for (let i = 0; i < list.length; i += group) {
    const cs = list.slice(i, i + group);
    stats.queries++;
    let arts = [];
    try {
      await throttle('api.gdeltproject.org', Number(env('GDELT_GAP_MS', 6000)));
      const url = `https://api.gdeltproject.org/api/v2/doc/doc?${new URLSearchParams({ query: groupQuery(cs), mode: 'artlist', format: 'json', maxrecords: '150', sort: 'datedesc', timespan: `${Number(env('COLLEGE_NEWS_HOURS', 168))}h` })}`;
      const body = await getText(url, 'application/json');
      try { arts = JSON.parse(body).articles || []; } catch { throw new Error(`GDELT: ${body.slice(0, 120)}`); }
    } catch (e) { stats.errors++; console.warn('[college-news]', e.message); continue; }   // not marked checked: tried again next run
    for (const c of cs) {
      stats.colleges++;
      const res = collegeAliases(c).map(aliasRe);
      const seen = new Set();
      for (const a of arts) {
        const title = String(a.title || '').trim();
        if (title.length < 20 || title.length > 300 || NOT.test(title) || !res.some((re) => re.test(title))) continue;
        const key = titleKey(title); if (!key || seen.has(key)) continue; seen.add(key);
        const { error: e2 } = await supabase.from('college_news').insert({ college_id: c.id, title: title.slice(0, 400), url: a.url,
          source: (a.domain || host(a.url)).replace(/^www\./, ''), published_at: gdeltDate(a.seendate), title_key: key });
        if (!e2) stats.saved++; else if (e2.code !== '23505') { stats.errors++; console.warn('[college-news] save:', e2.message); }
      }
      await supabase.from('colleges').update({ news_checked_at: new Date().toISOString() }).eq('id', c.id);
    }
  }
  return stats;
}

export function startCollegeNews() {
  if (env('COLLEGE_NEWS', 'on') === 'off') return;
  const every = Math.max(1, Number(env('COLLEGE_NEWS_EVERY_HOURS', 3))) * 3600e3;
  const run = whenIdle('college news', () => collectCollegeNews().then((s) => console.log('[college-news]', s)).catch((e) => console.warn('[college-news]', e.message)));
  setTimeout(run, 12 * 60e3); setInterval(run, every).unref();
}
