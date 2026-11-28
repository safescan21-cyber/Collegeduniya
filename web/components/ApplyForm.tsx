'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CheckCircle2, Upload, FileText } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { supabaseBrowser } from '@/lib/supabase/client';

export default function ApplyForm({ jobId, jobTitle, closed }: { jobId: string; jobTitle: string; closed: boolean }) {
  const { user, profile, loading } = useAuth();
  const pathname = usePathname();
  const supabase = supabaseBrowser();
  const [existing, setExisting] = useState<{ status: string; created_at: string } | null>(null);
  const [form, setForm] = useState({ full_name: '', phone: '', cover_letter: '' });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [built, setBuilt] = useState<any | null>(null);
  const [attachBuilt, setAttachBuilt] = useState(true);

  useEffect(() => {
    if (profile) setForm((f) => ({ ...f, full_name: f.full_name || profile.full_name || '', phone: f.phone || profile.phone || '' }));
  }, [profile]);

  useEffect(() => {
    if (!user) return;
    supabase.from('job_applications').select('status, created_at').eq('job_id', jobId).eq('user_id', user.id).maybeSingle()
      .then(({ data }: { data: { status: string; created_at: string } | null }) => setExisting(data));
    supabase.from('student_resumes').select('*').eq('user_id', user.id).maybeSingle().then(({ data }: { data: any }) => setBuilt(data));
  }, [user, jobId, supabase]);

  if (loading) return <div className="card h-64 animate-pulse" />;

  if (!user) {
    return (
      <div className="card p-6 text-center">
        <h3 className="text-lg font-bold text-slate-900">Apply for this job</h3>
        <p className="mt-2 text-sm text-slate-500">Register free with your email — no password, just a one-time code.</p>
        <Link href={`/login?mode=register&next=${encodeURIComponent(pathname)}`} className="btn-primary mt-5 w-full">Register & apply</Link>
        <Link href={`/login?next=${encodeURIComponent(pathname)}`} className="btn-ghost mt-2 w-full">I already have an account</Link>
      </div>
    );
  }

  if (existing) {
    return (
      <div className="card p-6 text-center">
        <CheckCircle2 className="mx-auto text-emerald-600" size={40} />
        <h3 className="mt-3 text-lg font-bold text-slate-900">You have applied</h3>
        <p className="mt-1 text-sm text-slate-500">Status: <span className="font-semibold capitalize text-slate-800">{existing.status}</span></p>
        <Link href="/dashboard" className="btn-ghost mt-5 w-full">Track in dashboard</Link>
      </div>
    );
  }

  if (closed) return <div className="card p-6 text-center text-slate-600">This job is no longer accepting applications.</div>;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    if (!/^[+\d][\d\s-]{6,}$/.test(form.phone)) return setErr('Enter a valid phone number.');
    setBusy(true);
    let resume_path: string | null = null;
    if (file) {
      if (file.size > 5 * 1024 * 1024) { setBusy(false); return setErr('Resume must be under 5 MB.'); }
      const ext = file.name.split('.').pop()?.toLowerCase() || 'pdf';
      resume_path = `${user.id}/${jobId}-${Date.now()}.${ext}`;
      const up = await supabase.storage.from('resumes').upload(resume_path, file, { contentType: file.type });
      if (up.error) { setBusy(false); return setErr('Resume upload failed: ' + up.error.message); }
    }
    const { error } = await supabase.from('job_applications').insert({
      job_id: jobId, user_id: user.id, full_name: form.full_name.trim(), phone: form.phone.trim(),
      email: user.email, cover_letter: form.cover_letter.trim() || null, resume_path,
      resume_snapshot: built && attachBuilt ? { ...built, user_id: undefined, snapshot_at: new Date().toISOString() } : null,
    });
    setBusy(false);
    if (error) return setErr(error.message.includes('duplicate') ? 'You already applied for this job.' : error.message);
    if (!profile?.phone || !profile?.full_name) {
      await supabase.from('profiles').update({ full_name: profile?.full_name || form.full_name, phone: profile?.phone || form.phone }).eq('id', user.id);
    }
    setExisting({ status: 'pending', created_at: new Date().toISOString() });
  };

  return (
    <form onSubmit={submit} className="card space-y-4 p-6">
      <h3 className="text-lg font-bold text-slate-900">Apply: {jobTitle}</h3>
      <div><label className="label">Full name *</label><input required className="input" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
      <div><label className="label">Phone *</label><input required className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 98765 43210" /></div>
      <div><label className="label">Email</label><input disabled className="input bg-slate-50" value={user.email || ''} /></div>
      <div><label className="label">Why are you a good fit?</label><textarea rows={4} maxLength={2000} className="input" value={form.cover_letter} onChange={(e) => setForm({ ...form, cover_letter: e.target.value })} placeholder="Your availability, experience, skills…" /></div>
      {built ? (
        <label className="flex items-center gap-2 rounded-xl bg-brand-50 px-4 py-3 text-sm text-slate-700">
          <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={attachBuilt} onChange={(e) => setAttachBuilt(e.target.checked)} />
          <FileText size={16} className="text-brand-600" />Attach my Collegeolo resume <Link href="/resume" className="ml-auto text-xs text-brand-700 underline">edit</Link>
        </label>
      ) : (
        <p className="text-xs text-slate-500">No resume? <Link href="/resume" className="text-brand-700 underline">Build one free in 5 minutes</Link> — or upload a file below.</p>
      )}
      <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-600 hover:border-brand-400">
        <Upload size={16} />{file ? file.name : 'Upload resume (PDF/DOC, optional)'}
        <input type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      </label>
      {err && <p className="text-sm text-rose-600">{err}</p>}
      <button disabled={busy} className="btn-primary w-full">{busy ? 'Submitting…' : 'Submit application'}</button>
    </form>
  );
}
