import { supabase } from '../supabase.js';
import { normName } from './collegeUpsert.js';

// Match institute names from official sheets (JoSAA / MCC / state counselling / NIRF) to our colleges.
const STRIP = /\b(the|of|and|for|in|at|a)\b/g;
const key = (s) => normName(s).replace(STRIP, ' ').replace(/\s+/g, ' ').trim();

export async function collegeMatcher(countryCode = 'IN') {
  const byKey = new Map();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('colleges').select('id, name, short_name, city, state')
      .eq('country_code', countryCode).order('id').range(from, from + 999);
    if (error) throw error;
    for (const c of data) {
      for (const n of [c.name, c.short_name, `${c.name} ${c.city}`]) if (n && !byKey.has(key(n))) byKey.set(key(n), c);
    }
    if (data.length < 1000) break;
  }
  return (raw) => {
    if (!raw) return null;
    const k = key(raw);
    if (byKey.has(k)) return byKey.get(k);
    // "National Institute of Technology, Tiruchirappalli" ↔ "NIT Tiruchirappalli" style: try "name city" splits
    const parts = String(raw).split(/[,–-]/).map((p) => p.trim()).filter(Boolean);
    if (parts.length > 1 && byKey.has(key(parts.join(' ')))) return byKey.get(key(parts.join(' ')));
    return null;
  };
}

const col = (headers, re) => headers.find((h) => re.test(String(h).trim()));
const num = (v) => { const n = Number(String(v ?? '').replace(/[^\d.]/g, '')); return Number.isFinite(n) && String(v ?? '').trim() !== '' ? n : null; };
const QUOTA = { AI: 'All India', HS: 'Home State', OS: 'Other State', GO: 'Goa', JK: 'Jammu & Kashmir', LA: 'Ladakh' };
const CATEGORY = (s) => {
  const v = String(s || '').trim().toUpperCase();
  if (/^OPEN|GEN/.test(v)) return v.includes('PWD') ? 'General-PwD' : 'General';
  if (/OBC/.test(v)) return v.includes('PWD') ? 'OBC-NCL-PwD' : 'OBC-NCL';
  if (/EWS/.test(v)) return v.includes('PWD') ? 'EWS-PwD' : 'EWS';
  if (/^SC/.test(v)) return v.includes('PWD') ? 'SC-PwD' : 'SC';
  if (/^ST/.test(v)) return v.includes('PWD') ? 'ST-PwD' : 'ST';
  return String(s || 'General').trim() || 'General';
};

// JoSAA-style columns: Institute | Academic Program Name | Quota | Seat Type | Gender | Opening Rank | Closing Rank
// exam = 'josaa' → IIT rows are saved as jee-advanced, all other institutes as jee-main (one JoSAA file has both)
export async function importCutoffs({ headers, rows, exam, year, round = 'Final', country = 'IN', source = null, log = () => {} }) {
  const exams = exam === 'josaa' ? ['jee-advanced', 'jee-main'] : [exam];
  for (const e of exams) {
    const { data: ex } = await supabase.from('exams').select('slug').eq('slug', e).maybeSingle();
    if (!ex) throw new Error(`Exam "${e}" not found — add it in Admin → Exams first`);
  }
  const examFor = (inst) => (exam === 'josaa' ? (/indian institute of technology|^iit\b/i.test(String(inst)) ? 'jee-advanced' : 'jee-main') : exam);
  const c = {
    inst: col(headers, /^(institute|institution|college)( name)?$/i) || col(headers, /institute|college/i),
    course: col(headers, /program|course|branch/i),
    quota: col(headers, /^quota/i), seat: col(headers, /seat type|category/i), gender: col(headers, /gender/i),
    open: col(headers, /opening/i), close: col(headers, /closing/i), state: col(headers, /home state|^state$/i),
  };
  if (!c.inst || !c.course || !c.close) throw new Error('Need columns: Institute, Program/Course, Closing Rank');
  const match = await collegeMatcher(country);
  const unmatched = new Map(); const out = [];
  for (const r of rows) {
    const college = match(r[c.inst]);
    if (!college) { unmatched.set(r[c.inst], (unmatched.get(r[c.inst]) || 0) + 1); continue; }
    if (/p\s*$/i.test(String(r[c.close] ?? '')) || /p\s*$/i.test(String(r[c.open] ?? ''))) continue;   // "1234P" = preparatory rank list
    const closing = num(r[c.close]);
    if (!closing) continue;
    const q = String(r[c.quota] || 'AI').trim();
    const quota = QUOTA[q.toUpperCase()] || q;
    out.push({
      college_id: college.id, exam_slug: examFor(r[c.inst]), year: Number(year), round: String(round), course: String(r[c.course]).trim().slice(0, 200),
      category: CATEGORY(r[c.seat]), quota, gender: r[c.gender] ? String(r[c.gender]).trim() : 'Gender-Neutral',
      home_state: quota === 'Home State' || quota === 'Other State' ? (r[c.state] || college.state || null) : null,
      opening_rank: num(r[c.open]), closing_rank: closing, source,
    });
  }
  // replace this exam/year/round's rows for the matched colleges, then insert
  const ids = Array.from(new Set(out.map((o) => o.college_id)));
  for (const e of exams) {
    for (let i = 0; i < ids.length; i += 200) {
      await supabase.from('cutoffs').delete().eq('exam_slug', e).eq('year', Number(year)).eq('round', String(round)).in('college_id', ids.slice(i, i + 200));
    }
  }
  for (let i = 0; i < out.length; i += 1000) {
    const { error } = await supabase.from('cutoffs').insert(out.slice(i, i + 1000));
    if (error) throw error;
    log(`cutoffs: ${Math.min(i + 1000, out.length)} / ${out.length}`);
  }
  return { saved: out.length, colleges: ids.length, unmatched: Array.from(unmatched, ([name, n]) => ({ name, rows: n })).slice(0, 200) };
}

// NIRF-style columns: Institute ID | Name | City | State | Score | Rank   (rank may be a band like "101-150")
export async function importRankings({ headers, rows, year, category = 'Overall', source = 'NIRF', country = 'IN', sourceUrl = null }) {
  const c = { name: col(headers, /^(name|institute|institution)/i), rank: col(headers, /rank/i), score: col(headers, /score/i), city: col(headers, /city/i) };
  if (!c.name || !c.rank) throw new Error('Need columns: Name and Rank');
  const match = await collegeMatcher(country);
  const unmatched = []; const out = [];
  for (const r of rows) {
    const college = match(r[c.name]) || (c.city ? match(`${r[c.name]} ${r[c.city]}`) : null);
    if (!college) { unmatched.push(r[c.name]); continue; }
    const rv = String(r[c.rank] ?? '').trim();
    const exact = /^\d+$/.test(rv) ? Number(rv) : null;
    out.push({ college_id: college.id, source, year: Number(year), category, rank: exact, rank_band: exact ? null : rv || null, score: num(r[c.score]), source_url: sourceUrl });
  }
  for (let i = 0; i < out.length; i += 500) {
    const { error } = await supabase.from('college_rankings').upsert(out.slice(i, i + 500), { onConflict: 'college_id,source,year,category' });
    if (error) throw error;
  }
  // keep colleges.ranking = best latest NIRF rank, for sorting
  for (const o of out.filter((x) => x.rank)) await supabase.from('colleges').update({ ranking: o.rank }).eq('id', o.college_id).or(`ranking.is.null,ranking.gt.${o.rank}`);
  return { saved: out.length, unmatched: unmatched.slice(0, 200) };
}
