'use client';
import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Briefcase, Star, User, Save, Trash2, Heart, FilePlus2, Building, Users, Download, Pencil, PlusCircle, GraduationCap, Home, BellRing, FileText, Gift, Bell, MessageCircle, ClipboardCheck,
} from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { JobAlertManager } from '@/components/JobAlerts';
import { NotificationList } from '@/components/Notifications';
import { PublicProfileSettings, EducationEditor, LoginHistory, MockHistory } from '@/components/ProfileExtras';
import CampusSettings from '@/components/campus/CampusSettings';
import MyExams from '@/components/exams/MyExams';
import DeleteAccount from '@/components/DeleteAccount';
import { Stars } from '@/components/Cards';
import { supabaseBrowser } from '@/lib/supabase/client';
import { range, timeAgo } from '@/lib/format';

const STATUS_CHIP: Record<string, string> = {
  pending: 'chip-amber', shortlisted: 'chip-brand', hired: 'chip-green', rejected: 'chip-red', approved: 'chip-green', blocked: 'chip-red',
  submitted: 'chip-amber', under_review: 'chip-brand', forwarded: 'chip-brand', accepted: 'chip-green', withdrawn: 'chip',
};

const QUOTA_CHIP: Record<string, string> = { submitted: 'chip', under_review: 'chip-amber', contacted: 'chip-amber', shortlisted: 'chip-green', offered: 'chip-green', admitted: 'chip-green', rejected: 'chip-red', withdrawn: 'chip' };
type Tab = 'exams' | 'mocks' | 'notifications' | 'alerts' | 'visits' | 'applications' | 'colleges' | 'saved' | 'listings' | 'reviews' | 'profile';

