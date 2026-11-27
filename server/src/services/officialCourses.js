// Degree programmes of foreign universities — read ONLY from each university's own website. Germany and Japan for now.
// (Germany's national list, HRK Hochschulkompass, may only be reused with HRK's approval; we asked for it separately.)
//
// Every few hours, when the server is calm, it takes the next few universities of a country (world-ranked first) and:
//   1. checks robots.txt (same rules as the official-fee reader), honest User-Agent, a pause between pages
//   2. opens the home page and up to 4 same-site pages whose link looks like the list of programmes, English pages first
//   3. asks the AI pool to list the programmes NAMED on the page (name, degree, teaching language, length if written)
//   4. keeps a programme ONLY if its name really appears in the page text → saved as a course (source 'official_site',
//      linked to the page it came from). Fees are not taken from here: the country's tuition rule is shown separately.
import { supabase } from '../supabase.js';
import { completeJson, llmReady } from './llm.js';
import { whenIdle, serverBusy } from './loadGuard.js';
import { grab, sameSite } from './examDates.js';
import { allowedByRobots } from './officialFees.js';
import { normName } from './collegeUpsert.js';

const env = (k, d) => (process.env[k] ?? d);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// letters of any script survive (so a Japanese name is compared too); accents and ß folded for German
export const norm = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const DEGREES = { bachelor: 'UG', master: 'PG', phd: 'PhD', state_exam: 'UG', other: 'Certificate' };
const DEGREE_LABEL = { bachelor: 'Bachelor', master: 'Master', phd: 'Doctorate', state_exam: 'Staatsexamen', other: '' };
const ENGLISH = /\/en(\/|$|-)|\/eng(\/|$)|english/i;

export const COUNTRIES = {
  DE: {
    country: 'Germany', tag: 'de-courses', label: 'German courses', on: 'DE_COURSES', perRun: 'DE_COURSES_PER_RUN', every: 'DE_COURSES_EVERY_HOURS', everyDefault: 2,
    link: /studieng(a|ä|ae)ng|studienangebot|studienfach|studienf(a|ä)cher|degree[- ]programs?|degree[- ]programmes?|study[- ]programs?|study[- ]programmes?|programmes?[- ]of[- ]study|courses?[- ]of[- ]study|study[- ]offer|bachelor|master/i,
    languages: ['German', 'English', 'German and English'],
    rules: 'Only real degree programmes (Bachelor, Master, PhD/doctorate, Staatsexamen); skip news, events, single modules, language courses, other universities.',
    length: { key: 'semesters', ask: 'only if the text states the standard period of study, in semesters', min: 2, max: 14, unit: 'semesters' },
  },
  JP: {
    country: 'Japan', tag: 'jp-courses', label: 'Japanese courses', on: 'JP_COURSES', perRun: 'JP_COURSES_PER_RUN', every: 'JP_COURSES_EVERY_HOURS', everyDefault: 3,
    link: /undergraduate|graduate[- ]schools?|faculties|faculty|academics|degree[- ]programs?|programmes?|programs?|departments|english[- ]taught|global[- ]30|g30|学部|研究科|大学院/i,
    languages: ['Japanese', 'English', 'Japanese and English'],
    rules: 'In Japan students are admitted to a faculty/department (学部・学科) for a bachelor\'s and to a graduate school/major (研究科・専攻) for master\'s and doctoral study — list those named, and degree programmes. Skip news, events, research centres, libraries, hospitals, single courses/subjects, exchange or non-degree programmes, language schools, other universities.',
    length: { key: 'years', ask: 'only if the text states the standard length, in years', min: 1, max: 6, unit: 'years' },
  },
};

