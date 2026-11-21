'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Camera, CheckCircle2, Loader2, ShieldCheck, XCircle, Clock, RotateCcw } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { api } from '@/lib/api';

type Status = { verification: string; has_photo: boolean; has_gender: boolean; last: { status: string; reason: string | null } | null };
type Step = 'intro' | 'front' | 'action' | 'sending' | 'done';

export default function VerifyFlow() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const [st, setSt] = useState<Status | null>(null);
  const [agree, setAgree] = useState(false);
  const [step, setStep] = useState<Step>('intro');
  const [check, setCheck] = useState<{ id: string; challenge: string } | null>(null);
  const [shots, setShots] = useState<{ front?: string; challenge?: string }>({});
  const [count, setCount] = useState(0);
  const [result, setResult] = useState<{ status: string; reason: string } | null>(null);
  const [err, setErr] = useState('');
  const video = useRef<HTMLVideoElement>(null); const stream = useRef<MediaStream | null>(null);

  useEffect(() => { if (user && !(user as any).is_anonymous) api<Status>('/api/verify/status').then(setSt).catch((e) => setErr(e.message)); }, [user]);
  useEffect(() => () => stream.current?.getTracks().forEach((t) => t.stop()), []);

  if (loading) return <div className="card h-80 animate-pulse" />;
  if (!user || (user as any).is_anonymous) return <div className="card p-8 text-center"><Link href="/login?next=/verify" className="btn-primary">Log in to get verified</Link></div>;

  const stopCam = () => { stream.current?.getTracks().forEach((t) => t.stop()); stream.current = null; };
  const begin = async () => {
    setErr('');
    try {
      const c = await api<{ id: string; challenge: string }>('/api/verify/start', { method: 'POST' });
      stream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 720 } }, audio: false });
      setCheck(c); setShots({}); setStep('front');
      setTimeout(() => { if (video.current && stream.current) { video.current.srcObject = stream.current; video.current.play().catch(() => {}); } }, 50);
    } catch (e: any) {
      setErr(e?.name === 'NotAllowedError' ? 'Please allow camera access in your browser and try again.' : e?.name === 'NotFoundError' ? 'No camera found — use your phone.' : e.message);
    }
  };
  const grab = () => {
    const v = video.current!; const c = document.createElement('canvas');
    const scale = Math.min(1, 960 / Math.max(v.videoWidth, v.videoHeight));
    c.width = Math.round(v.videoWidth * scale); c.height = Math.round(v.videoHeight * scale);
    c.getContext('2d')!.drawImage(v, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.85);
  };
  const shoot = (which: 'front' | 'challenge') => {
    let n = 3; setCount(n);
    const t = setInterval(() => {
      n -= 1; setCount(n);
      if (n > 0) return;
      clearInterval(t);
      const img = grab();
      if (which === 'front') { setShots({ front: img }); setStep('action'); }
      else { const all = { ...shots, challenge: img }; setShots(all); send(all); }
    }, 1000);
  };
  const send = async (all: { front?: string; challenge?: string }) => {
    stopCam(); setStep('sending');
    try { const r = await api<{ status: string; reason: string }>(`/api/verify/${check!.id}/submit`, { method: 'POST', body: JSON.stringify(all) }); setResult(r); }
    catch (e: any) { setResult({ status: 'error', reason: e.message }); }
    setStep('done'); refreshProfile(); api<Status>('/api/verify/status').then(setSt).catch(() => {});
  };

  const v = st?.verification || profile?.verification || 'none';
  const ready = st?.has_photo && st?.has_gender;
  return (
    <div className="card overflow-hidden">
      <div className="bg-gradient-to-br from-brand-700 to-brand-500 p-6 text-white">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold"><ShieldCheck />Get the verified tick</h1>
        <p className="mt-1 text-sm text-brand-100">A quick live selfie proves you are a real student. Verified girls can message anyone in their college directly, and everyone sees the tick on your posts.</p>
      </div>
      <div className="p-6">
        {v === 'verified' && step !== 'done' ? <p className="flex items-center gap-2 font-semibold text-emerald-700"><CheckCircle2 />You are verified.</p>
        : v === 'review' && step !== 'done' ? <p className="flex items-center gap-2 text-slate-700"><Clock className="text-amber-500" />Your photos are with our team — you will get a notification within 24 hours.</p>
        : step === 'intro' ? (
          <div className="space-y-4">
            <ol className="list-decimal space-y-1 ps-5 text-sm text-slate-700">
              <li>Add a clear profile photo of your face and choose your gender in <Link href="/dashboard?tab=profile" className="font-semibold text-brand-700">your profile</Link>.{st && (ready ? ' ✅' : ' ⬅ do this first')}</li>
              <li>Take a selfie with your phone camera (no gallery photos).</li>
              <li>Do the small action we show you — like a thumbs up — and take a second selfie.</li>
            </ol>
            {st?.last?.status === 'rejected' && st.last.reason && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">Last try: {st.last.reason}</p>}
            <label className="flex items-start gap-2 text-sm text-slate-600"><input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand-600" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
              I agree that my two selfies and profile photo are checked by AI (and by the Collegeolo team if the AI is unsure) only to verify me. The selfies are deleted as soon as the check is done.</label>
            <button onClick={begin} disabled={!agree || !ready} className="btn-primary w-full"><Camera size={17} />Open camera</button>
          </div>
        ) : step === 'front' || step === 'action' ? (
          <div className="space-y-3 text-center">
            <p className="text-lg font-bold text-slate-900">{step === 'front' ? 'Look straight at the camera' : check?.challenge}</p>
            <div className="relative mx-auto aspect-[3/4] max-w-sm overflow-hidden rounded-2xl bg-black">
              <video ref={video} playsInline muted className="h-full w-full -scale-x-100 object-cover" />
              <div className="pointer-events-none absolute inset-8 rounded-[45%] border-4 border-white/60" />
              {count > 0 && <span className="absolute inset-0 flex items-center justify-center text-7xl font-black text-white drop-shadow">{count}</span>}
            </div>
            <p className="text-xs text-slate-500">Good light, face inside the oval, no sunglasses or mask.</p>
            <button onClick={() => shoot(step === 'front' ? 'front' : 'challenge')} disabled={count > 0} className="btn-primary w-full"><Camera size={17} />{step === 'front' ? 'Take selfie' : 'Take second selfie'}</button>
          </div>
        ) : step === 'sending' ? (
          <p className="flex items-center justify-center gap-2 py-10 text-slate-600"><Loader2 className="animate-spin" />Checking your photos…</p>
        ) : result && (
          <div className="space-y-4 text-center">
            {result.status === 'verified' ? <CheckCircle2 size={48} className="mx-auto text-emerald-600" /> : result.status === 'review' ? <Clock size={48} className="mx-auto text-amber-500" /> : <XCircle size={48} className="mx-auto text-rose-600" />}
            <p className="text-lg font-bold">{result.status === 'verified' ? 'You are verified!' : result.status === 'review' ? 'Almost there' : 'Not verified this time'}</p>
            <p className="text-sm text-slate-600">{result.reason}</p>
            {['rejected', 'error'].includes(result.status) && <button onClick={() => { setStep('intro'); setResult(null); }} className="btn-ghost"><RotateCcw size={16} />Try again</button>}
            {result.status === 'verified' && <Link href="/messages" className="btn-primary">Go to messages</Link>}
          </div>
        )}
        {err && <p className="mt-3 text-sm text-rose-600">{err}</p>}
      </div>
    </div>
  );
}
