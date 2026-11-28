import type { Metadata } from 'next';
import { PhoneCall, GraduationCap, Home, Briefcase, Globe2 } from 'lucide-react';
import EnquiryForm from '@/components/EnquiryForm';

export const metadata: Metadata = {
  title: 'Free admission counselling',
  description: 'Talk to a Collegeolo counsellor for free — choose the right college and course, plan your budget, and find a PG and part-time job near campus.',
};

const POINTS = [
  { icon: GraduationCap, title: 'College & course shortlist', text: 'Based on your marks, entrance score, budget and city.' },
  { icon: Globe2, title: 'Study abroad guidance', text: 'Country, university, total cost and loan planning.' },
  { icon: Home, title: 'Stay sorted', text: 'Verified PGs and hostels near your campus.' },
  { icon: Briefcase, title: 'Earn while you study', text: 'Part-time jobs and internships that fit your timetable.' },
];

export default function CounsellingPage() {
  return (
    <div className="container-x grid gap-10 py-12 lg:grid-cols-[1fr_420px]">
      <div>
        <span className="chip-green"><PhoneCall size={12} />100% free</span>
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-slate-900">Confused about college? Talk to a counsellor.</h1>
        <p className="mt-3 max-w-xl text-lg text-slate-600">Share a few details and our team will call you back — usually within 24 hours.</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {POINTS.map((p) => (
            <div key={p.title} className="card flex gap-4 p-5">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700"><p.icon size={20} /></span>
              <div><p className="font-bold text-slate-900">{p.title}</p><p className="text-sm text-slate-500">{p.text}</p></div>
            </div>
          ))}
        </div>
      </div>
      <div className="lg:pt-6"><EnquiryForm kind="counselling" /></div>
    </div>
  );
}
