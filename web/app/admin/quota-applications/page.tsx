'use client';
import { useState } from 'react';
import { Paperclip, Loader2 } from 'lucide-react';
import ModerationList from '@/components/admin/ModerationList';
import { api } from '@/lib/api';
import { timeAgo } from '@/lib/format';

function Docs({ id, n }: { id: string; n: number }) {
  const [files, setFiles] = useState<{ name: string; url: string }[] | null>(null);
  const [busy, setBusy] = useState(false);
  if (!n) return <span className="text-xs text-slate-400">No files</span>;
  if (files) return <div className="space-y-0.5">{files.map((f) => <a key={f.url} href={f.url} target="_blank" rel="noopener" className="block max-w-40 truncate text-xs text-brand-700 underline">{f.name}</a>)}</div>;
  return (
    <button className="flex items-center gap-1 text-xs font-semibold text-brand-700" disabled={busy}
      onClick={async () => { setBusy(true); try { setFiles((await api(`/api/admin/quota_applications/${id}/documents`)).data); } catch (e: any) { alert(e.message); } setBusy(false); }}>
      {busy ? <Loader2 size={12} className="animate-spin" /> : <Paperclip size={12} />}{n} document{n > 1 ? 's' : ''}
    </button>
  );
}

const money = (v: number | null, c = 'USD', per = 'year') => {
  if (v == null) return '';
  try { return `${new Intl.NumberFormat(c === 'INR' ? 'en-IN' : 'en', { style: 'currency', currency: c || 'USD', maximumFractionDigits: 0 }).format(v)}/${per}`; }
  catch { return `${c} ${v}/${per}`; }
};

export default function AdminQuotaApplications() {
  return (
    <ModerationList
      resource="quota_applications" title="Management quota applications" exportName="quota_applications"
      statusField="status" noteField="admin_note" canDelete={false}
      statusOptions={['submitted', 'under_review', 'contacted', 'shortlisted', 'offered', 'admitted', 'rejected', 'withdrawn']}
      tabs={[
        { label: 'New', params: { status: 'submitted' } }, { label: 'Under review', params: { status: 'under_review' } },
        { label: 'Contacted', params: { status: 'contacted' } }, { label: 'Shortlisted', params: { status: 'shortlisted' } },
        { label: 'Offered', params: { status: 'offered' } }, { label: 'Admitted', params: { status: 'admitted' } }, { label: 'All', params: {} },
      ]}
      columns={[
        { key: 'student', label: 'Student', render: (r) => (
          <div><p className="font-semibold text-slate-900">{r.full_name}</p><a href={`tel:${r.phone}`} className="block text-xs text-slate-600">{r.phone}</a>
            <a href={`mailto:${r.email}`} className="text-xs text-brand-700">{r.email}</a>
            <p className="text-xs text-slate-400">{[r.city, r.state, r.country].filter(Boolean).join(', ')}{r.category ? ` · ${r.category}` : ''}</p>
            {(r.nationality || r.needs_visa) && <p className="text-xs text-slate-500">{r.nationality}{r.needs_visa ? ' · needs visa' : ''}</p>}
            {r.preferred_lang && r.preferred_lang !== 'en' && <span className="chip mt-1">speaks: {r.preferred_lang}</span>}
            {r.parent_name && <p className="text-xs text-slate-400">Parent: {r.parent_name} {r.parent_phone && <a href={`tel:${r.parent_phone}`}>{r.parent_phone}</a>}</p>}</div>) },
        { key: 'seat', label: 'College & seat', render: (r) => (
          <div><a href={`/colleges/${r.colleges?.slug}`} target="_blank" className="font-medium text-brand-700">{r.colleges?.name}</a>
            <p className="text-xs">{r.quota_seats?.course}</p>
            <p className="text-xs text-slate-400">{r.colleges?.country} · {r.quota_seats?.quota_type} {r.quota_seats?.intake || r.quota_seats?.academic_year || ''} {money(r.quota_seats?.fee_per_year, r.quota_seats?.currency, r.quota_seats?.fee_period)}</p></div>) },
        { key: 'academics', label: 'Academics', render: (r) => (
          <div className="text-xs text-slate-600"><p>{r.qualification} {r.percentage != null ? `· ${r.percentage}%` : ''} {r.passing_year ? `· ${r.passing_year}` : ''}</p>
            <p>{r.board_or_university}</p>{r.entrance_exam && <p>{r.entrance_exam}: {r.entrance_score}</p>}
            {r.english_test && <p>{r.english_test}{r.english_score ? `: ${r.english_score}` : ''}</p>}
            {r.message && <p className="mt-1 max-w-56 italic text-slate-500">“{r.message}”</p>}</div>) },
        { key: 'docs', label: 'Documents', render: (r) => <Docs id={r.id} n={(r.documents || []).length} /> },
        { key: 'when', label: 'Applied', render: (r) => <span className="text-xs text-slate-500">{timeAgo(r.created_at)}</span> },
      ]}
    />
  );
}
