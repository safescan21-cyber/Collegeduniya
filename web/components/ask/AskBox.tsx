'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Sparkles, Loader2, Send, ExternalLink, Info } from 'lucide-react';
import { api } from '@/lib/api';

type Answer = { answer: string; sources: { title: string; url: string }[]; ai: boolean };
const EXAMPLES = ['Which colleges can I get with JEE Main rank 15000 OBC?', 'IIT Bombay fees and placement', 'NIT Trichy cutoff for CSE', 'When is NEET UG registration?', 'Scholarships for engineering students'];

// "Ask Collegeolo" — answers come only from Collegeolo's data, with the pages used
export default function AskBox({ compact = false }: { compact?: boolean }) {
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [res, setRes] = useState<(Answer & { q: string }) | null>(null);

  const ask = async (text: string) => {
    const question = text.trim();
    if (question.length < 4) return setErr('Type a question first.');
    setQ(question); setBusy(true); setErr('');
    try { setRes({ ...(await api<Answer>('/api/ask', { method: 'POST', body: JSON.stringify({ q: question }) })), q: question }); }
    catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };
  const local = (u: string) => u.replace(/^https?:\/\/(www\.)?collegeolo\.com/, '') || '/';
  const isLocal = (u: string) => /^https?:\/\/(www\.)?collegeolo\.com/.test(u);

  return (
    <div className={compact ? '' : 'card p-5 sm:p-6'}>
      <form onSubmit={(e) => { e.preventDefault(); ask(q); }} className="flex gap-2">
        <input className="input flex-1" value={q} maxLength={300} onChange={(e) => setQ(e.target.value)} placeholder="Ask about colleges, fees, cutoffs, exam dates, scholarships…" aria-label="Your question" />
        <button disabled={busy} className="btn-primary shrink-0">{busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}<span className="hidden sm:inline">Ask</span></button>
      </form>
      {!res && !busy && (
        <div className="mt-3 flex flex-wrap gap-2">{EXAMPLES.map((x) => <button key={x} type="button" onClick={() => ask(x)} className="chip hover:bg-brand-50">{x}</button>)}</div>
      )}
      {err && <p className="mt-3 text-sm text-rose-600">{err}</p>}
      {res && (
        <div className="mt-4 rounded-xl bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{res.q}</p>
          <p className="mt-2 flex items-start gap-2 whitespace-pre-line text-slate-800"><Sparkles size={16} className="mt-1 shrink-0 text-brand-600" /><span>{res.answer}</span></p>
          {res.sources.length > 0 && (
            <div className="mt-3 border-t border-slate-200 pt-3">
              <p className="text-xs font-semibold text-slate-500">From these pages</p>
              <ul className="mt-1 space-y-1 text-sm">{res.sources.map((s) => (
                <li key={s.url}>{isLocal(s.url)
                  ? <Link href={local(s.url)} className="text-brand-700 hover:underline">{s.title}</Link>
                  : <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-brand-700 hover:underline">{s.title}<ExternalLink size={11} /></a>}</li>))}</ul>
            </div>
          )}
          <p className="mt-3 flex items-start gap-1.5 text-xs text-slate-500"><Info size={13} className="mt-0.5 shrink-0" />Answers use only Collegeolo’s data (official cutoffs, fees, rankings and notices). Always confirm on the official website before you apply.</p>
        </div>
      )}
    </div>
  );
}
