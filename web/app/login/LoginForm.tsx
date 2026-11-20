'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, KeyRound, ArrowLeft, GraduationCap } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useLang } from '@/components/LangProvider';

type Mode = 'login' | 'register';

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/dashboard';
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';
  const supabase = supabaseBrowser();
  const { user, refreshProfile } = useAuth();
  const { t } = useLang();

  const [mode, setMode] = useState<Mode>(params.get('mode') === 'register' ? 'register' : 'login');
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { if (user && step === 'email') router.replace(safeNext); }, [user, step, router, safeNext]);
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  const startCooldown = () => {
    setCooldown(60);
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => setCooldown((c) => { if (c <= 1 && timer.current) clearInterval(timer.current); return Math.max(0, c - 1); }), 1000);
  };

  const sendCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setErr(''); setInfo('');
    if (!/^\S+@\S+\.\S+$/.test(email)) return setErr('Enter a valid email address.');
    if (mode === 'register' && name.trim().length < 2) return setErr('Enter your full name.');
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        shouldCreateUser: mode === 'register',
        data: mode === 'register' ? { full_name: name.trim(), phone: phone.trim() } : undefined,
      },
    });
    setBusy(false);
    if (error) {
      if (/signups not allowed|not found|user not found/i.test(error.message)) {
        setMode('register');
        return setErr('No account with this email yet — add your name to register.');
      }
      return setErr(error.message);
    }
    setStep('otp');
    setInfo(`We sent a verification code to ${email}. Check inbox and spam.`);
    startCooldown();
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    const token = code.replace(/\s/g, '');
    if (!/^\d{6,10}$/.test(token)) return setErr('Enter the code from your email.');
    setBusy(true);
    const { data, error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token, type: 'email' });
    if (error || !data.user) { setBusy(false); return setErr(error?.message || 'Invalid or expired code.'); }

    // Existing user who used "register": make sure name/phone are saved
    if (mode === 'register' && (name || phone)) {
      const { data: p } = await supabase.from('profiles').select('full_name, phone').eq('id', data.user.id).maybeSingle();
      const patch: Record<string, string> = {};
      if (!p?.full_name && name) patch.full_name = name.trim();
      if (!p?.phone && phone) patch.phone = phone.trim();
      if (Object.keys(patch).length) await supabase.from('profiles').update(patch).eq('id', data.user.id);
    }
    await refreshProfile();
    setBusy(false);
    router.replace(safeNext);
    router.refresh();
  };

  return (
    <div className="card w-full max-w-md p-8">
      <div className="mb-6 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand-600 text-white"><GraduationCap /></span>
        <h1 className="mt-4 text-2xl font-extrabold text-slate-900">{step === 'otp' ? 'Enter verification code' : mode === 'register' ? t('login.create') : t('login.welcome')}</h1>
        <p className="mt-1 text-sm text-slate-500">{step === 'otp' ? info : t('login.noPassword')}</p>
      </div>

      {step === 'email' && (
        <>
          <div className="mb-5 grid grid-cols-2 rounded-xl bg-slate-100 p-1 text-sm font-semibold">
            {(['login', 'register'] as Mode[]).map((m) => (
              <button key={m} type="button" onClick={() => { setMode(m); setErr(''); }}
                className={`rounded-lg py-2 capitalize transition ${mode === m ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500'}`}>{m}</button>
            ))}
          </div>
          <form onSubmit={sendCode} className="space-y-4">
            {mode === 'register' && (
              <>
                <div><label className="label">Full name *</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name" /></div>
                <div><label className="label">Mobile number</label><input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" autoComplete="tel" /></div>
              </>
            )}
            <div>
              <label className="label">Email *</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="email" required className="input pl-9" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
              </div>
            </div>
            {err && <p className="text-sm text-rose-600">{err}</p>}
            <button disabled={busy} className="btn-primary w-full">{busy ? '…' : t('login.sendCode')}</button>
          </form>
        </>
      )}

      {step === 'otp' && (
        <form onSubmit={verify} className="space-y-4">
          <div className="relative">
            <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input inputMode="numeric" autoFocus maxLength={10} className="input pl-9 text-center text-2xl font-bold tracking-[0.5em]"
              value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="••••••" autoComplete="one-time-code" />
          </div>
          {err && <p className="text-sm text-rose-600">{err}</p>}
          <button disabled={busy} className="btn-primary w-full">{busy ? 'Verifying…' : mode === 'register' ? 'Verify & create account' : 'Verify & login'}</button>
          <div className="flex items-center justify-between text-sm">
            <button type="button" onClick={() => { setStep('email'); setCode(''); setErr(''); }} className="flex items-center gap-1 text-slate-500 hover:text-slate-800"><ArrowLeft size={14} />Change email</button>
            <button type="button" disabled={cooldown > 0 || busy} onClick={() => sendCode()} className="font-semibold text-brand-700 disabled:text-slate-400">
              {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
