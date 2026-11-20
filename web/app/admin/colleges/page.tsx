'use client';
import Link from 'next/link';
import { ListTree, ExternalLink } from 'lucide-react';
import ResourceManager, { type FieldDef } from '@/components/admin/ResourceManager';
import { range } from '@/lib/format';

const COLLEGE_FIELDS: FieldDef[] = [
  { name: 'name', label: 'College name', type: 'text', required: true, full: true },
  { name: 'short_name', label: 'Short name', type: 'text', placeholder: 'IIT Delhi' },
  { name: 'slug', label: 'URL slug', type: 'text', help: 'Leave empty to auto-generate' },
  { name: 'type', label: 'Ownership', type: 'select', options: ['Public', 'Private', 'Deemed', 'Autonomous', 'Other'], required: true },
  { name: 'accreditation', label: 'Accreditation', type: 'text', placeholder: 'NAAC A+' },
  { name: 'country', label: 'Country', type: 'text', required: true },
  { name: 'state', label: 'State / Region', type: 'text' },
  { name: 'city', label: 'City', type: 'text', required: true },
  { name: 'address', label: 'Address', type: 'text' },
  { name: 'latitude', label: 'Latitude', type: 'number', help: 'Right-click on Google Maps → copy coordinates' },
  { name: 'longitude', label: 'Longitude', type: 'number' },
  { name: 'established', label: 'Established (year)', type: 'number' },
  { name: 'ranking', label: 'Ranking', type: 'number' },
  { name: 'fees_min', label: 'Min fees / year', type: 'number' },
  { name: 'fees_max', label: 'Max fees / year', type: 'number' },
  { name: 'currency', label: 'Currency', type: 'select', options: ['INR', 'USD', 'GBP', 'EUR', 'CAD', 'AUD', 'AED', 'SGD', 'NZD'], required: true },
  { name: 'website', label: 'Website', type: 'text' },
  { name: 'email', label: 'Email', type: 'text' },
  { name: 'phone', label: 'Phone', type: 'text' },
  { name: 'streams', label: 'Streams', type: 'tags', placeholder: 'Engineering, Management' },
  { name: 'facilities', label: 'Facilities', type: 'tags', placeholder: 'Library, Hostel, Wi-Fi' },
  { name: 'description', label: 'About', type: 'textarea' },
  { name: 'logo_url', label: 'Logo', type: 'image' },
  { name: 'cover_url', label: 'Cover photo', type: 'image' },
  { name: 'photos', label: 'Gallery photos', type: 'images' },
  { name: 'accepts_applications', label: 'Accepts StudyEarnstay application', type: 'bool' },
  { name: 'application_note', label: 'Application note', type: 'text', placeholder: 'No application fee' },
  { name: 'is_featured', label: 'Featured on home', type: 'bool' },
  { name: 'is_published', label: 'Published', type: 'bool' },
];

export default function AdminColleges() {
  return (
    <ResourceManager
      resource="colleges"
      title="Colleges"
      fields={COLLEGE_FIELDS}
      defaults={{ type: 'Private', currency: 'INR', is_published: true, country: 'India' }}
      quickFilters={[{ label: 'All', params: {} }, { label: 'Added by us', params: { source: 'admin' } }, { label: 'Imported', params: { source: 'hipolabs' } }, { label: 'Hidden (need city)', params: { is_published: 'false' } }]}
      columns={[
        { key: 'name', label: 'College', render: (r) => <div><p className="font-semibold text-slate-900">{r.name}</p><p className="text-xs text-slate-500">{r.city}, {r.country}{r.source && r.source !== 'admin' ? ` · ${r.source}` : ''}</p></div> },
        { key: 'fees', label: 'Fees', render: (r) => range(r.fees_min, r.fees_max, r.currency) },
        { key: 'ranking', label: 'Rank', render: (r) => r.ranking ?? '—' },
        { key: 'is_published', label: 'Status', render: (r) => r.is_published ? <span className="chip-green">Live</span> : <span className="chip">Draft</span> },
      ]}
      rowActions={(r) => (
        <>
          <Link href={`/admin/colleges/${r.id}`} className="btn-ghost px-2 py-1.5" title="Courses, placements, cutoffs & nearby"><ListTree size={14} /></Link>
          <a href={`/colleges/${r.slug}`} target="_blank" className="btn-ghost px-2 py-1.5" title="View"><ExternalLink size={14} /></a>
        </>
      )}
    />
  );
}
