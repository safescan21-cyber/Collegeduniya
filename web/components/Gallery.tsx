'use client';
import { useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

export type PhotoCredit = { url: string; author?: string; license?: string; license_url?: string | null; page?: string };

function Credit({ c, dark }: { c?: PhotoCredit; dark?: boolean }) {
  if (!c) return null;
  const cls = dark ? 'text-white/70' : 'text-slate-400';
  return (
    <span className={`block truncate text-[11px] ${cls}`}>
      Photo: {c.page ? <a href={c.page} target="_blank" rel="noopener" className="underline" onClick={(e) => e.stopPropagation()}>{c.author || 'Wikimedia Commons'}</a> : c.author}
      {c.license && <> · {c.license_url ? <a href={c.license_url} target="_blank" rel="noopener license" className="underline" onClick={(e) => e.stopPropagation()}>{c.license}</a> : c.license}</>}
    </span>
  );
}

export default function Gallery({ photos, alt, credits = [] }: { photos: string[]; alt: string; credits?: PhotoCredit[] }) {
  const creditFor = (u: string) => credits.find((c) => c.url === u);
  const [open, setOpen] = useState<number | null>(null);
  const go = (d: number) => setOpen((i) => (i === null ? null : (i + d + photos.length) % photos.length));
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {photos.map((p, i) => (
          <figure key={p + i}>
            <button onClick={() => setOpen(i)} className="block aspect-[4/3] w-full overflow-hidden rounded-xl bg-slate-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p} alt={`${alt} photo ${i + 1}`} className="h-full w-full object-cover transition hover:scale-105" loading="lazy" />
            </button>
            <figcaption className="mt-1"><Credit c={creditFor(p)} /></figcaption>
          </figure>
        ))}
      </div>
      {open !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={() => setOpen(null)}>
          <button className="absolute right-4 top-4 text-white" aria-label="Close"><X size={28} /></button>
          {photos.length > 1 && <button className="absolute left-4 text-white" onClick={(e) => { e.stopPropagation(); go(-1); }} aria-label="Previous"><ChevronLeft size={36} /></button>}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <figure className="max-w-full text-center" onClick={(e) => e.stopPropagation()}>
            <img src={photos[open]} alt={alt} className="mx-auto max-h-[80vh] max-w-full rounded-lg" />
            <figcaption className="mt-2"><Credit c={creditFor(photos[open])} dark /></figcaption>
          </figure>
          {photos.length > 1 && <button className="absolute right-4 text-white" onClick={(e) => { e.stopPropagation(); go(1); }} aria-label="Next"><ChevronRight size={36} /></button>}
        </div>
      )}
    </>
  );
}
