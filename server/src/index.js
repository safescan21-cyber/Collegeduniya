import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { loadUser } from './middleware/auth.js';
import adminRoutes from './routes/admin.js';
import trackRoutes from './routes/track.js';
import publicRoutes from './routes/public.js';
import chatRoutes from './routes/chat.js';
import geoRoutes from './routes/geo.js';
import paymentRoutes, { webhook as razorpayWebhook } from './routes/payments.js';
import communityRoutes from './routes/community.js';
import { startJobAlertScheduler } from './services/jobAlerts.js';
import { startNotifier } from './services/notifier.js';
import { startMockSweeper } from './services/mockResults.js';
import { startAutopilot } from './services/mockAutopilot.js';
import mockRoutes from './routes/mock.js';
import presenceRoutes, { startPresenceCleanup } from './routes/presence.js';
import { llmReady, llmProvider, llmModel } from './services/llm.js';
import hookRoutes from './routes/hooks.js';
import verifyRoutes from './routes/verify.js';
import callRoutes from './routes/calls.js';
import accountRoutes from './routes/account.js';
import { startCollegeAutofill } from './services/collegeAutofill.js';
import { startExamNews } from './services/examNews.js';
import { startVisaNews } from './services/visaNews.js';
import { startHealthMonitor } from './services/health.js';
import { errorWatch, startErrorWatch } from './services/errorWatch.js';
import { supabase as sbAdmin } from './supabase.js';
import { loadSecrets } from './services/secrets.js';
import { initPush, pushPublicKey } from './services/push.js';
import { startNearbyPrefill } from './services/geo.js';
import { startAutoCountries } from './services/autoCountries.js';
import { startBundledCourses } from './services/bundledCourses.js';
import { startDateReminders } from './services/dateReminders.js';
import { startExamDates } from './services/examDates.js';
import { startFxSync } from './services/fxSync.js';
import { startOfficialFees } from './services/officialFees.js';
import { otpReady, notifyReady } from './services/whatsapp.js';

const app = express();
const PORT = process.env.PORT || 4000;
const origins = (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',').map((s) => s.trim());

