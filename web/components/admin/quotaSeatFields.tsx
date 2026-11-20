import type { FieldDef, ColumnDef } from '@/components/admin/ResourceManager';
import { CURRENCIES } from '@/lib/adminFields';

export const QUOTA_SEAT_FIELDS = (withCollege = true): FieldDef[] => [
  ...(withCollege ? [{ name: 'college_id', label: 'College', type: 'college', required: true, full: true } as FieldDef] : []),
  { name: 'course', label: 'Course / branch', type: 'text', required: true, placeholder: 'B.Tech Computer Science' },
  { name: 'level', label: 'Level', type: 'select', options: ['UG', 'PG', 'Diploma', 'PhD', 'Certificate', 'Other'] },
  { name: 'quota_type', label: 'Quota', type: 'select', options: ['Management', 'NRI', 'NRI Sponsored', 'Institutional', 'Foreign National', 'Other'] },
  { name: 'academic_year', label: 'Session', type: 'text', placeholder: '2027-28' },
  { name: 'seats_total', label: 'Total quota seats', type: 'number' },
  { name: 'seats_available', label: 'Seats available now', type: 'number', help: 'Set 0 when filled — students can no longer apply' },
  { name: 'fee_per_year', label: 'Official fee per year', type: 'number' },
  { name: 'total_fee', label: 'Total course fee', type: 'number' },
  { name: 'currency', label: 'Currency', type: 'select', options: CURRENCIES },
  { name: 'last_date', label: 'Last date to apply', type: 'date' },
  { name: 'fee_note', label: 'Fee details', type: 'textarea', full: true, placeholder: 'Hostel ₹1.2L/yr extra, one-time ₹25,000 admission charge, 2 instalments…' },
  { name: 'min_percentage', label: 'Minimum % in qualifying exam', type: 'number' },
  { name: 'exams_accepted', label: 'Exams accepted', type: 'tags', placeholder: 'JEE Main, MHT-CET, None' },
  { name: 'eligibility', label: 'Eligibility', type: 'textarea', full: true, placeholder: '10+2 with PCM, 45% aggregate (40% reserved)…' },
  { name: 'documents_required', label: 'Documents required', type: 'tags', full: true, placeholder: '10th marksheet, 12th marksheet, Aadhaar, Passport photo' },
  { name: 'description', label: 'About this admission', type: 'textarea', full: true },
  { name: 'status', label: 'Status', type: 'select', options: ['open', 'closed', 'filled'] },
  { name: 'is_published', label: 'Show on website', type: 'bool' },
  { name: 'is_featured', label: 'Featured', type: 'bool' },
];

const money = (v: number | null, c: string) => (v == null ? '—' : `${c === 'INR' ? '₹' : c + ' '}${Number(v).toLocaleString('en-IN')}`);

export const QUOTA_SEAT_COLUMNS = (withCollege = true): ColumnDef[] => [
  ...(withCollege ? [{ key: 'college', label: 'College', render: (r: any) => <a href={`/colleges/${r.colleges?.slug}`} target="_blank" className="font-medium text-brand-700">{r.colleges?.name}</a> }] : []),
  { key: 'course', label: 'Course', render: (r) => <div><p className="font-medium">{r.course}</p><p className="text-xs text-slate-500">{r.quota_type} · {r.level} {r.academic_year ? `· ${r.academic_year}` : ''}</p></div> },
  { key: 'fee', label: 'Fee / yr', render: (r) => money(r.fee_per_year, r.currency) },
  { key: 'seats', label: 'Seats', render: (r) => `${r.seats_available ?? '—'}${r.seats_total ? ` / ${r.seats_total}` : ''}` },
  { key: 'last_date', label: 'Last date', render: (r) => r.last_date || 'Rolling' },
  { key: 'status', label: 'Status', render: (r) => <span className={`${r.status === 'open' ? 'chip-green' : r.status === 'filled' ? 'chip-red' : 'chip'} capitalize`}>{r.status}{!r.is_published ? ' · hidden' : ''}</span> },
];

export const QUOTA_SEAT_DEFAULTS = { level: 'UG', quota_type: 'Management', currency: 'INR', status: 'open', is_published: true, is_featured: false };
