import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="container-x py-24 text-center">
      <p className="text-6xl font-extrabold text-brand-600">404</p>
      <h1 className="mt-3 text-2xl font-bold text-slate-900">Page not found</h1>
      <p className="mt-2 text-slate-500">The college, stay or job you are looking for may have been removed.</p>
      <div className="mt-6 flex justify-center gap-2"><Link href="/" className="btn-primary">Home</Link><Link href="/colleges" className="btn-ghost">Browse colleges</Link></div>
    </div>
  );
}
