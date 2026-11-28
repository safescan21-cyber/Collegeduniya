'use client';
import { useMemo, useState } from 'react';
import { Fragment } from 'react';
import { Search, ExternalLink, ChevronDown, Briefcase } from 'lucide-react';
import { careerScope } from '@/lib/careerScope';
import { money } from '@/lib/format';

type Co = { id: string; name: string; level: string | null; duration?: string | null; fees?: number | null; currency?: string | null;
  eligibility?: string | null; url?: string | null; study_mode?: string | null; seats?: number | null; source?: string | null; fees_note?: string | null };

// Degree type from the course name (U.S. Scorecard names start with it: "Bachelor's degree — Economics")
function degreeOf(c: Co): { rank: number; label: string } {
  const n = c.name.toLowerCase(); const l = (c.level || '').toLowerCase();
  if (/^bachelor|^b\.?\s?(tech|e|sc|a|com|ba|bba|bca|arch|pharm|des|ed)\b|bachelor of/.test(n) || (l === 'ug' && !/^associate/.test(n))) return { rank: 0, label: 'Bachelor’s / UG' };
  if (/^master|^m\.?\s?(tech|e|sc|a|com|ba|ca|arch|pharm|des|ed|phil)\b|master of|^mba\b/.test(n) || l === 'pg') return { rank: 1, label: 'Master’s / PG' };
  if (/^doctoral|^professional degree|ph\.?d|doctor of/.test(n) || l === 'phd') return { rank: 2, label: 'PhD / Doctoral' };
  if (/^associate/.test(n)) return { rank: 3, label: 'Associate' };
  if (/diploma/.test(n) || l === 'diploma') return { rank: 4, label: 'Diploma' };
  if (/certificate/.test(n) || l === 'certificate') return { rank: 5, label: 'Certificate' };
  return { rank: 6, label: c.level || 'Other' };
}

// Usual length and entry requirement for U.S. degrees when the college's data doesn't state them (marked "usual")
function usual(c: Co) {
  if (c.source !== 'scorecard') return { duration: null, eligibility: null };
  const n = c.name.toLowerCase();
  if (n.startsWith("bachelor's")) return { duration: '4 years (usual)', eligibility: 'High-school diploma / Class 12 (usual)' };
  if (n.startsWith("associate's")) return { duration: '2 years (usual)', eligibility: 'High-school diploma / Class 12 (usual)' };
  if (n.startsWith("master's")) return { duration: '1–2 years (usual)', eligibility: 'Bachelor’s degree (usual)' };
  if (n.startsWith('doctoral')) return { duration: null, eligibility: 'Bachelor’s or master’s degree (usual)' };
  if (n.startsWith('graduate certificate') || n.startsWith('post-baccalaureate')) return { duration: null, eligibility: 'Bachelor’s degree (usual)' };
  return { duration: null, eligibility: null };
}

const PAGE = 25;

