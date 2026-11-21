'use client';
import { ExternalLink } from 'lucide-react';
import ResourceManager from '@/components/admin/ResourceManager';

export default function AdminCourseCatalog() {
  return (
    <div className="space-y-3">
      <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">Course pages (/courses/…) show the colleges that offer each course, with real fee and placement numbers. College courses are linked automatically by the <b>Match</b> pattern. Write <b>About</b> and <b>Careers</b> yourself, from experience and official sources — they appear only when filled.</p>
      <ResourceManager resource="course_catalog" title="Course catalogue" idKey="slug"
        defaults={{ level: 'UG', is_published: true, sort: 100 }}
        fields={[
          { name: 'name', label: 'Short name', type: 'text', required: true, placeholder: 'B.Tech / B.E.' },
          { name: 'slug', label: 'URL slug', type: 'text', required: true, help: '/courses/<slug> — keep it stable' },
          { name: 'full_name', label: 'Full name', type: 'text', required: true, full: true },
          { name: 'level', label: 'Level', type: 'select', options: ['UG', 'PG', 'Diploma', 'PhD', 'Certificate'], required: true },
          { name: 'stream', label: 'Stream', type: 'text', required: true },
          { name: 'duration', label: 'Duration', type: 'text', placeholder: '4 years' },
          { name: 'exam_slugs', label: 'Entrance exams (slugs)', type: 'tags', placeholder: 'jee-main, mht-cet' },
          { name: 'eligibility', label: 'Eligibility', type: 'textarea' },
          { name: 'match', label: 'Match pattern (regex on college course names)', type: 'text', required: true, full: true, help: 'e.g. ^\\s*bba\\y  — \\y means word boundary' },
          { name: 'about', label: 'About the course (your own writing)', type: 'textarea' },
          { name: 'careers', label: 'Jobs & careers (your own writing)', type: 'textarea' },
          { name: 'sort', label: 'Order', type: 'number' },
          { name: 'is_published', label: 'Published', type: 'bool' },
        ]}
        columns={[
          { key: 'name', label: 'Course', render: (r) => <div><p className="font-semibold text-slate-900">{r.name}</p><p className="text-xs text-slate-500">{r.full_name}</p></div> },
          { key: 'level', label: 'Level', render: (r) => `${r.level} · ${r.stream}` },
          { key: 'about', label: 'Written', render: (r) => (r.about ? 'Yes' : <span className="text-amber-700">Not yet</span>) },
        ]}
        rowActions={(r) => <a href={`/courses/${r.slug}`} target="_blank" className="btn-ghost px-2 py-1.5"><ExternalLink size={14} /></a>}
      />
    </div>
  );
}
