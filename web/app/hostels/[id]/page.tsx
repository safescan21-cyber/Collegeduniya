import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MapPin, Phone, Mail, BadgeCheck, CheckCircle2, User, GraduationCap } from 'lucide-react';
import Gallery from '@/components/Gallery';
import { HostelCard, Stars } from '@/components/Cards';
import HostelReviews from '@/components/HostelReviews';
import { LiveNearby } from '@/components/LiveData';
import TranslateText from '@/components/TranslateText';
import { money } from '@/lib/format';
import EnquiryForm from '@/components/EnquiryForm';
import { SaveButton, ShareButtons } from '@/components/ActionButtons';
import { supabasePublic, hasSupabase } from '@/lib/supabase/server';
import { FALLBACK_IMG, range } from '@/lib/format';
import type { Hostel } from '@/lib/types';

export const dynamic = 'force-dynamic';

async function getHostel(id: string) {
  if (!hasSupabase || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await supabasePublic().from('hostels').select('*, colleges(name, slug)').eq('id', id).eq('is_published', true).maybeSingle();
  return data as Hostel | null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const h = await getHostel((await params).id);
  if (!h) return { title: 'Stay not found' };
  return {
    title: `${h.name} — ${h.type} for ${h.gender} in ${h.city}`,
    description: (h.description || `${h.type} in ${h.city} with ${(h.amenities || []).join(', ')}.`).slice(0, 160),
  };
}

export default async function HostelPage({ params }: { params: Promise<{ id: string }> }) {
  const h = await getHostel((await params).id);
  if (!h) notFound();
  const sb = supabasePublic();
  const [{ data: more }, { data: reviews }, { data: rating }, { data: rooms }] = await Promise.all([
    sb.from('hostels').select('*').eq('is_published', true).eq('city', h.city).neq('id', h.id).limit(3),
    sb.from('hostel_reviews_public').select('*').eq('hostel_id', h.id).order('created_at', { ascending: false }).limit(30),
    sb.from('hostel_ratings').select('*').eq('hostel_id', h.id).maybeSingle(),
    sb.from('hostel_rooms').select('*').eq('hostel_id', h.id).order('rent', { ascending: true, nullsFirst: false }),
  ]);
  const roomList = (rooms || []) as any[];
  const bedsFree = roomList.reduce((n, r) => n + (r.beds_available || 0), 0);
  const roomsUpdated = roomList.reduce((m, r) => (r.updated_at > m ? r.updated_at : m), '');
  const avg = rating?.avg_rating ? Number(rating.avg_rating) : 0;
  const photos = h.photos?.length ? h.photos : [FALLBACK_IMG];

  return (
    <div className="container-x py-10">
      <nav className="mb-4 text-sm text-slate-500"><Link href="/hostels" className="hover:underline">PG & Hostels</Link> / <Link href={`/hostels?city=${encodeURIComponent(h.city)}`} className="hover:underline">{h.city}</Link></nav>
      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-6">
          <div className="overflow-hidden rounded-2xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photos[0]} alt={h.name} className="aspect-[16/8] w-full object-cover" />
          </div>
          <div>
            <div className="flex flex-wrap gap-2"><span className="chip-brand">{h.type}</span><span className="chip">{h.gender}</span>{h.is_verified && <span className="chip-green"><BadgeCheck size={12} />Verified</span>}</div>
            <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
              <h1 className="text-3xl font-extrabold text-slate-900">{h.name}</h1>
              <SaveButton type="hostel" id={h.id} variant="button" />
            </div>
            {avg > 0 && <p className="mt-1 flex items-center gap-1 text-sm text-slate-600"><Stars value={avg} />{avg} · {rating?.review_count} reviews</p>}
            <p className="mt-2 flex items-center gap-1 text-slate-500"><MapPin size={16} />{[h.address, h.city, h.country].filter(Boolean).join(', ')}</p>
            {h.colleges && <Link href={`/colleges/${h.colleges.slug}`} className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline"><GraduationCap size={16} />Near {h.colleges.name}</Link>}
          </div>
          <div className="card p-6">
            <h2 className="font-bold text-slate-900">About this stay</h2>
            <TranslateText text={h.description || 'Contact the owner for details.'} className="mt-2 whitespace-pre-line text-slate-600" />
            {h.amenities?.length ? (
              <><p className="label mt-5">Amenities</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{h.amenities.map((a) => <span key={a} className="flex items-center gap-2 text-sm"><CheckCircle2 size={16} className="text-emerald-600" />{a}</span>)}</div></>
            ) : null}
          </div>
          {roomList.length > 0 && (
            <div className="card overflow-x-auto">
              <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4">
                <h2 className="font-bold text-slate-900">Rooms & availability</h2>
                <span className={bedsFree ? 'chip-green' : 'chip-red'}>{bedsFree ? `${bedsFree} bed${bedsFree > 1 ? 's' : ''} available` : 'Currently full'}</span>
              </div>
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-2">Room</th><th className="px-4 py-2">Rent</th><th className="px-4 py-2">Deposit</th><th className="px-4 py-2">Includes</th><th className="px-4 py-2">Available</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {roomList.map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 py-2 font-medium">{r.room_type}</td>
                      <td className="px-4 py-2">{r.rent != null ? `${money(r.rent, r.currency || h.currency || 'INR')} / ${r.rent_period || 'month'}` : '—'}</td>
                      <td className="px-4 py-2">{r.deposit != null ? money(r.deposit, r.currency || h.currency || 'INR') : '—'}</td>
                      <td className="px-4 py-2 text-xs text-slate-600">{[r.ac && 'AC', r.attached_bath && 'Attached bath', r.food_included && 'Food'].filter(Boolean).join(' · ') || '—'}</td>
                      <td className="px-4 py-2">{r.beds_available > 0 ? <span className="chip-green">{r.beds_available} of {r.beds_total}{r.available_from ? ` from ${new Date(r.available_from).toLocaleDateString()}` : ''}</span> : <span className="chip">Full</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {roomsUpdated && <p className="px-5 py-2 text-xs text-slate-400">Availability updated by owner {new Date(roomsUpdated).toLocaleDateString()}</p>}
            </div>
          )}
          {photos.length > 1 && <div><h2 className="mb-3 font-bold text-slate-900">Photos</h2><Gallery photos={photos} alt={h.name} /></div>}
          {h.latitude != null && h.longitude != null && <LiveNearby lat={h.latitude} lng={h.longitude} kinds={['hospital', 'pharmacy', 'transport', 'bus', 'food', 'bank']} radius={3000} />}
          <ShareButtons title={`${h.name} — ${h.type} in ${h.city}`} path={`/hostels/${h.id}`} />
          <HostelReviews hostelId={h.id} reviews={(reviews || []) as any} avg={avg} count={rating?.review_count || 0} />
        </div>
        <aside className="space-y-5">
          <div className="card p-5">
            <p className="text-xs text-slate-500">Rent</p>
            <p className="text-2xl font-extrabold text-slate-900">{range(h.rent_min, h.rent_max, h.currency)}<span className="text-base font-normal text-slate-500"> / {h.rent_period || 'month'}</span></p>
            <div className="mt-5 space-y-3 text-sm">
              {h.contact_name && <p className="flex items-center gap-2"><User size={16} />{h.contact_name}</p>}
              {h.contact_phone && <a href={`tel:${h.contact_phone}`} className="btn-primary w-full"><Phone size={16} />Call {h.contact_phone}</a>}
              {h.contact_phone && <a href={`https://wa.me/${h.contact_phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Hi, I found ${h.name} on StudyEarnstay.com. Is a room available?`)}`} target="_blank" rel="noopener noreferrer" className="btn-ghost w-full">WhatsApp</a>}
              {h.contact_email && <a href={`mailto:${h.contact_email}`} className="flex items-center gap-2 text-brand-700"><Mail size={16} />{h.contact_email}</a>}
              {h.latitude && h.longitude ? <a className="btn-ghost w-full" target="_blank" rel="noopener noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${h.latitude},${h.longitude}`}>View on map</a> : null}
            </div>
          </div>
          <div className="lg:sticky lg:top-24">
            <EnquiryForm kind="hostel" hostelId={h.id} title="Ask about a room" subtitle="Availability, visit time, deposit — we’ll connect you." compact />
          </div>
        </aside>
      </div>
      {(more || []).length > 0 && (
        <section className="mt-14">
          <h2 className="section-title mb-5">More stays in {h.city}</h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{(more as Hostel[]).map((x) => <HostelCard key={x.id} h={x} />)}</div>
        </section>
      )}
    </div>
  );
}