export default function CoursesTable({ courses, currency, website }: { courses: Co[]; currency: string; website?: string | null }) {
  const [q, setQ] = useState('');
  const [tab, setTab] = useState('all');
  const [shown, setShown] = useState(PAGE);
  const [open, setOpen] = useState<string | null>(null);
  const rows = useMemo(() => courses.map((c) => ({ c, d: degreeOf(c), u: usual(c) }))
    .sort((a, b) => a.d.rank - b.d.rank || a.c.name.localeCompare(b.c.name)), [courses]);
  const tabs = useMemo(() => {
    const m = new Map<string, { rank: number; n: number }>();
    for (const r of rows) { const t = m.get(r.d.label) || { rank: r.d.rank, n: 0 }; t.n++; m.set(r.d.label, t); }
    return [...m].sort((a, b) => a[1].rank - b[1].rank);
  }, [rows]);
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const list = rows.filter((r) => (tab === 'all' || r.d.label === tab) && words.every((w) => r.c.name.toLowerCase().includes(w)));

  return (
    <div className="card overflow-hidden">
      {(courses.length > 10) && (
        <div className="space-y-3 border-b border-slate-100 p-4">
          <div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9" value={q} onChange={(e) => { setQ(e.target.value); setShown(PAGE); }} placeholder={`Search ${courses.length} courses — e.g. computer, economics, nursing`} aria-label="Search courses" /></div>
          {tabs.length > 1 && (
            <div className="flex flex-wrap gap-2 text-sm">
              <button type="button" onClick={() => { setTab('all'); setShown(PAGE); }} className={tab === 'all' ? 'btn-primary py-1.5' : 'btn-ghost py-1.5'}>All ({courses.length})</button>
              {tabs.map(([label, t]) => <button type="button" key={label} onClick={() => { setTab(label); setShown(PAGE); }} className={tab === label ? 'btn-primary py-1.5' : 'btn-ghost py-1.5'}>{label} ({t.n})</button>)}
            </div>
          )}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr><th className="px-4 py-3">Course</th><th className="px-4 py-3">Level</th><th className="px-4 py-3">Duration</th><th className="px-4 py-3">Fees / year</th><th className="px-4 py-3">Eligibility</th><th className="px-4 py-3"><span className="sr-only">Details</span></th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {list.slice(0, shown).map(({ c, d, u }) => { const sc = careerScope(c.name, d.label); const isOpen = open === c.id; return (
              <Fragment key={c.id}>
              <tr>
                <td className="px-4 py-3 font-medium text-slate-900">{c.url ? <a href={c.url} target="_blank" rel="noopener nofollow" className="hover:text-brand-700 hover:underline">{c.name}</a> : c.name}
                  {c.study_mode ? <span className="block text-xs text-slate-400">{c.study_mode}</span> : null}{c.seats ? <span className="block text-xs text-slate-400">{c.seats} seats</span> : null}</td>
                <td className="px-4 py-3"><span className="chip whitespace-nowrap">{d.label}</span></td>
                <td className="px-4 py-3 text-slate-600">{c.duration || u.duration || '—'}</td>
                <td className="px-4 py-3 font-semibold text-slate-900">{c.fees != null ? <>{money(c.fees, c.currency || currency)}{c.source === 'scorecard' ? <span className="block text-xs font-normal text-slate-400">undergraduate tuition (official)</span> : null}</>
                  : website ? <a href={website} target="_blank" rel="noopener nofollow" className="inline-flex items-center gap-1 text-xs font-normal text-brand-700 hover:underline">See official site<ExternalLink size={11} /></a> : '—'}</td>
                <td className="px-4 py-3 text-slate-600">{c.eligibility || u.eligibility || '—'}</td>
                <td className="px-4 py-3"><button type="button" onClick={() => setOpen(isOpen ? null : c.id)} aria-expanded={isOpen} className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-semibold text-brand-700 hover:underline">Details & scope<ChevronDown size={13} className={isOpen ? 'rotate-180 transition' : 'transition'} /></button></td>
              </tr>
              {isOpen && (
                <tr className="bg-slate-50/70"><td colSpan={6} className="px-4 py-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1 text-sm">
                      <p className="font-semibold text-slate-900">Course details</p>
                      <p><span className="text-slate-500">Level:</span> {d.label}</p>
                      <p><span className="text-slate-500">Duration:</span> {c.duration || u.duration || 'see official page'}</p>
                      {c.study_mode && <p><span className="text-slate-500">Mode / language:</span> {c.study_mode}</p>}
                      <p><span className="text-slate-500">Fees:</span> {c.fees != null ? `${money(c.fees, c.currency || currency)} a year` : 'see official page'}{c.fees_note ? <span className="text-slate-400"> ({c.fees_note})</span> : null}</p>
                      <p><span className="text-slate-500">Eligibility:</span> {c.eligibility || u.eligibility || 'see official page'}</p>
                      {(c.url || website) && <a href={c.url || website!} target="_blank" rel="noopener nofollow" className="inline-flex items-center gap-1 text-brand-700 hover:underline">Official course page<ExternalLink size={12} /></a>}
                    </div>
                    <div className="space-y-1 text-sm">
                      <p className="flex items-center gap-1.5 font-semibold text-slate-900"><Briefcase size={14} className="text-brand-600" />Future scope{sc ? ` — ${sc.area}` : ''}</p>
                      {sc ? (<>
                        <p><span className="text-slate-500">Usual jobs:</span> {sc.jobs.join(', ')}</p>
                        <p><span className="text-slate-500">Where graduates work:</span> {sc.sectors.join(', ')}</p>
                        {sc.next && <p className="text-slate-600">{sc.next}</p>}
                        <p className="text-xs text-slate-400">General guidance for this subject. Licensed jobs (doctor, lawyer, nurse) need the country’s licence exam.</p>
                      </>) : <p className="text-slate-600">Ask the university’s careers office about typical jobs after this course{website ? ' — see the official website' : ''}.</p>}
                    </div>
                  </div>
                </td></tr>
              )}
              </Fragment>
            ); })}
            {!list.length && <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500">No course matches “{q}”.</td></tr>}
          </tbody>
        </table>
      </div>
      {list.length > shown && (
        <div className="border-t border-slate-100 p-3 text-center">
          <button type="button" onClick={() => setShown((s) => s + 50)} className="btn-ghost">Show more ({list.length - shown} left)</button>
        </div>
      )}
    </div>
  );
}
