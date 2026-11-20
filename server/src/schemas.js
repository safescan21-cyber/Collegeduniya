import { z } from 'zod';

const str = z.string().trim();
const optStr = z.union([str, z.null()]).optional().transform((v) => (v === '' ? null : v));
const optNum = z.union([z.literal(''), z.null(), z.coerce.number()]).optional()
  .transform((v) => (v === '' ? null : v));
const optInt = z.union([z.literal(''), z.null(), z.coerce.number().int()]).optional()
  .transform((v) => (v === '' ? null : v));
const strArr = z.union([z.array(str), str]).optional()
  .transform((v) => (typeof v === 'string' ? v.split(',').map((s) => s.trim()).filter(Boolean) : v));
const bool = z.boolean().optional();
const optUuid = z.union([z.literal(''), z.null(), z.string().uuid()]).optional()
  .transform((v) => (v === '' ? null : v));

export const slugify = (s) =>
  s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').slice(0, 80);

export const schemas = {
  colleges: z.object({
    name: str.min(2),
    slug: optStr,
    short_name: optStr,
    type: z.enum(['Public', 'Private', 'Deemed', 'Autonomous', 'Other']).optional(),
    country: str.min(2),
    state: optStr,
    city: str.min(1),
    address: optStr,
    latitude: optNum,
    longitude: optNum,
    established: optInt,
    ranking: optInt,
    accreditation: optStr,
    website: optStr,
    email: optStr,
    phone: optStr,
    description: optStr,
    fees_min: optNum,
    fees_max: optNum,
    currency: optStr,
    streams: strArr,
    facilities: strArr,
    logo_url: optStr,
    cover_url: optStr,
    photos: strArr,
    is_featured: bool,
    is_published: bool,
  }),
  courses: z.object({
    college_id: z.string().uuid(),
    name: str.min(2),
    level: z.enum(['UG', 'PG', 'Diploma', 'PhD', 'Certificate']).optional(),
    duration: optStr,
    fees: optNum,
    currency: optStr,
    seats: optInt,
    eligibility: optStr,
  }),
  places: z.object({
    college_id: z.string().uuid(),
    kind: z.enum(['company', 'hospital', 'bank', 'transport', 'other']),
    name: str.min(2),
    address: optStr,
    distance_km: optNum,
    phone: optStr,
    website: optStr,
  }),
  hostels: z.object({
    name: str.min(2),
    type: z.enum(['PG', 'Hostel', 'Flat', 'Homestay']).optional(),
    gender: z.enum(['Boys', 'Girls', 'Co-ed']).optional(),
    college_id: optUuid,
    country: str.min(2),
    city: str.min(1),
    address: optStr,
    latitude: optNum,
    longitude: optNum,
    rent_min: optNum,
    rent_max: optNum,
    currency: optStr,
    rent_period: optStr,
    amenities: strArr,
    description: optStr,
    photos: strArr,
    contact_name: optStr,
    contact_phone: optStr,
    contact_email: optStr,
    is_verified: bool,
    is_published: bool,
  }),
  jobs: z.object({
    title: str.min(2),
    company: str.min(1),
    company_logo: optStr,
    job_type: z.enum(['Part-time', 'Internship', 'Full-time', 'Freelance', 'Weekend']).optional(),
    college_id: optUuid,
    country: str.min(2),
    city: str.min(1),
    address: optStr,
    latitude: optNum,
    longitude: optNum,
    is_remote: bool,
    pay_min: optNum,
    pay_max: optNum,
    currency: optStr,
    pay_unit: z.enum(['hour', 'day', 'week', 'month', 'project']).optional(),
    hours_per_week: optInt,
    description: optStr,
    requirements: optStr,
    skills: strArr,
    deadline: optStr,
    status: z.enum(['open', 'closed']).optional(),
    is_published: bool,
  }),
};

export const reviewUpdate = z.object({
  title: str.min(2).optional(),
  body: str.min(5).optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  status: z.enum(['approved', 'pending', 'blocked']).optional(),
});

export const applicationUpdate = z.object({
  status: z.enum(['pending', 'shortlisted', 'rejected', 'hired']).optional(),
  admin_note: optStr,
});

export const userUpdate = z.object({
  role: z.enum(['student', 'admin', 'super_admin']).optional(),
  is_blocked: z.boolean().optional(),
});

export const trackSchema = z.object({
  visitor_id: str.min(6).max(64),
  path: str.max(300).optional(),
  referrer: str.max(500).optional().nullable(),
});