export async function extractProgrammes(college, page, cfg = COUNTRIES.DE) {
  const text = page.text.replace(/\s+\n/g, '\n').slice(0, 16000);
  if (text.length < 200) return [];
  const out = await completeJson({
    system: `You list degree programmes from a university's own web page in ${cfg.country}. You never guess and never use outside knowledge. Reply with JSON only.`,
    prompt: `University: ${college.name}${college.city ? `, ${college.city}` : ''}, ${cfg.country}.
From the text below (copied from ${page.url}), list each degree programme OF THIS UNIVERSITY that is named in the text.
Return {"items":[{"name":"name exactly as written on the page","degree":one of ${JSON.stringify(Object.keys(DEGREES))},
"language":${cfg.languages.map((l) => `"${l}"`).join(' | ')} | null (only if the text says it),"${cfg.length.key}":number or null (${cfg.length.ask})}]}.
Rules: ${cfg.rules}
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
  }).slice(0, 200).map((x) => {
    const len = Number(x?.[cfg.length.key]);
    return {
      name: String(x.name).replace(/\s+/g, ' ').trim().slice(0, 180), degree: x.degree,
      language: cfg.languages.includes(x.language) ? x.language : null,
      length: Number.isInteger(len) && len >= cfg.length.min && len <= cfg.length.max ? len : null,
    };
  });
}

async function save(college, page, items, cfg, cc) {
  let added = 0;
  for (const p of items) {
    const label = DEGREE_LABEL[p.degree];
    const name = label && !new RegExp(label, 'i').test(p.name) ? `${label} — ${p.name}` : p.name;
    const row = {
      college_id: college.id, source: 'official_site', external_id: `${cc.toLowerCase()}:${normName(p.name).slice(0, 150)}|${p.degree}`,
      name, level: DEGREES[p.degree], duration: p.length ? `${p.length} ${cfg.length.unit}` : null,
      study_mode: p.language ? `Taught in ${p.language}` : null, url: page.url,
    };
    const { error } = await supabase.from('courses').upsert(row, { onConflict: 'college_id,source,external_id' });
    if (!error) added++; else console.warn(`[${cfg.tag}]`, error.message);
  }
  return added;
}

export async function collectCourses(cc, { limit, collegeId = null } = {}) {
  const cfg = COUNTRIES[cc]; if (!cfg) return { error: `no course reader for ${cc}` };
  if (!llmReady()) return { skipped: 'no AI key' };
  limit = limit ?? Number(env(cfg.perRun, 4));
  let colleges = [];
  if (collegeId) {
    const { data } = await supabase.from('colleges').select('id, name, city, country, website').eq('id', collegeId).maybeSingle();
    if (data?.website) colleges = [data];
  } else {
    const { data, error } = await supabase.rpc('course_targets', { p_country: cfg.country, p_lim: limit, p_recheck_days: 90 });
    if (error) { console.warn(`[${cfg.tag}] queue:`, error.message); return { error: error.message }; }
    colleges = data || [];
  }
  let read = 0, saved = 0, blocked = 0;
  for (const college of colleges) {
    if (!collegeId && serverBusy()) break;
    await supabase.from('colleges').update({ courses_checked_at: new Date().toISOString() }).eq('id', college.id);
    const home = /^https?:\/\//i.test(college.website) ? college.website : `https://${college.website}`;
    if (!(await allowedByRobots(home))) { blocked++; continue; }
    let first = await grab(home); if (!first) continue;
    read++;
    // Japanese home pages are often Japanese only: hop to the university's own English home page if it links one
    if (cc === 'JP' && !ENGLISH.test(first.url)) {
      const en = first.links.map((l) => { try { return /^(english|en)$/i.test(String(l.label || '').trim()) || ENGLISH.test(l.href) ? new URL(l.href, first.url).toString() : null; } catch { return null; } })
        .find((u) => u && sameSite(u, first.url));
      if (en && (await allowedByRobots(en))) { await sleep(2500); first = (await grab(en)) || first; }
    }
    const links = [...new Map(first.links.filter((l) => cfg.link.test(`${l.label} ${l.href}`))
      .map((l) => { try { return new URL(l.href, first.url).toString().split('#')[0]; } catch { return null; } })
      .filter((u) => u && sameSite(u, first.url) && !/\.(pdf|jpe?g|png|zip|docx?)$/i.test(u)).map((u) => [u, u])).keys()]
      .sort((a, b) => Number(ENGLISH.test(b)) - Number(ENGLISH.test(a))).slice(0, 4);
    const pages = [];
    for (const u of links) {
      if (!(await allowedByRobots(u))) continue;
      await sleep(2500);
      const p = await grab(u); if (p) pages.push(p);
    }
    if (!pages.length) pages.push(first);
    for (const page of pages) saved += await save(college, page, await extractProgrammes(college, page, cfg), cfg, cc);
  }
  if (read || saved) console.log(`[${cfg.tag}] ${read} university site(s) read · ${saved} programme(s) saved · ${blocked} skipped by robots.txt`);
  return { read, saved, blocked };
}

// kept for existing callers
export const collectGermanCourses = (opts) => collectCourses('DE', opts);

export function startOfficialCourses() {
  Object.entries(COUNTRIES).forEach(([cc, cfg], i) => {
    if (env(cfg.on, 'on') === 'off') return;
    const run = whenIdle(cfg.label, () => collectCourses(cc).catch((e) => console.warn(`[${cfg.tag}]`, e.message)));
    setTimeout(run, (10 + i * 25) * 60_000).unref();          // countries start 25 min apart, never together
    setInterval(run, Number(env(cfg.every, cfg.everyDefault)) * 3600_000).unref();
  });
}
