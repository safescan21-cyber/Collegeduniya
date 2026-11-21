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

export function Rankings({ name, rows }: { name: string; rows: { source: string; year: number; category: string | null; rank: number | null; rank_band: string | null; source_url: string | null }[] }) {
  if (!rows.length) return null;
  const years = Array.from(new Set(rows.map((r) => r.year))).sort((a, b) => b - a).slice(0, 5);
  const keys = Array.from(new Set(rows.map((r) => `${r.source}|${r.category || 'Overall'}`)));
  return (
    <section id="ranking" className="card scroll-mt-32 overflow-hidden">
      <h2 className="flex items-center gap-2 px-6 pt-5 text-xl font-bold text-slate-900"><Trophy size={20} className="text-amber-500" />{name} ranking</h2>
      <div className="mt-3 overflow-x-auto"><table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-6 py-2">Ranking</th>{years.map((y) => <th key={y} className="px-4 py-2">{y}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">{keys.map((k) => { const [src, cat] = k.split('|'); return (
          <tr key={k}><td className="px-6 py-2"><b>{src}</b> <span className="text-slate-500">{cat}</span></td>
            {years.map((y) => { const r = rows.find((x) => x.year === y && x.source === src && (x.category || 'Overall') === cat);
              return <td key={y} className="px-4 py-2 font-semibold">{r ? (r.rank ? `#${r.rank}` : r.rank_band || '—') : <span className="font-normal text-slate-300">—</span>}</td>; })}
          </tr>); })}</tbody>
      </table></div>
      {rows.find((r) => r.source_url) && <p className="px-6 py-2 text-xs text-slate-400">Source: <a href={rows.find((r) => r.source_url)!.source_url!} target="_blank" rel="noopener noreferrer" className="underline">official ranking</a></p>}
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
