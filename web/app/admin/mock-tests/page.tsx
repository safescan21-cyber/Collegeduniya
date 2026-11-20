'use client';
import { useCallback, useEffect, useState } from 'react';
import { Bot, Sparkles, Loader2, Plus, Trash2, Save, CheckCircle2, XCircle, Wand2, ShieldAlert, Pencil } from 'lucide-react';
import ModerationList from '@/components/admin/ModerationList';
import MockAutopilot from '@/components/admin/MockAutopilot';
import { api } from '@/lib/api';
import { supabaseBrowser } from '@/lib/supabase/client';
import { timeAgo } from '@/lib/format';

type Section = { name: string; topics: string[]; questions: number; correct: number; wrong: number };
type BP = { exam_slug: string; title: string; duration_min: number; sections: Section[]; instructions: string; pattern_source: string; is_published: boolean; auto_publish_verified: boolean; autopilot?: boolean; pattern_checked?: boolean; ai_drafted?: boolean; note?: string };
type Exam = { slug: string; short_name: string; country: string | null };
const LETTERS = 'ABCDEF';

function useExams() {
  const [exams, setExams] = useState<Exam[]>([]);
  useEffect(() => {
    supabaseBrowser().from('exams').select('slug, short_name, country').eq('is_published', true).order('short_name').limit(500)
      .then(({ data }: { data: Exam[] | null }) => setExams(data || []));
  }, []);
  return exams;
}

function AiStatus() {
  const [s, setS] = useState<any>(null);
  useEffect(() => { api('/api/admin/mock/ai-status').then(setS).catch(() => setS({ ready: false })); }, []);
  if (!s) return null;
  return s.ready
    ? <p className="flex items-center gap-2 text-sm text-emerald-700"><Bot size={16} />AI connected: {s.provider} · {s.model}{s.check_model !== s.model ? ` (checks with ${s.check_model})` : ''}</p>
    : <p className="flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800"><ShieldAlert size={16} />AI is not configured. Set <code>ANTHROPIC_API_KEY</code>, or <code>LLM_PROVIDER=openai</code> + <code>LLM_BASE_URL</code> for a model you host (Ollama / vLLM), in <code>server/.env</code>. You can still add questions by hand.</p>;
}

