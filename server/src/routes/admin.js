import { Router } from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import { supabase } from '../supabase.js';
import { requireAdmin, requireSuperAdmin } from '../middleware/auth.js';
import {
  schemas, slugify, reviewUpdateV2, applicationUpdate, userUpdate, moderation,
} from '../schemas.js';

const router = Router();
router.use(requireAdmin);

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const fail = (res, error, code = 400) => res.status(code).json({ error: error.message || String(error) });
const page = (req) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 25, 500);
  const pageNo = Math.max(parseInt(req.query.page, 10) || 1, 1);
  return { from: (pageNo - 1) * limit, to: pageNo * limit - 1 };
};
const term = (q) => String(q || '').replace(/[%,()*"]/g, ' ').trim().slice(0, 80);

// Apply simple equality filters from the query string (only whitelisted keys)
function applyFilters(q, query, keys) {
  for (const k of keys) {
    const v = query[k];
    if (v === undefined || v === '') continue;
    if (v === 'true' || v === 'false') q = q.eq(k, v === 'true');
    else q = q.eq(k, v);
  }
  return q;
}

// ---------------------------------------------------------------- me
router.get('/me', (req, res) => res.json({ profile: req.profile }));

// ---------------------------------------------------------------- stats
router.get('/stats', wrap(async (_req, res) => {
  const now = Date.now();
  const iso = (days) => new Date(now - days * 864e5).toISOString();
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);

  const count = async (table, build = (q) => q) => {
    const { count: c, error } = await build(supabase.from(table).select('*', { count: 'exact', head: true }));
    if (error) return 0; // table may not exist yet if migration 002 not run
    return c || 0;
  };

  const [colleges, hostels, jobs, openJobs, users, reviews, pendingReviews, applications, pendingApps,
    visitsToday, visits7, visits30, visitsAll, signups7, newLeads, leads, collegeApps, newCollegeApps,
    pendingHostels, pendingJobs, questions, subscribers] = await Promise.all([
    count('colleges'), count('hostels'), count('jobs'),
    count('jobs', (q) => q.eq('status', 'open')),
    count('profiles'), count('reviews'),
    count('reviews', (q) => q.eq('status', 'pending')),
    count('job_applications'),
    count('job_applications', (q) => q.eq('status', 'pending')),
    count('site_visits', (q) => q.gte('created_at', startOfToday.toISOString())),
    count('site_visits', (q) => q.gte('created_at', iso(7))),
    count('site_visits', (q) => q.gte('created_at', iso(30))),
    count('site_visits'),
    count('profiles', (q) => q.gte('created_at', iso(7))),
    count('leads', (q) => q.eq('status', 'new')),
    count('leads'),
    count('college_applications'),
    count('college_applications', (q) => q.eq('status', 'submitted')),
    count('hostels', (q) => q.eq('approval_status', 'pending')),
    count('jobs', (q) => q.eq('approval_status', 'pending')),
    count('questions'),
    count('newsletter_subscribers', (q) => q.eq('unsubscribed', false)),
  ]);

  const { data: recent, error } = await supabase
    .from('site_visits')
    .select('visitor_id, path, created_at')
    .gte('created_at', iso(30))
    .order('created_at', { ascending: false })
    .limit(50000);
  if (error) throw error;

  const daily = {};
  for (let i = 29; i >= 0; i--) daily[new Date(now - i * 864e5).toISOString().slice(0, 10)] = { visits: 0, visitors: new Set() };
  const pages = {};
  const uniq30 = new Set();
  const uniqToday = new Set();
  for (const v of recent || []) {
    const d = v.created_at.slice(0, 10);
    if (daily[d]) { daily[d].visits++; daily[d].visitors.add(v.visitor_id); }
    uniq30.add(v.visitor_id);
    if (new Date(v.created_at) >= startOfToday) uniqToday.add(v.visitor_id);
    const p = (v.path || '/').split('?')[0];
    pages[p] = (pages[p] || 0) + 1;
  }

  res.json({
    totals: {
      colleges, hostels, jobs, openJobs, users, reviews, pendingReviews, applications, pendingApps, signups7,
      newLeads, leads, collegeApps, newCollegeApps, pendingHostels, pendingJobs, questions, subscribers,
    },
    visits: {
      today: visitsToday, last7: visits7, last30: visits30, allTime: visitsAll,
      uniqueToday: uniqToday.size, unique30: uniq30.size,
    },
    daily: Object.entries(daily).map(([date, v]) => ({ date, visits: v.visits, visitors: v.visitors.size })),
    topPages: Object.entries(pages).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([path, views]) => ({ path, views })),
  });
}));

