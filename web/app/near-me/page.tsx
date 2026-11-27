'use client';
import { useEffect, useState } from 'react';
import { MapPin, Loader2, GraduationCap, Home, Briefcase } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { api } from '@/lib/api';
import { CollegeCard, HostelCard, JobCard, EmptyState } from '@/components/Cards';

type Tab = 'colleges' | 'hostels' | 'jobs';
const RADII = [5, 10, 25, 50, 100];

export default function NearMePage() {
  const supabase = supabaseBrowser();
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [radius, setRadius] = useState(25);
  const [tab, setTab] = useState<Tab>('colleges');
  const [data, setData] = useState<Record<Tab, any[]>>({ colleges: [], hostels: [], jobs: [] });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  // before any permission prompt: approximate area from the internet connection (nginx GeoIP2 + DB-IP City Lite)
  const [approx, setApprox] = useState<{ city: string | null; region: string | null; source: string | null } | null>(null);
  useEffect(() => {
    api('/api/geo/me').then((g: any) => {
      if (g?.lat == null || g?.lng == null) return;
      setApprox({ city: g.city, region: g.region, source: g.source });
      setCoords((cur) => { if (cur) return cur; const c = { lat: g.lat, lng: g.lng }; search(c, 25); return c; });
    }).catch(() => {});
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  const search = async (c: { lat: number; lng: number }, r: number) => {
    setBusy(true); setErr('');
    const args = { lat: c.lat, lng: c.lng, radius_km: r };
    const [a, b, j] = await Promise.all([
      supabase.rpc('nearby_colleges', args), supabase.rpc('nearby_hostels', args), supabase.rpc('nearby_jobs', args),
    ]);
    setBusy(false);
    if (a.error) return setErr(a.error.message);
    setData({ colleges: a.data || [], hostels: b.data || [], jobs: j.data || [] });
  };

  const locate = () => {
    if (!navigator.geolocation) return setErr('Your browser does not support location.');
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { const c = { lat: pos.coords.latitude, lng: pos.coords.longitude }; setApprox(null); setCoords(c); search(c, radius); },
      () => { setBusy(false); setErr('Location permission denied. Allow location access and try again.'); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: 'colleges', label: 'Colleges', icon: GraduationCap },
    { key: 'hostels', label: 'PG & Hostels', icon: Home },
    { key: 'jobs', label: 'Jobs', icon: Briefcase },
  ];

  return (
    <div className="container-x py-10">
      <div className="card flex flex-col items-center gap-4 bg-gradient-to-br from-brand-900 to-brand-700 p-8 text-center text-white">
        <MapPin size={36} className="text-accent-400" />
        <h1 className="text-3xl font-extrabold">Colleges, PGs & jobs near you</h1>
        <p className="max-w-xl text-brand-100">Share your location once — we show what is within your chosen distance. Your location is not stored.</p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <select value={radius} onChange={(e) => { const r = Number(e.target.value); setRadius(r); if (coords) search(coords, r); }}
            className="rounded-xl border-0 bg-white/15 px-3 py-2.5 text-sm text-white">
            {RADII.map((r) => <option key={r} value={r} className="text-slate-900">Within {r} km</option>)}
          </select>
          <button onClick={locate} disabled={busy} className="btn-accent">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <MapPin size={16} />}{coords && !approx ? 'Refresh location' : 'Use my location'}
          </button>
        </div>
        {approx && (
          <p className="text-sm text-brand-100">
            Showing places around <b className="text-white">{[approx.city, approx.region].filter(Boolean).join(', ') || 'your area'}</b> — approximate, from your internet connection.
            Tap “Use my location” for exact distances.
            {approx.source === 'db-ip' && <> <a href="https://db-ip.com" target="_blank" rel="noopener noreferrer" className="underline opacity-80">IP Geolocation by DB-IP</a></>}
          </p>)}
        {err && <p className="text-sm text-rose-200">{err}</p>}
      </div>

      {coords && (
        <>
          <div className="mt-8 flex gap-2">
            {tabs.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)} className={tab === t.key ? 'btn-primary' : 'btn-ghost'}>
                <t.icon size={16} />{t.label} ({data[t.key].length})
              </button>
            ))}
          </div>
          <div className="mt-6">
            {data[tab].length === 0 ? (
              <EmptyState title={`No ${tab} within ${radius} km`} text="Try a bigger distance." />
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {tab === 'colleges' && data.colleges.map((c) => (
                  <div key={c.id} className="relative">
                    <span className="absolute right-3 top-12 z-10 rounded-lg bg-accent-500 px-2 py-0.5 text-xs font-bold text-slate-900">{c.distance} km</span>
                    <CollegeCard c={c} />
                  </div>
                ))}
                {tab === 'hostels' && data.hostels.map((h) => <HostelCard key={h.id} h={h} />)}
                {tab === 'jobs' && data.jobs.map((j) => <JobCard key={j.id} j={j} />)}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
