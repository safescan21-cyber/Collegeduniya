import type { Metadata } from 'next';
import Link from 'next/link';
import { ExternalLink, Mail, GraduationCap, Home, Briefcase, ShieldCheck, ArrowRight } from 'lucide-react';
import { ORG } from '@/lib/org';

export const metadata: Metadata = {
  title: `${ORG.founder} — Founder of Collegeolo`,
  description: `${ORG.founder} is the founder of Collegeolo, a free platform that helps students choose a college, find a PG or hostel near campus and get part-time work.`,
  alternates: { canonical: '/founder' },
  openGraph: { type: 'profile', title: `${ORG.founder} — Founder of Collegeolo`, url: '/founder', ...(ORG.founderPhoto ? { images: [{ url: ORG.founderPhoto, width: 480, height: 480, alt: ORG.founder }] } : {}) },
};

const initials = ORG.founder.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

export default function Founder() {
  return (
    <div className="container-x max-w-4xl py-12">
      <section className="card overflow-hidden p-0">
        {ORG.founderCover
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={ORG.founderCover} alt="" className="h-40 w-full object-cover sm:h-52" />
          : <div className="h-28 bg-gradient-to-r from-brand-700 via-indigo-600 to-brand-500" />}
        <div className="px-6 pb-8">
          <div className="-mt-14 flex flex-wrap items-end gap-5">
            {ORG.founderPhoto
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={ORG.founderPhoto} alt={`${ORG.founder}, founder of Collegeolo`} width={128} height={128} className="h-32 w-32 rounded-2xl border-4 border-white object-cover shadow-lg" />
              : <span className="grid h-28 w-28 place-items-center rounded-2xl border-4 border-white bg-gradient-to-br from-brand-600 to-indigo-700 text-4xl font-extrabold text-white shadow-lg">{initials}</span>}
            <div className="pb-1">
              <h1 className="text-3xl font-extrabold text-slate-900">{ORG.founder}</h1>
              <p className="text-slate-600">{ORG.founderRole}, Collegeolo</p>
            </div>
            <div className="ms-auto flex flex-wrap gap-2 pb-1">
              {ORG.founderLinkedin && <a href={ORG.founderLinkedin} target="_blank" rel="noopener noreferrer me" className="btn-primary">Connect on LinkedIn<ExternalLink size={15} /></a>}
              <a href={`mailto:${ORG.email}`} className="btn-ghost"><Mail size={16} />Email</a>
            </div>
          </div>

          <div className="prose prose-slate mt-8 max-w-none">
            {ORG.founderNote ? <p className="text-lg">{ORG.founderNote}</p> : <>
              <p className="text-lg">Hi, I’m {ORG.founder.split(' ')[0]} — a full-stack developer and the person who builds and runs Collegeolo.</p>
              <p>Picking a college is only one part of the decision. Students also need a safe place to stay near campus and, very often, a part-time job to pay for it. That information is usually spread across dozens of websites. I started Collegeolo to put it in one place — and to keep it honest: fees and dates from official sources, ranks from published rankings, and reviews only from students.</p>
            </>}
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              { I: GraduationCap, t: 'Study', d: 'Colleges, courses, fees, rankings, exams and mock tests — in India and abroad.', href: '/colleges' },
              { I: Home, t: 'Stay', d: 'PGs and hostels near campus, and roommates from your college.', href: '/hostels' },
              { I: Briefcase, t: 'Earn', d: 'Part-time jobs and internships near your college.', href: '/jobs' },
            ].map(({ I, t, d, href }) => (
              <Link key={t} href={href} className="rounded-xl border border-slate-100 p-4 transition hover:border-brand-200 hover:bg-brand-50/40">
                <I size={20} className="text-brand-600" /><b className="mt-2 block text-slate-900">{t}</b><p className="mt-1 text-sm text-slate-600">{d}</p>
              </Link>))}
          </div>

          <div className="mt-8 rounded-xl bg-slate-50 p-5">
            <p className="flex items-center gap-2 font-bold text-slate-900"><ShieldCheck size={18} className="text-emerald-600" />My promise to students</p>
            <ul className="mt-2 space-y-1 text-sm text-slate-700">
              <li>• Everything a student uses on Collegeolo is free — searching, applying, mock tests, chat.</li>
              <li>• We never sell your personal data, and your details go to a college only if you tick the box to share them.</li>
              <li>• Money never changes a college’s rank, rating or reviews. Sponsored listings are always labelled.</li>
            </ul>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3 text-sm">
            <Link href="/about" className="font-semibold text-brand-700 hover:underline">About Collegeolo <ArrowRight size={14} className="inline" /></Link>
            <Link href="/contact" className="font-semibold text-brand-700 hover:underline">Contact us <ArrowRight size={14} className="inline" /></Link>
          </div>
        </div>
      </section>
    </div>
  );
}
