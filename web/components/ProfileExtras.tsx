'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { GraduationCap, Plus, Pencil, Trash2, Save, Globe, Lock, ExternalLink, LogIn, ClipboardCheck, Loader2 } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { supabaseBrowser } from '@/lib/supabase/client';
import { timeAgo } from '@/lib/format';

export const LEVELS = ['Class 10', 'Class 12', 'Diploma', 'UG', 'PG', 'PhD', 'Certificate', 'Other'] as const;
type Edu = { id?: string; level: string; institute: string; board: string | null; course: string | null; start_year: number | null; end_year: number | null; is_current: boolean; score: string | null; city: string | null };
const empty: Edu = { level: 'UG', institute: '', board: '', course: '', start_year: null, end_year: null, is_current: false, score: '', city: '' };
const slugUser = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '').slice(0, 22);

// ---------------------------------------------------------------- public profile + privacy
export function PublicProfileSettings() {
  const { user, profile, refreshProfile } = useAuth();
  const sb = supabaseBrowser();
  const [f, setF] = useState({ username: '', headline: '', bio: '', public_profile: true, show_mock_scores: false, show_online: false });
  const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!profile) return;
    const p = profile as any;
    setF({ username: p.username || '', headline: p.headline || '', bio: p.bio || '', public_profile: p.public_profile !== false, show_mock_scores: !!p.show_mock_scores, show_online: !!p.show_online });
  }, [profile]);
  if (!user) return null;
  const save = async () => {
    setMsg(''); setBusy(true);
    let username = f.username.trim().toLowerCase();
    if (!username) username = `${slugUser(profile?.full_name || 'student') || 'student'}.${Math.random().toString(36).slice(2, 6)}`;
    if (!/^[a-z0-9_.]{3,30}$/.test(username)) { setBusy(false); return setMsg('Username: 3–30 characters, lowercase letters, numbers, dot or underscore.'); }
    const { error } = await sb.from('profiles').update({ ...f, username, headline: f.headline.trim() || null, bio: f.bio.trim() || null }).eq('id', user.id);
    setBusy(false);
    if (error) return setMsg(/duplicate|unique/i.test(error.message) ? 'That username is taken — try another.' : error.message);
    setF((x) => ({ ...x, username })); setMsg('Saved ✓'); refreshProfile();
  };
  const url = f.username ? `/u/${f.username}` : null;
  return (
    <section className="card space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-bold text-slate-900">{f.public_profile ? <Globe size={17} className="text-brand-600" /> : <Lock size={17} className="text-slate-500" />}Public profile</p>
        {url && f.public_profile && (profile as any)?.username && <Link href={url} target="_blank" className="flex items-center gap-1 text-sm text-brand-700 underline">View my public profile<ExternalLink size={13} /></Link>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="label">Username</label><div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 ps-3 text-sm text-slate-400">collegeolo.com/u/<input className="input border-0 bg-white" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, '') })} placeholder="auto" /></div></div>
        <div><label className="label">Headline</label><input className="input" maxLength={120} value={f.headline} onChange={(e) => setF({ ...f, headline: e.target.value })} placeholder="B.Tech CSE, 2nd year · NEET 2027 aspirant" /></div>
        <div className="sm:col-span-2"><label className="label">About me</label><textarea rows={3} maxLength={1000} className="input" value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} placeholder="What you study, what you’re preparing for, your interests…" /></div>
      </div>
      <div className="space-y-2 text-sm">
        <label className="flex items-start gap-2"><input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand-600" checked={f.public_profile} onChange={(e) => setF({ ...f, public_profile: e.target.checked })} /><span><b>Anyone can see my profile</b> — name, headline, about, city and education. Your email and phone are never shown.</span></label>
        <label className="flex items-start gap-2"><input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand-600" checked={f.show_mock_scores} onChange={(e) => setF({ ...f, show_mock_scores: e.target.checked })} /><span>Show my best mock-test scores on my profile</span></label>
        <label className="flex items-start gap-2"><input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand-600" checked={f.show_online} onChange={(e) => setF({ ...f, show_online: e.target.checked })} /><span>Show my first name and city in “is online” alerts (otherwise you appear as “A student”)</span></label>
      </div>
      <div className="flex items-center gap-3"><button onClick={save} disabled={busy} className="btn-primary">{busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}Save</button>{msg && <span className="text-sm text-slate-600">{msg}</span>}</div>
    </section>
  );
}

