import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { GraduationCap, MapPin, CalendarDays, ClipboardCheck } from 'lucide-react';
import { supabasePublic, hasSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

async function load(username: string) {
  if (!hasSupabase || !/^[a-z0-9_.]{3,30}$/i.test(username)) return null;
  const { data } = await supabasePublic().rpc('public_profile', { p_username: username });
  return ((data || []) as any[])[0] || null;
}

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const p = await load((await params).username);
  if (!p) return { title: 'Profile not found', robots: { index: false } };
  return {
    title: `${p.full_name || p.username}${p.headline ? ` — ${p.headline}` : ''}`,
    description: p.bio?.slice(0, 160) || `${p.full_name || p.username}'s education and profile on StudyEarnstay.`,
    robots: { index: false, follow: true },   // student profiles stay out of search engines
  };
}

export default async function PublicProfile({ params }: { params: Promise<{ username: string }> }) {
  const p = await load((await params).username);
  if (!p) notFound();
  const initials = (p.full_name || p.username).split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div className="container-x max-w-3xl py-10">
      <div className="card p-6">
        <div className="flex flex-wrap items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {p.avatar_url ? <img src={p.avatar_url} alt="" className="h-20 w-20 rounded-full object-cover" /> : <span className="grid h-20 w-20 place-items-center rounded-full bg-brand-600 text-2xl font-bold text-white">{initials}</span>}
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold text-slate-900">{p.full_name || p.username}</h1>
            {p.headline && <p className="text-slate-600">{p.headline}</p>}
            <p className="mt-1 flex flex-wrap gap-3 text-xs text-slate-500">
              <span>@{p.username}</span>
              {(p.city || p.country) && <span className="flex items-center gap-1"><MapPin size={12} />{[p.city, p.country].filter(Boolean).join(', ')}</span>}
              <span className="flex items-center gap-1"><CalendarDays size={12} />Member since {new Date(p.member_since).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}</span>
            </p>
          </div>
        </div>
        {p.bio && <p className="mt-4 whitespace-pre-line text-slate-700">{p.bio}</p>}
      </div>

      <section className="card mt-6 p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><GraduationCap size={19} className="text-brand-600" />Education</h2>
        {p.education.length ? (
          <ol className="relative mt-4 space-y-5 border-s-2 border-slate-100 ps-5">{p.education.map((e: any) => (
            <li key={e.id} className="relative">
              <span className="absolute -start-[27px] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-brand-600" />
              <p className="font-semibold text-slate-900">{e.college_id ? e.institute : e.institute}</p>
              <p className="text-sm text-slate-600">{[e.level, e.course, e.board].filter(Boolean).join(' · ')}</p>
              <p className="text-xs text-slate-500">{[e.start_year, e.is_current ? 'Present' : e.end_year].filter(Boolean).join(' – ')}{e.score ? ` · ${e.score}` : ''}{e.city ? ` · ${e.city}` : ''}</p>
            </li>))}</ol>
        ) : <p className="mt-2 text-sm text-slate-500">No education added yet.</p>}
      </section>

      {Array.isArray(p.mock) && p.mock.length > 0 && (
        <section className="card mt-6 p-6">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><ClipboardCheck size={19} className="text-brand-600" />Mock-test practice</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">{p.mock.map((m: any) => (
            <Link key={m.exam_slug} href={`/mock-tests/${m.exam_slug}`} className="rounded-xl border border-slate-100 p-3 hover:border-brand-300">
              <p className="font-medium text-slate-900">{m.title}</p>
              <p className="text-xs text-slate-500">{m.tests} test{m.tests > 1 ? 's' : ''} · best {Number(m.best)}/{Number(m.max)} · top percentile {Number(m.best_percentile)}</p>
            </Link>))}</div>
        </section>
      )}
    </div>
  );
}
