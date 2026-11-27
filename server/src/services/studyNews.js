import { supabase } from '../supabase.js';
import { whenIdle } from './loadGuard.js';
import { throttle } from './http.js';
import { titleKey } from './examNews.js';
import { has, getText, gdeltDate } from './visaNews.js';

// Study news (migration 052) — education headlines for students, every STUDY_NEWS_EVERY_HOURS (4)
//  Source: GDELT DOC 2.0 (free, any use with attribution — like exam and visa news). One query per category;
//  a headline is kept only when it has the category's words AND an education word, and is not a crime / tragedy story.
//  Only headline, source and link are stored; each item opens the original publisher.
//  Visa news has its own collector (visaNews.js) and is shown together with these on /news.

const env = (k, d) => process.env[k] ?? d;
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; } };

const EDU = ['student', 'students', 'graduate', 'graduates', 'freshers', 'university', 'universities', 'college', 'colleges', 'admission', 'admissions', 'education', 'campus', 'school of',
  'IIT', 'IITs', 'NIT', 'NITs', 'IIM', 'IIMs', 'AIIMS', 'UGC', 'AICTE', 'NAAC', 'NIRF', 'NEP', 'CUET', 'JoSAA', 'scholarship', 'scholarships', 'fellowship',
  'degree', 'degrees', 'course', 'courses', 'PhD', 'MBA', 'B.Tech', 'MBBS', 'undergraduate', 'postgraduate', 'tuition', 'study'];
// tragedies, crime and politics-only stories are not "study news"
const NOT = /\b(dies|died|death|dead|suicide|kill|killed|killing|murder|rape|raped|assault|arrest|arrested|stabbed|shot dead|molest|harass|drown|accident|body found|missing|protest(?:ers)? (?:clash|lathi)|lathicharge)\b/i;

export const CATEGORIES = [
  { key: 'admissions', region: 'IN', label: 'Admissions',
    q: '("admission" OR "admissions" OR "counselling" OR "seat allotment" OR "CUET" OR "JoSAA" OR "registration begins" OR "last date to apply") (university OR college OR IIT OR NIT OR "medical college") sourcecountry:india',
    words: ['admission', 'admissions', 'counselling', 'counseling', 'seat allotment', 'CUET', 'JoSAA', 'registration', 'apply', 'application', 'applications', 'merit list', 'cut-off', 'cutoff', 'seats', 'intake'] },
  { key: 'scholarships', region: 'IN', label: 'Scholarships',
    q: '("scholarship" OR "scholarships" OR "fellowship" OR "fee waiver" OR "education loan") (students OR student OR study) sourcecountry:india',
    words: ['scholarship', 'scholarships', 'fellowship', 'fellowships', 'fee waiver', 'education loan', 'stipend', 'financial aid', 'grant'] },
  { key: 'colleges', region: 'IN', label: 'Universities & colleges',
    q: '("UGC" OR "AICTE" OR "NAAC" OR "NIRF" OR "new IIT" OR "new campus" OR "university ranking" OR "QS ranking" OR "placements") (university OR college OR IIT OR IIM OR students) sourcecountry:india',
    words: ['UGC', 'AICTE', 'NAAC', 'NIRF', 'ranking', 'rankings', 'ranked', 'campus', 'placement', 'placements', 'new course', 'new courses', 'launches', 'launch', 'accreditation', 'approval', 'vice chancellor', 'convocation', 'faculty', 'research'] },
  { key: 'policy', region: 'IN', label: 'Education policy',
    q: '("National Education Policy" OR "NEP 2020" OR "Ministry of Education" OR "education ministry" OR "four-year undergraduate" OR "academic bank of credits" OR "higher education") sourcecountry:india',
    words: ['National Education Policy', 'NEP', 'Ministry of Education', 'education ministry', 'policy', 'guidelines', 'rules', 'regulation', 'regulations', 'reform', 'four-year', 'credit', 'credits', 'higher education', 'budget'] },
  { key: 'abroad', region: 'world', label: 'Study abroad',
    q: '("study abroad" OR "Indian students" OR "international students" OR "foreign universities" OR "global university rankings") (university OR universities OR students) sourcelang:english',
    words: ['study abroad', 'Indian students', 'international students', 'foreign university', 'foreign universities', 'overseas', 'abroad', 'global ranking', 'world ranking', 'QS', 'campus in India', 'offshore campus'] },
  { key: 'skills', region: 'world', label: 'Future skills & jobs',
    q: '("AI courses" OR "skills gap" OR "future of jobs" OR "upskilling" OR "online degree" OR "micro-credentials" OR "campus placements") (students OR graduates OR university) sourcelang:english',
    words: ['AI', 'artificial intelligence', 'skills', 'skill', 'upskilling', 'jobs', 'job', 'hiring', 'placements', 'internship', 'internships', 'online degree', 'graduates', 'careers', 'career'] },
];

export function keepStudy(cat, title) {
  if (!title || title.length < 25 || title.length > 300 || NOT.test(title)) return false;
  return has(cat.words, title) && has(EDU, title);
}

async function fromGdelt(cat) {
  await throttle('api.gdeltproject.org', Number(env('GDELT_GAP_MS', 6000)));
  const url = `https://api.gdeltproject.org/api/v2/doc/doc?${new URLSearchParams({ query: cat.q, mode: 'artlist', format: 'json', maxrecords: '100', sort: 'datedesc', timespan: `${Number(env('STUDY_NEWS_HOURS', 72))}h` })}`;
  const body = await getText(url, 'application/json');
  let j; try { j = JSON.parse(body); } catch { throw new Error(`GDELT: ${body.slice(0, 120)}`); }
  return (j.articles || []).filter((a) => keepStudy(cat, a.title) && (!a.language || /english/i.test(a.language)))
    .map((a) => ({ title: a.title.trim(), url: a.url, source: (a.domain || host(a.url)).replace(/^www\./, ''), published_at: gdeltDate(a.seendate) }));
}

export async function collectStudyNews({ only = null } = {}) {
  const stats = { categories: 0, found: 0, saved: 0, errors: 0 };
  for (const cat of CATEGORIES.filter((c) => !only || c.key === only)) {
    stats.categories++;
    let items = [];
    try { items = await fromGdelt(cat); } catch (e) { stats.errors++; console.warn(`[study-news] ${cat.key}:`, e.message); continue; }
    const seen = new Set();
    for (const it of items) {
      const key = titleKey(it.title);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      stats.found++;
      const { error } = await supabase.from('study_news').insert({ category: cat.key, region: cat.region, title: it.title.slice(0, 400), url: it.url,
        source: it.source, published_at: it.published_at, title_key: key });
      if (!error) stats.saved++;
      else if (error.code !== '23505') { stats.errors++; console.warn('[study-news] save:', error.message); }
    }
  }
  return stats;
}

export function startStudyNews() {
  if (env('STUDY_NEWS', 'on') === 'off') return;
  const every = Math.max(1, Number(env('STUDY_NEWS_EVERY_HOURS', 4))) * 3600e3;
  const run = whenIdle('study news', () => collectStudyNews().then((s) => console.log('[study-news]', s)).catch((e) => console.warn('[study-news]', e.message)));
  setTimeout(run, 9 * 60e3); setInterval(run, every).unref();
}
