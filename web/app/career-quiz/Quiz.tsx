'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Compass, RotateCcw } from 'lucide-react';

// Holland's RIASEC interest types — an interest guide, not an aptitude test.
type T = 'R' | 'I' | 'A' | 'S' | 'E' | 'C';
const QS: [T, string][] = [
  ['R', 'Fixing a bike, gadget or appliance'], ['I', 'Working out why something happens in science'], ['A', 'Drawing, designing or making videos'],
  ['S', 'Helping a friend understand a difficult topic'], ['E', 'Leading a team or organising an event'], ['C', 'Keeping accounts or records neat and correct'],
  ['R', 'Building or assembling things with your hands'], ['I', 'Solving tricky maths or logic puzzles'], ['A', 'Writing stories, poems or blogs'],
  ['S', 'Caring for people who are sick or upset'], ['E', 'Convincing people to agree with your idea'], ['C', 'Following clear steps and rules to finish a task'],
  ['R', 'Working outdoors — farms, sites, nature'], ['I', 'Doing experiments in a lab'], ['A', 'Acting, music or dance'],
  ['S', 'Volunteering for social causes'], ['E', 'Starting a small business or selling something'], ['C', 'Working with spreadsheets and numbers'],
  ['R', 'Using machines, tools or computers hands-on'], ['I', 'Reading about space, the body or technology'], ['A', 'Decorating a room or styling clothes'],
  ['S', 'Teaching or coaching younger students'], ['E', 'Debating and public speaking'], ['C', 'Planning budgets and schedules'],
  ['R', 'Repairing or maintaining vehicles or electronics'], ['I', 'Analysing data to find patterns'], ['A', 'Photography or graphic design'],
  ['S', 'Listening to people and giving advice'], ['E', 'Taking risks to achieve big goals'], ['C', 'Checking documents for mistakes'],
];
const INFO: Record<T, { name: string; about: string; courses: { label: string; stream?: string; q?: string }[] }> = {
  R: { name: 'Doer (Realistic)', about: 'You like practical, hands-on work with tools, machines and the outdoors.',
    courses: [{ label: 'B.Tech / B.E. (Mechanical, Civil, Electrical)', stream: 'Engineering' }, { label: 'Diploma / Polytechnic', stream: 'Engineering' }, { label: 'B.Sc Agriculture', stream: 'Agriculture' }, { label: 'Aviation, Merchant Navy', q: 'aviation' }] },
  I: { name: 'Thinker (Investigative)', about: 'You enjoy ideas, science, research and solving problems.',
    courses: [{ label: 'B.Sc (Physics, Chemistry, Biology, Maths)', stream: 'Science' }, { label: 'MBBS / BDS / Pharmacy', stream: 'Medical' }, { label: 'B.Tech Computer Science / Data Science', stream: 'Engineering' }, { label: 'Statistics, Economics (Hons)', stream: 'Science' }] },
  A: { name: 'Creator (Artistic)', about: 'You love creating, expressing yourself and original ideas.',
    courses: [{ label: 'B.Des (Fashion, Product, UX)', stream: 'Design' }, { label: 'B.Arch', stream: 'Architecture' }, { label: 'BA Journalism & Mass Communication', stream: 'Arts' }, { label: 'BFA, Film & Animation', stream: 'Arts' }] },
  S: { name: 'Helper (Social)', about: 'You like helping, teaching and working with people.',
    courses: [{ label: 'B.Sc Nursing', stream: 'Nursing' }, { label: 'BA Psychology', stream: 'Arts' }, { label: 'B.Ed / Teaching', stream: 'Education' }, { label: 'Physiotherapy, Social Work (BSW)', stream: 'Medical' }] },
  E: { name: 'Persuader (Enterprising)', about: 'You enjoy leading, persuading and building things that grow.',
    courses: [{ label: 'BBA / Integrated MBA', stream: 'Management' }, { label: 'BA LLB / Law', stream: 'Law' }, { label: 'Hotel Management', stream: 'Hotel Management' }, { label: 'Marketing, Entrepreneurship', stream: 'Management' }] },
  C: { name: 'Organiser (Conventional)', about: 'You like order, detail, numbers and clear systems.',
    courses: [{ label: 'B.Com / B.Com (Hons)', stream: 'Commerce' }, { label: 'CA / CS / CMA foundation', stream: 'Commerce' }, { label: 'BBA Finance, Banking', stream: 'Management' }, { label: 'BCA / IT administration', stream: 'Engineering' }] },
};

