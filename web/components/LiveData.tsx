'use client';
import { useEffect, useState } from 'react';
import { Hospital, Pill, BedDouble, TrainFront, Landmark, Bus, Coffee, BookOpen, ExternalLink, Loader2, Briefcase, Phone, Siren } from 'lucide-react';
import { API_URL } from '@/lib/api';
import { useLang } from './LangProvider';

type Place = { id: string; kind: string; name: string; distance_km: number; address: string | null; phone: string | null; website: string | null; emergency: boolean; osm_url: string; latitude: number; longitude: number };
type ExtJob = { id: string; source: string; title: string; company: string | null; location: string; snippet: string; salary_min: number | null; salary_max: number | null; salary_text: string | null; contract: string | null; url: string; posted_at: string | null };

const KINDS: Record<string, { label: string; icon: any }> = {
  hospital: { label: 'Hospitals', icon: Hospital }, pharmacy: { label: 'Pharmacies', icon: Pill },
  pg: { label: 'Hostels & guest houses', icon: BedDouble }, transport: { label: 'Railway', icon: TrainFront },
  bus: { label: 'Bus stations', icon: Bus }, bank: { label: 'Banks & ATMs', icon: Landmark },
  food: { label: 'Food', icon: Coffee }, library: { label: 'Libraries', icon: BookOpen },
};

// Live points of interest around a location from OpenStreetMap (via our API, cached)
export function LiveNearby({ lat, lng, kinds = ['hospital', 'pharmacy', 'pg', 'transport', 'bank'], radius = 3000, title }: {
  lat: number; lng: number; kinds?: string[]; radius?: number; title?: string;
}) {
  const { t } = useLang();
  const [kind, setKind] = useState(kinds[0]);
  const [rows, setRows] = useState<Place[] | null>(null);
  const [err, setErr] = useState('');
  const [r, setR] = useState(radius);

  useEffect(() => {
    setRows(null); setErr('');
    fetch(`${API_URL}/api/nearby?lat=${lat}&lng=${lng}&kind=${kind}&radius=${r}`)
      .then((x) => x.json()).then((b) => { setRows(b.data || []); if (b.error) setErr(b.error); })
      .catch(() => { setRows([]); setErr('Could not load map data.'); });
  }, [lat, lng, kind, r]);

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-slate-900">{title || t('live.hospitals')}</h3>
        <select value={r} onChange={(e) => setR(Number(e.target.value))} className="input w-auto py-1.5 text-xs">
          {[1000, 3000, 5000, 10000].map((m) => <option key={m} value={m}>Within {m / 1000} km</option>)}
        </select>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {kinds.map((k) => {
          const K = KINDS[k];
          return <button key={k} onClick={() => setKind(k)} className={`${kind === k ? 'chip-brand' : 'chip'} cursor-pointer py-1.5`}><K.icon size={12} />{K.label}</button>;
        })}
      </div>
      {rows === null ? <div className="grid h-24 place-items-center"><Loader2 className="animate-spin text-slate-300" /></div> : rows.length === 0 ? (
        <p className="mt-4 text-sm text-slate-400">{err || 'Nothing mapped here yet.'}</p>
      ) : (
        <ul className="mt-3 max-h-96 divide-y divide-slate-100 overflow-y-auto">
          {rows.map((p) => (
            <li key={p.id} className="flex items-start gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 font-medium text-slate-800">{p.name}{p.emergency && <span className="chip-red py-0"><Siren size={10} />24×7 ER</span>}</p>
                {p.address && <p className="truncate text-xs text-slate-500">{p.address}</p>}
                <div className="mt-0.5 flex flex-wrap gap-3 text-xs">
                  {p.phone && <a href={`tel:${p.phone}`} className="flex items-center gap-1 text-brand-700"><Phone size={11} />{p.phone}</a>}
                  <a href={`https://www.google.com/maps/dir/?api=1&destination=${p.latitude},${p.longitude}`} target="_blank" rel="noopener noreferrer" className="text-brand-700">Directions</a>
                </div>
              </div>
              <span className="chip shrink-0">{p.distance_km} km</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[10px] text-slate-400">Map data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline">OpenStreetMap contributors</a></p>
    </div>
  );
}

// Live job listings for a city from Adzuna / Jooble (via our API, cached per city)
export function LiveJobs({ city, country, query = 'part time' }: { city: string; country?: string | null; query?: string }) {
  const { t } = useLang();
  const [q, setQ] = useState(query);
  const [input, setInput] = useState(query);
  const [data, setData] = useState<{ jobs: ExtJob[]; providers: { adzuna: boolean; jooble: boolean } } | null>(null);

  useEffect(() => {
    setData(null);
    const p = new URLSearchParams({ city, q });
    if (country) p.set('country', country);
    fetch(`${API_URL}/api/local-jobs?${p}`).then((x) => x.json()).then(setData).catch(() => setData({ jobs: [], providers: { adzuna: false, jooble: false } }));
  }, [city, country, q]);

  const enabled = data && (data.providers.adzuna || data.providers.jooble);
  if (data && !enabled) return null;   // no job API keys configured → hide the block

  const sources = [data?.providers.adzuna && 'Adzuna', data?.providers.jooble && 'Jooble'].filter(Boolean).join(' & ');
  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-semibold text-slate-900"><Briefcase size={16} className="text-brand-600" />{t('live.jobs')} {city}</h3>
        <form onSubmit={(e) => { e.preventDefault(); setQ(input.trim() || 'part time'); }} className="flex gap-1">
          <input value={input} onChange={(e) => setInput(e.target.value)} className="input w-40 py-1.5 text-xs" placeholder="Keywords" />
          <button className="btn-ghost px-2 py-1.5 text-xs">Search</button>
        </form>
      </div>
      {data === null ? <div className="grid h-24 place-items-center"><Loader2 className="animate-spin text-slate-300" /></div> : data.jobs.length === 0 ? (
        <p className="mt-4 text-sm text-slate-400">No listings found for “{q}” in {city} right now.</p>
      ) : (
        <ul className="mt-3 max-h-[28rem] divide-y divide-slate-100 overflow-y-auto">
          {data.jobs.map((j) => (
            <li key={j.id} className="py-3">
              <a href={j.url} target="_blank" rel="noopener noreferrer nofollow" className="group block">
                <p className="flex items-start justify-between gap-2 font-medium text-slate-900 group-hover:text-brand-700">
                  <span>{j.title}</span><ExternalLink size={14} className="mt-1 shrink-0 text-slate-400" />
                </p>
                <p className="text-xs text-slate-500">{[j.company, j.location, j.contract].filter(Boolean).join(' · ')}</p>
                {j.snippet && <p className="mt-1 line-clamp-2 text-xs text-slate-600">{j.snippet}</p>}
                <p className="mt-1 flex gap-2 text-xs">
                  {(j.salary_text || j.salary_min) && <span className="chip-green py-0">{j.salary_text || `${Math.round(j.salary_min!).toLocaleString()}${j.salary_max ? `–${Math.round(j.salary_max).toLocaleString()}` : ''}`}</span>}
                  <span className="chip py-0">{j.source}</span>
                </p>
              </a>
            </li>
          ))}
        </ul>
      )}
      {sources && <p className="mt-3 text-[10px] text-slate-400">Jobs by {sources}. You apply on the employer’s site.</p>}
    </div>
  );
}
