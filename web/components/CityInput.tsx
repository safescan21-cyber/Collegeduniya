'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Loader2 } from 'lucide-react';
import { API_URL } from '@/lib/api';
import { useLang } from './LangProvider';

export type CityHit = {
  geoname_id: number | null; name: string; local_name?: string | null; admin1: string | null; country: string | null; country_code: string;
  latitude: number; longitude: number; population: number | null; slug: string | null; source: string;
};

const flag = (cc: string) => (cc && cc.length === 2 ? String.fromCodePoint(...cc.toUpperCase().split('').map((c) => 127397 + c.charCodeAt(0))) : '🌍');

// Autocomplete over every city in the world (GeoNames table + OpenStreetMap fallback).
//  - mode="field": works inside a normal <form> (submits the city name under `name`)
//  - mode="navigate": picking a city opens its /city/<slug> page
export default function CityInput({ name = 'city', defaultValue = '', placeholder, mode = 'field', country, onPick, className = '' }: {
  name?: string; defaultValue?: string; placeholder?: string; mode?: 'field' | 'navigate'; country?: string;
  onPick?: (c: CityHit) => void; className?: string;
}) {
  const router = useRouter();
  const { t, lang } = useLang();
  const [q, setQ] = useState(defaultValue);
  const [hits, setHits] = useState<CityHit[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const picked = useRef(false);

  useEffect(() => {
    if (picked.current) { picked.current = false; return; }
    const term = q.trim();
    if (term.length < 2) { setHits([]); return; }
    setBusy(true);
    const ctrl = new AbortController();
    const tm = setTimeout(async () => {
      try {
        const p = new URLSearchParams({ q: term, limit: '8', lang });
        if (country) p.set('country', country);
        const r = await fetch(`${API_URL}/api/cities?${p}`, { signal: ctrl.signal });
        const body = await r.json();
        setHits(body.data || []); setOpen(true); setActive(0);
      } catch { /* aborted */ }
      setBusy(false);
    }, 220);
    return () => { clearTimeout(tm); ctrl.abort(); };
  }, [q, country, lang]);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const pick = (c: CityHit) => {
    picked.current = true;
    setQ(c.name); setOpen(false);
    onPick?.(c);
    if (mode === 'navigate') {
      router.push(c.slug ? `/city/${c.slug}` : `/city/search?name=${encodeURIComponent(c.name)}&country=${c.country_code}&lat=${c.latitude}&lng=${c.longitude}`);
    }
  };

  return (
    <div ref={box} className={`relative ${className}`}>
      <MapPin size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input name={name} value={q} autoComplete="off" placeholder={placeholder || t('city.placeholder')}
        onChange={(e) => setQ(e.target.value)} onFocus={() => hits.length && setOpen(true)}
        onKeyDown={(e) => {
          if (!open || !hits.length) return;
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, hits.length - 1)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          if (e.key === 'Enter') { e.preventDefault(); pick(hits[active]); }
          if (e.key === 'Escape') setOpen(false);
        }}
        className="input ps-9" />
      {busy && <Loader2 size={14} className="absolute end-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400" />}
      {open && hits.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-80 w-full min-w-64 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 text-start text-slate-800 shadow-xl">
          {hits.map((c, i) => (
            <li key={`${c.geoname_id || c.name}-${c.country_code}-${i}`}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(c)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-start text-sm ${i === active ? 'bg-brand-50' : 'hover:bg-slate-50'}`}>
                <span className="text-base">{flag(c.country_code)}</span>
                <span className="min-w-0 flex-1 truncate"><strong>{c.local_name && c.local_name !== c.name ? c.local_name : c.name}</strong>{c.local_name && c.local_name !== c.name && <span className="text-slate-500"> ({c.name})</span>}{c.admin1 ? `, ${c.admin1}` : ''}<span className="text-slate-400"> · {c.country}</span></span>
                {c.population ? <span className="text-[10px] text-slate-400">{c.population >= 1e6 ? `${(c.population / 1e6).toFixed(1)}M` : `${Math.round(c.population / 1e3)}k`}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
