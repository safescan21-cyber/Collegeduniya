'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { BedDouble, PlusCircle, Pencil, ExternalLink, PhoneCall, Star, ChevronDown, ChevronUp } from 'lucide-react';
import PortalGate from '@/components/PortalGate';
import RoomsManager from '@/components/RoomsManager';
import { Stars } from '@/components/Cards';
import { useAuth } from '@/components/AuthProvider';
import { supabaseBrowser } from '@/lib/supabase/client';
import { range, timeAgo } from '@/lib/format';
import BoostButton from '@/components/BoostButton';
import { CalendarCheck } from 'lucide-react';

function OwnerPortal() {
  const { user, profile } = useAuth();
  const supabase = supabaseBrowser();
  const [hostels, setHostels] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [visits, setVisits] = useState<any[]>([]);
  const [boosts, setBoosts] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('hostels').select('*, hostel_rooms(beds_available, beds_total)').eq('submitted_by', user.id).order('created_at', { ascending: false });
    const list = data || [];
    setHostels(list);
    if (list.length && !open) setOpen(list[0].id);
    const ids = list.map((h: any) => h.id);
    if (ids.length) {
      const [l, r, v, b] = await Promise.all([
        supabase.from('leads').select('*').in('hostel_id', ids).order('created_at', { ascending: false }).limit(50),
        supabase.from('hostel_reviews_public').select('*').in('hostel_id', ids).order('created_at', { ascending: false }).limit(20),
        supabase.from('hostel_visits').select('*').in('hostel_id', ids).gte('visit_date', new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10)).order('visit_date').limit(100),
        supabase.from('promotions').select('item_id, ends_at').eq('item_type', 'hostel').in('item_id', ids),
      ]);
      setLeads(l.data || []); setReviews(r.data || []); setVisits(v.data || []);
      setBoosts(Object.fromEntries((b.data || []).map((x: any) => [x.item_id, x.ends_at])));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, supabase]);
  useEffect(() => { load(); }, [load]);

  const status = (h: any) => h.approval_status === 'pending' ? <span className="chip-amber">Under review</span>
    : h.approval_status === 'rejected' ? <span className="chip-red">Rejected</span>
    : h.is_published ? <span className="chip-green">Live</span> : <span className="chip">Hidden</span>;
  const totalFree = hostels.reduce((n, h) => n + (h.hostel_rooms || []).reduce((m: number, r: any) => m + r.beds_available, 0), 0);

  return (
    <div className="space-y-8">
      <div className="card flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-600 text-white"><BedDouble /></span>
          <div><h1 className="text-xl font-extrabold text-slate-900">Owner portal</h1><p className="text-sm text-slate-500">{profile?.full_name} · {hostels.length} propert{hostels.length === 1 ? 'y' : 'ies'} · {totalFree} beds free</p></div>
        </div>
        <Link href="/post?type=hostel" className="btn-primary"><PlusCircle size={16} />Add a PG / hostel</Link>
      </div>

      <section className="space-y-4">
        {hostels.map((h) => (
          <div key={h.id} className="card">
            <button onClick={() => setOpen(open === h.id ? null : h.id)} className="flex w-full flex-wrap items-center justify-between gap-3 p-5 text-start">
              <div><p className="font-bold text-slate-900">{h.name}</p><p className="text-sm text-slate-500">{h.type} · {h.gender} · {h.city} · {range(h.rent_min, h.rent_max, h.currency)}</p></div>
              <div className="flex items-center gap-2">{status(h)}{open === h.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</div>
            </button>
            {open === h.id && (
              <div className="border-t border-slate-100 p-5">
                <div className="mb-4 flex flex-wrap gap-2">
                  <Link href={`/post?type=hostel&edit=${h.id}`} className="btn-ghost py-1.5"><Pencil size={14} />Edit details & photos</Link>
                  {h.is_published && <Link href={`/hostels/${h.id}`} className="btn-ghost py-1.5"><ExternalLink size={14} />View listing</Link>}
                  <BoostButton itemType="hostel" itemId={h.id} title={h.name} live={h.is_published && h.approval_status === 'approved'} boostedUntil={boosts[h.id]} />
                  {h.is_verified ? <span className="chip-green">Verified</span> : <span className="chip" title="Our team verifies PGs after a visit — request it from the counselling page">Not verified yet</span>}
                </div>
                {h.approval_status === 'pending' && <p className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Our team is checking this listing. You can already add rooms — they show once it’s live.</p>}
                <RoomsManager hostelId={h.id} currency={h.currency || 'INR'} />
              </div>
            )}
          </div>
        ))}
        {!hostels.length && <div className="card p-10 text-center text-slate-500">No properties yet. <Link href="/post?type=hostel" className="font-semibold text-brand-700">Add your first PG →</Link></div>}
      </section>

      <section className="card p-5">
        <h2 className="flex items-center gap-2 font-bold text-slate-900"><CalendarCheck size={16} />Visit requests ({visits.filter((v) => v.status === 'requested').length} new)</h2>
        <ul className="mt-3 divide-y divide-slate-100">
          {visits.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
              <div>
                <p className="font-semibold text-slate-900">{v.name} · {new Date(v.visit_date).toLocaleDateString()} {v.slot ? `· ${v.slot}` : ''} {v.mode === 'video_call' && <span className="chip">Video call</span>}</p>
                <p className="flex flex-wrap gap-3"><a href={`tel:${v.phone}`} className="text-brand-700">{v.phone}</a><a href={`https://wa.me/${String(v.phone).replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="text-emerald-700">WhatsApp</a></p>
                {v.note && <p className="text-slate-600">{v.note}</p>}
                <p className="text-xs text-slate-400">{hostels.find((h) => h.id === v.hostel_id)?.name}</p>
              </div>
              <select value={v.status} onChange={async (e) => { const note = e.target.value === 'confirmed' ? prompt('Message for the student (optional)', v.owner_note || '') : v.owner_note;
                  await supabase.from('hostel_visits').update({ status: e.target.value, owner_note: note ?? v.owner_note }).eq('id', v.id); load(); }}
                className="input w-auto py-1.5 capitalize">
                {['requested', 'confirmed', 'done', 'no_show', 'cancelled'].map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
            </li>
          ))}
          {!visits.length && <li className="py-3 text-sm text-slate-400">No visit requests yet. Add visit times in your listing so students can book.</li>}
        </ul>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="flex items-center gap-2 font-bold text-slate-900"><PhoneCall size={16} />Enquiries ({leads.length})</h2>
          <ul className="mt-3 divide-y divide-slate-100">
            {leads.map((l) => (
              <li key={l.id} className="py-3 text-sm">
                <p className="font-semibold text-slate-900">{l.full_name} <span className="font-normal text-slate-400">· {timeAgo(l.created_at)}</span></p>
                <p className="flex flex-wrap gap-3"><a href={`tel:${l.phone}`} className="text-brand-700">{l.phone}</a><a href={`https://wa.me/${String(l.phone).replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="text-emerald-700">WhatsApp</a>{l.email && <a href={`mailto:${l.email}`} className="text-brand-700">{l.email}</a>}</p>
                {l.message && <p className="mt-1 text-slate-600">{l.message}</p>}
                <p className="text-xs text-slate-400">{hostels.find((h) => h.id === l.hostel_id)?.name}</p>
              </li>
            ))}
            {!leads.length && <li className="py-3 text-sm text-slate-400">No enquiries yet.</li>}
          </ul>
        </div>
        <div className="card p-5">
          <h2 className="flex items-center gap-2 font-bold text-slate-900"><Star size={16} />Latest reviews</h2>
          <ul className="mt-3 divide-y divide-slate-100">
            {reviews.map((r) => (
              <li key={r.id} className="py-3 text-sm"><div className="flex items-center justify-between"><span className="font-semibold">{r.reviewer_name}</span><Stars value={r.rating} /></div>
                <p className="mt-1 line-clamp-3 text-slate-600">{r.body}</p><p className="text-xs text-slate-400">{hostels.find((h) => h.id === r.hostel_id)?.name}</p></li>
            ))}
            {!reviews.length && <li className="py-3 text-sm text-slate-400">No reviews yet.</li>}
          </ul>
        </div>
      </section>
    </div>
  );
}

export default function OwnerPage() {
  return <div className="container-x py-10"><PortalGate type="pg_owner"><OwnerPortal /></PortalGate></div>;
}
