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
    video_url: optStr, tour_url: optStr, safety: strArr, deposit_amount: optNum, notice_days: optInt, lock_in_months: optInt,
    house_rules: optStr, visit_slots: strArr, verified_note: optStr, verified_at: optStr,
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

// ---------------------------------------------------------------- growth features (migration 002)
const optDate = z.union([z.literal(''), z.null(), z.string().regex(/^\d{4}-\d{2}-\d{2}/)]).optional()
  .transform((v) => (v === '' ? null : v));

schemas.colleges = schemas.colleges.extend({
  accepts_applications: bool,
  application_note: optStr,
  students_count: optInt,
  country_code: optStr,
  district: optStr,
  management: optStr,
  affiliated_to: optStr,
  admin_note: optStr,
  hidden_fields: z.array(z.enum(['fees', 'contact', 'website', 'address', 'map', 'ranking', 'accreditation', 'established', 'students', 'logo', 'photos', 'description'])).optional(),
  hidden_sections: z.array(z.enum(['courses', 'placements', 'cutoffs', 'reviews', 'qa', 'hostels', 'jobs', 'nearby', 'gallery', 'apply', 'enquiry'])).optional(),
});

export const collegeBulk = z.object({
  ids: z.array(z.string().uuid()).min(1).max(1000),
  action: z.enum(['publish', 'hide', 'feature', 'unfeature', 'hide_fields', 'show_fields', 'hide_sections', 'show_sections', 'delete']),
  values: z.array(z.string()).optional(),
});
schemas.hostels = schemas.hostels.extend({
  approval_status: z.enum(['approved', 'pending', 'rejected']).optional(),
});
schemas.jobs = schemas.jobs.extend({
  approval_status: z.enum(['approved', 'pending', 'rejected']).optional(),
  contact_email: optStr,
  contact_phone: optStr,
});

schemas.quota_seats = z.object({
  college_id: z.string().uuid(),
  course: str.min(2),
  level: z.enum(['Foundation', 'UG', 'PG', 'Diploma', 'PhD', 'Certificate', 'Language', 'Other']).optional(),
  quota_type: z.enum(['Management', 'NRI', 'NRI Sponsored', 'Institutional', 'Foreign National', 'International',
    'Direct admission', 'Self-financed', 'Private / fee-paying', 'Scholarship', 'Other']).optional(),
  academic_year: optStr,
  intake: optStr,
  open_to: z.enum(['all', 'domestic', 'international']).optional(),
  fee_period: z.enum(['year', 'semester', 'term', 'month', 'total']).optional(),
  english_requirement: optStr,
  scholarship_note: optStr,
  seats_total: optInt,
  seats_available: optInt,
  fee_per_year: optNum,
  total_fee: optNum,
  currency: optStr,
  fee_note: optStr,
  eligibility: optStr,
  min_percentage: optNum,
  exams_accepted: strArr,
  documents_required: strArr,
  last_date: optStr,
  description: optStr,
  status: z.enum(['open', 'closed', 'filled']).optional(),
  is_published: bool,
  is_featured: bool,
});


const url = z.string().trim().url();

schemas.rank_bands = z.object({
  exam_slug: str.min(2), year: z.coerce.number().int().min(2000).max(2100), category: optStr,
  marks_from: z.coerce.number(), marks_to: z.coerce.number(), rank_from: z.coerce.number().int().positive(), rank_to: z.coerce.number().int().positive(),
  source: optStr,
});
schemas.college_rankings = z.object({
  college_id: z.string().uuid(), source: optStr, year: z.coerce.number().int(), category: optStr,
  rank: optInt, rank_band: optStr, score: optNum, source_url: optStr,
});
schemas.scholarships = z.object({
  slug: optStr, name: str.min(3), provider: optStr, host_country: optStr, for_nationalities: strArr, levels: strArr, field: optStr,
  amount: optNum, currency: optStr, amount_note: optStr, deadline: optDate, eligibility: optStr, how_to_apply: optStr,
  official_url: url, is_published: bool,
});
schemas.visa_guides = z.object({
  country_code: z.string().trim().length(2).transform((v) => v.toUpperCase()), title: str.min(3), summary: optStr, body: optStr,
  processing_time: optStr, fee_note: optStr, work_rights: optStr, official_url: url, is_published: bool,
});
schemas.college_partners = z.object({
  college_id: z.string().uuid(), contact_name: optStr, contact_email: optStr, contact_phone: optStr,
  lead_price: optNum, currency: optStr, auto_share: bool, is_active: bool, notes: optStr,
});
schemas.promotions = z.object({
  item_type: z.enum(['college', 'hostel', 'job', 'quota_seat']), item_id: z.string().uuid(),
  starts_at: optStr, ends_at: str.min(10), note: optStr,
});

