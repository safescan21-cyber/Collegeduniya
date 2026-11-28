'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Sparkles, Loader2, MapPin, LocateFixed } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { CompareButton, SaveButton } from '@/components/ActionButtons';
import { range, FALLBACK_IMG } from '@/lib/format';

const STATES = ['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Delhi','Goa','Gujarat','Haryana','Himachal Pradesh','Jammu and Kashmir','Jharkhand','Karnataka','Kerala','Ladakh','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Puducherry','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal','Chandigarh'];
const STREAMS = ['Engineering', 'Medical', 'Management', 'Commerce', 'Science', 'Arts', 'Law', 'Design', 'Pharmacy', 'Nursing', 'Architecture', 'Agriculture', 'Hotel Management', 'Education'];
const CH: Record<string, string> = { High: 'chip-green', Medium: 'chip-amber', Low: 'chip-red' };

export default function Recommend({ exams }: { exams: { slug: string; short_name: string }[] }) {
  const params = useSearchParams();
  const supabase = supabaseBrowser();
  const [f, setF] = useState({ stream: params.get('stream') || '', exam: params.get('exam') || '', rank: '', category: 'General', budget: '', state: '', country: 'India' });
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null);
  const [rows, setRows] = useState<any[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const run = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setBusy(true); setErr('');
    const { data, error } = await supabase.rpc('recommend_colleges', {
      p_country: f.country || null, p_state: f.state || null, p_stream: f.stream || null, p_budget: f.budget ? Number(f.budget) : null,
      p_exam: f.exam || null, p_rank: f.rank ? Number(f.rank) : null, p_category: f.category,
      p_lat: geo?.lat ?? null, p_lng: geo?.lng ?? null, p_lim: 30,
    });
    setBusy(false);
    if (error) return setErr(error.message);
    setRows(data || []);
  };
  const locate = () => navigator.geolocation?.getCurrentPosition((p) => setGeo({ lat: p.coords.latitude, lng: p.coords.longitude }), () => setErr('Location permission denied'));

  return (
    <div>
      <h1 className="flex items-center gap-2 text-3xl font-extrabold text-slate-900"><Sparkles className="text-brand-600" />Find the right college for you</h1>
      <p className="mt-1 text-slate-500">Every field is optional — the more you add, the better the list. Reasons are shown for each suggestion.</p>
      <form onSubmit={run} className="card mt-6 grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm"><span className="label">Stream</span><select className="input" value={f.stream} onChange={(e) => setF({ ...f, stream: e.target.value })}><option value="">Any</option>{STREAMS.map((s) => <option key={s}>{s}</option>)}</select></label>
        <label className="text-sm"><span className="label">Entrance exam</span><select className="input" value={f.exam} onChange={(e) => setF({ ...f, exam: e.target.value })}><option value="">None / not yet</option>{exams.map((x) => <option key={x.slug} value={x.slug}>{x.short_name}</option>)}</select></label>
        <label className="text-sm"><span className="label">Your rank</span><input className="input" inputMode="numeric" disabled={!f.exam} value={f.rank} onChange={(e) => setF({ ...f, rank: e.target.value.replace(/\D/g, '') })} placeholder={f.exam ? 'e.g. 15000' : 'Pick an exam first'} /></label>
        <label className="text-sm"><span className="label">Category</span><select className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{['General', 'OBC-NCL', 'SC', 'ST', 'EWS'].map((c) => <option key={c}>{c}</option>)}</select></label>
        <label className="text-sm"><span className="label">Max fees per year</span><input className="input" inputMode="numeric" value={f.budget} onChange={(e) => setF({ ...f, budget: e.target.value.replace(/\D/g, '') })} placeholder="e.g. 200000" /></label>
        <label className="text-sm"><span className="label">Home state</span><select className="input" value={f.state} onChange={(e) => setF({ ...f, state: e.target.value })}><option value="">Any</option>{STATES.map((s) => <option key={s}>{s}</option>)}</select></label>
        <label className="text-sm"><span className="label">Country</span><input className="input" value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })} placeholder="India" /></label>
        <div className="text-sm"><span className="label">Near me</span><button type="button" onClick={locate} className={geo ? 'btn-primary w-full' : 'btn-ghost w-full'}><LocateFixed size={14} />{geo ? 'Using your location' : 'Use my location'}</button></div>
        {err && <p className="text-sm text-rose-600 sm:col-span-2 lg:col-span-4">{err}</p>}
        <button className="btn-primary sm:col-span-2 lg:col-span-4" disabled={busy}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}Show my colleges</button>
      </form>

      {rows && (rows.length ? (
        <div className="mt-8 space-y-3">
          {rows.map((r, i) => (
            <div key={r.id} className="card flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-600 font-bold text-white">{i + 1}</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={r.logo_url || r.cover_url || FALLBACK_IMG} alt="" className="hidden h-16 w-24 rounded-lg object-cover sm:block" />
              <div className="min-w-0 flex-1">
                <Link href={`/colleges/${r.slug}`} className="font-bold text-slate-900 hover:text-brand-700">{r.name}</Link>
                <p className="flex items-center gap-1 text-sm text-slate-500"><MapPin size={12} />{[r.city, r.state, r.country].filter(Boolean).join(', ')} · {range(r.fees_min, r.fees_max, r.currency)}</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {r.chance && <span className={CH[r.chance]}>{r.chance} chance</span>}
                  {(r.reasons || []).filter((x: string) => !x.includes('chance')).map((x: string) => <span key={x} className="chip">{x}</span>)}
                </div>
              </div>
              <div className="flex gap-2"><CompareButton item={{ id: r.id, slug: r.slug, name: r.name, city: r.city }} /><SaveButton type="college" id={r.id} /></div>
            </div>
          ))}
          <p className="text-xs text-slate-500">Ranking combines your admission chance (official closing ranks), NIRF rank, student ratings, budget, state and distance. It is a starting point — always check the official counselling brochure.</p>
        </div>
      ) : <div className="card mt-8 p-8 text-center text-slate-500">No colleges match all of that. Try a higher budget, another stream or “Any” state.</div>)}
    </div>
  );
}
