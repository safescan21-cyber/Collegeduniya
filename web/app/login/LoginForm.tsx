'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, KeyRound, ArrowLeft, GraduationCap, BedDouble, Building2, MessageCircle } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useLang } from '@/components/LangProvider';

type Mode = 'login' | 'register';
type Channel = 'email' | 'whatsapp';

// WhatsApp login appears once NEXT_PUBLIC_WHATSAPP_LOGIN=on (after the Supabase "Send SMS" hook + WhatsApp template are set up)
const WA_LOGIN = process.env.NEXT_PUBLIC_WHATSAPP_LOGIN === 'on';
const CODES = [['+91', 'IN'], ['+977', 'NP'], ['+880', 'BD'], ['+94', 'LK'], ['+971', 'AE'], ['+966', 'SA'], ['+44', 'GB'], ['+1', 'US/CA'], ['+61', 'AU'], ['+49', 'DE'], ['+65', 'SG'], ['+234', 'NG'], ['+254', 'KE']];
const e164 = (cc: string, num: string) => {
  const raw = num.trim();
  if (raw.startsWith('+')) return '+' + raw.replace(/\D/g, '');
  return cc + raw.replace(/\D/g, '').replace(/^0+/, '');
};

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || (params.get('as') === 'pg_owner' ? '/owner' : params.get('as') === 'employer' ? '/employer' : '/dashboard');
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';
  const supabase = supabaseBrowser();
  const { user, refreshProfile } = useAuth();
  const { t } = useLang();

  const asParam = params.get('as');
  const [mode, setMode] = useState<Mode>(params.get('mode') === 'register' ? 'register' : 'login');
  const [accountType, setAccountType] = useState<'student' | 'pg_owner' | 'employer'>(asParam === 'pg_owner' || asParam === 'employer' ? asParam : 'student');
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [channel, setChannel] = useState<Channel>(WA_LOGIN && params.get('via') === 'whatsapp' ? 'whatsapp' : 'email');
  const [cc, setCc] = useState('+91');
  const [waNum, setWaNum] = useState('');
  const [optIn, setOptIn] = useState(false);
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
    if (mode === 'register' && name.trim().length < 2) return setErr('Enter your full name.');
    if (channel === 'whatsapp') {
      const ph = e164(cc, waNum);
      if (!/^\+\d{8,15}$/.test(ph)) return setErr('Enter your WhatsApp number.');
      setBusy(true);
      const { error } = await supabase.auth.signInWithOtp({
        phone: ph,
        options: {
          shouldCreateUser: mode === 'register',
          data: mode === 'register' ? { full_name: name.trim(), phone: ph, account_type: accountType, whatsapp_opt_in: optIn } : undefined,
        },
      });
      setBusy(false);
      if (error) {
        if (/signups not allowed|not found|user not found/i.test(error.message)) { setMode('register'); return setErr('No account with this number yet — add your name to register.'); }
        return setErr(/hook|whatsapp|configured/i.test(error.message) ? 'WhatsApp login is unavailable right now — please use email.' : error.message);
      }
      setStep('otp');
      setInfo(`We sent a 6-digit code on WhatsApp to ${ph}.`);
      startCooldown();
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) return setErr('Enter a valid email address.');
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        shouldCreateUser: mode === 'register',
        data: mode === 'register' ? { full_name: name.trim(), phone: phone.trim(), account_type: accountType } : undefined,
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
    if (!/^\d{6,10}$/.test(token)) return setErr(channel === 'whatsapp' ? 'Enter the code from WhatsApp.' : 'Enter the code from your email.');
    setBusy(true);
    const { data, error } = channel === 'whatsapp'
      ? await supabase.auth.verifyOtp({ phone: e164(cc, waNum), token, type: 'sms' })
      : await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token, type: 'email' });
    if (error || !data.user) { setBusy(false); return setErr(error?.message || 'Invalid or expired code.'); }

    // Existing user who used "register": make sure name/phone are saved
    if (mode === 'register' && (name || phone || accountType !== 'student')) {
      const { data: p } = await supabase.from('profiles').select('full_name, phone, account_type').eq('id', data.user.id).maybeSingle();
      const patch: Record<string, string> = {};
      if (accountType !== 'student' && p?.account_type !== accountType) patch.account_type = accountType;
      if (!p?.full_name && name) patch.full_name = name.trim();
      if (!p?.phone && phone) patch.phone = phone.trim();
      if (Object.keys(patch).length) await supabase.from('profiles').update(patch).eq('id', data.user.id);
    }
    await refreshProfile();
    setBusy(false);
    const dest = params.get('next') ? safeNext : accountType === 'pg_owner' ? '/owner' : accountType === 'employer' ? '/employer' : safeNext;
    router.replace(dest);
    router.refresh();
  };

  return (
    <div className="card w-full max-w-md p-8">
      <div className="mb-6 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand-600 text-white"><GraduationCap /></span>
        <h1 className="mt-4 text-2xl font-extrabold text-slate-900">{step === 'otp' ? 'Enter verification code' : mode === 'register' ? t('login.create') : t('login.welcome')}</h1>
        <p className="mt-1 text-sm text-slate-500">{step === 'otp' ? info : channel === 'whatsapp' ? 'No password — we send a one-time code on WhatsApp.' : t('login.noPassword')}</p>
      </div>

      {step === 'email' && (
        <>
          <div className="mb-5 grid grid-cols-2 rounded-xl bg-slate-100 p-1 text-sm font-semibold">
            {(['login', 'register'] as Mode[]).map((m) => (
              <button key={m} type="button" onClick={() => { setMode(m); setErr(''); }}
                className={`rounded-lg py-2 capitalize transition ${mode === m ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500'}`}>{m}</button>
            ))}
          </div>
          {WA_LOGIN && (
            <div className="mb-4 grid grid-cols-2 gap-2 text-sm font-semibold">
              {([['email', 'Email', Mail], ['whatsapp', 'WhatsApp', MessageCircle]] as const).map(([v, label, Icon]) => (
                <button key={v} type="button" onClick={() => { setChannel(v); setErr(''); }}
                  className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 ${channel === v ? (v === 'whatsapp' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-brand-500 bg-brand-50 text-brand-700') : 'border-slate-200 text-slate-600'}`}>
                  <Icon size={16} />{label}
                </button>
              ))}
            </div>
          )}
          <form onSubmit={sendCode} className="space-y-4">
            {mode === 'register' && (
              <>
                <div>
                  <p className="label">{t('register.as')}</p>
                  <div className="grid grid-cols-3 gap-2">
                    {([['student', t('register.student'), GraduationCap], ['pg_owner', t('register.owner'), BedDouble], ['employer', t('register.employer'), Building2]] as const).map(([v, label, Icon]) => (
                      <button type="button" key={v} onClick={() => setAccountType(v)}
                        className={`flex flex-col items-center gap-1 rounded-xl border p-2.5 text-center text-xs font-semibold ${accountType === v ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                        <Icon size={18} />{label}
                      </button>
                    ))}
                  </div>
                </div>
                <div><label className="label">Full name *</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name" /></div>
                {channel === 'email' && <div><label className="label">Mobile number</label><input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" autoComplete="tel" /></div>}
              </>
            )}
            {channel === 'whatsapp' ? (
              <div>
                <label className="label">WhatsApp number *</label>
                <div className="flex gap-2">
                  <select className="input w-28" value={cc} onChange={(e) => setCc(e.target.value)} aria-label="Country code">
                    {CODES.map(([c, n]) => <option key={c + n} value={c}>{c} {n}</option>)}
                  </select>
                  <input type="tel" required className="input flex-1" value={waNum} onChange={(e) => setWaNum(e.target.value)} placeholder="98765 43210" autoComplete="tel-national" inputMode="tel" />
                </div>
                {mode === 'register' && (
                  <label className="mt-3 flex items-start gap-2 text-xs text-slate-600">
                    <input type="checkbox" className="mt-0.5 h-4 w-4 accent-emerald-600" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} />
                    Also send me application, PG visit and message updates on WhatsApp (optional — change any time in your profile).
                  </label>
                )}
              </div>
            ) : (
            <div>
              <label className="label">Email *</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="email" required className="input pl-9" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
              </div>
            </div>
            )}
            {err && <p className="text-sm text-rose-600">{err}</p>}
            <button disabled={busy} className={`w-full ${channel === 'whatsapp' ? 'btn-primary bg-emerald-600 hover:bg-emerald-700' : 'btn-primary'}`}>{busy ? '…' : channel === 'whatsapp' ? 'Send code on WhatsApp' : t('login.sendCode')}</button>
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
            <button type="button" onClick={() => { setStep('email'); setCode(''); setErr(''); }} className="flex items-center gap-1 text-slate-500 hover:text-slate-800"><ArrowLeft size={14} />{channel === 'whatsapp' ? 'Change number' : 'Change email'}</button>
            <button type="button" disabled={cooldown > 0 || busy} onClick={() => sendCode()} className="font-semibold text-brand-700 disabled:text-slate-400">
              {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