// ---------------------------------------------------------------- uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) =>
    /^image\/(jpe?g|png|webp|gif|svg\+xml)$/.test(file.mimetype) ? cb(null, true) : cb(new Error('Only image files allowed')),
});

router.post('/upload', upload.array('files', 10), wrap(async (req, res) => {
  const folder = slugify(String(req.body.folder || 'misc')) || 'misc';
  const urls = [];
  for (const f of req.files || []) {
    const ext = (f.originalname.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
    const path = `${folder}/${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
    const { error } = await supabase.storage.from('media').upload(path, f.buffer, { contentType: f.mimetype, upsert: false });
    if (error) return fail(res, error);
    urls.push(supabase.storage.from('media').getPublicUrl(path).data.publicUrl);
  }
  res.json({ urls });
}));

// ---------------------------------------------------------------- generic CRUD (content tables)
const crudConfig = {
  colleges:           { search: ['name', 'city', 'country'], filters: ['is_published', 'accepts_applications', 'country'], order: 'created_at' },
  courses:            { search: ['name'], filters: ['college_id', 'level'], order: 'created_at' },
  places:             { search: ['name'], filters: ['college_id', 'kind'], order: 'created_at' },
  hostels:            { search: ['name', 'city', 'country'], filters: ['approval_status', 'is_published', 'college_id'], order: 'created_at' },
  jobs:               { search: ['title', 'company', 'city'], filters: ['approval_status', 'is_published', 'status', 'college_id'], order: 'created_at' },
  exams:              { search: ['short_name', 'full_name', 'stream'], filters: ['level', 'is_published'], order: 'created_at' },
  articles:           { search: ['title', 'excerpt'], filters: ['category', 'is_published'], order: 'published_at' },
  college_placements: { search: ['course'], filters: ['college_id', 'year'], order: 'year' },
  cutoffs:            { search: ['course'], filters: ['college_id', 'exam_slug', 'year', 'category'], order: 'year' },
};

for (const [table, cfg] of Object.entries(crudConfig)) {
  const schema = schemas[table];

  router.get(`/${table}`, wrap(async (req, res) => {
    const { from, to } = page(req);
    let q = supabase.from(table).select('*', { count: 'exact' }).order(cfg.order, { ascending: false }).range(from, to);
    q = applyFilters(q, req.query, cfg.filters);
    const t = term(req.query.q);
    if (t) q = q.or(cfg.search.map((c) => `${c}.ilike.%${t}%`).join(','));
    const { data, count, error } = await q;
    if (error) return fail(res, error);
    res.json({ data, count });
  }));

  router.get(`/${table}/:id`, wrap(async (req, res) => {
    const { data, error } = await supabase.from(table).select('*').eq('id', req.params.id).single();
    if (error) return fail(res, error, 404);
    res.json({ data });
  }));

  router.post(`/${table}`, wrap(async (req, res) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(422).json({ error: 'Validation failed', issues: parsed.error.flatten() });
    const row = parsed.data;
    if (table === 'colleges') { row.slug = slugify(row.slug || `${row.name}-${row.city}`); row.created_by = req.user.id; }
    if (table === 'exams') row.slug = slugify(row.slug || row.short_name);
    if (table === 'articles') {
      row.slug = slugify(row.slug || row.title);
      row.author_id = req.user.id;
      row.author_name = row.author_name || req.profile.full_name || 'StudyEarnstay Team';
    }
    if (table === 'jobs') row.created_by = req.user.id;
    if (['hostels', 'jobs'].includes(table) && !row.approval_status) row.approval_status = 'approved';
    const { data, error } = await supabase.from(table).insert(row).select().single();
    if (error) return fail(res, error);
    res.status(201).json({ data });
  }));

  router.patch(`/${table}/:id`, wrap(async (req, res) => {
    const parsed = schema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(422).json({ error: 'Validation failed', issues: parsed.error.flatten() });
    const row = parsed.data;
    if (row.slug) row.slug = slugify(row.slug);
    // Approving a submitted listing publishes it; rejecting hides it
    if (row.approval_status === 'approved' && row.is_published === undefined) row.is_published = true;
    if (row.approval_status === 'rejected') row.is_published = false;
    const { data, error } = await supabase.from(table).update(row).eq('id', req.params.id).select().single();
    if (error) return fail(res, error);
    res.json({ data });
  }));

  router.delete(`/${table}/:id`, wrap(async (req, res) => {
    const { error } = await supabase.from(table).delete().eq('id', req.params.id);
    if (error) return fail(res, error);
    res.json({ ok: true });
  }));
}

// ---------------------------------------------------------------- moderation tables (list / patch / delete)
const modConfig = {
  leads: {
    select: '*, colleges(name, slug), hostels(name)', filters: ['status', 'kind', 'college_id'],
    search: ['full_name', 'email', 'phone', 'city'],
  },
  college_applications: {
    select: '*, colleges(name, slug, city)', filters: ['status', 'college_id', 'batch_id'],
    search: ['full_name', 'email', 'phone', 'course'],
  },
  questions: { select: '*, colleges(name, slug), profiles(full_name, email)', filters: ['status', 'college_id'], search: ['title'] },
  answers: { select: '*, questions(title), profiles(full_name, email)', filters: ['status', 'question_id'], search: ['body'] },
  hostel_reviews: { select: '*, hostels(name, city), profiles(full_name, email)', filters: ['status', 'hostel_id'], search: ['body'] },
  newsletter_subscribers: { select: '*', filters: ['unsubscribed'], search: ['email'] },
};

for (const [table, cfg] of Object.entries(modConfig)) {
  router.get(`/${table}`, wrap(async (req, res) => {
    const { from, to } = page(req);
    let q = supabase.from(table).select(cfg.select, { count: 'exact' }).order('created_at', { ascending: false }).range(from, to);
    q = applyFilters(q, req.query, cfg.filters);
    const t = term(req.query.q);
    if (t) q = q.or(cfg.search.map((c) => `${c}.ilike.%${t}%`).join(','));
    const { data, count, error } = await q;
    if (error) return fail(res, error);
    res.json({ data, count });
  }));

  router.patch(`/${table}/:id`, wrap(async (req, res) => {
    const parsed = moderation[table].safeParse(req.body);
    if (!parsed.success) return res.status(422).json({ error: 'Validation failed', issues: parsed.error.flatten() });
    const { data, error } = await supabase.from(table).update(parsed.data).eq('id', req.params.id).select().single();
    if (error) return fail(res, error);
    res.json({ data });
  }));

  router.delete(`/${table}/:id`, wrap(async (req, res) => {
    const { error } = await supabase.from(table).delete().eq('id', req.params.id);
    if (error) return fail(res, error);
    res.json({ ok: true });
  }));
}

// CSV export for leads, applications and newsletter
router.get('/export/:table.csv', wrap(async (req, res) => {
  const allowed = { leads: '*', college_applications: '*', newsletter_subscribers: '*', job_applications: '*' };
  const table = req.params.table;
  if (!allowed[table]) return fail(res, new Error('Not exportable'), 404);
  const { data, error } = await supabase.from(table).select(allowed[table]).order('created_at', { ascending: false }).limit(10000);
  if (error) return fail(res, error);
  const rows = data || [];
  const cols = rows.length ? Object.keys(rows[0]) : ['id'];
  const esc = (v) => {
    const s = v === null || v === undefined ? '' : Array.isArray(v) ? v.join('; ') : typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${table}-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send('﻿' + csv);
}));

// ---------------------------------------------------------------- college reviews moderation
router.get('/reviews', wrap(async (req, res) => {
  const { from, to } = page(req);
  let q = supabase
    .from('reviews')
    .select('*, colleges(name, slug), profiles(full_name, email)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);
  q = applyFilters(q, req.query, ['status', 'college_id', 'reward_status', 'is_verified']);
  const { data, count, error } = await q;
  if (error) return fail(res, error);
  res.json({ data, count });
}));

router.patch('/reviews/:id', wrap(async (req, res) => {
  const parsed = reviewUpdateV2.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: 'Validation failed', issues: parsed.error.flatten() });
  const row = { ...parsed.data };
  if (row.title || row.body || row.rating) row.edited_by_admin = true;
  const { data, error } = await supabase.from('reviews').update(row).eq('id', req.params.id).select().single();
  if (error) return fail(res, error);
  res.json({ data });
}));

// Signed link to the private proof (college ID / fee receipt) a reviewer uploaded
router.get('/reviews/:id/proof', wrap(async (req, res) => {
  const { data: r, error } = await supabase.from('reviews').select('proof_url').eq('id', req.params.id).single();
  if (error || !r?.proof_url) return fail(res, new Error('No proof uploaded'), 404);
  const { data, error: e2 } = await supabase.storage.from('resumes').createSignedUrl(r.proof_url, 300);
  if (e2) return fail(res, e2);
  res.json({ url: data.signedUrl });
}));

router.delete('/reviews/:id', wrap(async (req, res) => {
  const { error } = await supabase.from('reviews').delete().eq('id', req.params.id);
  if (error) return fail(res, error);
  res.json({ ok: true });
}));

// ---------------------------------------------------------------- job applications
router.get('/applications', wrap(async (req, res) => {
  const { from, to } = page(req);
  let q = supabase
    .from('job_applications')
    .select('*, jobs(title, company, city)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);
  q = applyFilters(q, req.query, ['status', 'job_id']);
  const { data, count, error } = await q;
  if (error) return fail(res, error);
  res.json({ data, count });
}));

router.patch('/applications/:id', wrap(async (req, res) => {
  const parsed = applicationUpdate.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: 'Validation failed', issues: parsed.error.flatten() });
  const { data, error } = await supabase.from('job_applications').update(parsed.data).eq('id', req.params.id).select().single();
  if (error) return fail(res, error);
  res.json({ data });
}));

router.get('/applications/:id/resume', wrap(async (req, res) => {
  const { data: app, error } = await supabase.from('job_applications').select('resume_path').eq('id', req.params.id).single();
  if (error || !app?.resume_path) return fail(res, new Error('No resume uploaded'), 404);
  const { data, error: e2 } = await supabase.storage.from('resumes').createSignedUrl(app.resume_path, 300);
  if (e2) return fail(res, e2);
  res.json({ url: data.signedUrl });
}));

// ---------------------------------------------------------------- users & admins
router.get('/users', wrap(async (req, res) => {
  const { from, to } = page(req);
  let q = supabase.from('profiles').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(from, to);
  if (req.query.role) q = q.eq('role', req.query.role);
  const t = term(req.query.q);
  if (t) q = q.or(`email.ilike.%${t}%,full_name.ilike.%${t}%,phone.ilike.%${t}%`);
  const { data, count, error } = await q;
  if (error) return fail(res, error);
  res.json({ data, count });
}));

// Block / unblock: any admin (but not other admins). Change role: super admin only.
router.patch('/users/:id', wrap(async (req, res, next) => {
  const parsed = userUpdate.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: 'Validation failed', issues: parsed.error.flatten() });
  if (req.params.id === req.user.id) return fail(res, new Error('You cannot change your own account here'), 403);

  const { data: target } = await supabase.from('profiles').select('role').eq('id', req.params.id).single();
  if (!target) return fail(res, new Error('User not found'), 404);

  const isSuper = req.profile.role === 'super_admin';
  if (parsed.data.role !== undefined && !isSuper) return requireSuperAdmin(req, res, next);
  if (!isSuper && target.role !== 'student') return fail(res, new Error('Only super admin can modify admins'), 403);

  const { data, error } = await supabase.from('profiles').update(parsed.data).eq('id', req.params.id).select().single();
  if (error) return fail(res, error);
  res.json({ data });
}));

export default router;
