import type { Metadata } from 'next';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import AskBox from '@/components/ask/AskBox';

export const metadata: Metadata = {
  title: 'Ask Collegeolo — college, cutoff, fees & exam questions answered',
  description: 'Ask any question about Indian and foreign colleges: which colleges your rank can get, fees, placements, exam dates and scholarships. Answers come from official data, with the source pages.',
  alternates: { canonical: '/ask' },
};

export default function AskPage() {
  return (
    <div className="container-x max-w-3xl py-10">
      <h1 className="flex items-center gap-2 text-3xl font-extrabold tracking-tight text-slate-900"><Sparkles className="text-brand-600" />Ask Collegeolo</h1>
      <p className="mt-1 text-slate-500">Ask in your own words. We answer only from our own data — official closing ranks, fees, rankings, exam notices and scholarships — and show the pages we used. No guessing.</p>
      <div className="mt-6"><AskBox /></div>
      <p className="mt-6 text-sm text-slate-500">Want a full list? Use the <Link href="/predictor" className="text-brand-700 underline">college predictor</Link>, <Link href="/compare" className="text-brand-700 underline">compare colleges</Link> or talk to a <Link href="/counselling" className="text-brand-700 underline">free counsellor</Link>.</p>
    </div>
  );
}