schemas.exam_resources = z.object({
  exam_slug: str.min(2), kind: z.enum(['question_paper', 'answer_key', 'solution', 'syllabus', 'date_sheet', 'notice', 'analysis', 'sample_paper']),
  title: str.min(3), year: optInt, session: optStr, file_url: optStr, source_url: url, is_published: bool,
});
schemas.exam_stats = z.object({
  exam_slug: str.min(2), year: z.coerce.number().int().min(2000).max(2100), session: z.string().trim().min(1).default('All'),
  total_candidates: z.coerce.number().int().positive(), source: str.min(5),
});
const mockSection = z.object({
  name: str.min(1).max(60), topics: z.array(str.max(80)).max(40).default([]),
  questions: z.coerce.number().int().min(1).max(200), correct: z.coerce.number().min(0).max(100).default(1), wrong: z.coerce.number().min(-100).max(0).default(0),
});
const jsonish = (schema) => z.preprocess((v) => { if (typeof v !== 'string') return v; try { return JSON.parse(v); } catch { return v; } }, schema);
schemas.mock_blueprints = z.object({
  exam_slug: str.min(2), title: str.min(3).max(120), duration_min: z.coerce.number().int().min(5).max(360),
  sections: jsonish(z.array(mockSection).min(1).max(12)), instructions: optStr, pattern_source: optStr,
  is_published: bool, auto_publish_verified: bool, autopilot: bool, pattern_checked: bool, ai_drafted: bool,
});
schemas.mock_questions = z.object({
  exam_slug: str.min(2), section: str.min(1).max(60), topic: optStr, difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
  stem: str.min(10).max(4000), options: jsonish(z.array(str.min(1).max(500)).min(2).max(6)), answer: z.coerce.number().int().min(0).max(5),
  explanation: optStr, status: z.enum(['draft', 'approved', 'rejected']).optional(), source: z.enum(['ai', 'manual']).optional(),
});   // the database also checks that answer < number of options

schemas.reward_catalog = z.object({
  code: z.string().trim().toLowerCase().regex(/^[a-z0-9_-]{2,40}$/), title: str.min(3), points: z.coerce.number().int().positive(),
  stock: optInt, is_active: bool,
});

schemas.exams = z.object({
  slug: optStr,
  short_name: str.min(2),
  full_name: optStr,
  stream: optStr,
  level: z.enum(['UG', 'PG', 'Diploma', 'PhD', 'Abroad', 'Other']).optional(),
  country: optStr,
  conducting_body: optStr,
  mode: optStr,
  frequency: optStr,
  exam_date: optStr,
  registration: optStr,
  website: optStr,
  eligibility: optStr,
  pattern: optStr,
  syllabus: optStr,
  description: optStr,
  is_published: bool,
});

schemas.articles = z.object({
  slug: optStr,
  title: str.min(5),
  excerpt: optStr,
  body: optStr,
  category: z.enum(['news', 'exam', 'admission', 'guide', 'abroad', 'jobs', 'hostel']).optional(),
  cover_url: optStr,
  tags: strArr,
  college_id: optUuid,
  exam_id: optUuid,
  author_name: optStr,
  is_published: bool,
  published_at: optDate,
});

schemas.college_placements = z.object({
  college_id: z.string().uuid(),
  year: z.coerce.number().int().min(1990).max(2100),
  course: optStr,
  avg_package: optNum,
  median_package: optNum,
  highest_package: optNum,
  currency: optStr,
  package_unit: optStr,
  placement_rate: optNum,
  students_placed: optInt,
  companies_visited: optInt,
  top_recruiters: strArr,
  source: optStr,
});

schemas.cutoffs = z.object({
  college_id: z.string().uuid(),
  exam_slug: str.min(2),
  year: z.coerce.number().int().min(1990).max(2100),
  course: str.min(2),
  category: optStr,
  quota: optStr,
  round: optStr,
  opening_rank: optInt,
  closing_rank: z.coerce.number().int().positive(),
  source: optStr,
});

