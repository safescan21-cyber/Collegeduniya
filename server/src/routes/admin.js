import { Router } from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import { supabase } from '../supabase.js';
import { requireAdmin, requireSuperAdmin } from '../middleware/auth.js';
import { schemas, slugify, reviewUpdate, applicationUpdate, userUpdate } from '../schemas.js';

const router = Router();
router.use(requireAdmin);

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const fail = (res, error, code = 400) => res.status(code).json({ error: error.message || String(error) });
const page = (req) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 25, 100);
  const pageNo = Math.max(parseInt(req.query.page, 10) || 1, 1);
  return { from: (pageNo - 1) * limit, to: pageNo * limit - 1 };
};

// ---------------------------------------------------------------- me
router.get('/me', (req, res) => res.json({ profile: req.profile }));

// ---------------------------------------------------------------- stats
router.get('/stats', wrap(async (_req, res) => {
  const now = Date.now();
  const iso = (days) => new Date(now - days * 864e5).toISOString();
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);

  const count = async (table, build = (q) => q) => {
    const { count: c, error } = await build(supabase.from(table).select('*', { count: 'exact', head: true }));
    if (error) throw error;
    return c || 0;
  };

  const [colleges, hostels, jobs, openJobs, users, reviews, pendingReviews, applications, pendingApps,
    visitsToday, visits7, visits30, visitsAll, signups7] = await Promise.all([
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
  ]);

  // Last 30 days of visits for the chart + unique visitors + top pages
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
    totals: { colleges, hostels, jobs, openJobs, users, reviews, pendingReviews, applications, pendingApps, signups7 },
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

// ---------------------------------------------------------------- generic CRUD
const searchCols = {
  colleges: ['name', 'city', 'country'],
  hostels: ['name', 'city', 'country'],
  jobs: ['title', 'company', 'city'],
  courses: ['name'],
  places: ['name'],
};

for (const table of Object.keys(schemas)) {
  const schema = schemas[table];

  router.get(`/${table}`, wrap(async (req, res) => {
    const { from, to } = page(req);
    let q = supabase.from(table).select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(from, to);
    if (req.query.college_id) q = q.eq('college_id', req.query.college_id);
    if (req.query.q) {
      const term = String(req.query.q).replace(/[%,()]/g, ' ').trim();
      q = q.or(searchCols[table].map((c) => `${c}.ilike.%${term}%`).join(','));
    }
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
    if (table === 'colleges') {
      row.slug = slugify(row.slug || `${row.name}-${row.city}`);
      row.created_by = req.user.id;
    }
    if (table === 'jobs') row.created_by = req.user.id;
    const { data, error } = await supabase.from(table).insert(row).select().single();
    if (error) return fail(res, error);
    res.status(201).json({ data });
  }));

  router.patch(`/${table}/:id`, wrap(async (req, res) => {
    const parsed = schema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(422).json({ error: 'Validation failed', issues: parsed.error.flatten() });
    const row = parsed.data;
    if (table === 'colleges' && row.slug) row.slug = slugify(row.slug);
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

// ---------------------------------------------------------------- reviews moderation
router.get('/reviews', wrap(async (req, res) => {
  const { from, to } = page(req);
  let q = supabase
    .from('reviews')
    .select('*, colleges(name, slug), profiles(full_name, email)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);
  if (req.query.status) q = q.eq('status', req.query.status);
  if (req.query.college_id) q = q.eq('college_id', req.query.college_id);
  const { data, count, error } = await q;
  if (error) return fail(res, error);
  res.json({ data, count });
}));

router.patch('/reviews/:id', wrap(async (req, res) => {
  const parsed = reviewUpdate.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: 'Validation failed', issues: parsed.error.flatten() });
  const row = { ...parsed.data };
  if (row.title || row.body || row.rating) row.edited_by_admin = true;
  const { data, error } = await supabase.from('reviews').update(row).eq('id', req.params.id).select().single();
  if (error) return fail(res, error);
  res.json({ data });
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
  if (req.query.status) q = q.eq('status', req.query.status);
  if (req.query.job_id) q = q.eq('job_id', req.query.job_id);
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
  if (req.query.q) {
    const term = String(req.query.q).replace(/[%,()]/g, ' ').trim();
    q = q.or(`email.ilike.%${term}%,full_name.ilike.%${term}%,phone.ilike.%${term}%`);
  }
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
