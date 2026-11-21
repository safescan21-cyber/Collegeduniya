import type { Metadata } from 'next';
import { Users, MapPin, CalendarDays, Wallet, GraduationCap } from 'lucide-react';
import FilterBar from '@/components/FilterBar';
import { EmptyState } from '@/components/Cards';
import StartChat from '@/components/StartChat';
import RoommateForm from './RoommateForm';
import { supabasePublic, hasSupabase } from '@/lib/supabase/server';
import { cleanTerm } from '@/lib/data';
import { range, timeAgo } from '@/lib/format';

export const dynamic = 'force-dynamic';
type SP = Record<string, string | undefined>;

export async function generateMetadata({ searchParams }: { searchParams: Promise<SP> }): Promise<Metadata> {
  const sp = await searchParams;
  return {
    title: `Find a roommate${sp.city ? ` in ${sp.city}` : ''} — students sharing PGs & flats`,
    description: `Students looking for roommates and rooms${sp.city ? ` in ${sp.city}` : ''}: budget, move-in date and college. Message privately on Collegeolo.`,
  };
}

const LOOK: Record<string, string> = { roommate: 'Has a place, needs a roommate', room: 'Looking for a room', both: 'Wants to find a place together' };

export default async function RoommatesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  let posts: any[] = [];
  if (hasSupabase) {
    let q = supabasePublic().from('roommate_posts_public').select('*').order('created_at', { ascending: false }).limit(60);
    if (sp.city) q = q.ilike('city', cleanTerm(sp.city));
    if (sp.gender) q = q.in('gender', [sp.gender, 'Any']);
    if (sp.looking) q = q.eq('looking_for', sp.looking);
    if (sp.budget) q = q.lte('budget_min', Number(sp.budget));
    posts = (await q).data || [];
  }
  return (
    <div className="container-x py-10">
      <h1 className="flex items-center gap-2 text-3xl font-extrabold tracking-tight text-slate-900"><Users className="text-brand-600" />Find a roommate{sp.city ? ` in ${sp.city}` : ''}</h1>
      <p className="mt-1 text-slate-500">Split rent with another student. Chat privately; your phone number stays hidden until you share it.</p>
      <div className="mt-8 grid gap-8 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-4">
          <FilterBar action="/roommates" values={sp} fields={[
            { name: 'city', label: 'City', type: 'city', placeholder: 'Any city' },
            { name: 'gender', label: 'Roommate gender', type: 'select', options: ['Female', 'Male'] },
            { name: 'looking', label: 'Post type', type: 'select', options: [{ value: 'roommate', label: 'Has a place' }, { value: 'room', label: 'Looking for a room' }, { value: 'both', label: 'Find a place together' }] },
            { name: 'budget', label: 'My max budget', type: 'text', placeholder: 'e.g. 8000' },
          ]} />
        </aside>
        <section className="space-y-6">
          <RoommateForm />
          {posts.length ? (
            <div className="grid gap-4 md:grid-cols-2">
              {posts.map((p) => (
                <div key={p.id} className="card flex flex-col p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div><p className="font-bold text-slate-900">{p.first_name}</p><p className="text-xs text-slate-500">{LOOK[p.looking_for]} · {timeAgo(p.created_at)}</p></div>
                    <span className="chip">{p.gender === 'Any' ? 'Any gender' : `${p.gender} only`}</span>
                  </div>
                  <div className="mt-3 space-y-1 text-sm text-slate-600">
                    <p className="flex items-center gap-2"><MapPin size={14} />{p.city}{p.country ? `, ${p.country}` : ''}</p>
                    {p.college_name && <p className="flex items-center gap-2"><GraduationCap size={14} />{p.college_name}</p>}
                    {(p.budget_min || p.budget_max) && <p className="flex items-center gap-2"><Wallet size={14} />{range(p.budget_min, p.budget_max, p.currency)} / month</p>}
                    {p.move_in && <p className="flex items-center gap-2"><CalendarDays size={14} />Move-in {new Date(p.move_in).toLocaleDateString()}</p>}
                  </div>
                  <p className="mt-3 line-clamp-4 flex-1 text-sm text-slate-700">{p.about}</p>
                  <div className="mt-4"><StartChat otherId={p.user_id} contextType="roommate" contextId={p.id} label="Message" className="btn-primary w-full py-2" /></div>
                </div>
              ))}
            </div>
          ) : <EmptyState icon={<Users size={28} />} title="No roommate posts here yet" text="Post yours — students moving to the same city will find you." />}
        </section>
      </div>
    </div>
  );
}
