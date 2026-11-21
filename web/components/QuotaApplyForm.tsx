'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Loader2, Paperclip, X, Send } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useLang } from '@/components/LangProvider';

const MAX_FILES = 6;
const MAX_MB = 5;
const OK_TYPES = /^(application\/pdf|image\/(jpeg|png|webp))$/;

const QUALIFICATIONS = ['Secondary school (10th / GCSE / O-level)', 'High school (12th / A-level / IB / HSC)', 'Diploma', "Bachelor's degree", "Master's degree", 'Doctorate', 'Other'];
const ENGLISH = ['None yet', 'IELTS Academic', 'TOEFL iBT', 'PTE Academic', 'Duolingo English Test', 'Cambridge (C1/C2)', 'Native / English-medium schooling'];

export default function QuotaApplyForm({ seatId, course, college, open, documents, minPercentage, countryCode, openTo }: {
  seatId: string; course: string; college: string; open: boolean; documents: string[]; minPercentage: number | null;
  countryCode: string | null; openTo: 'all' | 'domestic' | 'international';
}) {
  const { user, profile, loading } = useAuth();
  const { t, lang } = useLang();
  const isIndia = countryCode === 'IN';
  const supabase = supabaseBrowser();
  const [existing, setExisting] = useState<{ status: string; created_at: string } | null | undefined>(undefined);
  const [f, setF] = useState<Record<string, string>>({
    full_name: '', email: '', phone: '', dob: '', gender: '', city: '', state: '', parent_name: '', parent_phone: '',
    qualification: QUALIFICATIONS[1], board_or_university: '', percentage: '', passing_year: '', entrance_exam: '', entrance_score: '', category: '', message: '',
    nationality: '', country: '', english_test: '', english_score: '',
  });
  const [visa, setVisa] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!user) { setExisting(null); return; }
    supabase.from('quota_applications').select('status, created_at').eq('seat_id', seatId).eq('user_id', user.id).maybeSingle()
      .then(({ data }: { data: any }) => setExisting(data || null));
  }, [user, seatId, supabase]);

  useEffect(() => {
    if (user || profile) setF((p) => ({ ...p, full_name: p.full_name || profile?.full_name || '', email: p.email || user?.email || '',
      phone: p.phone || profile?.phone || '', city: p.city || profile?.city || '', country: p.country || profile?.country || '' }));
  }, [user, profile]);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  const addFiles = (list: FileList | null) => {
    setErr('');
    const picked = Array.from(list || []);
    const bad = picked.find((x) => !OK_TYPES.test(x.type) || x.size > MAX_MB * 1024 * 1024);
    if (bad) return setErr(`${bad.name}: only PDF, JPG or PNG up to ${MAX_MB} MB.`);
    setFiles((cur) => [...cur, ...picked].slice(0, MAX_FILES));
  };

  if (loading || existing === undefined) return <div className="card h-48 animate-pulse" />;

  if (!user) {
    return (
      <div className="card p-6 text-center">
        <p className="font-semibold text-slate-900">{t('quota.applyTitle')}: {course}</p>
        <p className="mt-1 text-sm text-slate-500">{t('quota.loginText')}</p>
        <Link href={`/login?next=/management-quota/${seatId}`} className="btn-primary mt-4 w-full">{t('quota.login')}</Link>
      </div>
    );
  }

  if (existing) {
    return (
      <div className="card p-6 text-center">
        <CheckCircle2 className="mx-auto text-emerald-600" size={40} />
        <p className="mt-2 font-semibold text-slate-900">{t('quota.applied')} {new Date(existing.created_at).toLocaleDateString(lang)}</p>
        <p className="mt-1 text-sm text-slate-500">{t('quota.status')}: <span className="font-semibold capitalize">{existing.status.replace('_', ' ')}</span></p>
        <Link href="/dashboard?tab=colleges" className="btn-ghost mt-4 w-full">{t('quota.track')}</Link>
      </div>
    );
  }

  if (!open) return <div className="card p-6 text-center text-sm text-slate-500">{t('quota.closedText')} <Link href="/management-quota" className="font-semibold text-brand-700 underline">{t('quota.seeOpen')}</Link></div>;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    if (!ack) return setErr('Please tick the confirmation box.');
    if (!/^[+\d][\d\s-]{6,18}$/.test(f.phone.trim())) return setErr('Enter a valid phone number.');
    if (minPercentage && f.percentage && Number(f.percentage) < minPercentage) {
      if (!confirm(`This seat asks for at least ${minPercentage}%. Apply anyway?`)) return;
    }
    setBusy(true);
    const paths: string[] = [];
    for (const file of files) {
      const ext = (file.name.split('.').pop() || 'pdf').toLowerCase().replace(/[^a-z0-9]/g, '');
      const path = `${user.id}/quota-${seatId.slice(0, 8)}-${Date.now()}-${paths.length}.${ext}`;
      const up = await supabase.storage.from('resumes').upload(path, file, { contentType: file.type });
      if (up.error) { setBusy(false); return setErr(`Upload failed for ${file.name}: ${up.error.message}`); }
      paths.push(path);
    }
    const num = (v: string) => (v.trim() === '' ? null : Number(v));
    const row: any = { seat_id: seatId, user_id: user.id, documents: paths, fee_acknowledged: true };
    for (const [k, v] of Object.entries(f)) row[k] = v.trim() === '' ? null : v.trim();
    row.percentage = num(f.percentage); row.passing_year = num(f.passing_year);
    row.email = row.email || user.email;
    row.needs_visa = visa; row.preferred_lang = lang;
    const { error } = await supabase.from('quota_applications').insert(row);
    setBusy(false);
    if (error) {
      setErr(/duplicate|unique/i.test(error.message) ? 'You have already applied for this seat.'
        : /row-level|policy/i.test(error.message) ? 'This seat is no longer open, or your account is restricted.' : error.message);
      return;
    }
    setExisting({ status: 'submitted', created_at: new Date().toISOString() });
  };

  const input = (k: string, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div><label className="label" htmlFor={`q-${k}`}>{label}</label><input id={`q-${k}`} value={f[k]} onChange={set(k)} className="input" {...props} /></div>
  );

  return (
    <form onSubmit={submit} className="card space-y-4 p-5" id="apply">
      <div>
        <p className="text-lg font-bold text-slate-900">{t('quota.applyTitle')}: {course}</p>
        <p className="text-sm text-slate-500">{college}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {input('full_name', `${t('quota.f.name')} *`, { required: true, minLength: 2 })}
        {input('phone', `${t('quota.f.phone')} *`, { required: true, inputMode: 'tel', placeholder: '+44 7700 900123' })}
        {input('email', `${t('quota.f.email')} *`, { required: true, type: 'email' })}
        {input('dob', t('quota.f.dob'), { type: 'date' })}
        <div><label className="label" htmlFor="q-gender">{t('quota.f.gender')}</label>
          <select id="q-gender" value={f.gender} onChange={set('gender')} className="input"><option value="">—</option><option>Female</option><option>Male</option><option>Other</option><option>Prefer not to say</option></select></div>
        {isIndia
          ? <div><label className="label" htmlFor="q-category">{t('quota.f.category')}</label>
              <select id="q-category" value={f.category} onChange={set('category')} className="input"><option value="">—</option>{['General', 'OBC', 'SC', 'ST', 'EWS', 'NRI', 'Foreign national'].map((c) => <option key={c}>{c}</option>)}</select></div>
          : input('nationality', t('quota.f.nationality'), { placeholder: 'e.g. Nigerian, Indian, Vietnamese' })}
        {isIndia && input('nationality', t('quota.f.nationality'), { placeholder: 'Indian' })}
        {input('country', t('quota.f.country'))}
        {input('city', t('quota.f.city'))}
        {input('state', t('quota.f.state'))}
        {input('parent_name', t('quota.f.parent'))}
        {input('parent_phone', t('quota.f.parentPhone'), { inputMode: 'tel' })}
      </div>
      <p className="border-t border-slate-100 pt-3 text-sm font-semibold text-slate-900">{t('quota.f.academics')}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2"><label className="label" htmlFor="q-qual">{t('quota.f.qualification')}</label>
          <select id="q-qual" value={f.qualification} onChange={set('qualification')} className="input">{QUALIFICATIONS.map((c) => <option key={c}>{c}</option>)}</select></div>
        {input('board_or_university', t('quota.f.board'))}
        {input('percentage', `${t('quota.f.marks')}${minPercentage ? ` (min ${minPercentage}%)` : ''}`, { type: 'number', step: '0.01', min: 0, max: 100 })}
        {input('passing_year', t('quota.f.year'), { type: 'number', min: 1980, max: 2100 })}
        {input('entrance_exam', t('quota.f.exam'), { placeholder: isIndia ? 'JEE Main, NEET, CAT…' : 'SAT, ACT, GRE, GMAT, Gaokao…' })}
        {input('entrance_score', t('quota.f.score'))}
        {!isIndia && <>
          <div><label className="label" htmlFor="q-eng">{t('quota.f.englishTest')}</label>
            <select id="q-eng" value={f.english_test} onChange={set('english_test')} className="input"><option value="">—</option>{ENGLISH.map((c) => <option key={c}>{c}</option>)}</select></div>
          {input('english_score', t('quota.f.englishScore'), { placeholder: 'e.g. 6.5 / 95' })}
          {openTo !== 'domestic' && <label className="flex items-center gap-2 text-sm text-slate-600 sm:col-span-2"><input type="checkbox" checked={visa} onChange={(e) => setVisa(e.target.checked)} />{t('quota.f.visa')}</label>}
        </>}
      </div>
      <div>
        <label className="label">{t('quota.f.docs')} · max {MAX_FILES}</label>
        {!!documents.length && <p className="mb-2 text-xs text-slate-500">{t('quota.f.docsAsk')}: {documents.join(', ')}</p>}
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 p-3 text-sm text-slate-600 hover:bg-slate-50">
          <Paperclip size={16} />{t('quota.f.attach')}
          <input type="file" multiple accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
        </label>
        {!!files.length && (
          <ul className="mt-2 space-y-1">
            {files.map((x, i) => (
              <li key={i} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5 text-xs">
                <span className="truncate">{x.name}</span>
                <button type="button" onClick={() => setFiles((c) => c.filter((_, j) => j !== i))} aria-label="Remove"><X size={14} /></button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-1 text-xs text-slate-400">{t('quota.f.private')}</p>
      </div>
      <div><label className="label" htmlFor="q-msg">{t('quota.f.message')}</label>
        <textarea id="q-msg" value={f.message} onChange={set('message')} rows={3} className="input" placeholder="Preferred branch, hostel need, best time to call…" /></div>
      <label className="flex items-start gap-2 text-sm text-slate-600">
        <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-1" />
        <span>{t('quota.f.ack')}</span>
      </label>
      {err && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{err}</p>}
      <button disabled={busy} className="btn-primary w-full">{busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}{t('quota.f.submit')}</button>
    </form>
  );
}
