'use client';
import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Eye, EyeOff, Save, Loader2, ExternalLink, Star, Trash2 } from 'lucide-react';
import ResourceManager, { FieldInput } from '@/components/admin/ResourceManager';
import { api } from '@/lib/api';
import { money } from '@/lib/format';
import { COLLEGE_FIELDS, HIDEABLE_FIELDS, HIDEABLE_SECTIONS, CURRENCIES } from '@/lib/adminFields';

type Tab = 'details' | 'visibility' | 'courses' | 'placements' | 'cutoffs' | 'nearby';

function Toggle({ on, onChange, label, hint }: { on: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-slate-200 p-3 hover:bg-slate-50">
      <span><span className="block font-medium text-slate-800">{label}</span>{hint && <span className="block text-xs text-slate-500">{hint}</span>}</span>
      <span className="flex items-center gap-2 text-xs font-semibold">
        <span className={on ? 'text-emerald-700' : 'text-slate-400'}>{on ? 'Shown' : 'Hidden'}</span>
        <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)}
          className={`relative h-6 w-11 rounded-full transition ${on ? 'bg-emerald-500' : 'bg-slate-300'}`}>
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${on ? 'start-[22px]' : 'start-0.5'}`} />
        </button>
      </span>
    </label>
  );
}

export default function CollegeEditor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [tab, setTab] = useState<Tab>('details');
  const [college, setCollege] = useState<any>(null);
  const [draft, setDraft] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const r = await api(`/api/admin/colleges/${id}`);
    setCollege(r.data); setDraft({ ...r.data, hidden_fields: r.data.hidden_fields || [], hidden_sections: r.data.hidden_sections || [] });
  }, [id]);
  useEffect(() => { load().catch((e) => setMsg({ ok: false, text: e.message })); }, [load]);

  const save = async (patch?: any) => {
    setSaving(true); setMsg(null);
    const body: any = {};
    const src = patch || draft;
    for (const f of COLLEGE_FIELDS) if (src[f.name] !== undefined) body[f.name] = src[f.name];
    body.hidden_fields = src.hidden_fields; body.hidden_sections = src.hidden_sections;
    if (body.slug === college.slug) delete body.slug;
    try {
      const r = await api(`/api/admin/colleges/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
      setCollege(r.data); setDraft({ ...r.data, hidden_fields: r.data.hidden_fields || [], hidden_sections: r.data.hidden_sections || [] });
      setMsg({ ok: true, text: 'Saved ✓ — changes are live.' });
    } catch (e: any) { setMsg({ ok: false, text: e.message }); }
    setSaving(false);
  };

  const remove = async () => {
    if (!confirm(`Delete ${college.name}? Reviews, courses and applications for it are deleted too. Use “Hide” if you might need it again.`)) return;
    await api(`/api/admin/colleges/${id}`, { method: 'DELETE' }).catch((e) => alert(e.message));
    window.location.href = '/admin/colleges';
  };

  if (!draft) return <div className="card grid h-64 place-items-center">{msg ? <p className="text-rose-600">{msg.text}</p> : <Loader2 className="animate-spin text-slate-300" />}</div>;

  const toggleIn = (key: 'hidden_fields' | 'hidden_sections', v: string, shown: boolean) =>
    setDraft((d: any) => ({ ...d, [key]: shown ? d[key].filter((x: string) => x !== v) : Array.from(new Set([...d[key], v])) }));
  const dirty = JSON.stringify(draft) !== JSON.stringify({ ...college, hidden_fields: college.hidden_fields || [], hidden_sections: college.hidden_sections || [] });
  const TABS: [Tab, string][] = [['details', 'Details'], ['visibility', 'Show / hide'], ['courses', 'Courses & fees'], ['placements', 'Placements'], ['cutoffs', 'Cutoffs'], ['nearby', 'Nearby places']];

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/colleges" className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft size={14} />All colleges</Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">{college.name}</h1>
            <p className="text-sm text-slate-500">{[college.city, college.state, college.country].filter(Boolean).join(', ')} · source: {college.source}{college.external_id ? ` (${college.external_id})` : ''}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => save({ ...draft, is_published: !draft.is_published })} disabled={saving}
              className={draft.is_published ? 'btn-ghost' : 'btn-primary'}>{draft.is_published ? <><EyeOff size={16} />Hide college</> : <><Eye size={16} />Show college</>}</button>
            <button onClick={() => save({ ...draft, is_featured: !draft.is_featured })} disabled={saving} className="btn-ghost"><Star size={16} className={draft.is_featured ? 'fill-accent-400 text-accent-400' : ''} />{draft.is_featured ? 'Featured' : 'Feature'}</button>
            {college.is_published && <a href={`/colleges/${college.slug}`} target="_blank" className="btn-ghost"><ExternalLink size={16} />View page</a>}
            <button onClick={remove} className="btn-ghost text-rose-600" aria-label="Delete"><Trash2 size={16} /></button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {college.is_published ? <span className="chip-green"><Eye size={12} />Visible on site</span> : <span className="chip-red"><EyeOff size={12} />Hidden from site</span>}
          {(college.hidden_fields || []).map((f: string) => <span key={f} className="chip">hidden: {f}</span>)}
          {(college.hidden_sections || []).map((f: string) => <span key={f} className="chip">hidden section: {f}</span>)}
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-semibold ${tab === k ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>{label}</button>
        ))}
      </div>

      {(tab === 'details' || tab === 'visibility') && (
        <div className="sticky top-16 z-20 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur">
          <span className={`text-sm ${msg ? (msg.ok ? 'text-emerald-700' : 'text-rose-600') : 'text-slate-500'}`}>{msg?.text || (dirty ? 'You have unsaved changes' : 'All changes saved')}</span>
          <div className="flex gap-2">
            {dirty && <button onClick={() => setDraft({ ...college, hidden_fields: college.hidden_fields || [], hidden_sections: college.hidden_sections || [] })} className="btn-ghost py-1.5">Discard</button>}
            <button onClick={() => save()} disabled={saving || !dirty} className="btn-primary py-1.5">{saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}Save</button>
          </div>
        </div>
      )}

      {tab === 'details' && (
        <div className="card grid gap-4 p-6 sm:grid-cols-2">
          {COLLEGE_FIELDS.map((f) => {
            const hiddenKey = ({ fees_min: 'fees', fees_max: 'fees', phone: 'contact', email: 'contact', website: 'website', address: 'address', latitude: 'map', longitude: 'map',
              ranking: 'ranking', accreditation: 'accreditation', established: 'established', students_count: 'students', description: 'description', logo_url: 'logo', cover_url: 'photos', photos: 'photos' } as Record<string, string>)[f.name];
            const isHidden = hiddenKey && draft.hidden_fields.includes(hiddenKey);
            return (
              <div key={f.name} className={f.full || ['textarea', 'images', 'image'].includes(f.type) ? 'sm:col-span-2' : ''}>
                <label className="label flex items-center justify-between">
                  <span>{f.label}{f.required && ' *'}</span>
                  {hiddenKey && (
                    <button type="button" onClick={() => toggleIn('hidden_fields', hiddenKey, !!isHidden)}
                      className={`flex items-center gap-1 normal-case tracking-normal ${isHidden ? 'text-rose-600' : 'text-slate-400 hover:text-slate-700'}`} title={isHidden ? 'Hidden from visitors — click to show' : 'Click to hide from visitors'}>
                      {isHidden ? <><EyeOff size={12} />hidden</> : <><Eye size={12} />shown</>}
                    </button>
                  )}
                </label>
                <FieldInput f={f} value={draft[f.name]} folder="colleges" onChange={(v) => setDraft((d: any) => ({ ...d, [f.name]: v }))} />
                {f.help && <p className="mt-1 text-xs text-slate-400">{f.help}</p>}
              </div>
            );
          })}
        </div>
      )}

      {tab === 'visibility' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="card p-5">
            <h2 className="font-bold text-slate-900">Information</h2>
            <p className="mb-3 text-sm text-slate-500">Hidden information is removed for visitors everywhere (cards, college page, compare, search, chat) — your team still sees it here.</p>
            <div className="space-y-2">{HIDEABLE_FIELDS.map((f) => <Toggle key={f.key} label={f.label} hint={f.hint} on={!draft.hidden_fields.includes(f.key)} onChange={(v) => toggleIn('hidden_fields', f.key, v)} />)}</div>
          </div>
          <div className="card p-5">
            <h2 className="font-bold text-slate-900">Page sections</h2>
            <p className="mb-3 text-sm text-slate-500">Turn off whole parts of this college’s page.</p>
            <div className="space-y-2">{HIDEABLE_SECTIONS.map((s) => <Toggle key={s.key} label={s.label} on={!draft.hidden_sections.includes(s.key)} onChange={(v) => toggleIn('hidden_sections', s.key, v)} />)}</div>
            <div className="mt-4 flex gap-2">
              <button className="btn-ghost py-1.5" onClick={() => setDraft((d: any) => ({ ...d, hidden_fields: [], hidden_sections: [] }))}>Show everything</button>
              <button className="btn-ghost py-1.5" onClick={() => setDraft((d: any) => ({ ...d, hidden_fields: ['fees', 'contact'], hidden_sections: ['courses', 'placements', 'cutoffs'] }))}>Basic profile only</button>
            </div>
          </div>
        </div>
      )}

      {tab === 'courses' && (
        <ResourceManager resource="courses" title="Courses" fixed={{ college_id: id }} searchable={false}
          defaults={{ level: 'UG', currency: college?.currency || 'INR' }}
          fields={[
            { name: 'name', label: 'Course name', type: 'text', required: true, full: true, placeholder: 'B.Tech Computer Science' },
            { name: 'level', label: 'Level', type: 'select', options: ['UG', 'PG', 'Diploma', 'PhD', 'Certificate'], required: true },
            { name: 'duration', label: 'Duration', type: 'text', placeholder: '4 years' },
            { name: 'fees', label: 'Fees / year', type: 'number' },
            { name: 'currency', label: 'Currency', type: 'select', options: CURRENCIES, required: true },
            { name: 'seats', label: 'Seats', type: 'number' },
            { name: 'eligibility', label: 'Eligibility / entrance exam', type: 'text', full: true },
          ]}
          columns={[
            { key: 'name', label: 'Course', render: (r) => <span className="font-medium">{r.name}</span> },
            { key: 'level', label: 'Level' },
            { key: 'duration', label: 'Duration', render: (r) => r.duration || '—' },
            { key: 'fees', label: 'Fees', render: (r) => money(r.fees, r.currency) },
          ]} />
      )}

      {tab === 'placements' && (
        <ResourceManager resource="college_placements" title="Placements" fixed={{ college_id: id }} searchable={false}
          defaults={{ year: new Date().getFullYear(), course: 'All', currency: college?.currency || 'INR', package_unit: 'year' }}
          fields={[
            { name: 'year', label: 'Year', type: 'number', required: true },
            { name: 'course', label: 'Course (or All)', type: 'text' },
            { name: 'avg_package', label: 'Average package', type: 'number' },
            { name: 'median_package', label: 'Median package', type: 'number' },
            { name: 'highest_package', label: 'Highest package', type: 'number' },
            { name: 'currency', label: 'Currency', type: 'select', options: CURRENCIES, required: true },
            { name: 'package_unit', label: 'Package per', type: 'select', options: ['year', 'month'], required: true },
            { name: 'placement_rate', label: 'Placement rate %', type: 'number' },
            { name: 'students_placed', label: 'Students placed', type: 'number' },
            { name: 'companies_visited', label: 'Companies visited', type: 'number' },
            { name: 'top_recruiters', label: 'Top recruiters', type: 'tags', full: true },
            { name: 'source', label: 'Source', type: 'text', full: true, placeholder: 'e.g. NIRF 2026 data' },
          ]}
          columns={[
            { key: 'year', label: 'Year' }, { key: 'course', label: 'Course', render: (r) => r.course || 'All' },
            { key: 'avg', label: 'Avg / Highest', render: (r) => `${money(r.avg_package, r.currency)} / ${money(r.highest_package, r.currency)}` },
            { key: 'placement_rate', label: 'Placed', render: (r) => (r.placement_rate != null ? `${r.placement_rate}%` : '—') },
          ]} />
      )}

      {tab === 'cutoffs' && (
        <ResourceManager resource="cutoffs" title="Cutoffs (closing ranks)" fixed={{ college_id: id }} searchable={false}
          defaults={{ year: new Date().getFullYear(), category: 'General', quota: 'All India', round: 'Final' }}
          fields={[
            { name: 'exam_slug', label: 'Exam slug', type: 'text', required: true, placeholder: 'jee-main', help: 'Must match an exam in Admin → Exams' },
            { name: 'year', label: 'Year', type: 'number', required: true },
            { name: 'course', label: 'Course', type: 'text', required: true, full: true },
            { name: 'category', label: 'Category', type: 'select', options: ['General', 'EWS', 'OBC-NCL', 'SC', 'ST', 'General-PwD', 'Other'], required: true },
            { name: 'quota', label: 'Quota', type: 'text' }, { name: 'round', label: 'Round', type: 'text' },
            { name: 'opening_rank', label: 'Opening rank', type: 'number' }, { name: 'closing_rank', label: 'Closing rank', type: 'number', required: true },
            { name: 'source', label: 'Source', type: 'text', full: true },
          ]}
          columns={[
            { key: 'exam_slug', label: 'Exam' }, { key: 'year', label: 'Year' }, { key: 'course', label: 'Course' },
            { key: 'category', label: 'Category', render: (r) => `${r.category}${r.quota ? ` · ${r.quota}` : ''}` },
            { key: 'closing_rank', label: 'Closing', render: (r) => r.closing_rank?.toLocaleString() },
          ]} />
      )}

      {tab === 'nearby' && (
        <ResourceManager resource="places" title="Nearby places (added by your team)" fixed={{ college_id: id }} searchable={false} defaults={{ kind: 'company' }}
          fields={[
            { name: 'kind', label: 'Type', type: 'select', options: ['company', 'hospital', 'bank', 'transport', 'other'], required: true },
            { name: 'name', label: 'Name', type: 'text', required: true }, { name: 'address', label: 'Address', type: 'text', full: true },
            { name: 'distance_km', label: 'Distance (km)', type: 'number' }, { name: 'phone', label: 'Phone', type: 'text' },
            { name: 'website', label: 'Website', type: 'text', full: true },
          ]}
          columns={[
            { key: 'kind', label: 'Type', render: (r) => <span className="chip capitalize">{r.kind}</span> },
            { key: 'name', label: 'Name', render: (r) => <span className="font-medium">{r.name}</span> },
            { key: 'distance_km', label: 'Distance', render: (r) => (r.distance_km != null ? `${r.distance_km} km` : '—') },
          ]} />
      )}
    </div>
  );
}
