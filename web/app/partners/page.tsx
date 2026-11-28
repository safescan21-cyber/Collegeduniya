import type { Metadata } from 'next';
import Link from 'next/link';
import { BedDouble, Building2, CheckCircle2 } from 'lucide-react';

export const metadata: Metadata = {
  title: 'For PG owners and employers — list rooms and jobs free',
  description: 'PG and hostel owners list rooms and keep availability up to date. Companies post part-time jobs and internships for students. Free on Collegeolo.',
};

const OWNER = ['List your PG, hostel or flat free', 'Update available beds in one tap', 'Get enquiries and calls from students nearby', 'Verified badge after a quick check', 'Reviews from real students build trust'];
const EMPLOYER = ['Company profile with verified badge', 'Post part-time jobs, internships and weekend work', 'Applicants with CV, phone and message', 'Shortlist / hire / reject in one place', 'Reach students near every college in your city'];

export default async function Partners({ searchParams }: { searchParams: Promise<{ as?: string }> }) {
  const as = (await searchParams).as;
  const cards = [
    { key: 'pg_owner', icon: BedDouble, title: 'PG & hostel owners', points: OWNER, cta: 'Register as PG owner', portal: '/owner' },
    { key: 'employer', icon: Building2, title: 'Companies & employers', points: EMPLOYER, cta: 'Register as employer', portal: '/employer' },
  ];
  return (
    <div className="container-x py-12">
      <h1 className="text-center text-4xl font-extrabold tracking-tight text-slate-900">Reach students where they study</h1>
      <p className="mx-auto mt-3 max-w-2xl text-center text-lg text-slate-600">Free accounts for PG owners and employers. Sign in with just your email — no password.</p>
      <div className="mt-10 grid gap-6 md:grid-cols-2">
        {cards.map((c) => (
          <div key={c.key} className={`card p-8 ${as === c.key ? 'border-brand-400 ring-4 ring-brand-100' : ''}`}>
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-600 text-white"><c.icon size={26} /></span>
            <h2 className="mt-4 text-2xl font-bold text-slate-900">{c.title}</h2>
            <ul className="mt-4 space-y-2">{c.points.map((p) => <li key={p} className="flex items-start gap-2 text-slate-700"><CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-600" />{p}</li>)}</ul>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link href={`/login?mode=register&as=${c.key}`} className="btn-primary">{c.cta}</Link>
              <Link href={`/login?as=${c.key}&next=${c.portal}`} className="btn-ghost">I already have an account</Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
