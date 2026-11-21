import Link from 'next/link';

// Plain reading layout for About / policies — no hero banners, just text people can read.
export default function LegalPage({ title, updated, children, crumbs = true }: { title: string; updated?: string; children: React.ReactNode; crumbs?: boolean }) {
  return (
    <div className="container-x max-w-3xl py-10">
      {crumbs && <nav className="text-sm text-slate-500"><Link href="/" className="hover:underline">Home</Link> / <span>{title}</span></nav>}
      <h1 className="mt-2 text-3xl font-extrabold text-slate-900">{title}</h1>
      {updated && <p className="mt-1 text-sm text-slate-500">Last updated {updated}</p>}
      <div className="legal mt-6 space-y-4 text-[15px] leading-7 text-slate-700 [&_a]:text-brand-700 [&_a]:underline [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-slate-900 [&_h3]:mt-5 [&_h3]:font-semibold [&_h3]:text-slate-900 [&_li]:ms-5 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ul]:list-disc [&_ul]:space-y-1">
        {children}
      </div>
    </div>
  );
}
