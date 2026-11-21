import Link from 'next/link';
import { CalendarDays, ClipboardList, GraduationCap, HelpCircle, Trophy, ExternalLink, Info } from 'lucide-react';
import { range, short } from '@/lib/format';

// Extra college-page sections. Each one renders only when the college actually has that information.

type Row = [string, React.ReactNode | null | undefined | false];

export function Highlights({ rows, source }: { rows: Row[]; source?: string | null }) {
  const shown = rows.filter(([, v]) => v !== null && v !== undefined && v !== false && v !== '');
  if (shown.length < 3) return null;
  return (
    <section id="highlights" className="card scroll-mt-32 overflow-hidden">
      <h2 className="flex items-center gap-2 border-b border-slate-100 px-6 py-4 text-lg font-bold text-slate-900"><Info size={18} className="text-brand-600" />Highlights</h2>
      <table className="w-full text-sm"><tbody className="divide-y divide-slate-100">
        {shown.map(([k, v]) => <tr key={k}><th scope="row" className="w-2/5 bg-slate-50/70 px-6 py-2.5 text-left font-medium text-slate-600">{k}</th><td className="px-6 py-2.5 text-slate-900">{v}</td></tr>)}
      </tbody></table>
      {source && <p className="px-6 py-2 text-xs text-slate-400">Source: {/^https?:/.test(source) ? <a href={source} target="_blank" rel="noopener noreferrer" className="underline">{source.replace(/^https?:\/\/(www\.)?/, '').slice(0, 60)}</a> : source}</p>}
    </section>
  );
}

// "Event | Date" lines → table
export function parseDates(text?: string | null) {
  return (text || '').split('\n').map((l) => l.split('|').map((x) => x.trim())).filter((p) => p[0] && p[1]).slice(0, 30) as [string, string][];
}
// "Q: … / A: …" blocks → list
export function parseFaqs(text?: string | null) {
  const out: { q: string; a: string }[] = [];
  let cur: { q: string; a: string } | null = null;
  for (const raw of (text || '').split('\n')) {
    const l = raw.trim();
    if (/^q[:.)]/i.test(l)) { if (cur?.q && cur.a) out.push(cur); cur = { q: l.replace(/^q[:.)]\s*/i, ''), a: '' }; }
    else if (/^a[:.)]/i.test(l) && cur) cur.a = l.replace(/^a[:.)]\s*/i, '');
    else if (l && cur?.a) cur.a += `\n${l}`;
  }
  if (cur?.q && cur.a) out.push(cur);
  return out.slice(0, 30);
}

export function Admission({ name, process, dates, eligibility, exams, examNames }: {
  name: string; process?: string | null; dates: [string, string][]; eligibility: { course: string; text: string }[]; exams: string[]; examNames: Record<string, string>;
}) {
  if (!process && !dates.length && !eligibility.length && !exams.length) return null;
  return (
    <section id="admission" className="card scroll-mt-32 space-y-5 p-6">
      <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900"><ClipboardList size={20} className="text-brand-600" />{name} admission</h2>
      {exams.length > 0 && <div><p className="label">Entrance exams accepted</p><div className="flex flex-wrap gap-2">{exams.map((e) => examNames[e]
        ? <Link key={e} href={`/exams/${e}`} className="chip-brand hover:underline">{examNames[e]}</Link> : <span key={e} className="chip">{e}</span>)}</div></div>}
      {process && <div><p className="label">How to apply</p><p className="whitespace-pre-line leading-relaxed text-slate-700">{process}</p></div>}
      {dates.length > 0 && <div><p className="label flex items-center gap-1"><CalendarDays size={14} />Important dates</p>
        <div className="overflow-x-auto rounded-xl border border-slate-100"><table className="w-full text-sm"><thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-2">Event</th><th className="px-4 py-2">Date</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{dates.map(([e, d], i) => <tr key={i}><td className="px-4 py-2">{e}</td><td className="px-4 py-2 font-medium">{d}</td></tr>)}</tbody></table></div>
        <p className="mt-1 text-xs text-slate-400">Dates change — confirm on the official website.</p></div>}
      {eligibility.length > 0 && <div><p className="label">Eligibility by course</p>
        <div className="overflow-x-auto rounded-xl border border-slate-100"><table className="w-full text-sm"><tbody className="divide-y divide-slate-100">
          {eligibility.map((x) => <tr key={x.course}><th scope="row" className="w-2/5 bg-slate-50/70 px-4 py-2 text-left font-medium text-slate-700">{x.course}</th><td className="px-4 py-2 text-slate-700">{x.text}</td></tr>)}
        </tbody></table></div></div>}
    </section>
  );
}

