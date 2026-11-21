'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Loader2, MailX, Check } from 'lucide-react';

// A button (not an automatic action) so email scanners that open links don't unsubscribe people
export default function Unsubscribe() {
  const t = useSearchParams().get('t') || '';
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle'); const [exam, setExam] = useState<string | null>(null);
  const go = async () => {
    setState('busy');
    try {
      const r = await fetch(`/unsubscribe/exam-news/confirm?t=${encodeURIComponent(t)}`, { method: 'POST' });
      const j = await r.json(); if (!r.ok) throw new Error(j.error);
      setExam(j.exam); setState('done');
    } catch { setState('error'); }
  };
  return (
    <div className="card p-8 text-center">
      {state === 'done' ? <>
        <Check className="mx-auto text-emerald-600" size={36} />
        <h1 className="mt-3 text-xl font-bold text-slate-900">{exam ? `You won't get ${exam} emails any more` : 'This link was already used'}</h1>
        <p className="mt-2 text-sm text-slate-500">News still shows on the exam page. You can turn emails back on there or in your dashboard.</p>
        <Link href="/dashboard?tab=exams" className="btn-ghost mt-4">Manage my exams</Link>
      </> : <>
        <MailX className="mx-auto text-slate-400" size={36} />
        <h1 className="mt-3 text-xl font-bold text-slate-900">Stop exam news emails?</h1>
        <p className="mt-2 text-sm text-slate-500">You will stop getting news emails for this exam.</p>
        <button onClick={go} disabled={!t || state === 'busy'} className="btn-primary mt-4">{state === 'busy' && <Loader2 size={16} className="animate-spin" />}Yes, stop these emails</button>
        {(state === 'error' || !t) && <p className="mt-3 text-sm text-rose-600">This link is not valid. Turn emails off in your dashboard instead.</p>}
      </>}
    </div>
  );
}
