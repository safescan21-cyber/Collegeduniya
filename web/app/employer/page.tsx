'use client';
import BoostButton from '@/components/BoostButton';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Building2, PlusCircle, Pencil, BadgeCheck, Users, Download, ExternalLink, Upload, Loader2, Save } from 'lucide-react';
import PortalGate from '@/components/PortalGate';
import CityInput from '@/components/CityInput';
import { useAuth } from '@/components/AuthProvider';
import { supabaseBrowser } from '@/lib/supabase/client';
import { timeAgo } from '@/lib/format';

const CHIP: Record<string, string> = { pending: 'chip-amber', shortlisted: 'chip-brand', hired: 'chip-green', rejected: 'chip-red' };
const slugify = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').slice(0, 60);

function EmployerPortal() {
  const { user, profile } = useAuth();
  const supabase = supabaseBrowser();
  const [company, setCompany] = useState<any>(null);
  const [form, setForm] = useState<any>({ name: '', website: '', industry: '', size: '1-10', about: '', address: '', city: '', country: '', contact_email: '', contact_phone: '', registration_no: '', logo_url: '' });
  const [editing, setEditing] = useState(false);
  const [jobs, setJobs] = useState<any[]>([]);
  const [apps, setApps] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    const [{ data: c }, { data: j }] = await Promise.all([
      supabase.from('companies').select('*').eq('owner_id', user.id).maybeSingle(),
      supabase.from('jobs').select('*').eq('created_by', user.id).order('created_at', { ascending: false }),
    ]);
    setCompany(c); setJobs(j || []);
    if (c) setForm({ ...c }); else { setEditing(true); setForm((f: any) => ({ ...f, contact_email: f.contact_email || user.email || '', contact_phone: f.contact_phone || profile?.phone || '' })); }
    const ids = (j || []).map((x: any) => x.id);
    if (ids.length) {
      const { data } = await supabase.from('job_applications').select('*, jobs(title)').in('job_id', ids).order('created_at', { ascending: false });
      setApps(data || []);
    } else setApps([]);
  }, [user, profile, supabase]);
  useEffect(() => { load(); }, [load]);

  const uploadLogo = async (f: File | undefined) => {
    if (!f || !user) return;
    setUploading(true);
    const path = `user/${user.id}/logo-${Date.now()}.${f.name.split('.').pop()}`;
    const { error } = await supabase.storage.from('media').upload(path, f, { contentType: f.type });
    if (!error) setForm((x: any) => ({ ...x, logo_url: supabase.storage.from('media').getPublicUrl(path).data.publicUrl }));
    setUploading(false);
  };

  const saveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true); setMsg('');
    const row = {
      name: form.name.trim(), website: form.website || null, industry: form.industry || null, size: form.size || null, about: form.about || null,
      address: form.address || null, city: form.city || null, country: form.country || null, contact_email: form.contact_email || null,
      contact_phone: form.contact_phone || null, registration_no: form.registration_no || null, logo_url: form.logo_url || null,
    };
    const res = company
      ? await supabase.from('companies').update(row).eq('id', company.id)
      : await supabase.from('companies').insert({ ...row, owner_id: user.id, slug: `${slugify(row.name)}-${Math.random().toString(36).slice(2, 6)}` });
    setBusy(false);
    if (res.error) return setMsg(res.error.message);
    setEditing(false); setMsg('Company profile saved ✓');
    load();
  };

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from('job_applications').update({ status }).eq('id', id);
    if (error) alert(error.message); else load();
  };
  const resume = async (path: string) => {
    const { data, error } = await supabase.storage.from('resumes').createSignedUrl(path, 300);
    if (error) alert(error.message); else window.open(data.signedUrl, '_blank');
  };
  const approval = (x: any) => x.approval_status === 'pending' ? <span className="chip-amber">Under review</span>
    : x.approval_status === 'rejected' ? <span className="chip-red">Rejected</span>
    : x.status === 'closed' ? <span className="chip">Closed</span> : x.is_published ? <span className="chip-green">Live</span> : <span className="chip">Hidden</span>;

  return (
    <div className="space-y-8">
      <div className="card flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          <span className="grid h-14 w-14 place-items-center overflow-hidden rounded-2xl bg-brand-600 text-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {company?.logo_url ? <img src={company.logo_url} alt="" className="h-full w-full object-cover" /> : <Building2 />}
          </span>
          <div>
            <h1 className="flex items-center gap-1 text-xl font-extrabold text-slate-900">{company?.name || 'Employer portal'}{company?.is_verified && <BadgeCheck size={18} className="text-emerald-600" />}</h1>
            <p className="text-sm text-slate-500">{company ? (company.is_verified ? 'Verified employer' : 'Verification pending — our team checks new companies') : 'Set up your company profile to start hiring'}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {company && <Link href={`/companies/${company.slug}`} className="btn-ghost"><ExternalLink size={16} />Public page</Link>}
          {company && <button onClick={() => setEditing(!editing)} className="btn-ghost"><Pencil size={16} />Edit profile</button>}
          {company && <Link href="/post?type=job" className="btn-primary"><PlusCircle size={16} />Post a job</Link>}
        </div>
      </div>
      {msg && <p className="text-sm text-emerald-700">{msg}</p>}

      {editing && (
        <form onSubmit={saveCompany} className="card grid gap-4 p-6 sm:grid-cols-2">
          <p className="font-bold text-slate-900 sm:col-span-2">{company ? 'Edit company profile' : 'Create your company profile'}</p>
          <div className="flex items-center gap-3 sm:col-span-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {form.logo_url && <img src={form.logo_url} alt="" className="h-14 w-14 rounded-xl object-cover" />}
            <label className="btn-ghost cursor-pointer">{uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}Logo<input type="file" accept="image/*" className="hidden" onChange={(e) => uploadLogo(e.target.files?.[0])} /></label>
          </div>
          <div className="sm:col-span-2"><label className="label">Company name *</label><input required className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><label className="label">Website</label><input className="input" value={form.website || ''} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://" /></div>
          <div><label className="label">Industry</label><input className="input" value={form.industry || ''} onChange={(e) => setForm({ ...form, industry: e.target.value })} placeholder="Education, Retail, IT…" /></div>
          <div><label className="label">Team size</label><select className="input" value={form.size || ''} onChange={(e) => setForm({ ...form, size: e.target.value })}>{['1-10', '11-50', '51-200', '201-1000', '1000+'].map((s) => <option key={s}>{s}</option>)}</select></div>
          <div><label className="label">Registration / GST no. (private)</label><input className="input" value={form.registration_no || ''} onChange={(e) => setForm({ ...form, registration_no: e.target.value })} /></div>
          <div><label className="label">City</label><CityInput name="company_city" defaultValue={form.city || ''} onPick={(c) => setForm((f: any) => ({ ...f, city: c.name, country: c.country || f.country }))} /></div>
          <div><label className="label">Country</label><input className="input" value={form.country || ''} onChange={(e) => setForm({ ...form, country: e.target.value })} /></div>
          <div className="sm:col-span-2"><label className="label">Address</label><input className="input" value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          <div><label className="label">Contact email</label><input type="email" className="input" value={form.contact_email || ''} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} /></div>
          <div><label className="label">Contact phone</label><input className="input" value={form.contact_phone || ''} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} /></div>
          <div className="sm:col-span-2"><label className="label">About the company</label><textarea rows={4} className="input" value={form.about || ''} onChange={(e) => setForm({ ...form, about: e.target.value })} /></div>
          <div className="sm:col-span-2"><button disabled={busy} className="btn-primary"><Save size={16} />{busy ? 'Saving…' : 'Save profile'}</button></div>
        </form>
      )}

      {company && (
        <section className="card divide-y divide-slate-100">
          <p className="px-5 py-3 font-bold text-slate-900">Your jobs ({jobs.length})</p>
          {jobs.map((j) => (
            <div key={j.id} className="flex flex-wrap items-center justify-between gap-2 p-5">
              <div><p className="font-semibold text-slate-900">{j.title}</p><p className="text-sm text-slate-500">{j.job_type} · {j.city} · {apps.filter((a) => a.job_id === j.id).length} applicants · {timeAgo(j.created_at)}</p></div>
              <div className="flex items-center gap-2">{approval(j)}
                {j.is_published && <Link href={`/jobs/${j.id}`} className="btn-ghost py-1.5">View</Link>}
                <BoostButton itemType="job" itemId={j.id} title={j.title} live={j.is_published && j.approval_status === 'approved'} />
                <Link href={`/post?type=job&edit=${j.id}`} className="btn-ghost py-1.5"><Pencil size={14} /></Link></div>
            </div>
          ))}
          {!jobs.length && <p className="p-5 text-sm text-slate-500">No jobs yet. <Link href="/post?type=job" className="font-semibold text-brand-700">Post your first job →</Link></p>}
        </section>
      )}

      {apps.length > 0 && (
        <section className="card overflow-x-auto">
          <p className="flex items-center gap-2 px-5 py-3 font-bold text-slate-900"><Users size={16} />Applicants ({apps.length})</p>
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-2">Applicant</th><th className="px-4 py-2">Job</th><th className="px-4 py-2">Message</th><th className="px-4 py-2">Status</th><th className="px-4 py-2">CV</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {apps.map((a) => (
                <tr key={a.id} className="align-top">
                  <td className="px-4 py-3"><p className="font-semibold">{a.full_name}</p><a href={`tel:${a.phone}`} className="block text-xs text-slate-600">{a.phone}</a><a href={`mailto:${a.email}`} className="text-xs text-brand-700">{a.email}</a></td>
                  <td className="px-4 py-3">{a.jobs?.title}<p className="text-xs text-slate-400">{timeAgo(a.created_at)}</p></td>
                  <td className="max-w-xs px-4 py-3 text-slate-600"><p className="line-clamp-3">{a.cover_letter || '—'}</p></td>
                  <td className="px-4 py-3"><select value={a.status} onChange={(e) => setStatus(a.id, e.target.value)} className={`${CHIP[a.status]} cursor-pointer border-0 capitalize`}>{['pending', 'shortlisted', 'hired', 'rejected'].map((s) => <option key={s} value={s}>{s}</option>)}</select></td>
                  <td className="px-4 py-3">{a.resume_path ? <button onClick={() => resume(a.resume_path)} className="btn-ghost px-2 py-1.5"><Download size={14} /></button> : '—'}{a.resume_snapshot && <a href={`/resume/view?app=${a.id}`} target="_blank" className="btn-ghost ms-1 px-2 py-1.5 text-xs">Resume</a>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

export default function EmployerPage() {
  return <div className="container-x py-10"><PortalGate type="employer"><EmployerPortal /></PortalGate></div>;
}