app.set('trust proxy', 1); // behind Nginx on the VPS
app.use(errorWatch());       // counts failed/slow requests, explains them and starts automatic fixes (Admin → System health)
app.use(helmet());
// the NIRF data import runs in an admin's browser on nirfindia.org (which refuses server downloads) and posts each sheet here
const nirfCors = cors({ origin: ['https://www.nirfindia.org', 'https://nirfindia.org'], methods: ['POST'], allowedHeaders: ['Content-Type', 'X-Import-Code'] });
app.options('/api/nirf-sheet', nirfCors);
app.post('/api/nirf-sheet', nirfCors, express.json({ limit: '4mb' }), async (req, res) => {
  try {
    const { checkImportCode } = await import('./services/importCodes.js');
    if (!checkImportCode(req.get('X-Import-Code'), 'nirf')) return res.status(401).json({ error: 'Import code missing or expired — create a new one in Admin → Import' });
    const { importNirfSheet } = await import('./services/nirfData.js');
    const b = req.body || {};
    res.json(await importNirfSheet({ year: Number(b.year) || 2025, category: String(b.category || ''), pageUrl: b.pageUrl, row: b.row, pdfBase64: b.pdf || null }));
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});
app.use(cors({ origin: origins, credentials: true }));
app.post('/api/payments/razorpay/webhook', ...razorpayWebhook);   // needs the raw body, so before express.json
app.use('/api/hooks', hookRoutes);                                  // Supabase Auth hooks (signed raw body)
app.use(express.json({ limit: '2mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'collegeolo-api', time: new Date().toISOString() }));
app.get('/api/whatsapp/status', (_req, res) => res.json({ login: otpReady(), notifications: notifyReady() }));

// fair use: one address may make 600 API calls a minute (many students share one mobile-network address);
// stops scrapers and runaway scripts from slowing the site for everyone
app.use('/api', rateLimit({ windowMs: 60_000, limit: Number(process.env.API_RATE_PER_MIN || 600), standardHeaders: 'draft-7', legacyHeaders: false,
  skip: (req) => req.path === '/health' || req.path.startsWith('/hooks') || req.path.startsWith('/payments/razorpay'),
  message: { error: 'Too many requests from your network — please wait a minute and try again.' } }));
app.get('/api/push/key', (_req, res) => { const key = pushPublicKey(); res.set('Cache-Control', 'public, max-age=3600'); res.json({ key }); });   // public: browsers need it to subscribe
app.use('/api', loadUser);
app.use('/api/track', trackRoutes);
app.use('/api', publicRoutes);       // /api/leads, /api/newsletter
app.use('/api/chat', chatRoutes);
app.use('/api', geoRoutes);         // /api/cities, /api/nearby, /api/local-jobs, /api/translate, /api/languages
app.use('/api/payments', paymentRoutes);
app.use('/api/mock', mockRoutes);
app.use('/api/verify', verifyRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/account', accountRoutes);
app.use('/api', presenceRoutes);   // /api/presence, /api/session/login
app.use('/api', communityRoutes);    // /api/notify/visit, /api/notify/message
app.use('/api/admin', rateLimit({ windowMs: 60_000, limit: 300 }), adminRoutes);

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[error]', err);
  res.locals.errMsg = err.message;
  const status = err.status || (err.code === 'LIMIT_FILE_SIZE' ? 413 : 500);
  res.status(status).json({ error: err.message || 'Server error' });
});

const server = app.listen(PORT, () => {
  console.log(`Collegeolo API running on http://localhost:${PORT}`);
  // An import still marked "running" when the API starts was cut off by the restart (one API process): mark it failed,
  // so the admin page tells the truth and the automatic importers try it again instead of waiting hours for it.
  sbAdmin.from('import_runs').update({ status: 'failed', message: 'Stopped — the server restarted during the import. It will run again automatically.', finished_at: new Date().toISOString() })
    .eq('status', 'running').select('id')
    .then(({ data, error }) => {
      if (error) console.warn('[imports] could not tidy interrupted imports:', error.message);
      else if (data?.length) console.log(`[imports] ${data.length} interrupted import(s) marked as stopped`);
    }, () => {});
  startJobAlertScheduler();
  startCollegeAutofill();
  startExamNews();
  startVisaNews();
  startHealthMonitor();
  startErrorWatch();
  // chats (messages + call log) older than CHAT_RETENTION_MONTHS (default 6) are deleted daily; posts are kept
  if (process.env.CHAT_PURGE !== 'off') {
    const purge = async () => {
      const { data, error } = await sbAdmin.rpc('purge_old_chats', { p_months: Number(process.env.CHAT_RETENTION_MONTHS || 6) });
      if (error) console.warn('[chat purge]', error.message); else if (data?.[0]?.messages) console.log('[chat purge]', data[0]);
    };
    setTimeout(purge, 60_000); setInterval(purge, 24 * 3600e3);
  }
  // which college and city pages have enough real information to be shown to Google (migration 018)
  if (process.env.SEO_REFRESH !== 'off') {
    const seo = async () => {
      const { data, error } = await sbAdmin.rpc('refresh_seo', {});
      if (error) console.warn('[seo refresh]', error.message); else console.log('[seo refresh]', data?.[0]);
      const { data: cities } = await sbAdmin.rpc('refresh_city_counts');   // every city with a college gets an indexed page
      if (cities != null) console.log('[city pages]', cities, 'cities with colleges');
    };
    setTimeout(seo, 120_000); setInterval(seo, 24 * 3600e3);
  }
  startNotifier();
  startMockSweeper();
  startAutopilot();
  startPresenceCleanup();
  startNearbyPrefill();
  startAutoCountries();
  startBundledCourses();
  startDateReminders();
  startExamDates();
  startFxSync();
  startOfficialFees();
  loadSecrets().then((n) => n && console.log(`[secrets] ${n} key(s) from the admin panel`)).then(() => initPush()).finally(() =>
    console.log(`[ai] ${llmReady() ? `${llmProvider()} · ${llmModel()}` : 'not configured — mock-test generation and AI feedback are off (rule-based feedback still works)'}`));
});

// many visitors at once: keep connections from nginx open and don't let a slow client hold a request forever
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;
server.requestTimeout = 180_000;
