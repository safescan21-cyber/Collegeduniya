'use client';
import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import ResourceManager from '@/components/admin/ResourceManager';
import { api } from '@/lib/api';
import { money } from '@/lib/format';

export default function CollegeExtras({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [college, setCollege] = useState<any>(null);
  useEffect(() => { api(`/api/admin/colleges/${id}`).then((r) => setCollege(r.data)).catch(() => {}); }, [id]);

  return (
    <div className="space-y-10">
      <div>
        <Link href="/admin/colleges" className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft size={14} />All colleges</Link>
        <h1 className="mt-2 text-2xl font-extrabold text-slate-900">{college?.name || 'College'}</h1>
        <p className="text-sm text-slate-500">Manage courses & fees, placements, cutoffs (used by the college predictor) and nearby places.</p>
      </div>

      <ResourceManager
        resource="courses"
        title="Courses"
        fixed={{ college_id: id }}
        searchable={false}
        defaults={{ level: 'UG', currency: college?.currency || 'INR' }}
        fields={[
          { name: 'name', label: 'Course name', type: 'text', required: true, full: true, placeholder: 'B.Tech Computer Science' },
          { name: 'level', label: 'Level', type: 'select', options: ['UG', 'PG', 'Diploma', 'PhD', 'Certificate'], required: true },
          { name: 'duration', label: 'Duration', type: 'text', placeholder: '4 years' },
          { name: 'fees', label: 'Fees / year', type: 'number' },
          { name: 'currency', label: 'Currency', type: 'select', options: ['INR', 'USD', 'GBP', 'EUR', 'CAD', 'AUD', 'AED', 'SGD', 'NZD'], required: true },
          { name: 'seats', label: 'Seats', type: 'number' },
          { name: 'eligibility', label: 'Eligibility / entrance exam', type: 'text', full: true },
        ]}
        columns={[
          { key: 'name', label: 'Course', render: (r) => <span className="font-medium">{r.name}</span> },
          { key: 'level', label: 'Level' },
          { key: 'duration', label: 'Duration', render: (r) => r.duration || '—' },
          { key: 'fees', label: 'Fees', render: (r) => money(r.fees, r.currency) },
        ]}
      />

      <ResourceManager
        resource="college_placements"
        title="Placements"
        fixed={{ college_id: id }}
        searchable={false}
        defaults={{ year: new Date().getFullYear(), course: 'All', currency: college?.currency || 'INR', package_unit: 'year' }}
        fields={[
          { name: 'year', label: 'Year', type: 'number', required: true },
          { name: 'course', label: 'Course (or All)', type: 'text' },
          { name: 'avg_package', label: 'Average package', type: 'number' },
          { name: 'median_package', label: 'Median package', type: 'number' },
          { name: 'highest_package', label: 'Highest package', type: 'number' },
          { name: 'currency', label: 'Currency', type: 'select', options: ['INR', 'USD', 'GBP', 'EUR', 'CAD', 'AUD', 'AED', 'SGD', 'NZD'], required: true },
          { name: 'package_unit', label: 'Package per', type: 'select', options: ['year', 'month'], required: true },
          { name: 'placement_rate', label: 'Placement rate %', type: 'number' },
          { name: 'students_placed', label: 'Students placed', type: 'number' },
          { name: 'companies_visited', label: 'Companies visited', type: 'number' },
          { name: 'top_recruiters', label: 'Top recruiters', type: 'tags', full: true },
          { name: 'source', label: 'Source', type: 'text', full: true, placeholder: 'e.g. NIRF 2026 data / college placement report' },
        ]}
        columns={[
          { key: 'year', label: 'Year' },
          { key: 'course', label: 'Course', render: (r) => r.course || 'All' },
          { key: 'avg', label: 'Avg / Highest', render: (r) => `${money(r.avg_package, r.currency)} / ${money(r.highest_package, r.currency)}` },
          { key: 'placement_rate', label: 'Placed', render: (r) => (r.placement_rate != null ? `${r.placement_rate}%` : '—') },
        ]}
      />

      <ResourceManager
        resource="cutoffs"
        title="Cutoffs (closing ranks)"
        fixed={{ college_id: id }}
        searchable={false}
        defaults={{ year: new Date().getFullYear(), category: 'General', quota: 'All India', round: 'Final' }}
        fields={[
          { name: 'exam_slug', label: 'Exam slug', type: 'text', required: true, placeholder: 'jee-main', help: 'Must match an exam in Admin → Exams' },
          { name: 'year', label: 'Year', type: 'number', required: true },
          { name: 'course', label: 'Course', type: 'text', required: true, full: true },
          { name: 'category', label: 'Category', type: 'select', options: ['General', 'EWS', 'OBC-NCL', 'SC', 'ST', 'General-PwD', 'Other'], required: true },
          { name: 'quota', label: 'Quota', type: 'text', placeholder: 'All India / Home State / Other State' },
          { name: 'round', label: 'Round', type: 'text', placeholder: 'Final' },
          { name: 'opening_rank', label: 'Opening rank', type: 'number' },
          { name: 'closing_rank', label: 'Closing rank', type: 'number', required: true },
          { name: 'source', label: 'Source', type: 'text', full: true },
        ]}
        columns={[
          { key: 'exam_slug', label: 'Exam' },
          { key: 'year', label: 'Year' },
          { key: 'course', label: 'Course' },
          { key: 'category', label: 'Category', render: (r) => `${r.category}${r.quota ? ` · ${r.quota}` : ''}` },
          { key: 'closing_rank', label: 'Closing', render: (r) => r.closing_rank?.toLocaleString() },
        ]}
      />

      <ResourceManager
        resource="places"
        title="Nearby places"
        fixed={{ college_id: id }}
        searchable={false}
        defaults={{ kind: 'company' }}
        fields={[
          { name: 'kind', label: 'Type', type: 'select', options: ['company', 'hospital', 'bank', 'transport', 'other'], required: true },
          { name: 'name', label: 'Name', type: 'text', required: true },
          { name: 'address', label: 'Address', type: 'text', full: true },
          { name: 'distance_km', label: 'Distance (km)', type: 'number' },
          { name: 'phone', label: 'Phone', type: 'text' },
          { name: 'website', label: 'Website', type: 'text', full: true },
        ]}
        columns={[
          { key: 'kind', label: 'Type', render: (r) => <span className="chip capitalize">{r.kind}</span> },
          { key: 'name', label: 'Name', render: (r) => <span className="font-medium">{r.name}</span> },
          { key: 'distance_km', label: 'Distance', render: (r) => (r.distance_km != null ? `${r.distance_km} km` : '—') },
        ]}
      />
    </div>
  );
}
