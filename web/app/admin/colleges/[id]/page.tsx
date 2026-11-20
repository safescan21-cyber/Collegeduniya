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
        <p className="text-sm text-slate-500">Manage courses & fees, and nearby companies / hospitals shown on the college page.</p>
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
