'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FileText, Plus, Trash2, Printer, Save, Loader2, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { supabaseBrowser } from '@/lib/supabase/client';
import ResumePreview, { type Resume } from '@/components/ResumePreview';

const blank: Resume = {
  full_name: '', headline: '', email: '', phone: '', city: '', summary: '',
  education: [{ degree: '', institute: '', year: '', score: '' }], experience: [], projects: [], skills: [], languages: [], links: {},
};
const DRAFT = 'ses-resume-draft';

export default function ResumeBuilder() {
  const { user, profile, loading } = useAuth();
  const supabase = supabaseBrowser();
  const [r, setR] = useState<Resume>(blank);
  const [skills, setSkills] = useState('');
  const [langs, setLangs] = useState('');
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'err'>('idle');
  const [err, setErr] = useState('');

  useEffect(() => {
    if (loading) return;
    const apply = (x: Partial<Resume>) => {
      const m = { ...blank, ...x, links: { ...(x.links || {}) } } as Resume;
      setR(m); setSkills((m.skills || []).join(', ')); setLangs((m.languages || []).join(', '));
    };
    if (user) {
      supabase.from('student_resumes').select('*').eq('user_id', user.id).maybeSingle().then(({ data }: { data: any }) => {
        if (data) return apply(data);
        apply({ full_name: profile?.full_name || '', email: user.email || '', phone: profile?.phone || '', city: profile?.city || '' });
      });
    } else {
      try { const d = localStorage.getItem(DRAFT); if (d) apply(JSON.parse(d)); } catch { /* storage unavailable */ }
    }
  }, [user, profile, loading, supabase]);

  const final = (): Resume => ({ ...r, skills: skills.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 30), languages: langs.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 10) });
  useEffect(() => { if (!user) { try { localStorage.setItem(DRAFT, JSON.stringify(final())); } catch { /* ignore */ } } });

  const save = async () => {
    if (!user) return;
    setState('saving'); setErr('');
    const f = final();
    const { error } = await supabase.from('student_resumes').upsert({
      user_id: user.id, ...f,
      education: f.education.filter((e) => e.degree || e.institute), experience: f.experience.filter((e) => e.role || e.org), projects: f.projects.filter((p) => p.title),
    });
    if (error) { setErr(error.message); setState('err'); } else setState('saved');
  };

  const set = <K extends keyof Resume>(k: K, v: Resume[K]) => { setR((x) => ({ ...x, [k]: v })); setState('idle'); };
  const setItem = <K extends 'education' | 'experience' | 'projects'>(k: K, i: number, field: string, v: string) =>
    set(k, (r[k] as any[]).map((it, j) => (j === i ? { ...it, [field]: v } : it)) as Resume[K]);
  const add = (k: 'education' | 'experience' | 'projects') => set(k, [...(r[k] as any[]),
    k === 'education' ? { degree: '', institute: '', year: '', score: '' } : k === 'experience' ? { role: '', org: '', from: '', to: '', details: '' } : { title: '', link: '', details: '' }] as any);
  const del = (k: 'education' | 'experience' | 'projects', i: number) => set(k, (r[k] as any[]).filter((_, j) => j !== i) as any);
  const f = final();

  return (
    <div className="container-x py-10">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-extrabold tracking-tight text-slate-900"><FileText className="text-brand-600" />Resume builder</h1>
          <p className="mt-1 text-slate-500">Fill in the left side — the preview updates live. Save it to attach to job applications in one click.</p>
        </div>
        <div className="flex gap-2">
          {user ? <button onClick={save} disabled={state === 'saving'} className="btn-primary">{state === 'saving' ? <Loader2 size={16} className="animate-spin" /> : state === 'saved' ? <CheckCircle2 size={16} /> : <Save size={16} />}{state === 'saved' ? 'Saved' : 'Save'}</button>
            : <Link href="/login?next=/resume" className="btn-primary">Log in to save</Link>}
          <button onClick={() => window.print()} className="btn-ghost"><Printer size={16} />Download PDF</button>
        </div>
      </div>
      {err && <p className="no-print mt-3 text-sm text-rose-600">{err}</p>}
      <p className="no-print mt-2 text-xs text-slate-400">“Download PDF” opens the print window — choose “Save as PDF”.</p>

      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        <div className="no-print space-y-5">
          <section className="card grid gap-3 p-5 sm:grid-cols-2">
            <div><label className="label">Full name</label><input className="input" value={r.full_name} onChange={(e) => set('full_name', e.target.value)} /></div>
            <div><label className="label">Headline</label><input className="input" value={r.headline} onChange={(e) => set('headline', e.target.value)} placeholder="B.Tech CSE student · web developer" /></div>
            <div><label className="label">Email</label><input className="input" value={r.email} onChange={(e) => set('email', e.target.value)} /></div>
            <div><label className="label">Phone</label><input className="input" value={r.phone} onChange={(e) => set('phone', e.target.value)} /></div>
            <div><label className="label">City</label><input className="input" value={r.city} onChange={(e) => set('city', e.target.value)} /></div>
            <div><label className="label">LinkedIn / GitHub / portfolio</label><input className="input" value={r.links.linkedin || ''} onChange={(e) => set('links', { ...r.links, linkedin: e.target.value })} placeholder="linkedin.com/in/you" /></div>
            <div className="sm:col-span-2"><label className="label">Summary (2–3 lines)</label><textarea rows={3} maxLength={600} className="input" value={r.summary} onChange={(e) => set('summary', e.target.value)} /></div>
          </section>

          <Section title="Education" onAdd={() => add('education')}>
            {r.education.map((e, i) => (
              <Row key={i} onDelete={() => del('education', i)}>
                <input className="input" placeholder="Degree / class (B.Tech CSE, Class 12)" value={e.degree} onChange={(x) => setItem('education', i, 'degree', x.target.value)} />
                <input className="input" placeholder="College / school" value={e.institute} onChange={(x) => setItem('education', i, 'institute', x.target.value)} />
                <input className="input" placeholder="Year (2022–2026)" value={e.year} onChange={(x) => setItem('education', i, 'year', x.target.value)} />
                <input className="input" placeholder="CGPA / %" value={e.score} onChange={(x) => setItem('education', i, 'score', x.target.value)} />
              </Row>))}
          </Section>

          <Section title="Experience & internships" onAdd={() => add('experience')}>
            {r.experience.map((e, i) => (
              <Row key={i} onDelete={() => del('experience', i)}>
                <input className="input" placeholder="Role" value={e.role} onChange={(x) => setItem('experience', i, 'role', x.target.value)} />
                <input className="input" placeholder="Company / organisation" value={e.org} onChange={(x) => setItem('experience', i, 'org', x.target.value)} />
                <input className="input" placeholder="From (Jun 2025)" value={e.from} onChange={(x) => setItem('experience', i, 'from', x.target.value)} />
                <input className="input" placeholder="To (Aug 2025 / Present)" value={e.to} onChange={(x) => setItem('experience', i, 'to', x.target.value)} />
                <textarea rows={2} className="input sm:col-span-2" placeholder="What you did — one point per line" value={e.details} onChange={(x) => setItem('experience', i, 'details', x.target.value)} />
              </Row>))}
          </Section>

          <Section title="Projects" onAdd={() => add('projects')}>
            {r.projects.map((p, i) => (
              <Row key={i} onDelete={() => del('projects', i)}>
                <input className="input" placeholder="Project title" value={p.title} onChange={(x) => setItem('projects', i, 'title', x.target.value)} />
                <input className="input" placeholder="Link (optional)" value={p.link} onChange={(x) => setItem('projects', i, 'link', x.target.value)} />
                <textarea rows={2} className="input sm:col-span-2" placeholder="What it does, tech used — one point per line" value={p.details} onChange={(x) => setItem('projects', i, 'details', x.target.value)} />
              </Row>))}
          </Section>

          <section className="card grid gap-3 p-5">
            <div><label className="label">Skills (comma separated)</label><input className="input" value={skills} onChange={(e) => { setSkills(e.target.value); setState('idle'); }} placeholder="React, Excel, Communication, Python" /></div>
            <div><label className="label">Languages</label><input className="input" value={langs} onChange={(e) => { setLangs(e.target.value); setState('idle'); }} placeholder="English, Hindi" /></div>
          </section>
        </div>

        {/* preview = what gets printed */}
        <ResumePreview r={f} />
      </div>
    </div>
  );
}

function Section({ title, onAdd, children }: { title: string; onAdd: () => void; children: React.ReactNode }) {
  return (
    <section className="card space-y-3 p-5">
      <div className="flex items-center justify-between"><p className="font-bold text-slate-900">{title}</p><button type="button" onClick={onAdd} className="btn-ghost text-xs"><Plus size={14} />Add</button></div>
      {children}
    </section>
  );
}
function Row({ onDelete, children }: { onDelete: () => void; children: React.ReactNode }) {
  return (
    <div className="relative grid gap-2 rounded-xl border border-slate-100 p-3 pe-10 sm:grid-cols-2">
      {children}
      <button type="button" onClick={onDelete} className="absolute end-2 top-2 text-slate-400 hover:text-rose-600" aria-label="Remove"><Trash2 size={15} /></button>
    </div>
  );
}