type RankRow = { source: string; year: number; category: string | null; rank: number | null; rank_band: string | null; source_url: string | null };

// Plain-language highlights worked out from the official ranks (no copied text): best ranks, streaks, moves, top-10s
export function rankingHighlights(rows: RankRow[], review?: { avg: number; count: number } | null) {
  const out: { tone: 'gold' | 'up' | 'down' | 'info'; text: string }[] = [];
  const nirf = rows.filter((r) => r.source === 'NIRF' && r.rank);
  if (nirf.length) {
    const latest = Math.max(...nirf.map((r) => r.year));
    const now = nirf.filter((r) => r.year === latest).sort((a, b) => (a.category === 'Overall' ? -1 : 0) - (b.category === 'Overall' ? -1 : 0) || a.rank! - b.rank!);
    const cats = Array.from(new Set(nirf.map((r) => r.category || 'Overall')));
    for (const r of now.slice(0, 3)) out.push({ tone: r.rank! <= 10 ? 'gold' : 'info', text: `#${r.rank} in ${r.category === 'Overall' ? 'India (Overall)' : r.category} — NIRF ${latest}` });
    const top10 = now.filter((r) => r.rank! <= 10).map((r) => r.category).filter((c) => c !== 'Overall');
    if (top10.length > 1) out.push({ tone: 'gold', text: `Top 10 in India for ${top10.slice(0, 3).join(', ')}` });
    for (const c of cats) {
      const hist = nirf.filter((r) => (r.category || 'Overall') === c).sort((a, b) => b.year - a.year);
      if (hist[0]?.year !== latest || hist.length < 2) continue;
      let streak = 1; while (streak < hist.length && hist[streak].rank === hist[0].rank && hist[streak].year === latest - streak) streak++;
      if (streak >= 2 && hist[0].rank! <= 20) { out.push({ tone: 'gold', text: `Held #${hist[0].rank} in ${c} for ${streak} years running (${latest - streak + 1}–${latest})` }); continue; }
      const first = hist[hist.length - 1]; const move = first.rank! - hist[0].rank!;
      if (Math.abs(move) >= 3) out.push({ tone: move > 0 ? 'up' : 'down', text: `${move > 0 ? 'Up' : 'Down'} ${Math.abs(move)} places in ${c} since ${first.year} (#${first.rank} → #${hist[0].rank})` });
    }
    const fresh = now.filter((r) => !nirf.some((x) => x.year < latest && x.category === r.category));
    if (fresh.length && nirf.some((x) => x.year < latest)) out.push({ tone: 'info', text: `Newly ranked in ${fresh.map((r) => r.category).slice(0, 2).join(' and ')} in ${latest}` });
    const years = Array.from(new Set(nirf.map((r) => r.year))).sort();
    if (years.length >= 3) out.push({ tone: 'info', text: `Ranked by NIRF every year ${years[0]}–${years[years.length - 1]}` });
  }
  if (review && review.count > 0) out.push({ tone: 'info', text: `Students rate it ${review.avg.toFixed(1)}/5 from ${review.count} review${review.count === 1 ? '' : 's'}` });
  const seen = new Set<string>(); return out.filter((h) => (seen.has(h.text) ? false : (seen.add(h.text), true))).slice(0, 7);
}

