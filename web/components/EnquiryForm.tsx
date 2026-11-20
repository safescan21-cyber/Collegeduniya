'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { CheckCircle2, PhoneCall } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { useLang } from './LangProvider';
import { api } from '@/lib/api';

type Props = {
  kind?: 'counselling' | 'college' | 'hostel' | 'job' | 'other';
  collegeId?: string;
  hostelId?: string;
  title?: string;
  subtitle?: string;
  compact?: boolean;
  defaultCourse?: string;
};

// Lead form → Node API /api/leads → admin "Leads" page (CSV export for your call team)
export default function EnquiryForm({ kind = 'counselling', collegeId, hostelId, title, subtitle, compact, defaultCourse }: Props) {
  const { user, profile } = useAuth();
  const { t } = useLang();
  const pathname = usePathname();
  const [f, setF] = useState({ full_name: '', phone: '', email: '', city: '', course_interest: defaultCourse || '', message: '', website: '' });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (profile) setF((p) => ({
      ...p, full_name: p.full_name || profile.full_name || '', phone: p.phone || profile.phone || '',
      email: p.email || profile.email || user?.email || '', city: p.city || profile.city || '',
      course_interest: p.course_interest || profile.course_interest || '',
    }));
  }, [profile, user]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      await api('/api/leads', {
        method: 'POST',
        body: JSON.stringify({ ...f, kind, college_id: collegeId || null, hostel_id: hostelId || null, source_path: pathname }),
      });
      setDone(true);
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  };

  if (done) {
    return (
      <div className="card p-6 text-center">
        <CheckCircle2 className="mx-auto text-emerald-600" size={40} />
        <p className="mt-3 font-semibold text-slate-900">{t('lead.thanks')}</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card space-y-3 p-5">
      <div>
        <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900"><PhoneCall size={18} className="text-brand-600" />{title || t('lead.title')}</h3>
        <p className="text-sm text-slate-500">{subtitle || t('lead.subtitle')}</p>
      </div>
      <input required className="input" placeholder={`${t('lead.name')} *`} value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} autoComplete="name" />
      <input required className="input" placeholder={`${t('lead.phone')} *`} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} autoComplete="tel" inputMode="tel" />
      <input type="email" className="input" placeholder={t('lead.email')} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="email" />
      {!compact && (
        <div className="grid grid-cols-2 gap-3">
          <input className="input" placeholder={t('lead.city')} value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} />
          <input className="input" placeholder={t('lead.course')} value={f.course_interest} onChange={(e) => setF({ ...f, course_interest: e.target.value })} />
        </div>
      )}
      {!compact && <textarea rows={2} className="input" placeholder={t('lead.message')} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} />}
      {/* honeypot: bots fill this, people never see it */}
      <input tabIndex={-1} autoComplete="off" className="hidden" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} aria-hidden />
      {err && <p className="text-sm text-rose-600">{err}</p>}
      <button disabled={busy} className="btn-primary w-full">{busy ? t('lead.sending') : t('lead.submit')}</button>
      <p className="text-[11px] leading-snug text-slate-400">{t('lead.consent')}</p>
    </form>
  );
}
