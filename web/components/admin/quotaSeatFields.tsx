import type { FieldDef, ColumnDef } from '@/components/admin/ResourceManager';
import { CURRENCIES } from '@/lib/adminFields';

export const QUOTA_SEAT_FIELDS = (withCollege = true): FieldDef[] => [
  ...(withCollege ? [{ name: 'college_id', label: 'College', type: 'college', required: true, full: true } as FieldDef] : []),
  { name: 'course', label: 'Course / branch', type: 'text', required: true, placeholder: 'B.Tech Computer Science' },
  { name: 'level', label: 'Level', type: 'select', options: ['Foundation', 'UG', 'PG', 'Diploma', 'PhD', 'Certificate', 'Language', 'Other'] },
  { name: 'quota_type', label: 'Admission route', type: 'select', help: 'India: Management / NRI. Elsewhere: International, Direct admission, Self-financed…',
    options: ['Management', 'NRI', 'NRI Sponsored', 'Institutional', 'Foreign National', 'International', 'Direct admission', 'Self-financed', 'Private / fee-paying', 'Scholarship', 'Other'] },
  { name: 'open_to', label: 'Who can apply', type: 'select', options: ['all', 'domestic', 'international'] },
  { name: 'academic_year', label: 'Session', type: 'text', placeholder: '2027-28' },
  { name: 'intake', label: 'Intake / start', type: 'text', placeholder: 'September 2027 · Fall 2027 · July session' },
  { name: 'seats_total', label: 'Total quota seats', type: 'number' },
  { name: 'seats_available', label: 'Seats available now', type: 'number', help: 'Set 0 when filled — students can no longer apply' },
  { name: 'fee_per_year', label: 'Official fee (amount)', type: 'number' },
  { name: 'fee_period', label: 'Fee is per', type: 'select', options: ['year', 'semester', 'term', 'month', 'total'] },
  { name: 'total_fee', label: 'Total course fee', type: 'number' },
  { name: 'currency', label: 'Currency', type: 'select', options: CURRENCIES, help: 'Leave blank to use the college’s country currency' },
  { name: 'last_date', label: 'Last date to apply', type: 'date' },
  { name: 'fee_note', label: 'Fee details', type: 'textarea', full: true, placeholder: 'Hostel ₹1.2L/yr extra, one-time ₹25,000 admission charge, 2 instalments…' },
  { name: 'min_percentage', label: 'Minimum % in qualifying exam', type: 'number' },
  { name: 'exams_accepted', label: 'Exams / tests accepted', type: 'tags', placeholder: 'JEE Main, SAT, A-levels, GRE, None' },
  { name: 'english_requirement', label: 'English requirement', type: 'text', full: true, placeholder: 'IELTS 6.5 (no band below 6.0) / TOEFL iBT 90 / PTE 62' },
  { name: 'scholarship_note', label: 'Scholarships', type: 'textarea', full: true, placeholder: 'Merit scholarship up to 20% of tuition for international students…' },
  { name: 'eligibility', label: 'Eligibility', type: 'textarea', full: true, placeholder: '10+2 with PCM, 45% aggregate (40% reserved)…' },
  { name: 'documents_required', label: 'Documents required', type: 'tags', full: true, placeholder: '10th marksheet, 12th marksheet, Aadhaar, Passport photo' },
  { name: 'description', label: 'About this admission', type: 'textarea', full: true },
  { name: 'status', label: 'Status', type: 'select', options: ['open', 'closed', 'filled'] },
  { name: 'is_published', label: 'Show on website', type: 'bool' },
  { name: 'is_featured', label: 'Featured', type: 'bool' },
];

const money = (v: number | null, c: string | null) => {
  if (v == null) return '—';
  try { return new Intl.NumberFormat(c === 'INR' ? 'en-IN' : 'en', { style: 'currency', currency: c || 'USD', maximumFractionDigits: 0 }).format(v); }
  catch { return `${c} ${v}`; }
};

export const QUOTA_SEAT_COLUMNS = (withCollege = true): ColumnDef[] => [
  ...(withCollege ? [{ key: 'college', label: 'College', render: (r: any) => <div><a href={`/colleges/${r.colleges?.slug}`} target="_blank" className="font-medium text-brand-700">{r.colleges?.name}</a><p className="text-xs text-slate-400">{[r.colleges?.city, r.colleges?.country].filter(Boolean).join(', ')}</p></div> }] : []),
  { key: 'course', label: 'Course', render: (r) => <div><p className="font-medium">{r.course}</p><p className="text-xs text-slate-500">{r.quota_type} · {r.level} {r.intake || r.academic_year ? `· ${r.intake || r.academic_year}` : ''}{r.open_to !== 'all' ? ` · ${r.open_to}` : ''}</p></div> },
  { key: 'fee', label: 'Fee', render: (r) => <span>{money(r.fee_per_year, r.currency)} <span className="text-xs text-slate-400">/{r.fee_period || 'year'}</span></span> },
  { key: 'seats', label: 'Seats', render: (r) => `${r.seats_available ?? '—'}${r.seats_total ? ` / ${r.seats_total}` : ''}` },
  { key: 'last_date', label: 'Last date', render: (r) => r.last_date || 'Rolling' },
  { key: 'status', label: 'Status', render: (r) => <span className={`${r.status === 'open' ? 'chip-green' : r.status === 'filled' ? 'chip-red' : 'chip'} capitalize`}>{r.status}{!r.is_published ? ' · hidden' : ''}</span> },
];

export const QUOTA_SEAT_DEFAULTS = { level: 'UG', quota_type: 'Management', open_to: 'all', fee_period: 'year', status: 'open', is_published: true, is_featured: false };