// ---------------------------------------------------------------- pattern editor
function PatternEditor({ exams, slug, setSlug, onSaved }: { exams: Exam[]; slug: string; setSlug: (s: string) => void; onSaved: (bp: BP | null) => void }) {
  const [bp, setBp] = useState<BP | null>(null);
  const [exists, setExists] = useState(false);
  const [busy, setBusy] = useState(''); const [msg, setMsg] = useState('');
  const blank = (s: string): BP => ({ exam_slug: s, title: `${exams.find((e) => e.slug === s)?.short_name || s} full mock test`, duration_min: 60, instructions: '', pattern_source: '', is_published: false, auto_publish_verified: false,
    sections: [{ name: 'Section 1', topics: [], questions: 20, correct: 1, wrong: 0 }] });
  useEffect(() => {
    if (!slug) { setBp(null); onSaved(null); return; }
    setMsg('');
    api<{ data: BP }>(`/api/admin/mock_blueprints/${slug}`).then((r) => { setBp(r.data); setExists(true); onSaved(r.data); })
      .catch(() => { setBp(blank(slug)); setExists(false); onSaved(null); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);
  const draft = async () => {
    setBusy('draft'); setMsg('');
    try { const r = await api<{ data: BP }>('/api/admin/mock/blueprint-draft', { method: 'POST', body: JSON.stringify({ exam_slug: slug }) });
      setBp((b) => ({ ...(b || blank(slug)), ...r.data, is_published: false, pattern_source: b?.pattern_source || '' })); setMsg('AI draft loaded — check it against the official notice, then save.'); }
    catch (e: any) { setMsg(e.message); }
    setBusy('');
  };
  const save = async () => {
    if (!bp) return;
    setBusy('save'); setMsg('');
    const body = { ...bp, note: undefined, ai_drafted: exists ? bp.ai_drafted : !!bp.note };
    try {
      const r = exists ? await api<{ data: BP }>(`/api/admin/mock_blueprints/${slug}`, { method: 'PATCH', body: JSON.stringify(body) })
        : await api<{ data: BP }>('/api/admin/mock_blueprints', { method: 'POST', body: JSON.stringify(body) });
      setExists(true); onSaved(r.data); setMsg('Saved ✓');
    } catch (e: any) { setMsg(e.message); }
    setBusy('');
  };
  const setSec = (i: number, k: keyof Section, v: any) => setBp((b) => b && ({ ...b, sections: b.sections.map((s, j) => (j === i ? { ...s, [k]: v } : s)) }));
  const total = bp?.sections.reduce((s, x) => s + Number(x.questions || 0), 0) || 0;

  return (
    <section className="card space-y-4 p-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-60 flex-1"><label className="label">Exam</label>
          <select className="input" value={slug} onChange={(e) => setSlug(e.target.value)}><option value="">Choose an exam…</option>
            {exams.map((e) => <option key={e.slug} value={e.slug}>{e.short_name}{e.country && e.country !== 'India' ? ` (${e.country})` : ''}</option>)}</select></div>
        {slug && <button onClick={draft} disabled={!!busy} className="btn-ghost">{busy === 'draft' ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}Draft pattern with AI</button>}
      </div>
      {bp && (
        <>
          {bp.note && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800"><b>Check before publishing:</b> {bp.note}</p>}
          {exists && bp.ai_drafted && !bp.pattern_checked && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">The AI drafted this pattern. Compare sections, question counts, marking and duration with the official notice, then tick <b>Pattern confirmed</b> below.</p>}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2"><label className="label">Test title</label><input className="input" value={bp.title} onChange={(e) => setBp({ ...bp, title: e.target.value })} /></div>
            <div><label className="label">Duration (minutes)</label><input type="number" className="input" value={bp.duration_min} onChange={(e) => setBp({ ...bp, duration_min: Number(e.target.value) })} /></div>
            <div className="sm:col-span-3"><label className="label">Official pattern source (notice / bulletin URL you checked)</label><input className="input" value={bp.pattern_source || ''} onChange={(e) => setBp({ ...bp, pattern_source: e.target.value })} placeholder="https://… information bulletin 2027" /></div>
            <div className="sm:col-span-3"><label className="label">Instructions for candidates</label><textarea rows={3} className="input" value={bp.instructions || ''} onChange={(e) => setBp({ ...bp, instructions: e.target.value })} /></div>
          </div>
          <div>
            <p className="label">Sections ({total} questions)</p>
            <div className="space-y-2">{bp.sections.map((s, i) => (
              <div key={i} className="grid gap-2 rounded-xl border border-slate-100 p-3 sm:grid-cols-[1.2fr_70px_70px_70px_auto]">
                <input className="input" value={s.name} onChange={(e) => setSec(i, 'name', e.target.value)} placeholder="Section name" />
                <input type="number" className="input" title="Questions" value={s.questions} onChange={(e) => setSec(i, 'questions', Number(e.target.value))} />
                <input type="number" className="input" title="Marks if correct" value={s.correct} onChange={(e) => setSec(i, 'correct', Number(e.target.value))} />
                <input type="number" className="input" title="Marks if wrong (0 or negative)" value={s.wrong} onChange={(e) => setSec(i, 'wrong', Number(e.target.value))} />
                <button onClick={() => setBp({ ...bp, sections: bp.sections.filter((_, j) => j !== i) })} className="btn-ghost text-rose-600" aria-label="Remove section"><Trash2 size={15} /></button>
                <input className="input sm:col-span-5" value={s.topics.join(', ')} onChange={(e) => setSec(i, 'topics', e.target.value.split(',').map((t) => t.trim()).filter(Boolean))} placeholder="Topics, comma separated" />
              </div>))}</div>
            <p className="mt-1 text-xs text-slate-400">Columns: name · questions · marks if correct · marks if wrong</p>
            <button onClick={() => setBp({ ...bp, sections: [...bp.sections, { name: '', topics: [], questions: 10, correct: 1, wrong: 0 }] })} className="btn-ghost mt-2 text-sm"><Plus size={15} />Add section</button>
          </div>
          <div className="flex flex-wrap gap-5 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-brand-600" checked={bp.is_published} onChange={(e) => setBp({ ...bp, is_published: e.target.checked })} />Published (students can take it)</label>
            <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-brand-600" checked={bp.auto_publish_verified} onChange={(e) => setBp({ ...bp, auto_publish_verified: e.target.checked })} />Auto-approve AI questions that pass the AI double-check</label>
            <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-emerald-600" checked={bp.autopilot !== false} onChange={(e) => setBp({ ...bp, autopilot: e.target.checked })} />Managed by autopilot</label>
            <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-emerald-600" checked={!!bp.pattern_checked} onChange={(e) => setBp({ ...bp, pattern_checked: e.target.checked })} />Pattern confirmed against the official notice</label>
          </div>
          <div className="flex items-center gap-3"><button onClick={save} disabled={!!busy} className="btn-primary">{busy === 'save' ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}Save pattern</button>{msg && <span className="text-sm text-slate-600">{msg}</span>}</div>
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- generator
function Generator({ slug, bp, onDone }: { slug: string; bp: BP | null; onDone: () => void }) {
  const [section, setSection] = useState(''); const [topic, setTopic] = useState(''); const [difficulty, setDifficulty] = useState('mixed'); const [count, setCount] = useState(10);
  const [perTopic, setPerTopic] = useState(3);
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState(''); const [job, setJob] = useState<any>(null);
  useEffect(() => { setSection(bp?.sections[0]?.name || ''); setTopic(''); }, [bp]);
  useEffect(() => {
    if (!job || job.status !== 'running') return;
    const t = setInterval(() => api(`/api/admin/mock/jobs/${job.id}`).then((j) => { setJob(j); if (j.status !== 'running') onDone(); }).catch(() => undefined), 4000);
    return () => clearInterval(t);
  }, [job, onDone]);
  if (!slug || !bp) return <section className="card p-5 text-sm text-slate-500">Save a pattern for this exam first, then generate questions.</section>;
  const sec = bp.sections.find((s) => s.name === section);
  const gen = async () => {
    setBusy(true); setMsg('');
    try {
      const r = await api('/api/admin/mock/generate', { method: 'POST', body: JSON.stringify({ exam_slug: slug, section, topic: topic || null, difficulty, count }) });
      setMsg(`Created ${r.created} questions · AI double-check agreed on ${r.agree}${r.disagree ? `, disagreed on ${r.disagree} (fix or reject those)` : ''}${r.approved ? ` · ${r.approved} auto-approved` : ''}.`);
      onDone();
    } catch (e: any) { setMsg(e.message); }
    setBusy(false);
  };
  const bank = async () => {
    const n = bp.sections.reduce((s, x) => s + Math.max(1, x.topics.length), 0);
    if (!confirm(`Generate about ${n * perTopic} questions (${perTopic} per topic, ${n} topics)? This runs in the background and uses AI credits.`)) return;
    try { setJob(await api('/api/admin/mock/generate-bank', { method: 'POST', body: JSON.stringify({ exam_slug: slug, per_topic: perTopic }) })); } catch (e: any) { setMsg(e.message); }
  };
  return (
    <section className="card space-y-4 p-5">
      <p className="flex items-center gap-2 font-bold text-slate-900"><Sparkles size={17} className="text-brand-600" />Generate questions with AI</p>
      <div className="grid gap-3 sm:grid-cols-4">
        <div><label className="label">Section</label><select className="input" value={section} onChange={(e) => { setSection(e.target.value); setTopic(''); }}>{bp.sections.map((s) => <option key={s.name}>{s.name}</option>)}</select></div>
        <div><label className="label">Topic</label><select className="input" value={topic} onChange={(e) => setTopic(e.target.value)}><option value="">Mix of all topics</option>{(sec?.topics || []).map((t) => <option key={t}>{t}</option>)}</select></div>
        <div><label className="label">Difficulty</label><select className="input" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>{['mixed', 'easy', 'medium', 'hard'].map((d) => <option key={d}>{d}</option>)}</select></div>
        <div><label className="label">How many (max 20)</label><input type="number" min={1} max={20} className="input" value={count} onChange={(e) => setCount(Math.max(1, Math.min(20, Number(e.target.value))))} /></div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={gen} disabled={busy} className="btn-primary">{busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}{busy ? 'Writing & double-checking…' : 'Generate'}</button>
        <span className="text-slate-300">|</span>
        <label className="flex items-center gap-2 text-sm">Whole exam: <input type="number" min={1} max={10} className="input w-16 py-1.5" value={perTopic} onChange={(e) => setPerTopic(Number(e.target.value))} /> per topic</label>
        <button onClick={bank} disabled={job?.status === 'running'} className="btn-ghost"><Bot size={16} />Fill question bank</button>
      </div>
      {msg && <p className="text-sm text-slate-700">{msg}</p>}
      {job && (
        <div className="rounded-xl bg-slate-50 p-3 text-sm">
          <p>{job.status === 'running' ? <Loader2 size={14} className="me-1 inline animate-spin" /> : null}Bank job: <b>{job.status}</b> — {job.done}/{job.total} topics · {job.created} questions · {job.agree} passed the AI check</p>
          {job.total > 0 && <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-brand-600" style={{ width: `${(100 * job.done) / job.total}%` }} /></div>}
          {job.errors?.length > 0 && <p className="mt-1 text-xs text-rose-600">{job.errors.slice(0, 3).join(' · ')}</p>}
        </div>
      )}
      <p className="text-xs text-slate-400">Each question is written by the AI, then answered again by a separate AI pass without seeing the key. “Disagree” usually means the question is ambiguous or the key is wrong. Generated questions are original and not taken from past papers.</p>
    </section>
  );
}

// ---------------------------------------------------------------- review queue
function Review({ slug, refresh }: { slug: string; refresh: number }) {
  const [rows, setRows] = useState<any[]>([]); const [count, setCount] = useState(0);
  const [status, setStatus] = useState('draft'); const [check, setCheck] = useState('');
  const [page, setPage] = useState(1); const [edit, setEdit] = useState<any | null>(null); const [err, setErr] = useState('');
  const load = useCallback(async () => {
    const p = new URLSearchParams({ page: String(page), limit: '20' });
    if (slug) p.set('exam_slug', slug); if (status) p.set('status', status); if (check) p.set('ai_check', check);
    const r = await api(`/api/admin/mock_questions?${p}`).catch(() => ({ data: [], count: 0 }));
    setRows(r.data); setCount(r.count);
  }, [slug, status, check, page]);
  useEffect(() => { load(); }, [load, refresh]);
  const set = async (ids: string[], st: string) => { await api('/api/admin/mock/bulk-questions', { method: 'POST', body: JSON.stringify({ ids, status: st }) }); load(); };
  const saveEdit = async () => {
    setErr('');
    try {
      const body = { exam_slug: edit.exam_slug, section: edit.section, topic: edit.topic, difficulty: edit.difficulty, stem: edit.stem, options: edit.options, answer: Number(edit.answer), explanation: edit.explanation, status: edit.status, source: edit.id ? undefined : 'manual' };
      if (edit.id) await api(`/api/admin/mock_questions/${edit.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      else await api('/api/admin/mock_questions', { method: 'POST', body: JSON.stringify(body) });
      setEdit(null); load();
    } catch (e: any) { setErr(e.message); }
  };
  const agreed = rows.filter((r) => r.ai_check === 'agree' && r.status === 'draft').map((r) => r.id);
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {[['draft', 'To review'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['', 'All']].map(([v, l]) => (
          <button key={v} onClick={() => { setStatus(v); setPage(1); }} className={`${status === v ? 'btn-primary' : 'btn-ghost'} py-1.5 text-sm`}>{l}</button>))}
        <select className="input w-auto py-1.5 text-sm" value={check} onChange={(e) => { setCheck(e.target.value); setPage(1); }}>
          <option value="">Any AI check</option><option value="agree">AI check agreed</option><option value="disagree">AI check disagreed</option><option value="unchecked">Unchecked</option></select>
        <span className="text-sm text-slate-500">{count} questions</span>
        <div className="ms-auto flex gap-2">
          {agreed.length > 0 && <button onClick={() => set(agreed, 'approved')} className="btn-ghost py-1.5 text-sm text-emerald-700"><CheckCircle2 size={15} />Approve {agreed.length} AI-checked on this page</button>}
          {slug && <button onClick={() => setEdit({ exam_slug: slug, section: '', topic: '', difficulty: 'medium', stem: '', options: ['', '', '', ''], answer: 0, explanation: '', status: 'approved' })} className="btn-primary py-1.5 text-sm"><Plus size={15} />Add manually</button>}
        </div>
      </div>
      {rows.map((q) => (
        <div key={q.id} className="card p-4">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="chip">{q.exam_slug}</span><span className="chip-brand">{q.section}</span>{q.topic && <span className="chip">{q.topic}</span>}<span className="chip">{q.difficulty}</span>
            <span className={q.ai_check === 'agree' ? 'chip-green' : q.ai_check === 'disagree' ? 'chip-red' : 'chip'}>AI check: {q.ai_check}</span>
            {q.reports > 0 && <span className="chip-red">{q.reports} reports</span>}
            <span className="ms-auto text-slate-400">{q.source === 'manual' ? 'manual' : q.model} · {timeAgo(q.created_at)}</span>
          </div>
          <p className="mt-2 whitespace-pre-line text-slate-900">{q.stem}</p>
          <ul className="mt-2 grid gap-1 sm:grid-cols-2">{q.options.map((o: string, i: number) => (
            <li key={i} className={`rounded-lg px-2.5 py-1.5 text-sm ${i === q.answer ? 'bg-emerald-50 font-medium text-emerald-900' : 'text-slate-700'}`}><b>{LETTERS[i]}.</b> {o}</li>))}</ul>
          {q.explanation && <p className="mt-2 text-xs text-slate-500"><b>Why:</b> {q.explanation}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {q.status !== 'approved' && <button onClick={() => set([q.id], 'approved')} className="btn-ghost py-1.5 text-sm text-emerald-700"><CheckCircle2 size={15} />Approve</button>}
            {q.status !== 'rejected' && <button onClick={() => set([q.id], 'rejected')} className="btn-ghost py-1.5 text-sm text-rose-600"><XCircle size={15} />Reject</button>}
            <button onClick={() => setEdit({ ...q })} className="btn-ghost py-1.5 text-sm"><Pencil size={15} />Edit</button>
            <span className={`ms-auto self-center ${q.status === 'approved' ? 'chip-green' : q.status === 'rejected' ? 'chip-red' : 'chip-amber'}`}>{q.status}</span>
          </div>
        </div>
      ))}
      {!rows.length && <div className="card p-8 text-center text-sm text-slate-500">Nothing here.</div>}
      {count > 20 && <div className="flex justify-center gap-2"><button disabled={page === 1} onClick={() => setPage(page - 1)} className="btn-ghost">Previous</button><span className="self-center text-sm">Page {page} of {Math.ceil(count / 20)}</span><button disabled={page * 20 >= count} onClick={() => setPage(page + 1)} className="btn-ghost">Next</button></div>}

      {edit && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50" onClick={() => setEdit(null)}>
          <div className="h-full w-full max-w-xl overflow-y-auto bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold">{edit.id ? 'Edit question' : 'Add question'}</h3>
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div><label className="label">Section</label><input className="input" value={edit.section} onChange={(e) => setEdit({ ...edit, section: e.target.value })} /></div>
                <div><label className="label">Topic</label><input className="input" value={edit.topic || ''} onChange={(e) => setEdit({ ...edit, topic: e.target.value })} /></div>
                <div><label className="label">Difficulty</label><select className="input" value={edit.difficulty} onChange={(e) => setEdit({ ...edit, difficulty: e.target.value })}>{['easy', 'medium', 'hard'].map((d) => <option key={d}>{d}</option>)}</select></div>
              </div>
              <div><label className="label">Question</label><textarea rows={4} className="input" value={edit.stem} onChange={(e) => setEdit({ ...edit, stem: e.target.value })} /></div>
              {edit.options.map((o: string, i: number) => (
                <div key={i} className="flex items-center gap-2">
                  <input type="radio" name="ans" className="h-4 w-4 accent-emerald-600" checked={Number(edit.answer) === i} onChange={() => setEdit({ ...edit, answer: i })} aria-label={`Option ${LETTERS[i]} is correct`} />
                  <input className="input" value={o} onChange={(e) => setEdit({ ...edit, options: edit.options.map((x: string, j: number) => (j === i ? e.target.value : x)) })} placeholder={`Option ${LETTERS[i]}`} />
                </div>))}
              <p className="text-xs text-slate-400">Select the radio button next to the correct option.</p>
              <div><label className="label">Explanation</label><textarea rows={3} className="input" value={edit.explanation || ''} onChange={(e) => setEdit({ ...edit, explanation: e.target.value })} /></div>
              <div><label className="label">Status</label><select className="input" value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}>{['draft', 'approved', 'rejected'].map((d) => <option key={d}>{d}</option>)}</select></div>
              {err && <p className="text-sm text-rose-600">{err}</p>}
              <div className="flex gap-2"><button onClick={saveEdit} className="btn-primary"><Save size={16} />Save</button><button onClick={() => setEdit(null)} className="btn-ghost">Cancel</button></div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default function AdminMockTests() {
  const exams = useExams();
  const [slug, setSlug] = useState('');
  const [bp, setBp] = useState<BP | null>(null);
  const [tab, setTab] = useState<'autopilot' | 'build' | 'review' | 'reports'>('autopilot');
  const [refresh, setRefresh] = useState(0);
  const bump = useCallback(() => setRefresh((n) => n + 1), []);
  return (
    <div className="space-y-5">
      <div className="card space-y-2 p-5">
        <h1 className="text-xl font-extrabold text-slate-900">Mock tests</h1>
        <p className="text-sm text-slate-600"><b>Autopilot</b> lets the AI do everything below on its own — you only spot-check. Manual steps: 1) Pick an exam and save its pattern (draft it with AI, then check it against the official notice). 2) Generate questions. 3) Review and approve them. 4) Tick “Published”. Students only ever see approved questions.</p>
        <AiStatus />
      </div>
      <div className="flex gap-2">{([['autopilot', 'Autopilot'], ['build', 'Pattern & generate'], ['review', 'Review questions'], ['reports', 'Student reports']] as const).map(([k, l]) => (
        <button key={k} onClick={() => setTab(k)} className={`${tab === k ? 'btn-primary' : 'btn-ghost'} py-1.5`}>{l}</button>))}</div>
      {tab === 'autopilot' && <MockAutopilot onPickExam={(x) => { setSlug(x); setTab('build'); }} />}
      {tab === 'build' && <><PatternEditor exams={exams} slug={slug} setSlug={setSlug} onSaved={setBp} /><Generator slug={slug} bp={bp} onDone={bump} /></>}
      {tab === 'review' && (
        <>
          <select className="input max-w-xs" value={slug} onChange={(e) => setSlug(e.target.value)}><option value="">All exams</option>{exams.map((e) => <option key={e.slug} value={e.slug}>{e.short_name}</option>)}</select>
          <Review slug={slug} refresh={refresh} />
        </>
      )}
      {tab === 'reports' && (
        <ModerationList resource="mock_question_reports" title="Reported questions" statusField="status" statusOptions={['open', 'fixed', 'dismissed']} canDelete={false}
          tabs={[{ label: 'Open', params: { status: 'open' } }, { label: 'All', params: {} }]}
          columns={[
            { key: 'q', label: 'Question', render: (r) => <div className="max-w-md"><p className="text-xs text-slate-400">{r.mock_questions?.exam_slug} · {r.mock_questions?.section} · {r.mock_questions?.status}</p><p className="line-clamp-3 text-sm">{r.mock_questions?.stem}</p></div> },
            { key: 'reason', label: 'Problem', render: (r) => <p className="max-w-xs text-sm">{r.reason}</p> },
            { key: 'by', label: 'By', render: (r) => <span className="text-xs">{r.profiles?.full_name}<br />{timeAgo(r.created_at)}</span> },
          ]} />
      )}
    </div>
  );
}