// ---------------------------------------------------------------- education
export function EducationEditor() {
  const { user } = useAuth();
  const sb = supabaseBrowser();
  const [rows, setRows] = useState<Edu[]>([]); const [edit, setEdit] = useState<Edu | null>(null); const [err, setErr] = useState('');
  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await sb.from('student_education').select('*').eq('user_id', user.id).order('is_current', { ascending: false }).order('end_year', { ascending: false, nullsFirst: true });
    setRows((data || []) as Edu[]);
  }, [user, sb]);
  useEffect(() => { load(); }, [load]);
  if (!user) return null;
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setErr('');
    if (!edit) return;
    if (edit.institute.trim().length < 2) return setErr('Enter the school / college name.');
    if (edit.start_year && edit.end_year && edit.end_year < edit.start_year) return setErr('End year is before start year.');
    const row = { level: edit.level, institute: edit.institute.trim(), board: edit.board?.trim() || null, course: edit.course?.trim() || null, start_year: edit.start_year || null,
      end_year: edit.is_current ? null : edit.end_year || null, is_current: edit.is_current, score: edit.score?.trim() || null, city: edit.city?.trim() || null };
    const { error } = edit.id ? await sb.from('student_education').update(row).eq('id', edit.id) : await sb.from('student_education').insert({ ...row, user_id: user.id });
    if (error) return setErr(error.message);
    setEdit(null); load();
  };
  const del = async (id: string) => { if (confirm('Remove this entry?')) { await sb.from('student_education').delete().eq('id', id); load(); } };
  const yr = (v: string) => (v ? Math.max(1950, Math.min(2100, parseInt(v, 10) || 0)) || null : null);
  return (
    <section className="card space-y-4 p-6">
      <div className="flex items-center justify-between"><p className="flex items-center gap-2 font-bold text-slate-900"><GraduationCap size={17} className="text-brand-600" />Education</p>
        {!edit && <button onClick={() => setEdit({ ...empty })} className="btn-ghost text-sm"><Plus size={15} />Add</button>}</div>
      {edit && (
        <form onSubmit={save} className="grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
          <div><label className="label">Level</label><select className="input" value={edit.level} onChange={(e) => setEdit({ ...edit, level: e.target.value })}>{LEVELS.map((l) => <option key={l}>{l}</option>)}</select></div>
          <div><label className="label">School / college *</label><input className="input" value={edit.institute} onChange={(e) => setEdit({ ...edit, institute: e.target.value })} placeholder="e.g. Delhi Public School, IIT Delhi" /></div>
          <div><label className="label">{['Class 10', 'Class 12'].includes(edit.level) ? 'Board' : 'University'}</label><input className="input" value={edit.board || ''} onChange={(e) => setEdit({ ...edit, board: e.target.value })} placeholder={['Class 10', 'Class 12'].includes(edit.level) ? 'CBSE / ICSE / State board' : 'University'} /></div>
          <div><label className="label">{['Class 10', 'Class 12'].includes(edit.level) ? 'Stream / subjects' : 'Course'}</label><input className="input" value={edit.course || ''} onChange={(e) => setEdit({ ...edit, course: e.target.value })} placeholder={edit.level === 'Class 12' ? 'PCM / PCB / Commerce / Arts' : 'B.Tech Computer Science'} /></div>
          <div className="grid grid-cols-2 gap-2"><div><label className="label">From</label><input className="input" inputMode="numeric" value={edit.start_year || ''} onChange={(e) => setEdit({ ...edit, start_year: yr(e.target.value) })} placeholder="2023" /></div>
            <div><label className="label">To</label><input className="input" inputMode="numeric" disabled={edit.is_current} value={edit.is_current ? '' : edit.end_year || ''} onChange={(e) => setEdit({ ...edit, end_year: yr(e.target.value) })} placeholder={edit.is_current ? 'Present' : '2027'} /></div></div>
          <div className="grid grid-cols-2 gap-2"><div><label className="label">Marks / CGPA</label><input className="input" maxLength={40} value={edit.score || ''} onChange={(e) => setEdit({ ...edit, score: e.target.value })} placeholder="92% / 8.6 CGPA" /></div>
            <div><label className="label">City</label><input className="input" value={edit.city || ''} onChange={(e) => setEdit({ ...edit, city: e.target.value })} /></div></div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" className="h-4 w-4 accent-brand-600" checked={edit.is_current} onChange={(e) => setEdit({ ...edit, is_current: e.target.checked })} />I study here now</label>
          {err && <p className="text-sm text-rose-600 sm:col-span-2">{err}</p>}
          <div className="flex gap-2 sm:col-span-2"><button className="btn-primary"><Save size={16} />Save</button><button type="button" onClick={() => setEdit(null)} className="btn-ghost">Cancel</button></div>
        </form>
      )}
      {rows.length ? <ol className="relative space-y-4 border-s-2 border-slate-100 ps-5">{rows.map((r) => (
        <li key={r.id} className="relative">
          <span className="absolute -start-[27px] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-brand-600" />
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div><p className="font-semibold text-slate-900">{r.institute}</p>
              <p className="text-sm text-slate-600">{[r.level, r.course, r.board].filter(Boolean).join(' · ')}</p>
              <p className="text-xs text-slate-500">{[r.start_year, r.is_current ? 'Present' : r.end_year].filter(Boolean).join(' – ')}{r.score ? ` · ${r.score}` : ''}{r.city ? ` · ${r.city}` : ''}</p></div>
            <div className="flex gap-1"><button onClick={() => setEdit({ ...r })} className="btn-ghost px-2 py-1" aria-label="Edit"><Pencil size={14} /></button><button onClick={() => del(r.id!)} className="btn-ghost px-2 py-1 text-rose-600" aria-label="Remove"><Trash2 size={14} /></button></div>
          </div>
        </li>))}</ol> : !edit && <p className="text-sm text-slate-500">Add your school and college — it appears on your public profile.</p>}
    </section>
  );
}

