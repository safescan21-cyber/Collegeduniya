export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  city: string | null;
  country: string | null;
  course_interest: string | null;
  role: 'student' | 'admin' | 'super_admin';
  account_type?: 'student' | 'pg_owner' | 'employer';
  preferred_lang?: string | null;
  is_blocked: boolean;
  created_at: string;
};

export type College = {
  id: string;
  slug: string;
  name: string;
  short_name: string | null;
  type: string | null;
  country: string;
  state: string | null;
  city: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  established: number | null;
  ranking: number | null;
  accreditation: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  description: string | null;
  fees_min: number | null;
  fees_max: number | null;
  currency: string | null;
  streams: string[] | null;
  facilities: string[] | null;
  logo_url: string | null;
  cover_url: string | null;
  photos: string[] | null;
  is_featured: boolean;
  is_published: boolean;
  accepts_applications?: boolean;
  application_note?: string | null;
  created_at: string;
};

export type Course = {
  id: string; college_id: string; name: string; level: string; duration: string | null;
  fees: number | null; currency: string | null; seats: number | null; eligibility: string | null;
};

export type Place = {
  id: string; college_id: string; kind: string; name: string; address: string | null;
  distance_km: number | null; phone: string | null; website: string | null;
};

export type Hostel = {
  id: string; name: string; type: string; gender: string; college_id: string | null;
  country: string; city: string; address: string | null; latitude: number | null; longitude: number | null;
  rent_min: number | null; rent_max: number | null; currency: string | null; rent_period: string | null;
  amenities: string[] | null; description: string | null; photos: string[] | null;
  contact_name: string | null; contact_phone: string | null; contact_email: string | null;
  is_verified: boolean; is_published: boolean; created_at: string;
  approval_status?: string; submitted_by?: string | null;
  colleges?: { name: string; slug: string } | null;
};

export type Job = {
  id: string; title: string; company: string; company_logo: string | null; job_type: string;
  college_id: string | null; country: string; city: string; address: string | null;
  latitude: number | null; longitude: number | null; is_remote: boolean;
  pay_min: number | null; pay_max: number | null; currency: string | null; pay_unit: string;
  hours_per_week: number | null; description: string | null; requirements: string | null;
  skills: string[] | null; deadline: string | null; status: string; is_published: boolean; created_at: string;
  approval_status?: string; created_by?: string | null; contact_email?: string | null; contact_phone?: string | null;
  colleges?: { name: string; slug: string } | null;
};

export type ReviewPublic = {
  id: string; college_id: string; rating: number; rating_faculty: number | null; rating_campus: number | null;
  rating_placement: number | null; title: string; body: string; course: string | null; batch_year: number | null;
  edited_by_admin: boolean; created_at: string; reviewer_name: string; is_verified?: boolean;
};

export type Exam = {
  id: string; slug: string; short_name: string; full_name: string | null; stream: string | null; level: string;
  country: string | null; conducting_body: string | null; mode: string | null; frequency: string | null;
  exam_date: string | null; registration: string | null; website: string | null; eligibility: string | null;
  pattern: string | null; syllabus: string | null; description: string | null; updated_at: string;
};

export type Article = {
  id: string; slug: string; title: string; excerpt: string | null; body: string | null; category: string;
  cover_url: string | null; tags: string[] | null; college_id: string | null; exam_id: string | null;
  author_name: string | null; published_at: string; updated_at: string;
};

export type Placement = {
  id: string; college_id: string; year: number; course: string | null; avg_package: number | null;
  median_package: number | null; highest_package: number | null; currency: string | null; package_unit: string | null;
  placement_rate: number | null; students_placed: number | null; companies_visited: number | null;
  top_recruiters: string[] | null; source: string | null;
};

export type Cutoff = {
  id: string; college_id: string; exam_slug: string; year: number; course: string; category: string;
  quota: string | null; round: string | null; opening_rank: number | null; closing_rank: number;
};

export type QuestionPublic = {
  id: string; college_id: string | null; title: string; body: string | null; created_at: string;
  asker_name: string; college_name: string | null; college_slug: string | null; answer_count: number;
};

export type AnswerPublic = {
  id: string; question_id: string; body: string; is_official: boolean; created_at: string; author_name: string; is_team: boolean;
};
