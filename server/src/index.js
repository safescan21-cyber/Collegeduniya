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
import { supabase as sbAdmin } from './supabase.js';
import { otpReady, notifyReady } from './services/whatsapp.js';

const app = express();
const PORT = process.env.PORT || 4000;
const origins = (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',').map((s) => s.trim());

app.set('trust proxy', 1); // behind Nginx on the VPS
app.use(helmet());
app.use(cors({ origin: origins, credentials: true }));
app.post('/api/payments/razorpay/webhook', ...razorpayWebhook);   // needs the raw body, so before express.json
app.use('/api/hooks', hookRoutes);                                  // Supabase Auth hooks (signed raw body)
app.use(express.json({ limit: '2mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'studyearnstay-api', time: new Date().toISOString() }));
app.get('/api/whatsapp/status', (_req, res) => res.json({ login: otpReady(), notifications: notifyReady() }));

app.use('/api', loadUser);
app.use('/api/track', trackRoutes);
app.use('/api', publicRoutes);       // /api/leads, /api/newsletter
app.use('/api/chat', chatRoutes);
app.use('/api', geoRoutes);         // /api/cities, /api/nearby, /api/local-jobs, /api/translate, /api/languages
app.use('/api/payments', paymentRoutes);
app.use('/api/mock', mockRoutes);
app.use('/api/verify', verifyRoutes);
app.use('/api/calls', callRoutes);
app.use('/api', presenceRoutes);   // /api/presence, /api/session/login
app.use('/api', communityRoutes);    // /api/notify/visit, /api/notify/message
app.use('/api/admin', rateLimit({ windowMs: 60_000, limit: 300 }), adminRoutes);

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[error]', err);
  const status = err.status || (err.code === 'LIMIT_FILE_SIZE' ? 413 : 500);
  res.status(status).json({ error: err.message || 'Server error' });
});

app.listen(PORT, () => {
  console.log(`StudyEarnstay API running on http://localhost:${PORT}`);
  startJobAlertScheduler();
  // chats (messages + call log) older than CHAT_RETENTION_MONTHS (default 6) are deleted daily; posts are kept
  if (process.env.CHAT_PURGE !== 'off') {
    const purge = async () => {
      const { data, error } = await sbAdmin.rpc('purge_old_chats', { p_months: Number(process.env.CHAT_RETENTION_MONTHS || 6) });
      if (error) console.warn('[chat purge]', error.message); else if (data?.[0]?.messages) console.log('[chat purge]', data[0]);
    };
    setTimeout(purge, 60_000); setInterval(purge, 24 * 3600e3);
  }
  startNotifier();
  startMockSweeper();
  startAutopilot();
  startPresenceCleanup();
  console.log(`[ai] ${llmReady() ? `${llmProvider()} · ${llmModel()}` : 'not configured — mock-test generation and AI feedback are off (rule-based feedback still works)'}`);
});
