import type { Metadata } from 'next';
import Link from 'next/link';
import { BookOpen, ArrowRight } from 'lucide-react';
import { PREP } from '@/lib/prepMaterial';

export const metadata: Metadata = {
  title: 'Free study material — CAT, XAT, SNAP, NMAT, GMAT, GRE',
  description: 'Free notes, formulas, strategy and solved questions for MBA and study-abroad entrance exams, with links to the free official mock tests.',
  alternates: { canonical: '/study-material' },
};

export default function StudyMaterialHub() {
  const list = Object.values(PREP);
  return (
    <div className="container-x space-y-6 py-8">
      <header>
        <h1 className="flex items-center gap-2 text-3xl font-bold text-slate-900"><BookOpen className="text-brand-600" />Free study material</h1>
        <p className="mt-2 max-w-3xl text-slate-600">Notes, formulas, strategy and solved questions written by Collegeolo, with the official exam pattern and links to free official mock tests. Free to read — no sign-up.</p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((p) => (
          <Link key={p.slug} href={`/exams/${p.slug}/study-material`} className="card group p-5 hover:shadow-md">
            <p className="text-xl font-bold text-slate-900">{p.exam}</p>
            <p className="mt-1 line-clamp-3 text-sm text-slate-600">{p.intro}</p>
            <p className="mt-2 text-xs text-slate-500">{p.sections.map((s) => s.short).join(' · ')} · {p.sections.reduce((n, s) => n + s.practice.length, 0)} solved questions</p>
            <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand-700">Start reading<ArrowRight size={14} className="transition group-hover:translate-x-0.5" /></span>
          </Link>
        ))}
      </div>
    </div>
  );
}
