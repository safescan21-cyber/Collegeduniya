import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldCheck, BadgeCheck, Database, UserCheck, Megaphone, Trash2 } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Why you can trust Collegeolo — reviews, data sources & your details',
  description: 'How Collegeolo checks student reviews, where our cutoffs, fees and dates come from, how we make money, and why we never share your details with a college without your permission.',
  alternates: { canonical: '/trust' },
};

const POINTS = [
  { icon: UserCheck, title: 'Your details stay yours', body: 'We share your name and phone with a college only when you tick the box that says you want that college to contact you. No tick, no sharing. You can delete your account and data at any time from your account page.' },
  { icon: BadgeCheck, title: 'Real reviews from real students', body: 'Anyone logged in can review a college. Students who upload a college ID card or fee receipt get a “Verified student” badge after our team checks it — and you can show only verified reviews on every college page. We never remove a review because it is negative, and any reward for a detailed review is the same whatever your rating. You can edit or delete your own review whenever you like. If our team edits a review (for abuse or personal details), it is marked “Edited by moderator”.' },
  { icon: Database, title: 'Numbers from official sources', body: 'Closing ranks come from official counselling results (JoSAA, MCC and state counselling sites). Rankings come from NIRF and the official world-ranking publishers. Fees come only from a university’s or government’s own pages. Exam dates link to the official notice they came from. When we don’t have an official number, we say so instead of guessing.' },
  { icon: Megaphone, title: 'How we make money — openly', body: 'Collegeolo is free for students. Hostel owners and employers can pay to boost their listings, and some colleges are partners who receive enquiries from students who asked to be contacted. Cards marked “Featured” may include partner colleges. Rankings, cutoffs, predictor results and reviews are never for sale.' },
  { icon: Trash2, title: 'Report anything wrong', body: 'Found a wrong fee, a fake review or a broken link? Tell us from the contact page and we fix it — usually within a few days.' },
];

export default function TrustPage() {
  return (
    <div className="container-x max-w-3xl py-10">
      <h1 className="flex items-center gap-2 text-3xl font-extrabold tracking-tight text-slate-900"><ShieldCheck className="text-brand-600" />Why you can trust Collegeolo</h1>
      <p className="mt-2 text-slate-600">Choosing a college is a big decision, often with your family’s savings. Here is exactly how we work.</p>
      <div className="mt-6 space-y-4">
        {POINTS.map((p) => (
          <section key={p.title} className="card flex gap-4 p-5">
            <p.icon className="mt-0.5 shrink-0 text-brand-600" size={22} />
            <div><h2 className="font-bold text-slate-900">{p.title}</h2><p className="mt-1 text-sm text-slate-600">{p.body}</p></div>
          </section>
        ))}
      </div>
      <p className="mt-6 text-sm text-slate-500">Read more: <Link href="/editorial-policy" className="text-brand-700 underline">editorial policy</Link> · <Link href="/privacy" className="text-brand-700 underline">privacy</Link> · <Link href="/founder" className="text-brand-700 underline">why I started Collegeolo</Link> · <Link href="/contact" className="text-brand-700 underline">report a problem</Link></p>
    </div>
  );
}
