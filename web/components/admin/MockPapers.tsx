'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Layers, ExternalLink } from 'lucide-react';
import { api } from '@/lib/api';

type Paper = { id: string; exam_slug: string; kind: string; number: number; title: string; section: string | null; topic: string | null; duration_min: number; is_published: boolean; questions: number };

export default function MockPapers({ exams, slug, setSlug }: { exams: { slug: string; short_name: string }[]; slug: string; setSlug: (s: string) => void }) {
  const [rows, setRows] = useState<Paper[]>([]);
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState('');
  const load = useCallback(() => api<{ data: Paper[] }>(`/api/admin/mock/papers${slug ? `?exam_slug=${slug}` : ''}`).then((r) => setRows(r.data)).catch((e) => setMsg(e.message)), [slug]);
  useEffect(() => { load(); }, [load]);
  const build = async () => {
    if (!slug) return setMsg('Pick an exam first');
    setBusy(true); setMsg('');
    try { const r = await api<{ created: number }>('/api/admin/mock/papers/build', { method: 'POST', body: JSON.stringify({ exam_slug: slug }) }); setMsg(r.created ? `${r.created} new test(s) created from approved questions.` : 'No new tests — add/approve more questions first (each full test needs a complete set of unused questions).'); load(); }
    catch (e: any) { setMsg(e.message); }
    setBusy(false);
  };
  const toggle = async (p: Paper) => { await api(`/api/admin/mock/papers/${p.id}`, { method: 'PATCH', body: JSON.stringify({ is_published: !p.is_published }) }); load(); };
  return (
    <div className="card space-y-4 p-5">
      <div><h2 className="flex items-center gap-2 font-bold"><Layers size={18} />Numbered tests</h2>
        <p className="text-sm text-slate-600">Fixed papers (Full Mock Test 1, 2…, sectional and topic tests) built from approved questions. Everyone taking the same paper gets the same questions, so ranks and leaderboards are fair. Autopilot builds these automatically; you can build now or hide a paper.</p></div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm"><span className="label">Exam</span><select className="input" value={slug} onChange={(e) => setSlug(e.target.value)}><option value="">All exams</option>{exams.map((e) => <option key={e.slug} value={e.slug}>{e.short_name}</option>)}</select></label>
        <button onClick={build} disabled={busy || !slug} className="btn-primary">{busy && <Loader2 size={16} className="animate-spin" />}Build tests now</button>
        {slug && <Link href={`/mock-tests/${slug}`} target="_blank" className="btn-ghost"><ExternalLink size={15} />Student view</Link>}
      </div>
      {msg && <p className="text-sm text-slate-600">{msg}</p>}
      <div className="overflow-x-auto"><table className="w-full text-left text-sm">
        <thead className="text-xs uppercase text-slate-500"><tr><th className="py-2">Test</th><th>Exam</th><th>Type</th><th>Qs</th><th>Min</th><th>Visible</th></tr></thead>
        <tbody>{rows.map((p) => (
          <tr key={p.id} className="border-t border-slate-100"><td className="py-2"><Link href={`/mock-tests/leaderboard/${p.id}`} className="hover:underline">{p.title}</Link></td><td>{p.exam_slug}</td><td className="capitalize">{p.kind}</td><td>{p.questions}</td><td>{p.duration_min}</td>
            <td><input type="checkbox" checked={p.is_published} onChange={() => toggle(p)} /></td></tr>))}
          {!rows.length && <tr><td colSpan={6} className="py-6 text-center text-slate-500">No tests yet.</td></tr>}</tbody>
      </table></div>
    </div>
  );
}