export default function Quiz() {
  const [ans, setAns] = useState<Record<number, number>>({});
  const done = Object.keys(ans).length === QS.length;
  const scores = useMemo(() => {
    const s: Record<T, number> = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };
    QS.forEach(([t], i) => { s[t] += ans[i] ?? 0; });
    return (Object.entries(s) as [T, number][]).sort((a, b) => b[1] - a[1]);
  }, [ans]);
  const max = 10;

  return (
    <div>
      <h1 className="flex items-center gap-2 text-3xl font-extrabold text-slate-900"><Compass className="text-brand-600" />Career interest quiz</h1>
      <p className="mt-1 text-slate-500">How much would you enjoy each activity? Answer honestly — there are no right answers. ({Object.keys(ans).length}/{QS.length})</p>
      <div className="mt-2 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-brand-600 transition-all" style={{ width: `${(Object.keys(ans).length / QS.length) * 100}%` }} /></div>

      {!done ? (
        <div className="mt-6 space-y-2">
          {QS.map(([, q], i) => (
            <div key={i} className={`card flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between ${ans[i] != null ? 'opacity-60' : ''}`}>
              <p className="text-sm font-medium text-slate-800">{i + 1}. {q}</p>
              <div className="flex gap-1">
                {[['Not for me', 0], ['Maybe', 1], ['Love it', 2]].map(([l, v]) => (
                  <button key={l as string} type="button" onClick={() => setAns({ ...ans, [i]: v as number })}
                    className={ans[i] === v ? 'btn-primary px-3 py-1 text-xs' : 'btn-ghost px-3 py-1 text-xs'}>{l}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          <div className="card p-5">
            <p className="font-bold text-slate-900">Your interest profile</p>
            <div className="mt-3 space-y-2">{scores.map(([t, v]) => (
              <div key={t} className="flex items-center gap-3 text-sm"><span className="w-48 shrink-0">{INFO[t].name}</span>
                <div className="h-2 flex-1 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-brand-600" style={{ width: `${(v / max) * 100}%` }} /></div><span className="w-8 text-end text-slate-500">{v}</span></div>
            ))}</div>
          </div>
          {scores.slice(0, 2).map(([t]) => (
            <div key={t} className="card p-5">
              <p className="text-lg font-bold text-slate-900">{INFO[t].name}</p>
              <p className="text-sm text-slate-600">{INFO[t].about}</p>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {INFO[t].courses.map((c) => (
                  <li key={c.label} className="rounded-xl bg-slate-50 p-3 text-sm">
                    <p className="font-medium text-slate-800">{c.label}</p>
                    <p className="mt-1 flex gap-3 text-xs">
                      <Link href={c.stream ? `/colleges?stream=${encodeURIComponent(c.stream)}` : `/colleges?q=${encodeURIComponent(c.q || '')}`} className="text-brand-700 underline">Colleges</Link>
                      {c.stream && <Link href={`/recommend?stream=${encodeURIComponent(c.stream)}`} className="text-brand-700 underline">Recommend for me</Link>}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <p className="text-xs text-slate-500">Based on Holland’s RIASEC interest types. It shows what you enjoy, not what you’re able to do — talk to a counsellor and look at your marks and exams too.</p>
          <div className="flex gap-2"><button onClick={() => setAns({})} className="btn-ghost"><RotateCcw size={14} />Retake</button><Link href="/counselling" className="btn-primary">Talk to a counsellor (free)</Link></div>
        </div>
      )}
    </div>
  );
}
