// JoSAA seat matrix → every B.Tech / dual-degree / B.Arch / BS programme at the IITs, IISc, NITs, IIEST, IIITs and other
// government-funded technical institutes (≈1,000 programmes at ≈138 institutes), with total seats.
// Source: Joint Seat Allocation Authority (Ministry of Education), josaa.admissions.nic.in — the official counselling list.
// Runs once after deploy, then yearly (JoSAA publishes a new matrix each session); also from Admin → Import.
import { supabase } from '../supabase.js';
import { USER_AGENT } from './http.js';
import { normName } from './collegeUpsert.js';
import { collegeIndex, createCollege, startRun, finishRun } from './europe.js';

const URL_ = process.env.JOSAA_SEAT_URL || 'https://josaa.admissions.nic.in/applicant/seatmatrix/seatmatrixinfo.aspx';
const strip = (s) => String(s || '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();

// ---- talk to the ASP.NET page like a browser form: GET (hidden fields + cookies), then POST "ALL / ALL / ALL → Submit"
async function fetchMatrixHtml() {
  const jar = new Map();
  const keep = (res) => { for (const c of res.headers.getSetCookie?.() || []) { const [kv] = c.split(';'); const i = kv.indexOf('='); jar.set(kv.slice(0, i), kv.slice(i + 1)); } };
  const cookie = () => [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
  const first = await fetch(URL_, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(60000) });
  if (!first.ok) throw new Error(`JoSAA: HTTP ${first.status}`);
  keep(first);
  const html = await first.text();
  const form = new URLSearchParams();
  for (const m of html.matchAll(/<input[^>]+type="hidden"[^>]*>/gi)) {
    const name = m[0].match(/name="([^"]+)"/)?.[1]; const value = m[0].match(/value="([^"]*)"/)?.[1] ?? '';
    if (name) form.set(name, value.replace(/&amp;/g, '&'));
  }
  for (const m of html.matchAll(/<select[^>]+name="([^"]+)"[^>]*>([\s\S]*?)<\/select>/gi)) {
    const opt = m[2].match(/<option[^>]*value="([^"]*)"[^>]*>\s*ALL\s*</i) || m[2].match(/<option[^>]*value="([^"]*)"/i);
    form.set(m[1], opt ? opt[1] : 'ALL');
  }
  const btn = html.match(/<input[^>]+type="submit"[^>]+name="([^"]+)"[^>]*value="([^"]*)"/i) || html.match(/<input[^>]+name="([^"]+)"[^>]+type="submit"[^>]*value="([^"]*)"/i);
  if (btn) form.set(btn[1], btn[2]); else form.set('ctl00$ContentPlaceHolder1$btnSubmit', 'Submit');
  const res = await fetch(URL_, {
    method: 'POST', body: form.toString(), signal: AbortSignal.timeout(180000),
    headers: { 'User-Agent': USER_AGENT, 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie(), Referer: URL_ },
  });
  if (!res.ok) throw new Error(`JoSAA (submit): HTTP ${res.status}`);
  return res.text();
}

// rows: institute, programme ("Computer Science and Engineering (4 Years, Bachelor of Technology)"), … , programme total seats
export function parseMatrix(html) {
  const out = new Map();
  for (const tr of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...tr[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => strip(m[1]));
    if (cells.length < 16 || !/\(.*\d+\s*Years?,/i.test(cells[1])) continue;
    const key = `${cells[0]}||${cells[1]}`;
    if (!out.has(key)) out.set(key, { institute: cells[0], program: cells[1], seats: parseInt(cells[15], 10) || null });
  }
  return [...out.values()];
}

const DEGREE = [
  [/^Bachelor of Technology$/i, 'B.Tech', 'btech'], [/^Bachelor of Science$/i, 'BS', 'bsc'], [/^Bachelor of Architecture$/i, 'B.Arch', 'barch'],
  [/^Bachelor of Planning$/i, 'B.Plan', null], [/^Bachelor of Design$/i, 'B.Des', 'bdes'],
  [/Bachelor and Master of Technology|B\.?\s*Tech\.?\s*\+\s*M\.?\s*Tech|Integrated B\.?\s*Tech\.? and M\.?\s*Tech/i, 'B.Tech + M.Tech (Dual Degree)', null],
  [/Bachelor of Technology and MBA|Integrated B\.?\s*Tech\.? and MBA/i, 'B.Tech + MBA (Dual Degree)', null],
  [/Bachelor of Science and Master of Science|Integrated Bachelor of Science-Master of Science/i, 'BS + MS (Dual Degree)', null],
  [/Bachelor of Science and MBA/i, 'BS + MBA (Dual Degree)', null], [/Integrated Master/i, 'Integrated M.Tech / M.Sc', null],
];
export function programRow(p) {
  const m = p.program.match(/^(.*)\((\d+)\s*Years?,\s*(.+)\)\s*$/);
  const branch = (m ? m[1] : p.program).trim(); const years = m ? Number(m[2]) : null; const degree = (m ? m[3] : '').replace(/\)+$/, '').trim();
  const d = DEGREE.find(([re]) => re.test(degree));
  const abbr = d ? d[1] : degree;
  const name = /^(B\.?\s?Tech|BS\b|B\.?\s?Arch|B\.?\s?Sc|B\.\s?Tech)/i.test(branch) ? branch : `${abbr} ${branch}`;
  return { name: name.slice(0, 200), level: 'UG', duration: years ? `${years} years` : null, seats: p.seats, catalog_slug: d ? d[2] : null, external_id: normName(p.program).slice(0, 200) };
}

