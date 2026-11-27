// Degree programmes of German universities — read ONLY from each university's own website.
// (The national list, HRK Hochschulkompass, may only be reused with HRK's approval; we asked for it separately.)
//
// Every 2 hours, when the server is calm, it takes the next few German universities (world-ranked first) and:
//   1. checks robots.txt (same rules as the official-fee reader), honest User-Agent, a pause between pages
//   2. opens the home page and up to 4 same-site pages whose link looks like the list of degree programmes
//      ("Studiengänge", "Studienangebot", "degree programmes", "study programmes" …), English pages first
//   3. asks the AI pool to list the programmes NAMED on the page (name, degree, teaching language, length if written)
//   4. keeps a programme ONLY if its name really appears in the page text → saved as a course (source 'official_site',
//      linked to the page it came from). Fees are not taken from here: public universities' tuition rule is shown separately.
import { supabase } from '../supabase.js';
import { completeJson, llmReady } from './llm.js';
import { whenIdle, serverBusy } from './loadGuard.js';
import { grab, sameSite } from './examDates.js';
import { allowedByRobots } from './officialFees.js';
import { normName } from './collegeUpsert.js';

const env = (k, d) => (process.env[k] ?? d);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, ' ').trim();
const LINK = /studieng(a|ä|ae)ng|studienangebot|studienfach|studienf(a|ä)cher|degree[- ]programs?|degree[- ]programmes?|study[- ]programs?|study[- ]programmes?|programmes?[- ]of[- ]study|courses?[- ]of[- ]study|study[- ]offer|bachelor|master/i;
const DEGREES = { bachelor: 'UG', master: 'PG', phd: 'PhD', state_exam: 'UG', other: 'Certificate' };

export async function extractProgrammes(college, page) {
  const text = page.text.replace(/\s+\n/g, '\n').slice(0, 16000);
  if (text.length < 200) return [];
  const out = await completeJson({
    system: 'You list degree programmes from a German university\'s own web page. You never guess and never use outside knowledge. Reply with JSON only.',
    prompt: `University: ${college.name}${college.city ? `, ${college.city}` : ''}, Germany.
From the text below (copied from ${page.url}), list each degree programme OF THIS UNIVERSITY that is named in the text.
Return {"items":[{"name":"programme name exactly as written, e.g. 'Informatik' or 'Data Science'","degree":one of ${JSON.stringify(Object.keys(DEGREES))},
"language":"German" | "English" | "German and English" | null (only if the text says it),"semesters":number or null (only if the text states the standard period of study)}]}.
Rules: only real degree programmes (Bachelor, Master, PhD/doctorate, Staatsexamen); skip news, events, single modules, language courses, other universities.
If the page is not a list of programmes, return {"items":[]}.

TEXT:
${text}`,
    maxTokens: 4000, temperature: 0, json: true,
  }).catch(() => null);
  const res = out?.data ?? out;
  const list = Array.isArray(res?.items) ? res.items : [];
  const pageText = norm(page.text);
  const seen = new Set();
  return list.filter((x) => {
    const n = norm(x?.name);
    if (!n || n.length < 3 || n.length > 150 || !DEGREES[x?.degree]) return false;
    if (!pageText.includes(n)) return false;                     // the name must really be on the official page
    const key = `${n}|${x.degree}`; if (seen.has(key)) return false; seen.add(key);
    return true;
  }).slice(0, 200).map((x) => ({
    name: String(x.name).replace(/\s+/g, ' ').trim().slice(0, 180), degree: x.degree,
    language: ['German', 'English', 'German and English'].includes(x.language) ? x.language : null,
    semesters: Number.isInteger(Number(x.semesters)) && Number(x.semesters) >= 2 && Number(x.semesters) <= 14 ? Number(x.semesters) : null,
  }));
}

const DEGREE_LABEL = { bachelor: 'Bachelor', master: 'Master', phd: 'Doctorate', state_exam: 'Staatsexamen', other: '' };
async function save(college, page, items) {
  let added = 0;
  for (const p of items) {
    const label = DEGREE_LABEL[p.degree];
    const name = label && !new RegExp(label, 'i').test(p.name) ? `${label} — ${p.name}` : p.name;
    const row = {
      college_id: college.id, source: 'official_site', external_id: `de:${normName(p.name).slice(0, 150)}|${p.degree}`,
      name, level: DEGREES[p.degree], duration: p.semesters ? `${p.semesters} semesters` : null,
      study_mode: p.language ? `Taught in ${p.language}` : null, url: page.url,
    };
    const { error } = await supabase.from('courses').upsert(row, { onConflict: 'college_id,source,external_id' });
    if (!error) added++; else console.warn('[de-courses]', error.message);
  }
  return added;
}

export async function collectGermanCourses({ limit = Number(env('DE_COURSES_PER_RUN', 4)), collegeId = null } = {}) {
  if (!llmReady()) return { skipped: 'no AI key' };
  let colleges = [];
  if (collegeId) {
    const { data } = await supabase.from('colleges').select('id, name, city, country, website').eq('id', collegeId).maybeSingle();
    if (data?.website) colleges = [data];
  } else {
    const { data, error } = await supabase.rpc('de_course_targets', { p_lim: limit, p_recheck_days: 90 });
    if (error) { console.warn('[de-courses] queue:', error.message); return { error: error.message }; }
    colleges = data || [];
  }
  let read = 0, saved = 0, blocked = 0;
  for (const college of colleges) {
    if (!collegeId && serverBusy()) break;
    await supabase.from('colleges').update({ courses_checked_at: new Date().toISOString() }).eq('id', college.id);
    const home = /^https?:\/\//i.test(college.website) ? college.website : `https://${college.website}`;
    if (!(await allowedByRobots(home))) { blocked++; continue; }
    const first = await grab(home); if (!first) continue;
    read++;
    const links = [...new Map(first.links.filter((l) => LINK.test(`${l.label} ${l.href}`))
      .map((l) => { try { return new URL(l.href, first.url).toString().split('#')[0]; } catch { return null; } })
      .filter((u) => u && sameSite(u, first.url) && !/\.(pdf|jpe?g|png|zip|docx?)$/i.test(u)).map((u) => [u, u])).keys()]
      .sort((a, b) => Number(/\/en(\/|$)|english/i.test(b)) - Number(/\/en(\/|$)|english/i.test(a))).slice(0, 4);
    const pages = [];
    for (const u of links) {
      if (!(await allowedByRobots(u))) continue;
      await sleep(2500);
      const p = await grab(u); if (p) pages.push(p);
    }
    if (!pages.length) pages.push(first);
    for (const page of pages) saved += await save(college, page, await extractProgrammes(college, page));
  }
  if (read || saved) console.log(`[de-courses] ${read} university site(s) read · ${saved} programme(s) saved · ${blocked} skipped by robots.txt`);
  return { read, saved, blocked };
}

export function startGermanCourses() {
  if (env('DE_COURSES', 'on') === 'off') return;
  const run = whenIdle('German courses', () => collectGermanCourses().catch((e) => console.warn('[de-courses]', e.message)));
  setTimeout(run, 10 * 60_000).unref();
  setInterval(run, Number(env('DE_COURSES_EVERY_HOURS', 2)) * 3600_000).unref();
}