// ---------------------------------------------------------------- login history
export function LoginHistory() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    if (!user) return;
    supabaseBrowser().from('login_events').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10).then(({ data }: { data: any[] | null }) => setRows(data || []));
  }, [user]);
  return (
    <section className="card p-6">
      <p className="flex items-center gap-2 font-bold text-slate-900"><LogIn size={17} className="text-brand-600" />Recent logins</p>
      {rows.length ? <ul className="mt-3 divide-y divide-slate-100 text-sm">{rows.map((r) => (
        <li key={r.id} className="flex justify-between gap-3 py-2"><span>{r.device}{r.city ? ` · ${r.city}` : ''}{r.country ? `, ${r.country}` : ''} <span className="text-xs text-slate-400">via {r.method}</span></span><span className="shrink-0 text-xs text-slate-500">{new Date(r.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span></li>))}</ul>
        : <p className="mt-2 text-sm text-slate-500">Your logins will be listed here.</p>}
      <p className="mt-2 text-xs text-slate-400">Don’t recognise a login? Log out everywhere by changing your email, and contact support.</p>
    </section>
  );
}

// ---------------------------------------------------------------- mock-test history (dashboard tab)
export function MockHistory() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[] | null>(null);
  useEffect(() => {
    if (!user) return;
    supabaseBrowser().from('mock_attempts').select('id, exam_slug, title, status, score, max_score, correct, wrong, unanswered, percentile, started_at, deadline, duration_min, submitted_at')
      .eq('user_id', user.id).order('started_at', { ascending: false }).limit(100).then(({ data }: { data: any[] | null }) => setRows(data || []));
  }, [user]);
  if (!rows) return <div className="card h-40 animate-pulse" />;
  if (!rows.length) return <div className="card p-10 text-center text-slate-500">No mock tests yet. <Link href="/mock-tests" className="font-semibold text-brand-700">Take a free mock test →</Link></div>;
  const done = rows.filter((r) => r.status === 'submitted');
  const byExam = new Map<string, any[]>(); done.forEach((r) => byExam.set(r.title, [...(byExam.get(r.title) || []), r]));
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card p-4"><p className="text-xs text-slate-500">Tests taken</p><p className="text-2xl font-extrabold">{done.length}</p></div>
        <div className="card p-4"><p className="text-xs text-slate-500">Exams practised</p><p className="text-2xl font-extrabold">{byExam.size}</p></div>
        <div className="card p-4"><p className="text-xs text-slate-500">Best percentile</p><p className="text-2xl font-extrabold">{done.length ? Math.max(...done.map((r) => Number(r.percentile) || 0)) : '—'}</p></div>
      </div>
      {Array.from(byExam.entries()).map(([title, list]) => list.length > 1 && (
        <div key={title} className="card p-4 text-sm">
          <p className="font-semibold">{title} — progress</p>
          <div className="mt-2 flex h-16 items-end gap-1.5">{list.slice().reverse().map((r) => {
            const p = r.max_score > 0 ? Math.max(4, (100 * Math.max(0, Number(r.score))) / Number(r.max_score)) : 4;
            return <div key={r.id} title={`${Number(r.score)}/${Number(r.max_score)} · ${new Date(r.started_at).toLocaleDateString()}`} className="w-6 rounded-t bg-brand-500" style={{ height: `${p}%` }} />;
          })}</div>
        </div>))}
      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-2">Test</th><th className="px-4 py-2">Date</th><th className="px-4 py-2">Score</th><th className="px-4 py-2">✓ / ✗ / –</th><th className="px-4 py-2">Percentile</th><th /></tr></thead>
          <tbody>{rows.map((r) => {
            const live = r.status === 'in_progress' && new Date(r.deadline) > new Date();
            return (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="px-4 py-2 font-medium">{r.title}</td><td className="px-4 py-2 text-xs text-slate-500">{timeAgo(r.started_at)}</td>
                <td className="px-4 py-2">{r.score != null ? <b>{Number(r.score)}/{Number(r.max_score)}</b> : '—'}</td>
                <td className="px-4 py-2 text-xs">{r.score != null ? `${r.correct} / ${r.wrong} / ${r.unanswered}` : '—'}</td>
                <td className="px-4 py-2">{r.percentile != null ? Number(r.percentile) : '—'}</td>
                <td className="px-4 py-2 text-right">{live ? <Link href={`/mock-tests/attempt/${r.id}`} className="btn-primary py-1 text-xs">Resume</Link>
                  : <Link href={`/mock-tests/result/${r.id}`} className="btn-ghost py-1 text-xs"><ClipboardCheck size={13} />Solutions</Link>}</td>
              </tr>);
          })}</tbody>
        </table>
      </div>
    </div>
  );
}
