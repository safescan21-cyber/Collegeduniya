'use client';
import { useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

export default function Gallery({ photos, alt }: { photos: string[]; alt: string }) {
  const [open, setOpen] = useState<number | null>(null);
  const go = (d: number) => setOpen((i) => (i === null ? null : (i + d + photos.length) % photos.length));
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {photos.map((p, i) => (
          <button key={p + i} onClick={() => setOpen(i)} className="aspect-[4/3] overflow-hidden rounded-xl bg-slate-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p} alt={`${alt} photo ${i + 1}`} className="h-full w-full object-cover transition hover:scale-105" loading="lazy" />
          </button>
        ))}
      </div>
      {open !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={() => setOpen(null)}>
          <button className="absolute right-4 top-4 text-white" aria-label="Close"><X size={28} /></button>
          {photos.length > 1 && <button className="absolute left-4 text-white" onClick={(e) => { e.stopPropagation(); go(-1); }} aria-label="Previous"><ChevronLeft size={36} /></button>}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photos[open]} alt={alt} className="max-h-[85vh] max-w-full rounded-lg" onClick={(e) => e.stopPropagation()} />
          {photos.length > 1 && <button className="absolute right-4 text-white" onClick={(e) => { e.stopPropagation(); go(1); }} aria-label="Next"><ChevronRight size={36} /></button>}
        </div>
      )}
    </>
  );
}
