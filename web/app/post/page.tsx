'use client';
import { SAFETY } from '@/lib/pgSafety';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Home, Briefcase, Upload, X, Loader2, CheckCircle2, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { supabaseBrowser } from '@/lib/supabase/client';
import CityInput from '@/components/CityInput';
import { API_URL } from '@/lib/api';

const CURRENCIES = ['INR', 'USD', 'GBP', 'EUR', 'CAD', 'AUD', 'AED', 'SGD', 'NZD'];
const AMENITIES = ['Food', 'Wi-Fi', 'AC', 'Laundry', 'Housekeeping', 'CCTV', 'Power backup', 'Gym', 'Study room', 'Transport', 'Parking', 'Attached washroom'];

type Kind = 'hostel' | 'job';

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return <div className={full ? 'sm:col-span-2' : ''}><label className="label">{label}</label>{children}</div>;
}

function PostForm() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const editId = params.get('edit');
  const supabase = supabaseBrowser();
  const [kind, setKind] = useState<Kind>(params.get('type') === 'job' ? 'job' : 'hostel');
  const [h, setH] = useState<any>({ type: 'PG', gender: 'Co-ed', currency: 'INR', rent_period: 'month', country: 'India', amenities: [] as string[], photos: [] as string[], safety: [] as string[] });
  const [j, setJ] = useState<any>({ job_type: 'Part-time', currency: 'INR', pay_unit: 'month', country: 'India', is_remote: false });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);
  const [company, setCompany] = useState<any>(null);
  const [geoMsg, setGeoMsg] = useState('');

  // Edit an existing listing of mine
  useEffect(() => {
    if (!editId || !user) return;
    const table = params.get('type') === 'job' ? 'jobs' : 'hostels';
    supabase.from(table).select('*').eq('id', editId).maybeSingle().then(({ data }: { data: any }) => {
      if (!data) return;
      if (table === 'jobs') { setKind('job'); setJ({ ...data, skills: (data.skills || []).join(', ') }); }
      else { setKind('hostel'); setH({ ...data, amenities: data.amenities || [], photos: data.photos || [], safety: data.safety || [] }); }
    });
  }, [editId, user, params, supabase]);

  useEffect(() => {
    if (!user) return;
    supabase.from('companies').select('id, name, logo_url, city, country').eq('owner_id', user.id).maybeSingle().then(({ data }: { data: any }) => {
      setCompany(data);
      if (data) setJ((p: any) => ({ ...p, company: p.company || data.name, company_logo: p.company_logo || data.logo_url, city: p.city || data.city || '', country: p.country || data.country || 'India' }));
    });
  }, [user, supabase]);

  const locate = async (address: string, city: string, country: string, apply: (lat: number, lng: number) => void) => {
    setGeoMsg('Finding on map…');
    try {
      const r = await fetch(`${API_URL}/api/geocode?q=${encodeURIComponent([address, city, country].filter(Boolean).join(', '))}`);
      const b = await r.json();
      if (b.data) { apply(b.data.latitude, b.data.longitude); setGeoMsg(`📍 Location found: ${b.data.display?.slice(0, 80) || ''}`); }
      else setGeoMsg('Could not find this address on the map — students will still see the city.');
    } catch { setGeoMsg('Map lookup failed — you can still submit.'); }
  };

  useEffect(() => {
    if (profile) {
      setH((p: any) => ({ ...p, contact_name: p.contact_name || profile.full_name || '', contact_phone: p.contact_phone || profile.phone || '', contact_email: p.contact_email || profile.email || '' }));
      setJ((p: any) => ({ ...p, contact_phone: p.contact_phone || profile.phone || '', contact_email: p.contact_email || profile.email || '' }));
    }
  }, [profile]);

  if (loading) return <div className="card h-96 animate-pulse" />;
  if (!user) {
    return (
      <div className="card mx-auto max-w-lg p-8 text-center">
        <ShieldCheck className="mx-auto text-brand-600" size={40} />
        <h1 className="mt-3 text-2xl font-bold text-slate-900">List your PG or job — free</h1>
        <p className="mt-2 text-slate-500">Create a free account with your email to post. Every listing is checked by our team before it goes live.</p>
        <Link href="/login?mode=register&next=/post" className="btn-primary mt-5">Register to post</Link>
        <Link href="/login?next=/post" className="btn-ghost ml-2 mt-5">Login</Link>
      </div>
    );
  }

  const uploadPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    const urls: string[] = [];
    for (const f of Array.from(files).slice(0, 8)) {
      if (!f.type.startsWith('image/') || f.size > 5 * 1024 * 1024) continue;
      const path = `user/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${f.name.split('.').pop()}`;
      const { error } = await supabase.storage.from('media').upload(path, f, { contentType: f.type });
      if (!error) urls.push(supabase.storage.from('media').getPublicUrl(path).data.publicUrl);
    }
    setH((p: any) => ({ ...p, photos: [...(p.photos || []), ...urls].slice(0, 12) }));
    setUploading(false);
  };

  const num = (v: any) => (v === '' || v === undefined || v === null ? null : Number(v));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const typedCity = String(new FormData(e.currentTarget as HTMLFormElement).get(kind === 'hostel' ? 'pg_city' : 'job_city') || '').trim();
    const cityValue = (kind === 'hostel' ? h.city : j.city) || typedCity;
    if (!cityValue) return setErr('Please choose the city.');
    if (kind === 'hostel') h.city = cityValue; else j.city = cityValue;
    setBusy(true); setErr('');
    let res;
    if (kind === 'hostel') {
      const row = {
        name: h.name, type: h.type, gender: h.gender, country: h.country, city: h.city, address: h.address || null,
        rent_min: num(h.rent_min), rent_max: num(h.rent_max), currency: h.currency, rent_period: h.rent_period,
        amenities: h.amenities, description: h.description || null, photos: h.photos,
        video_url: h.video_url || null, tour_url: h.tour_url || null, safety: h.safety || [], house_rules: h.house_rules || null,
        deposit_amount: num(h.deposit_amount), notice_days: num(h.notice_days), lock_in_months: num(h.lock_in_months),
        visit_slots: String(h.visit_slots_text ?? (h.visit_slots || []).join(', ')).split(',').map((x: string) => x.trim()).filter(Boolean),
        contact_name: h.contact_name || null, contact_phone: h.contact_phone || null, contact_email: h.contact_email || null,
        latitude: num(h.latitude), longitude: num(h.longitude), submitted_by: user.id,
      };
      res = h.id ? await supabase.from('hostels').update(row).eq('id', h.id) : await supabase.from('hostels').insert(row);
    } else {
      const row = {
        title: j.title, company: j.company, job_type: j.job_type, country: j.country, city: j.city, address: j.address || null,
        is_remote: !!j.is_remote, pay_min: num(j.pay_min), pay_max: num(j.pay_max), currency: j.currency, pay_unit: j.pay_unit,
        hours_per_week: num(j.hours_per_week), description: j.description || null, requirements: j.requirements || null,
        skills: String(j.skills || '').split(',').map((s: string) => s.trim()).filter(Boolean), deadline: j.deadline || null,
        contact_email: j.contact_email || null, contact_phone: j.contact_phone || null, created_by: user.id, status: j.status || 'open',
        company_id: company?.id || null, company_logo: j.company_logo || null, latitude: num(j.latitude), longitude: num(j.longitude),
      };
      res = j.id ? await supabase.from('jobs').update(row).eq('id', j.id) : await supabase.from('jobs').insert(row);
    }
    setBusy(false);
    if (res.error) return setErr(res.error.message);
    setDone(true);
  };

  if (done) {
    return (
      <div className="card mx-auto max-w-lg p-8 text-center">
        <CheckCircle2 className="mx-auto text-emerald-600" size={44} />
        <h1 className="mt-3 text-2xl font-bold text-slate-900">Submitted for review</h1>
        <p className="mt-2 text-slate-500">Our team checks every listing, usually within 24 hours. You can track it in your dashboard.</p>
        <div className="mt-5 flex justify-center gap-2">
          <button onClick={() => router.push(profile?.account_type === 'pg_owner' ? '/owner' : profile?.account_type === 'employer' ? '/employer' : '/dashboard?tab=listings')} className="btn-primary">{profile?.account_type === 'pg_owner' ? 'Add rooms & availability' : 'My listings'}</button>
          <button onClick={() => { setDone(false); setH({ type: 'PG', gender: 'Co-ed', currency: 'INR', rent_period: 'month', country: 'India', amenities: [], photos: [] }); setJ({ job_type: 'Part-time', currency: 'INR', pay_unit: 'month', country: 'India' }); }} className="btn-ghost">Post another</button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-extrabold text-slate-900">{editId ? 'Edit your listing' : 'Post a PG or a job — free'}</h1>
      <p className="mt-1 text-slate-500">Listings go live after a quick check by our team. Editing a live listing sends it for review again.</p>
      {!editId && (
        <div className="mt-6 grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1.5">
          <button onClick={() => setKind('hostel')} className={`flex items-center justify-center gap-2 rounded-xl py-3 font-semibold ${kind === 'hostel' ? 'bg-white text-brand-700 shadow' : 'text-slate-500'}`}><Home size={18} />PG / Hostel / Flat</button>
          <button onClick={() => setKind('job')} className={`flex items-center justify-center gap-2 rounded-xl py-3 font-semibold ${kind === 'job' ? 'bg-white text-brand-700 shadow' : 'text-slate-500'}`}><Briefcase size={18} />Part-time job</button>
        </div>
      )}

      <form onSubmit={submit} className="card mt-6 grid gap-4 p-6 sm:grid-cols-2">
        {kind === 'hostel' ? (
          <>
            <Field label="Name of PG / hostel *" full><input required className="input" value={h.name || ''} onChange={(e) => setH({ ...h, name: e.target.value })} /></Field>
            <Field label="Type"><select className="input" value={h.type} onChange={(e) => setH({ ...h, type: e.target.value })}>{['PG', 'Hostel', 'Flat', 'Homestay'].map((x) => <option key={x}>{x}</option>)}</select></Field>
            <Field label="For"><select className="input" value={h.gender} onChange={(e) => setH({ ...h, gender: e.target.value })}>{['Boys', 'Girls', 'Co-ed'].map((x) => <option key={x}>{x}</option>)}</select></Field>
            <Field label="City *"><CityInput name="pg_city" defaultValue={h.city || ''} onPick={(c) => setH((p: any) => ({ ...p, city: c.name, country: c.country || p.country, latitude: p.latitude ?? c.latitude, longitude: p.longitude ?? c.longitude }))} /></Field>
            <Field label="Country *"><input required className="input" value={h.country || ''} onChange={(e) => setH({ ...h, country: e.target.value })} /></Field>
            <Field label="Area / address" full>
              <div className="flex gap-2">
                <input className="input" value={h.address || ''} onChange={(e) => setH({ ...h, address: e.target.value })} placeholder="e.g. Near Gate 2, Kamla Nagar" />
                <button type="button" className="btn-ghost shrink-0" onClick={() => locate(h.address, h.city, h.country, (lat, lng) => setH((p: any) => ({ ...p, latitude: lat, longitude: lng })))}>Find on map</button>
              </div>
              {geoMsg && <p className="mt-1 text-xs text-slate-500">{geoMsg}</p>}
            </Field>
            <Field label="Rent from"><input type="number" className="input" value={h.rent_min ?? ''} onChange={(e) => setH({ ...h, rent_min: e.target.value })} /></Field>
            <Field label="Rent up to"><input type="number" className="input" value={h.rent_max ?? ''} onChange={(e) => setH({ ...h, rent_max: e.target.value })} /></Field>
            <Field label="Currency"><select className="input" value={h.currency} onChange={(e) => setH({ ...h, currency: e.target.value })}>{CURRENCIES.map((x) => <option key={x}>{x}</option>)}</select></Field>
            <Field label="Per"><select className="input" value={h.rent_period} onChange={(e) => setH({ ...h, rent_period: e.target.value })}>{['month', 'week', 'semester', 'year'].map((x) => <option key={x}>{x}</option>)}</select></Field>
            <Field label="Amenities" full>
              <div className="flex flex-wrap gap-2">
                {AMENITIES.map((a) => {
                  const on = h.amenities.includes(a);
                  return <button type="button" key={a} onClick={() => setH({ ...h, amenities: on ? h.amenities.filter((x: string) => x !== a) : [...h.amenities, a] })}
                    className={on ? 'chip-brand cursor-pointer py-1.5' : 'chip cursor-pointer py-1.5'}>{a}</button>;
                })}
              </div>
            </Field>
            <Field label="Description" full><textarea rows={4} className="input" value={h.description || ''} onChange={(e) => setH({ ...h, description: e.target.value })} placeholder="Rooms, sharing, food timings, rules, deposit…" /></Field>
            <Field label="Safety" full>
              <div className="flex flex-wrap gap-2">
                {SAFETY.map((a) => {
                  const on = (h.safety || []).includes(a.key);
                  return <button type="button" key={a.key} onClick={() => setH({ ...h, safety: on ? h.safety.filter((x: string) => x !== a.key) : [...(h.safety || []), a.key] })}
                    className={on ? 'chip-green cursor-pointer py-1.5' : 'chip cursor-pointer py-1.5'}>{a.label}</button>;
                })}
              </div>
            </Field>
            <Field label="Security deposit"><input type="number" className="input" value={h.deposit_amount ?? ''} onChange={(e) => setH({ ...h, deposit_amount: e.target.value })} /></Field>
            <Field label="Notice period (days)"><input type="number" className="input" value={h.notice_days ?? ''} onChange={(e) => setH({ ...h, notice_days: e.target.value })} /></Field>
            <Field label="Lock-in (months, 0 = none)"><input type="number" className="input" value={h.lock_in_months ?? ''} onChange={(e) => setH({ ...h, lock_in_months: e.target.value })} /></Field>
            <Field label="Visit times (comma separated)"><input className="input" value={h.visit_slots_text ?? (h.visit_slots || []).join(', ')} onChange={(e) => setH({ ...h, visit_slots_text: e.target.value })} placeholder="Weekdays 5–8 pm, Sunday 10 am–1 pm" /></Field>
            <Field label="Video tour link (YouTube / Vimeo)" full><input className="input" value={h.video_url || ''} onChange={(e) => setH({ ...h, video_url: e.target.value })} placeholder="https://youtu.be/…" /></Field>
            <Field label="360° tour link (optional)" full><input className="input" value={h.tour_url || ''} onChange={(e) => setH({ ...h, tour_url: e.target.value })} /></Field>
            <Field label="House rules" full><textarea rows={3} className="input" value={h.house_rules || ''} onChange={(e) => setH({ ...h, house_rules: e.target.value })} placeholder="Gate closing time, guests, cooking, smoking…" /></Field>
            <Field label="Photos (up to 12)" full>
              <div className="flex flex-wrap gap-2">
                {(h.photos || []).map((u: string, i: number) => (
                  <div key={u} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={u} alt="" className="h-20 w-28 rounded-lg object-cover" />
                    <button type="button" onClick={() => setH({ ...h, photos: h.photos.filter((_: string, k: number) => k !== i) })} className="absolute -right-2 -top-2 rounded-full bg-rose-600 p-1 text-white"><X size={12} /></button>
                  </div>
                ))}
                <label className="grid h-20 w-28 cursor-pointer place-items-center rounded-lg border-2 border-dashed border-slate-300 text-slate-400 hover:border-brand-400">
                  {uploading ? <Loader2 className="animate-spin" /> : <Upload />}
                  <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => uploadPhotos(e.target.files)} />
                </label>
              </div>
            </Field>
            <Field label="Contact name"><input className="input" value={h.contact_name || ''} onChange={(e) => setH({ ...h, contact_name: e.target.value })} /></Field>
            <Field label="Contact phone / WhatsApp *"><input required className="input" value={h.contact_phone || ''} onChange={(e) => setH({ ...h, contact_phone: e.target.value })} /></Field>
            <Field label="Contact email" full><input type="email" className="input" value={h.contact_email || ''} onChange={(e) => setH({ ...h, contact_email: e.target.value })} /></Field>
          </>
        ) : (
          <>
            <Field label="Job title *" full><input required className="input" value={j.title || ''} onChange={(e) => setJ({ ...j, title: e.target.value })} placeholder="e.g. Evening maths tutor" /></Field>
            <Field label="Company / employer *"><input required className="input" value={j.company || ''} onChange={(e) => setJ({ ...j, company: e.target.value })} /></Field>
            <Field label="Type"><select className="input" value={j.job_type} onChange={(e) => setJ({ ...j, job_type: e.target.value })}>{['Part-time', 'Internship', 'Weekend', 'Freelance', 'Full-time'].map((x) => <option key={x}>{x}</option>)}</select></Field>
            <Field label="City *"><CityInput name="job_city" defaultValue={j.city || ''} onPick={(c) => setJ((p: any) => ({ ...p, city: c.name, country: c.country || p.country, latitude: c.latitude, longitude: c.longitude }))} /></Field>
            <Field label="Country *"><input required className="input" value={j.country || ''} onChange={(e) => setJ({ ...j, country: e.target.value })} /></Field>
            <Field label="Area / address"><input className="input" value={j.address || ''} onChange={(e) => setJ({ ...j, address: e.target.value })} /></Field>
            <Field label="Remote job"><label className="flex h-[42px] items-center gap-2 text-sm"><input type="checkbox" checked={!!j.is_remote} onChange={(e) => setJ({ ...j, is_remote: e.target.checked })} className="h-4 w-4 accent-brand-600" />Work from home</label></Field>
            <Field label="Pay from"><input type="number" className="input" value={j.pay_min ?? ''} onChange={(e) => setJ({ ...j, pay_min: e.target.value })} /></Field>
            <Field label="Pay up to"><input type="number" className="input" value={j.pay_max ?? ''} onChange={(e) => setJ({ ...j, pay_max: e.target.value })} /></Field>
            <Field label="Currency"><select className="input" value={j.currency} onChange={(e) => setJ({ ...j, currency: e.target.value })}>{CURRENCIES.map((x) => <option key={x}>{x}</option>)}</select></Field>
            <Field label="Per"><select className="input" value={j.pay_unit} onChange={(e) => setJ({ ...j, pay_unit: e.target.value })}>{['hour', 'day', 'week', 'month', 'project'].map((x) => <option key={x}>{x}</option>)}</select></Field>
            <Field label="Hours per week"><input type="number" className="input" value={j.hours_per_week ?? ''} onChange={(e) => setJ({ ...j, hours_per_week: e.target.value })} /></Field>
            <Field label="Apply by"><input type="date" className="input" value={j.deadline || ''} onChange={(e) => setJ({ ...j, deadline: e.target.value })} /></Field>
            <Field label="Skills (comma separated)" full><input className="input" value={j.skills || ''} onChange={(e) => setJ({ ...j, skills: e.target.value })} /></Field>
            <Field label="Job description *" full><textarea required rows={4} className="input" value={j.description || ''} onChange={(e) => setJ({ ...j, description: e.target.value })} /></Field>
            <Field label="Requirements" full><textarea rows={3} className="input" value={j.requirements || ''} onChange={(e) => setJ({ ...j, requirements: e.target.value })} /></Field>
            <Field label="Contact phone"><input className="input" value={j.contact_phone || ''} onChange={(e) => setJ({ ...j, contact_phone: e.target.value })} /></Field>
            <Field label="Contact email"><input type="email" className="input" value={j.contact_email || ''} onChange={(e) => setJ({ ...j, contact_email: e.target.value })} /></Field>
            {j.id && <Field label="Status"><select className="input" value={j.status || 'open'} onChange={(e) => setJ({ ...j, status: e.target.value })}><option value="open">Open</option><option value="closed">Closed</option></select></Field>}
          </>
        )}
        {err && <p className="text-sm text-rose-600 sm:col-span-2">{err}</p>}
        <div className="sm:col-span-2">
          <button disabled={busy || uploading} className="btn-primary w-full sm:w-auto">{busy ? 'Submitting…' : editId ? 'Save & send for review' : 'Submit for review'}</button>
          <p className="mt-2 text-xs text-slate-400">By posting you confirm the details are true. Fake or misleading listings are removed and the account blocked.</p>
        </div>
      </form>
    </div>
  );
}

export default function PostPage() {
  return <div className="container-x py-10"><Suspense fallback={<div className="card h-96 animate-pulse" />}><PostForm /></Suspense></div>;
}