export function Rankings({ name, rows, review, nirf }: { name: string; rows: RankRow[]; review?: { avg: number; count: number } | null;
  nirf?: { year: number; score: number | null; tlr: number; rpc: number; go: number; oi: number; perception: number } | null }) {
  if (!rows.length) return null;
  const hl = rankingHighlights(rows, review);
  const years = Array.from(new Set(rows.map((r) => r.year))).sort((a, b) => b - a).slice(0, 5);
  const keys = Array.from(new Set(rows.map((r) => `${r.source}|${r.category || 'Overall'}`)));
  return (
    <section id="ranking" className="card scroll-mt-32 overflow-hidden">
      <h2 className="flex items-center gap-2 px-6 pt-5 text-xl font-bold text-slate-900"><Trophy size={20} className="text-amber-500" />{name} ranking</h2>
      {nirf && (
        <div className="mx-6 mt-3 rounded-xl border border-slate-100 p-3">
          <p className="text-sm font-semibold text-slate-800">NIRF {nirf.year} score{nirf.score != null ? <>: <b className="text-brand-700">{nirf.score.toFixed(2)}</b> / 100</> : null}</p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {([['Teaching & resources', nirf.tlr], ['Research', nirf.rpc], ['Graduation outcomes', nirf.go], ['Outreach & inclusivity', nirf.oi], ['Perception', nirf.perception]] as [string, number][]).map(([l, v]) => (
              <div key={l} className="text-xs"><p className="text-slate-500">{l}</p>
                <div className="mt-1 h-1.5 rounded-full bg-slate-100"><div className="h-1.5 rounded-full bg-brand-600" style={{ width: `${Math.max(2, Math.min(100, v))}%` }} /></div>
                <p className="mt-0.5 font-semibold text-slate-800">{v.toFixed(1)}</p></div>))}
          </div>
        </div>
      )}
      {hl.length > 0 && (
        <ul className="mx-6 mt-3 grid gap-2 sm:grid-cols-2">
          {hl.map((h) => (
            <li key={h.text} className={`flex items-start gap-2 rounded-xl px-3 py-2 text-sm ${h.tone === 'gold' ? 'bg-amber-50 text-amber-900' : h.tone === 'up' ? 'bg-emerald-50 text-emerald-800' : h.tone === 'down' ? 'bg-rose-50 text-rose-800' : 'bg-slate-50 text-slate-700'}`}>
              <span aria-hidden>{h.tone === 'gold' ? '🏆' : h.tone === 'up' ? '▲' : h.tone === 'down' ? '▼' : '•'}</span>{h.text}
            </li>))}
        </ul>
      )}
      <div className="mt-3 overflow-x-auto"><table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-6 py-2">Ranking</th>{years.map((y) => <th key={y} className="px-4 py-2">{y}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">{keys.map((k) => { const [src, cat] = k.split('|'); return (
          <tr key={k}><td className="px-6 py-2"><b>{src}</b> <span className="text-slate-500">{cat}</span></td>
            {years.map((y) => { const r = rows.find((x) => x.year === y && x.source === src && (x.category || 'Overall') === cat);
              return <td key={y} className="px-4 py-2 font-semibold">{r ? (r.rank ? `#${r.rank}` : r.rank_band || '—') : <span className="font-normal text-slate-300">—</span>}</td>; })}
          </tr>); })}</tbody>
      </table></div>
      {rows.find((r) => r.source_url) && <p className="px-6 py-2 text-xs text-slate-400">Source: <a href={rows.find((r) => r.source_url)!.source_url!} target="_blank" rel="noopener noreferrer" className="underline">official ranking</a>{rows.some((r) => r.source === 'NIRF') ? ' — NIRF India Rankings, Ministry of Education, Govt. of India. ' : ' '}<Link href="/rankings" className="underline">See full ranking lists</Link></p>}
    </section>
  );
}

export function Scholarships({ name, text }: { name: string; text?: string | null }) {
  if (!text) return null;
  return (
    <section id="scholarships" className="card scroll-mt-32 p-6">
      <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900"><GraduationCap size={20} className="text-brand-600" />Scholarships at {name}</h2>
      <p className="mt-3 whitespace-pre-line leading-relaxed text-slate-700">{text}</p>
      <Link href="/scholarships" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">Government & private scholarships you can also apply for <ExternalLink size={13} /></Link>
    </section>
  );
}

export function Faqs({ name, items }: { name: string; items: { q: string; a: string }[] }) {
  if (!items.length) return null;
  return (
    <section id="faqs" className="card scroll-mt-32 p-6">
      <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900"><HelpCircle size={20} className="text-brand-600" />FAQs about {name}</h2>
      <div className="mt-3 divide-y divide-slate-100">{items.map((f, i) => (
        <details key={i} className="group py-3" open={i === 0}>
          <summary className="cursor-pointer list-none font-semibold text-slate-900 marker:hidden">{f.q}</summary>
          <p className="mt-2 whitespace-pre-line text-slate-700">{f.a}</p>
        </details>))}</div>
    </section>
  );
}

export const feeRange = (lo?: number | null, hi?: number | null, cur?: string | null) =>
  lo || hi ? ((cur || 'INR') === 'INR' ? (lo && hi && lo !== hi ? `${short(lo)} – ${short(hi)} per year` : `${short((lo || hi)!)} per year`) : range(lo ?? null, hi ?? null, cur)) : null;
