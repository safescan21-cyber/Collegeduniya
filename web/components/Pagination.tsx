import Link from 'next/link';

export default function Pagination({ page, total, perPage, basePath, params }: {
  page: number; total: number; perPage: number; basePath: string; params: Record<string, string | undefined>;
}) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  if (pages <= 1) return null;
  const href = (p: number) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => v && k !== 'page' && q.set(k, v));
    q.set('page', String(p));
    return `${basePath}?${q.toString()}`;
  };
  const nums = Array.from({ length: pages }, (_, i) => i + 1).filter((n) => n === 1 || n === pages || Math.abs(n - page) <= 2);
  return (
    <nav className="mt-10 flex flex-wrap items-center justify-center gap-1">
      {page > 1 && <Link className="btn-ghost" href={href(page - 1)}>← Prev</Link>}
      {nums.map((n, i) => (
        <span key={n} className="flex items-center">
          {i > 0 && nums[i - 1] !== n - 1 && <span className="px-1 text-slate-400">…</span>}
          <Link href={href(n)} className={n === page ? 'btn-primary' : 'btn-ghost'}>{n}</Link>
        </span>
      ))}
      {page < pages && <Link className="btn-ghost" href={href(page + 1)}>Next →</Link>}
    </nav>
  );
}
