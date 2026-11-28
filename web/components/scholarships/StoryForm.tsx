'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, PenLine, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { api } from '@/lib/api';

// shrink a photo in the browser so it fits the upload limit (JPEG, longest side 1600px)
async function shrink(file: File): Promise<string> {
  const img = await createImageBitmap(file);
  const k = Math.min(1, 1600 / Math.max(img.width, img.height));
  const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.8);
}

export default function StoryForm({ scholarshipId }: { scholarshipId: string }) {
  const { user } = useAuth();
  const loggedIn = !!user && !(user as any).is_anonymous;
  const [open, setOpen] = useState(false);
  const [mine, setMine] = useState<any>(undefined);
  const [f, setF] = useState({ display_name: '', college: '', course: '', year_awarded: String(new Date().getFullYear()), story: '', tips: '' });
  const [proof, setProof] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!loggedIn) return;
    api(`/api/scholarships/${scholarshipId}/my-story`).then((r: any) => {
      setMine(r.data);
      if (r.data) setF({ display_name: r.data.display_name, college: r.data.college || '', course: r.data.course || '', year_awarded: String(r.data.year_awarded), story: r.data.story, tips: r.data.tips || '' });
    }).catch(() => setMine(null));
  }, [loggedIn, scholarshipId]);

  if (!loggedIn) return <Link href={`/login?next=${encodeURIComponent(typeof location !== 'undefined' ? `${location.pathname}#stories` : '/scholarships')}`} className="btn-ghost mt-4"><PenLine size={15} />Got this scholarship? Share your story</Link>;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setMsg(null);
    try {
      await api(`/api/scholarships/${scholarshipId}/stories`, { method: 'POST', body: JSON.stringify({ ...f, year_awarded: Number(f.year_awarded), proof, consent }) });
      setMine({ ...f, status: 'pending' }); setOpen(false); setMsg('Thank you! Your story will appear after we check it.');
    } catch (err: any) { setMsg(err.message || 'Could not save'); }
    setBusy(false);
  };
  const set = (k: keyof typeof f) => (e: any) => setF({ ...f, [k]: e.target.value });

  return (
    <div className="mt-4">
      {mine && !open && (
        <p className="flex items-center gap-1.5 text-sm text-slate-600"><CheckCircle2 size={15} className="text-emerald-600" />
          Your story is {mine.status === 'approved' ? 'published' : mine.status === 'rejected' ? 'not published' : 'waiting for a check'}.
          <button onClick={() => setOpen(true)} className="text-brand-700 underline">Edit</button></p>)}
      {!mine && !open && mine !== undefined && <button onClick={() => setOpen(true)} className="btn-ghost"><PenLine size={15} />Got this scholarship? Share your story</button>}
      {msg && <p className="mt-2 text-sm text-slate-700">{msg}</p>}
      {open && (
        <form onSubmit={submit} className="mt-2 grid gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-2">
          <label className="text-sm">Name to show<input className="input mt-1" required minLength={2} maxLength={60} value={f.display_name} onChange={set('display_name')} placeholder="e.g. Priya S." /></label>
          <label className="text-sm">Year you received it<input className="input mt-1" type="number" required min={1990} max={new Date().getFullYear()} value={f.year_awarded} onChange={set('year_awarded')} /></label>
          <label className="text-sm">Course<input className="input mt-1" maxLength={120} value={f.course} onChange={set('course')} placeholder="e.g. MSc Data Science" /></label>
          <label className="text-sm">College / university<input className="input mt-1" maxLength={120} value={f.college} onChange={set('college')} /></label>
          <label className="text-sm sm:col-span-2">How did you get it? <span className="text-slate-400">(your preparation, the application, interview — at least a few sentences)</span>
            <textarea className="input mt-1 min-h-32" required minLength={80} maxLength={3000} value={f.story} onChange={set('story')} /></label>
          <label className="text-sm sm:col-span-2">Tips for the next applicants <span className="text-slate-400">(optional)</span>
            <textarea className="input mt-1 min-h-20" maxLength={1500} value={f.tips} onChange={set('tips')} /></label>
          <label className="text-sm sm:col-span-2">Award letter photo <span className="text-slate-400">(optional — only our team sees it, deleted after checking; adds “Award verified”)</span>
            <input className="mt-1 block text-sm" type="file" accept="image/jpeg,image/png,image/webp" onChange={async (e) => { const file = e.target.files?.[0]; setProof(file ? await shrink(file).catch(() => null) : null); }} /></label>
          <label className="flex items-start gap-2 text-sm sm:col-span-2"><input type="checkbox" className="mt-1" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            This is my own true story, and I agree that it is shown publicly with the name above.</label>
          <div className="flex gap-2 sm:col-span-2">
            <button disabled={busy || !consent} className="btn-primary">{busy && <Loader2 size={15} className="animate-spin" />}Send for checking</button>
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost">Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}