export const moderation = {
  leads: z.object({ status: z.enum(['new', 'contacted', 'converted', 'closed']).optional(), admin_note: optStr }),
  college_applications: z.object({
    status: z.enum(['submitted', 'under_review', 'forwarded', 'accepted', 'rejected', 'withdrawn']).optional(),
    admin_note: optStr,
  }),
  quota_applications: z.object({
    status: z.enum(['submitted', 'under_review', 'contacted', 'shortlisted', 'offered', 'admitted', 'rejected', 'withdrawn']).optional(),
    admin_note: optStr,
  }),
  reports: z.object({ status: z.enum(['open', 'actioned', 'dismissed']).optional(), admin_note: optStr }),
  college_members: z.object({ is_verified: bool, open_to_questions: bool }),
  roommate_posts: z.object({ is_active: bool }),
  hostel_visits: z.object({ status: z.enum(['requested', 'confirmed', 'done', 'cancelled', 'no_show']).optional(), owner_note: optStr }),
  payments: z.object({ status: z.enum(['created', 'paid', 'failed', 'refunded']).optional() }),
  questions: z.object({ status: z.enum(['approved', 'pending', 'blocked']).optional(), title: str.min(10).optional(), body: optStr }),
  answers: z.object({ status: z.enum(['approved', 'pending', 'blocked']).optional(), body: str.min(5).optional(), is_official: bool }),
  hostel_reviews: z.object({ status: z.enum(['approved', 'pending', 'blocked']).optional(), body: str.min(5).optional() }),
  newsletter_subscribers: z.object({ unsubscribed: bool }),
  companies: z.object({ is_verified: bool }),
  reward_redemptions: z.object({ status: z.enum(['requested', 'fulfilled', 'rejected']).optional(), voucher: optStr, admin_note: optStr }),
  ambassadors: z.object({ status: z.enum(['applied', 'approved', 'rejected', 'paused']).optional(), admin_note: optStr }),
  mock_question_reports: z.object({ status: z.enum(['open', 'fixed', 'dismissed']).optional() }),
  posts: z.object({ status: z.enum(['published', 'hidden', 'removed']).optional(), hidden_reason: optStr }),
  post_comments: z.object({ status: z.enum(['published', 'hidden']).optional() }),
  content_reports: z.object({ status: z.enum(['open', 'actioned', 'dismissed']).optional(), admin_note: optStr }),
  reward_points: z.object({ status: z.enum(['pending', 'approved', 'reversed']).optional(), note: optStr }),
};

export const mockSettings = z.object({
  autopilot: bool, auto_publish: bool,
  target_per_topic: z.coerce.number().int().min(1).max(200).optional(),
  daily_budget: z.coerce.number().int().min(0).max(20000).optional(),
  min_ready_ratio: z.coerce.number().min(0.2).max(5).optional(),
});

export const pointsGrant = z.object({
  user_id: z.string().uuid(), points: z.coerce.number().int().min(-100000).max(100000).refine((n) => n !== 0), note: str.min(3).max(200),
});

export const reviewUpdateV2 = reviewUpdate.extend({
  is_verified: bool,
  reward_status: z.enum(['none', 'eligible', 'paid']).optional(),
});

const phone = z.string().trim().regex(/^[+\d][\d\s-]{6,18}$/, 'Enter a valid phone number');

export const leadSchema = z.object({
  kind: z.enum(['counselling', 'college', 'hostel', 'job', 'other']).default('counselling'),
  college_id: optUuid,
  hostel_id: optUuid,
  full_name: str.min(2).max(100),
  email: z.union([z.literal(''), z.string().trim().email()]).optional().transform((v) => v || null),
  phone,
  city: optStr,
  course_interest: optStr,
  message: z.string().trim().max(2000).optional().nullable(),
  source_path: z.string().max(300).optional().nullable(),
  consent_share: z.boolean().optional().default(false),
  website: z.string().max(0).optional(), // honeypot — must stay empty
});

export const newsletterSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  interests: z.array(z.string().max(40)).max(10).optional(),
  source: z.string().max(100).optional(),
  website: z.string().max(0).optional(),
});

export const chatSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().trim().min(1).max(2000),
  })).min(1).max(12),
  path: z.string().max(300).optional(),
});
