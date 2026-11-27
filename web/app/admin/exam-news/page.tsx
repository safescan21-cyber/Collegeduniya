'use client';
import { useCallback, useEffect, useState } from 'react';
import { EyeOff, Eye, Loader2, Play, Send, ExternalLink, Globe } from 'lucide-react';
import { api } from '@/lib/api';
import { supabaseBrowser } from '@/lib/supabase/client';
import { timeAgo } from '@/lib/format';

export default function AdminExamNews() {
  const [s, setS] = useState<any>(null); const [rows, setRows] = useState<any[] | null>(null);
  const [exams, setExams] = useState<{ id: string; short_name: string }[]>([]); const [exam, setExam] = useState('');
  const [busy, setBusy] = useState(''); const [msg, setMsg] = useState('');
  const sb = supabaseBrowser();
  const load = useCallback(async () => {
    api<any>('/api/admin/exam-news/status').then(setS).catch((e) => setMsg(e.message));
    let q = sb.from('exam_news').select('id, title, url, source, published_at, official, score, is_hidden, provider, exams(short_name)').order('fetched_at', { ascending: false }).limit(100);
    if (exam) q = q.eq('exam_id', exam);
    const { data } = await q; setRows(data || []);
  }, [exam]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);
  useEffect(() => { sb.from('exams').select('id, short_name').eq('is_published', true).order('short_name').then(({ data }: any) => setExams(data || [])); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const run = async (what: 'collect' | 'digest') => {
    setBusy(what); setMsg('');
    try {
      const r = await api<any>(`/api/admin/exam-news/${what}`, { method: 'POST', body: JSON.stringify(exam ? { exam_id: exam } : {}) });
      setMsg(what === 'digest' ? `Emails: ${r.sent} sent to ${r.users} students${r.failed ? `, ${r.failed} failed` : ''}`
        : r.skipped ? 'A collection is already running — wait a few minutes and try again.'
        : r.message || `Checked ${r.exams} exam(s), added ${r.added} headline(s)${r.errors ? `, ${r.errors} error(s)` : ''}`);
      load();
    } catch (e: any) { setMsg(e.message); }
    setBusy('');
  };
  const [pr, setPr] = useState<any>(null);
  const probe = async () => { setBusy('probe'); setPr(null); setPr(await api<any>(`/api/admin/exam-news/probe?exam=${exam}`).catch((e) => ({ error: e.message }))); setBusy(''); };
  const hide = async (r: any) => { await sb.from('exam_news').update({ is_hidden: !r.is_hidden }).eq('id', r.id); load(); };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Exam news</h1>
        <p className="text-sm text-slate-500">Headlines are collected every {s?.every_hours ?? 3} hours from the free GDELT news index{s?.newsdata ? ' and NewsData.io' : ''} and kept only when the exam name and an exam word (result, admit card, answer key…) are in the headline{s?.ai_check ? ', then checked by AI' : ''}. Followers get at most one email a day from {s?.digest_hour_ist ?? 7}:00 India time. Hide anything wrong — it disappears from the site and from emails.</p>
      </div>
      {s && (
        <div className="grid gap-3 sm:grid-cols-4">
          {[['Followers', s.follows], ['Emails on', s.email_on], ['Headlines stored', s.items], ['Email (SMTP)', s.email_ready ? 'ready' : 'not set']].map(([k, v]) => (
            <div key={k} className="card p-4"><p className="text-xs text-slate-500">{k}</p><p className={`text-xl font-bold ${v === 'not set' ? 'text-rose-600' : 'text-slate-900'}`}>{typeof v === 'number' ? v.toLocaleString('en-IN') : v}</p></div>
          ))}
        </div>
      )}
      {s?.last_collect && <p className="text-xs text-slate-500">Last collection {timeAgo(s.last_collect.at)}: {s.last_collect.exams} exams checked, {s.last_collect.added} added{s.last_collect.errors ? `, ${s.last_collect.errors} errors` : ''}.</p>}
      <div className="flex flex-wrap items-center gap-2">
        <select value={exam} onChange={(e) => setExam(e.target.value)} className="input max-w-xs" aria-label="Exam">
          <option value="">All exams</option>{exams.map((x) => <option key={x.id} value={x.id}>{x.short_name}</option>)}
        </select>
        <button onClick={() => run('collect')} disabled={!!busy} className="btn-primary">{busy === 'collect' ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}{exam ? 'Collect for this exam' : 'Collect now'}</button>
        {exam && <button onClick={probe} disabled={!!busy} className="btn-ghost">{busy === 'probe' ? <Loader2 size={16} className="animate-spin" /> : <Globe size={16} />}Test website</button>}
        <button onClick={() => run('digest')} disabled={!!busy} className="btn-ghost">{busy === 'digest' ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}Send due emails now</button>
      </div>
      {msg && <p className="text-sm text-slate-700">{msg}</p>}
      {pr && <div className="card p-4 text-sm">
        {pr.error && !pr.status ? <p className="text-rose-700"><b>{pr.exam || 'Website'}:</b> the server could not open {pr.url || 'it'} — {pr.error}. The site may block servers or be down; news and dates come only from news headlines until it opens.</p>
        : <><p><b>{pr.exam}</b> · <a href={pr.url} target="_blank" rel="noopener noreferrer" className="text-brand-700 underline">{pr.url}</a> · answered <b>{pr.status}</b> in {(pr.ms / 1000).toFixed(1)} s · {pr.links} links · <b>{pr.notices.length}</b> notices found</p>
          {pr.status >= 400 && <p className="mt-1 text-rose-700">The site refused the server (HTTP {pr.status}). Check the website address in Admin → Exams.</p>}
          {pr.read && pr.notices.length === 0 && <p className="mt-1 text-amber-700">The page opened but has no notice links the server can read — it may load them with JavaScript. Try setting the exam’s website to its notices page.</p>}
          <ul className="mt-2 space-y-1">{pr.notices.map((n: any) => <li key={n.url} className="text-xs"><a href={n.url} target="_blank" rel="noopener noreferrer" className="text-slate-800 hover:text-brand-700">{n.title}</a>{n.date && <span className="text-slate-500"> · {n.date}</span>}</li>)}</ul></>}
      </div>}
      <div className="card divide-y divide-slate-100">
        {!rows ? <Loader2 className="m-5 animate-spin text-slate-300" /> : !rows.length ? <p className="p-5 text-sm text-slate-500">No headlines yet.</p> : rows.map((r) => (
          <div key={r.id} className={`flex items-start justify-between gap-3 p-4 ${r.is_hidden ? 'opacity-50' : ''}`}>
            <div className="min-w-0">
              <a href={r.url} target="_blank" rel="noopener noreferrer" className="font-medium text-slate-900 hover:text-brand-700">{r.title} <ExternalLink size={12} className="inline" /></a>
              <p className="text-xs text-slate-500">{r.exams?.short_name} · {r.source} · {timeAgo(r.published_at)} · score {r.score}{r.official ? ' · Official' : ''} · {r.provider}</p>
            </div>
            <button onClick={() => hide(r)} className="btn-ghost shrink-0 px-2 py-1.5" aria-label={r.is_hidden ? 'Show' : 'Hide'}>{r.is_hidden ? <Eye size={14} /> : <EyeOff size={14} />}</button>
          </div>
        ))}
      </div>
    </div>
  );
}
