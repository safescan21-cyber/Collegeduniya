'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Users, BadgeCheck, Loader2 } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { supabaseBrowser } from '@/lib/supabase/client';
import StartChat from '@/components/StartChat';

type Member = { id: string; user_id: string; relation: string; course: string | null; batch_year: number | null; bio: string | null; open_to_questions: boolean; is_verified: boolean; first_name: string };
const REL: Record<string, string> = { student: 'Current student', alumnus: 'Alumni', aspirant: 'Aspirant' };

export default function CollegeCommunity({ collegeId, collegeName }: { collegeId: string; collegeName: string }) {
  const { user } = useAuth();
  const supabase = supabaseBrowser();
  const [members, setMembers] = useState<Member[]>([]);
  const [tab, setTab] = useState<'senior' | 'aspirant'>('senior');
  const [mine, setMine] = useState<any | null>(null);
  const [form, setForm] = useState<any>({ relation: 'student', course: '', batch_year: '', bio: '', open_to_questions: true });
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from('college_members_public').select('*').eq('college_id', collegeId).order('is_verified', { ascending: false }).order('created_at', { ascending: false }).limit(60);
    setMembers((data || []) as Member[]);
    if (user) {
      const { data: me } = await supabase.from('college_members').select('*').eq('college_id', collegeId).eq('user_id', user.id).maybeSingle();
      setMine(me);
      if (me) setForm({ relation: me.relation, course: me.course || '', batch_year: me.batch_year || '', bio: me.bio || '', open_to_questions: me.open_to_questions });
    }
  }, [collegeId, supabase, user]);
  useEffect(() => { load(); }, [load]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    const row = { college_id: collegeId, user_id: user.id, relation: form.relation, course: form.course || null,
      batch_year: form.batch_year ? Number(form.batch_year) : null, bio: form.bio || null, open_to_questions: form.open_to_questions };
    const { error } = mine ? await supabase.from('college_members').update(row).eq('id', mine.id) : await supabase.from('college_members').insert(row);
    setBusy(false);
    if (error) return alert(error.message);
    setEditing(false); load();
  };
  const leave = async () => { if (mine && confirm('Remove yourself from this college’s community?')) { await supabase.from('college_members').delete().eq('id', mine.id); setMine(null); load(); } };

  const seniors = members.filter((m) => m.relation !== 'aspirant');
  const aspirants = members.filter((m) => m.relation === 'aspirant');
  const shown = tab === 'senior' ? seniors : aspirants;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <button onClick={() => setTab('senior')} className={tab === 'senior' ? 'btn-primary py-1.5' : 'btn-ghost py-1.5'}>Students & alumni ({seniors.length})</button>
          <button onClick={() => setTab('aspirant')} className={tab === 'aspirant' ? 'btn-primary py-1.5' : 'btn-ghost py-1.5'}>Also applying ({aspirants.length})</button>
        </div>
        {user ? (mine && !editing ? <span className="flex gap-2"><button onClick={() => setEditing(true)} className="btn-ghost py-1.5">Edit my profile</button><button onClick={leave} className="btn-ghost py-1.5 text-rose-600">Leave</button></span>
          : !editing && <button onClick={() => setEditing(true)} className="btn-primary py-1.5"><Users size={14} />Join this college’s community</button>)
          : <Link href="/login" className="btn-ghost py-1.5">Login to join</Link>}
      </div>

      {editing && (
        <form onSubmit={save} className="card mb-4 grid gap-3 p-4 sm:grid-cols-2">
          <label className="text-sm"><span className="label">I am</span>
            <select className="input" value={form.relation} onChange={(e) => setForm({ ...form, relation: e.target.value })}>
              <option value="student">A current student here</option><option value="alumnus">An alumnus</option><option value="aspirant">Applying / planning to join</option></select></label>
          <label className="text-sm"><span className="label">Course</span><input className="input" value={form.course} onChange={(e) => setForm({ ...form, course: e.target.value })} placeholder="B.Tech CSE" /></label>
          <label className="text-sm"><span className="label">{form.relation === 'aspirant' ? 'Joining year' : 'Batch (graduation year)'}</span><input className="input" inputMode="numeric" value={form.batch_year} onChange={(e) => setForm({ ...form, batch_year: e.target.value.replace(/\D/g, '').slice(0, 4) })} /></label>
          <label className="flex items-center gap-2 text-sm sm:mt-6"><input type="checkbox" checked={form.open_to_questions} onChange={(e) => setForm({ ...form, open_to_questions: e.target.checked })} />Others can message me</label>
          <label className="text-sm sm:col-span-2"><span className="label">Short intro (optional)</span><textarea className="input" rows={2} maxLength={400} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} placeholder="Happy to answer about hostels, clubs, placements…" /></label>
          <div className="flex gap-2 sm:col-span-2"><button className="btn-primary" disabled={busy}>{busy && <Loader2 size={14} className="animate-spin" />}Save</button><button type="button" onClick={() => setEditing(false)} className="btn-ghost">Cancel</button></div>
          <p className="text-xs text-slate-400 sm:col-span-2">Only your first name, course and batch are shown. A “Verified” badge is added by our team after checking.</p>
        </form>
      )}

      {shown.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {shown.map((m) => (
            <div key={m.id} className="card flex items-start gap-3 p-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-100 font-bold text-brand-700">{m.first_name[0]}</span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900">{m.first_name} {m.is_verified && <BadgeCheck size={14} className="inline text-emerald-600" />}</p>
                <p className="text-xs text-slate-500">{REL[m.relation]}{m.course ? ` · ${m.course}` : ''}{m.batch_year ? ` · ${m.batch_year}` : ''}</p>
                {m.bio && <p className="mt-1 line-clamp-2 text-sm text-slate-600">{m.bio}</p>}
              </div>
              {m.open_to_questions && <StartChat otherId={m.user_id} contextType="college" contextId={collegeId} label="Ask" />}
            </div>
          ))}
        </div>
      ) : <p className="card p-6 text-center text-sm text-slate-500">{tab === 'senior' ? `No students of ${collegeName} have joined yet. Studying here? Join and help juniors.` : 'Nobody has said they are applying yet. Join to find classmates and roommates.'}</p>}
    </div>
  );
}