function Dashboard() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const params = useSearchParams();
  const supabase = supabaseBrowser();
  const [tab, setTab] = useState<Tab>((params.get('tab') as Tab) || 'applications');
  const [apps, setApps] = useState<any[]>([]);
  const [capps, setCapps] = useState<any[]>([]);
  const [qapps, setQapps] = useState<any[]>([]);
  const [visits, setVisits] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [saved, setSaved] = useState<{ colleges: any[]; hostels: any[]; jobs: any[] }>({ colleges: [], hostels: [], jobs: [] });
  const [myHostels, setMyHostels] = useState<any[]>([]);
  const [myJobs, setMyJobs] = useState<any[]>([]);
  const [applicants, setApplicants] = useState<any[]>([]);
  const [form, setForm] = useState({ full_name: '', phone: '', city: '', country: '', course_interest: '', whatsapp: '', whatsapp_opt_in: false });
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    const [a, ca, r, s, mh, mj, qa] = await Promise.all([
      supabase.from('job_applications').select('*, jobs(id, title, company, city)').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('college_applications').select('*, colleges(name, slug, city)').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('reviews').select('id, college_id, rating, title, body, status, is_verified, reward_status, created_at, colleges(name, slug)').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('saved_items').select('item_type, item_id').eq('user_id', user.id),
      supabase.from('hostels').select('*').eq('submitted_by', user.id).order('created_at', { ascending: false }),
      supabase.from('jobs').select('*').eq('created_by', user.id).order('created_at', { ascending: false }),
      supabase.from('quota_applications').select('*, quota_seats(course, quota_type, academic_year), colleges(name, slug, city)').eq('user_id', user.id).order('created_at', { ascending: false }),
    ]);
    setQapps(qa.data || []);
    const { data: vs } = await supabase.from('hostel_visits').select('*, hostels(name, city)').eq('user_id', user.id).order('visit_date', { ascending: false }).limit(50);
    setVisits(vs || []);
    setApps(a.data || []); setCapps(ca.data || []); setReviews(r.data || []);
    setMyHostels(mh.data || []); setMyJobs(mj.data || []);
    const ids = (t: string) => (s.data || []).filter((x: any) => x.item_type === t).map((x: any) => x.item_id);
    const [sc, sh, sj] = await Promise.all([
      ids('college').length ? supabase.from('colleges_public').select('id, slug, name, city, country, fees_min, fees_max, currency').in('id', ids('college')) : { data: [] },
      ids('hostel').length ? supabase.from('hostels').select('id, name, type, city, rent_min, rent_max, currency').in('id', ids('hostel')) : { data: [] },
      ids('job').length ? supabase.from('jobs').select('id, title, company, city, pay_min, pay_max, currency, pay_unit').in('id', ids('job')) : { data: [] },
    ]);
    setSaved({ colleges: sc.data || [], hostels: sh.data || [], jobs: sj.data || [] });
    const jobIds = (mj.data || []).map((x: any) => x.id);
    if (jobIds.length) {
      const { data } = await supabase.from('job_applications').select('*, jobs(title)').in('job_id', jobIds).order('created_at', { ascending: false });
      setApplicants(data || []);
    } else setApplicants([]);
  }, [user, supabase]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (profile) setForm({ full_name: profile.full_name || '', phone: profile.phone || '', city: profile.city || '', country: profile.country || '', course_interest: profile.course_interest || '', whatsapp: profile.whatsapp || '', whatsapp_opt_in: !!profile.whatsapp_opt_in });
  }, [profile]);

  if (loading) return <div className="card h-64 animate-pulse" />;
  if (!user) return <div className="py-20 text-center"><Link href="/login?next=/dashboard" className="btn-primary">Login to continue</Link></div>;

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3000); };
  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const wa = form.whatsapp.trim();
    if (form.whatsapp_opt_in && !/^\+\d[\d\s-]{7,16}$/.test(wa || form.phone.trim())) return flash('Add your WhatsApp number with country code, e.g. +91 98765 43210');
    const { error } = await supabase.from('profiles').update({ ...form, whatsapp: wa || null }).eq('id', user.id);
    flash(error ? error.message : 'Profile saved ✓');
    refreshProfile();
  };
  const withdraw = async (id: string) => {
    if (!confirm('Withdraw this application?')) return;
    const { error } = await supabase.from('job_applications').delete().eq('id', id);
    if (!error) setApps((a) => a.filter((x) => x.id !== id));
  };
  const withdrawCollege = async (id: string) => {
    if (!confirm('Withdraw this college application?')) return;
    await supabase.from('college_applications').update({ status: 'withdrawn' }).eq('id', id);
    load();
  };
  const withdrawQuota = async (id: string) => {
    if (!confirm('Withdraw this management quota application?')) return;
    await supabase.from('quota_applications').update({ status: 'withdrawn' }).eq('id', id);
    load();
  };
  const unsave = async (type: string, id: string) => {
    await supabase.from('saved_items').delete().eq('user_id', user.id).eq('item_type', type).eq('item_id', id);
    load();
  };
  const deleteListing = async (table: 'hostels' | 'jobs', id: string) => {
    if (!confirm('Delete this listing?')) return;
    await supabase.from(table).delete().eq('id', id);
    load();
  };
  const setApplicantStatus = async (id: string, status: string) => {
    const { error } = await supabase.from('job_applications').update({ status }).eq('id', id);
    if (error) alert(error.message); else load();
  };
  const resume = async (path: string) => {
    const { data, error } = await supabase.storage.from('resumes').createSignedUrl(path, 300);
    if (error) alert(error.message); else window.open(data.signedUrl, '_blank');
  };

  const savedCount = saved.colleges.length + saved.hostels.length + saved.jobs.length;
  const TABS: { key: Tab; label: string; icon: any; n?: number }[] = [
    { key: 'applications', label: 'Job applications', icon: Briefcase, n: apps.length },
    { key: 'colleges', label: 'College applications', icon: FilePlus2, n: capps.length + qapps.length },
    { key: 'exams', label: 'My exams', icon: BellRing },
    { key: 'mocks', label: 'Mock tests', icon: ClipboardCheck },
    { key: 'notifications', label: 'Notifications', icon: Bell },
    { key: 'alerts', label: 'Job alerts', icon: BellRing },
    { key: 'visits', label: 'PG visits', icon: Home, n: visits.length },
    { key: 'saved', label: 'Shortlist', icon: Heart, n: savedCount },
    { key: 'listings', label: 'My listings', icon: Building, n: myHostels.length + myJobs.length },
    { key: 'reviews', label: 'My reviews', icon: Star, n: reviews.length },
    { key: 'profile', label: 'Profile', icon: User },
  ];
  const approval = (x: any) => x.approval_status === 'pending' ? <span className="chip-amber">Under review</span>
    : x.approval_status === 'rejected' ? <span className="chip-red">Rejected</span>
    : x.is_published ? <span className="chip-green">Live</span> : <span className="chip">Hidden</span>;

  return (
    <>
      <div className="card flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-brand-600 text-xl font-bold text-white">{(profile?.full_name || user.email || '?')[0].toUpperCase()}</span>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900">Hi, {profile?.full_name || 'Student'} 👋</h1>
            <p className="text-sm text-slate-500">{user.email}</p>
          </div>
        </div>
        {profile?.is_blocked && <span className="chip-red">Your account is restricted — contact support</span>}
        <div className="flex flex-wrap gap-2"><Link href="/messages" className="btn-ghost">Messages</Link><Link href="/resume" className="btn-ghost"><FileText size={16} />Resume</Link><Link href="/rewards" className="btn-ghost"><Gift size={16} />Rewards</Link><Link href="/jobs" className="btn-primary">Find jobs</Link><Link href="/post" className="btn-ghost"><PlusCircle size={16} />Post PG / Job</Link></div>
      </div>

      <div className="mt-6 flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`${tab === t.key ? 'btn-primary' : 'btn-ghost'} whitespace-nowrap`}>
            <t.icon size={16} />{t.label}{t.n !== undefined ? ` (${t.n})` : ''}
          </button>
        ))}
      </div>
      {profile?.account_type === 'pg_owner' && <Link href="/owner" className="mt-4 block rounded-2xl bg-brand-50 p-4 font-semibold text-brand-800 hover:bg-brand-100">🏠 Manage your PGs, rooms and enquiries in the Owner portal →</Link>}
      {profile?.account_type === 'employer' && <Link href="/employer" className="mt-4 block rounded-2xl bg-brand-50 p-4 font-semibold text-brand-800 hover:bg-brand-100">🏢 Manage your company, jobs and applicants in the Employer portal →</Link>}
      {msg && <p className="mt-3 text-sm text-emerald-700">{msg}</p>}

      <div className="mt-6">
        {tab === 'applications' && (apps.length ? (
          <div className="card divide-y divide-slate-100">
            {apps.map((a) => (
              <div key={a.id} className="flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <Link href={`/jobs/${a.jobs?.id}`} className="font-semibold text-slate-900 hover:text-brand-700">{a.jobs?.title || 'Job removed'}</Link>
                  <p className="text-sm text-slate-500">{a.jobs?.company} · {a.jobs?.city} · applied {timeAgo(a.created_at)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`${STATUS_CHIP[a.status] || 'chip'} capitalize`}>{a.status}</span>
                  {a.status === 'pending' && <button onClick={() => withdraw(a.id)} className="btn-ghost py-1.5 text-rose-600" aria-label="Withdraw"><Trash2 size={14} /></button>}
                </div>
              </div>
            ))}
          </div>
        ) : <Empty text="No job applications yet." href="/jobs" cta="Browse part-time jobs" />)}

        {tab === 'colleges' && (capps.length || qapps.length ? (
          <div className="space-y-5">
            {!!qapps.length && (
              <div className="card divide-y divide-slate-100">
                <p className="px-5 py-3 text-sm font-bold text-slate-900">Management quota</p>
                {qapps.map((a) => (
                  <div key={a.id} className="flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <Link href={`/management-quota/${a.seat_id}`} className="font-semibold text-slate-900 hover:text-brand-700">{a.quota_seats?.course || 'Seat'} · {a.colleges?.name}</Link>
                      <p className="text-sm text-slate-500">{a.quota_seats?.quota_type} quota{a.quota_seats?.academic_year ? ` · ${a.quota_seats.academic_year}` : ''} · applied {timeAgo(a.created_at)}{a.documents?.length ? ` · ${a.documents.length} document${a.documents.length > 1 ? 's' : ''}` : ''}</p>
                      {a.admin_note && <p className="mt-1 text-sm text-brand-700">Note from us: {a.admin_note}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`${QUOTA_CHIP[a.status] || 'chip'} capitalize`}>{a.status.replace('_', ' ')}</span>
                      {['submitted', 'under_review', 'contacted'].includes(a.status) && <button onClick={() => withdrawQuota(a.id)} className="btn-ghost py-1.5 text-rose-600">Withdraw</button>}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!!capps.length && (
<div className="card divide-y divide-slate-100">
            {capps.map((a) => (
              <div key={a.id} className="flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <Link href={`/colleges/${a.colleges?.slug}`} className="font-semibold text-slate-900 hover:text-brand-700">{a.colleges?.name}</Link>
                  <p className="text-sm text-slate-500">{a.course} · applied {timeAgo(a.created_at)}</p>
                  {a.admin_note && <p className="mt-1 text-sm text-brand-700">Note from us: {a.admin_note}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`${STATUS_CHIP[a.status] || 'chip'} capitalize`}>{a.status.replace('_', ' ')}</span>
                  {['submitted', 'under_review'].includes(a.status) && <button onClick={() => withdrawCollege(a.id)} className="btn-ghost py-1.5 text-rose-600">Withdraw</button>}
                </div>
              </div>
            ))}
          </div>
            )}
          </div>
        ) : <Empty text="You haven't applied to any college through Collegeolo yet." href="/management-quota" cta="See management quota seats" />)}

        {tab === 'exams' && <MyExams />}
        {tab === 'mocks' && <MockHistory />}
        {tab === 'notifications' && <NotificationList />}
        {tab === 'alerts' && <JobAlertManager />}
        {tab === 'visits' && (visits.length ? (
          <div className="card divide-y divide-slate-100">
            {visits.map((v) => (
              <div key={v.id} className="flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <Link href={`/hostels/${v.hostel_id}`} className="font-semibold text-slate-900 hover:text-brand-700">{v.hostels?.name}, {v.hostels?.city}</Link>
                  <p className="text-sm text-slate-500">{new Date(v.visit_date).toLocaleDateString()} {v.slot ? `· ${v.slot}` : ''} · {v.mode === 'video_call' ? 'Video call' : 'In person'}</p>
                  {v.owner_note && <p className="mt-1 text-sm text-brand-700">Owner: {v.owner_note}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`${v.status === 'confirmed' ? 'chip-green' : v.status === 'cancelled' || v.status === 'no_show' ? 'chip-red' : 'chip'} capitalize`}>{v.status.replace('_', ' ')}</span>
                  {['requested', 'confirmed'].includes(v.status) && <button onClick={async () => { if (confirm('Cancel this visit?')) { await supabase.from('hostel_visits').update({ status: 'cancelled' }).eq('id', v.id); load(); } }} className="btn-ghost py-1.5 text-rose-600">Cancel</button>}
                </div>
              </div>
            ))}
          </div>
        ) : <Empty text="Book a visit from any PG page to see the room before you pay." href="/hostels" cta="Find a PG" />)}

        {tab === 'saved' && (savedCount ? (
          <div className="grid gap-6 lg:grid-cols-3">
            <SavedCol title="Colleges" icon={GraduationCap} items={saved.colleges.map((c) => ({ id: c.id, href: `/colleges/${c.slug}`, title: c.name, sub: `${c.city} · ${range(c.fees_min, c.fees_max, c.currency)}` }))} onRemove={(id) => unsave('college', id)} />
            <SavedCol title="PG & Hostels" icon={Home} items={saved.hostels.map((h) => ({ id: h.id, href: `/hostels/${h.id}`, title: h.name, sub: `${h.type} · ${h.city} · ${range(h.rent_min, h.rent_max, h.currency)}` }))} onRemove={(id) => unsave('hostel', id)} />
            <SavedCol title="Jobs" icon={Briefcase} items={saved.jobs.map((j) => ({ id: j.id, href: `/jobs/${j.id}`, title: j.title, sub: `${j.company} · ${j.city}` }))} onRemove={(id) => unsave('job', id)} />
            {saved.colleges.length >= 2 && (
              <Link href={`/compare?c=${saved.colleges.slice(0, 4).map((c) => c.slug).join(',')}`} className="btn-primary lg:col-span-3">Compare my saved colleges</Link>
            )}
          </div>
        ) : <Empty text="Tap the ♥ on any college, PG or job to save it here." href="/colleges" cta="Explore colleges" />)}

        {tab === 'listings' && (
          <div className="space-y-6">
            <div className="flex justify-end"><Link href="/post" className="btn-primary"><PlusCircle size={16} />New listing</Link></div>
            <div className="card divide-y divide-slate-100">
              <p className="px-5 py-3 text-sm font-semibold text-slate-500">My PG / hostels ({myHostels.length})</p>
              {myHostels.map((h) => (
                <div key={h.id} className="flex flex-wrap items-center justify-between gap-2 p-5">
                  <div><p className="font-semibold text-slate-900">{h.name}</p><p className="text-sm text-slate-500">{h.type} · {h.city} · {range(h.rent_min, h.rent_max, h.currency)}</p></div>
                  <div className="flex items-center gap-2">{approval(h)}
                    {h.is_published && <Link href={`/hostels/${h.id}`} className="btn-ghost py-1.5">View</Link>}
                    <Link href={`/post?type=hostel&edit=${h.id}`} className="btn-ghost py-1.5"><Pencil size={14} /></Link>
                    <button onClick={() => deleteListing('hostels', h.id)} className="btn-ghost py-1.5 text-rose-600"><Trash2 size={14} /></button></div>
                </div>
              ))}
            </div>
            <div className="card divide-y divide-slate-100">
              <p className="px-5 py-3 text-sm font-semibold text-slate-500">My jobs ({myJobs.length})</p>
              {myJobs.map((j) => (
                <div key={j.id} className="flex flex-wrap items-center justify-between gap-2 p-5">
                  <div><p className="font-semibold text-slate-900">{j.title}</p><p className="text-sm text-slate-500">{j.company} · {j.city} · {applicants.filter((a) => a.job_id === j.id).length} applicants{j.status === 'closed' ? ' · closed' : ''}</p></div>
                  <div className="flex items-center gap-2">{approval(j)}
                    {j.is_published && <Link href={`/jobs/${j.id}`} className="btn-ghost py-1.5">View</Link>}
                    <Link href={`/post?type=job&edit=${j.id}`} className="btn-ghost py-1.5"><Pencil size={14} /></Link>
                    <button onClick={() => deleteListing('jobs', j.id)} className="btn-ghost py-1.5 text-rose-600"><Trash2 size={14} /></button></div>
                </div>
              ))}
            </div>
            {applicants.length > 0 && (
              <div className="card overflow-x-auto">
                <p className="flex items-center gap-2 px-5 py-3 font-semibold text-slate-900"><Users size={16} />Applicants to my jobs</p>
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-2">Applicant</th><th className="px-4 py-2">Job</th><th className="px-4 py-2">Message</th><th className="px-4 py-2">Status</th><th className="px-4 py-2">CV</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {applicants.map((a) => (
                      <tr key={a.id} className="align-top">
                        <td className="px-4 py-3"><p className="font-semibold">{a.full_name}</p><a href={`tel:${a.phone}`} className="text-xs text-slate-600">{a.phone}</a><p className="text-xs text-brand-700">{a.email}</p></td>
                        <td className="px-4 py-3">{a.jobs?.title}<p className="text-xs text-slate-400">{timeAgo(a.created_at)}</p></td>
                        <td className="max-w-xs px-4 py-3 text-slate-600"><p className="line-clamp-3">{a.cover_letter || '—'}</p></td>
                        <td className="px-4 py-3">
                          <select value={a.status} onChange={(e) => setApplicantStatus(a.id, e.target.value)} className={`${STATUS_CHIP[a.status]} cursor-pointer border-0 capitalize`}>
                            {['pending', 'shortlisted', 'hired', 'rejected'].map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </td>
                        <td className="px-4 py-3">{a.resume_path ? <button onClick={() => resume(a.resume_path)} className="btn-ghost px-2 py-1.5"><Download size={14} /></button> : '—'}{a.resume_snapshot && <a href={`/resume/view?app=${a.id}`} target="_blank" className="btn-ghost ms-1 px-2 py-1.5 text-xs">Resume</a>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === 'reviews' && (reviews.length ? (
          <div className="space-y-4">
            {reviews.map((r) => (
              <div key={r.id} className="card p-5">
                <div className="flex items-start justify-between">
                  <Link href={`/colleges/${r.colleges?.slug}#reviews`} className="font-semibold text-slate-900 hover:text-brand-700">{r.colleges?.name}</Link>
                  <span className="flex gap-1"><span className={`${STATUS_CHIP[r.status] || 'chip'} capitalize`}>{r.status}</span>{r.is_verified && <span className="chip-green">Verified</span>}{r.reward_status !== 'none' && <span className="chip-amber capitalize">Reward {r.reward_status}</span>}</span>
                </div>
                <Stars value={r.rating} />
                <p className="mt-1 font-medium">{r.title}</p>
                <p className="mt-1 line-clamp-2 text-sm text-slate-600">{r.body}</p>
              </div>
            ))}
          </div>
        ) : <Empty text="You have not reviewed any college yet." href="/colleges" cta="Find your college" />)}

        {tab === 'profile' && (
          <div className="grid items-start gap-6 lg:grid-cols-2">
          <div className="space-y-6">
          <form onSubmit={saveProfile} className="card grid gap-4 p-6 sm:grid-cols-2">
            <div className="sm:col-span-2"><label className="label">Full name</label><input className="input" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
            <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><label className="label">Course interested in</label><input className="input" value={form.course_interest} onChange={(e) => setForm({ ...form, course_interest: e.target.value })} placeholder="e.g. MBA" /></div>
            <div><label className="label">City</label><input className="input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
            <div><label className="label">Country</label><input className="input" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /></div>
            <div className="rounded-xl bg-emerald-50 p-4 sm:col-span-2">
              <p className="flex items-center gap-2 font-semibold text-slate-900"><MessageCircle size={16} className="text-emerald-600" />WhatsApp updates</p>
              <p className="mt-1 text-xs text-slate-600">Application status, PG visit and message alerts on WhatsApp instead of email. You can switch this off any time.</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div><label className="label">WhatsApp number</label><input className="input" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder={form.phone || '+91 98765 43210'} /></div>
                <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-emerald-600" checked={form.whatsapp_opt_in} onChange={(e) => setForm({ ...form, whatsapp_opt_in: e.target.checked })} />Send me updates on WhatsApp</label>
              </div>
            </div>
            <div className="sm:col-span-2"><button className="btn-primary"><Save size={16} />Save profile</button></div>
          </form>
          <LoginHistory />
          <DeleteAccount />
          </div>
          <div className="space-y-6"><CampusSettings /><PublicProfileSettings /><EducationEditor /></div>
          </div>
        )}
      </div>
    </>
  );
}

function Empty({ text, href, cta }: { text: string; href: string; cta: string }) {
  return <div className="card p-10 text-center text-slate-500">{text} <Link href={href} className="font-semibold text-brand-700">{cta} →</Link></div>;
}

function SavedCol({ title, icon: Icon, items, onRemove }: { title: string; icon: any; items: { id: string; href: string; title: string; sub: string }[]; onRemove: (id: string) => void }) {
  return (
    <div className="card p-4">
      <p className="mb-2 flex items-center gap-2 font-semibold text-slate-900"><Icon size={16} />{title} ({items.length})</p>
      {items.length === 0 ? <p className="text-sm text-slate-400">Nothing saved.</p> : (
        <ul className="divide-y divide-slate-100">
          {items.map((i) => (
            <li key={i.id} className="flex items-start justify-between gap-2 py-2">
              <Link href={i.href} className="min-w-0"><p className="truncate font-medium text-slate-800 hover:text-brand-700">{i.title}</p><p className="truncate text-xs text-slate-500">{i.sub}</p></Link>
              <button onClick={() => onRemove(i.id)} aria-label="Remove"><Heart size={16} className="fill-rose-500 text-rose-500" /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return <div className="container-x py-10"><Suspense fallback={<div className="card h-64 animate-pulse" />}><Dashboard /></Suspense></div>;
}