// institute name → our college: every meaningful word of the JoSAA name must be in the college's name; the closest wins
// old and new city names, short forms — JoSAA and our lists often use different ones
const CITY = { trichy: 'tiruchirappalli', allahabad: 'prayagraj', calicut: 'kozhikode', bangalore: 'bengaluru', bombay: 'mumbai', madras: 'chennai',
  calcutta: 'kolkata', pondicherry: 'puducherry', trivandrum: 'thiruvananthapuram', mysore: 'mysuru', baroda: 'vadodara', gurgaon: 'gurugram',
  benares: 'varanasi', banaras: 'varanasi', cochin: 'kochi', vizag: 'visakhapatnam', poona: 'pune', mangalore: 'mangaluru', belgaum: 'belagavi',
  hubli: 'hubballi', simla: 'shimla', jullundur: 'jalandhar', nitk: 'karnataka' };
// one-letter spelling differences in long words ("Tiruchirapalli" / "Tiruchirappalli")
function near(a, b) {
  if (a.length < 7 || b.length < 7 || Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}
export function matcher(rows) {
  const stop = new Set(['of', 'the', 'and', 'for', 'in', 'at']);
  const words = (s) => new Set(normName(String(s).replace(/[()]/g, ' ')).split(' ').filter((w) => w && !stop.has(w)).map((w) => CITY[w] || w));
  const list = rows.map((c) => ({ c, w: new Set([...words(c.name), ...(c.short_name ? words(c.short_name) : [])]) }));
  return (inst) => {
    const noAbbr = inst.replace(/\(([A-Z.]{2,6})\)/g, ' ');   // "(BHU)" "(ISM)" — our names spell these out
    for (const src of [inst, noAbbr]) {
      const need = [...words(src)]; if (need.length < 3) continue;
      const has = (x, w) => x.w.has(w) || (w.length >= 7 && [...x.w].some((v) => near(v, w)));
      const hits = list.filter((x) => need.filter((w) => !x.w.has(w)).length <= 1 && need.every((w) => has(x, w))).map((x) => ({ c: x.c, extra: x.w.size - need.length }))
        .sort((a, b) => Number(a.c.source === 'josaa') - Number(b.c.source === 'josaa') || a.extra - b.extra);
      const own = hits.filter((h) => h.c.source !== 'josaa');
      if (own.length === 1 || (own.length > 1 && own[0].extra < own[1].extra)) return own[0].c;
      if (hits.length && (hits.length === 1 || hits[0].extra < hits[1].extra)) return hits[0].c;
    }
    return null;
  };
}

export async function importJosaa({ startedBy = null, log = () => {}, html = null } = {}) {
  const run = await startRun('josaa', { country: 'IN' }, startedBy);
  try {
    const programs = parseMatrix(html || await fetchMatrixHtml());
    if (programs.length < 100) throw new Error(`JoSAA: only ${programs.length} programmes found — the page layout may have changed`);
    log(`${programs.length} programmes at ${new Set(programs.map((p) => p.institute)).size} institutes`);
    const idx = await collegeIndex('IN');
    const find = matcher(idx.rows);
    const byInst = new Map(); programs.forEach((p) => (byInst.get(p.institute) || byInst.set(p.institute, []).get(p.institute)).push(p));
    let matched = 0, created = 0, courses = 0, merged = 0; const unmatched = [];
    for (const [inst, list] of byInst) {
      let id = find(inst)?.id;
      if (id) {
        matched++;
        const ext = normName(inst).slice(0, 120);
        const { data: dup } = await supabase.from('colleges').select('id').eq('source', 'josaa').eq('external_id', ext).neq('id', id).maybeSingle();
        if (dup) {   // an earlier run added this institute as new: move nothing, just hide that copy and its JoSAA courses
          await supabase.from('courses').delete().eq('college_id', dup.id).eq('source', 'josaa');
          await supabase.from('colleges').update({ is_published: false }).eq('id', dup.id);
          merged++;
        }
      }
      else {
        const city = (inst.includes(',') ? inst.split(',').pop() : inst.split(' ').pop()).trim();
        id = await createCollege({ source: 'josaa', external_id: normName(inst).slice(0, 120), name: inst, country: 'India', country_code: 'IN', type: 'Public', factsKey: 'josaa', facts: { counselling: 'JoSAA' }, cityName: city });
        if (id) created++; else { unmatched.push(inst); continue; }
      }
      const rows = list.map((p) => ({ college_id: id, source: 'josaa', currency: 'INR', url: 'https://josaa.nic.in/seat-matrix/', ...programRow(p) }));
      const uniq = [...new Map(rows.map((r) => [r.external_id, r])).values()];
      const { error } = await supabase.from('courses').upsert(uniq, { onConflict: 'college_id,source,external_id' });
      if (error) throw new Error(`courses: ${error.message}`);
      courses += uniq.length;
      // IITs and IISc admit through JEE Advanced; NITs, IIITs and the other institutes through JEE Main
      const exams = /Indian Institute of Technology|Indian Institute of Science/i.test(inst) ? ['jee-advanced'] : ['jee-main'];
      await supabase.from('colleges').update({ exams_accepted: exams }).eq('id', id).is('exams_accepted', null);
    }
    const message = `JoSAA seat matrix: ${byInst.size} institutes (${matched} matched, ${created} added${merged ? `, ${merged} duplicates merged` : ''}) · ${courses} programmes${unmatched.length ? ` · not placed: ${unmatched.slice(0, 5).join('; ')}` : ''}`;
    await finishRun(run, { status: 'done', inserted: created, updated: matched, skipped: unmatched.length, message });
    return { institutes: byInst.size, matched, created, courses, unmatched };
  } catch (e) {
    await finishRun(run, { status: 'failed', message: e.message });
    throw e;
  }
}
