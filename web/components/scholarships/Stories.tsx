import { BadgeCheck, Quote } from 'lucide-react';
import { supabasePublic, hasSupabase } from '@/lib/supabase/server';
import StoryForm from './StoryForm';

type S = { id: string; display_name: string; college: string | null; course: string | null; year_awarded: number; story: string; tips: string | null; verified: boolean };

// Stories from students who received this scholarship — written by them, published only after an admin checks them.
export default async function Stories({ scholarshipId, name }: { scholarshipId: string; name: string }) {
  const rows: S[] = hasSupabase ? (((await supabasePublic().rpc('scholarship_stories_public', { p_scholarship: scholarshipId, p_lim: 20 })).data || []) as S[]) : [];
  return (
    <section id="stories" className="card mt-4 scroll-mt-24 p-5">
      <h2 className="font-bold text-slate-900">Students who got it</h2>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-slate-600">No stories yet. If you received the {name}, tell other students how you did it — your tips can help someone apply.</p>
      ) : (
        <div className="mt-3 space-y-4">
          {rows.map((r) => (
            <figure key={r.id} className="rounded-xl bg-slate-50 p-4">
              <Quote size={18} className="text-brand-300" />
              <blockquote className="mt-1 whitespace-pre-line text-slate-700">{r.story}</blockquote>
              {r.tips && <p className="mt-2 whitespace-pre-line text-sm text-slate-700"><b>Tips:</b> {r.tips}</p>}
              <figcaption className="mt-3 flex flex-wrap items-center gap-x-2 text-sm text-slate-500">
                <span className="font-semibold text-slate-800">{r.display_name}</span>
                {r.verified && <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-emerald-700" title="We saw the award letter"><BadgeCheck size={14} />Award verified</span>}
                <span>· Received {r.year_awarded}{r.course ? ` · ${r.course}` : ''}{r.college ? ` · ${r.college}` : ''}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
      <StoryForm scholarshipId={scholarshipId} />
      <p className="mt-3 text-xs text-slate-400">Stories are written by the students themselves and checked by Collegeolo before they appear. “Award verified” means we saw the award letter (then deleted it). Your own result depends on the official selection.</p>
    </section>
  );
}
