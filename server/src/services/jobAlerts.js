import { supabase } from '../supabase.js';
import { sendMail, mailEnabled } from './mailer.js';
import { alertsReady, sendJobAlert } from './whatsapp.js';

// Job alerts: every hour, find alerts that are due (daily = 24h since last send, weekly = 7 days), look for new
// open jobs that match, and send one email (or one WhatsApp template message) per alert.
//
// WhatsApp alerts use services/whatsapp.js (WHATSAPP_TOKEN, WHATSAPP_PHONE_ID and WHATSAPP_TEMPLATE or WHATSAPP_NOTIFY_TEMPLATE).
// Without them, WhatsApp alerts fall back to email.

const SITE = (process.env.SITE_URL || 'https://studyearnstay.com').replace(/\/$/, '');
const DAY = 86_400_000;

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clean = (s) => String(s || '').replace(/[%,()*\\]/g, ' ').trim().slice(0, 60);

export const whatsappEnabled = alertsReady;

export function alertSearchUrl(a) {
  const p = new URLSearchParams();
  if (a.keywords) p.set('q', a.keywords);
  if (a.city) p.set('city', a.city);
  if (a.country) p.set('country', a.country);
  if (a.job_type) p.set('type', a.job_type);
  return `${SITE}/jobs${p.toString() ? `?${p}` : ''}`;
}

export async function matchingJobs(a, since) {
  let q = supabase.from('jobs').select('id, title, company, city, country, job_type, is_remote, pay_min, pay_max, currency, pay_unit, created_at')
    .eq('is_published', true).eq('status', 'open').gt('created_at', since).order('created_at', { ascending: false }).limit(10);
  if (a.job_type) q = q.eq('job_type', a.job_type);
  if (a.country) q = q.eq('country', a.country);
  const kw = clean(a.keywords);
  if (kw) q = q.or(`title.ilike.%${kw}%,company.ilike.%${kw}%,description.ilike.%${kw}%`);
  const city = clean(a.city);
  if (city) q = a.remote_ok ? q.or(`city.ilike.${city},is_remote.eq.true`) : q.ilike('city', city);
  else if (!a.remote_ok) q = q.eq('is_remote', false);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

const pay = (j) => (j.pay_min || j.pay_max)
  ? `${j.currency || ''} ${[j.pay_min, j.pay_max].filter(Boolean).map((n) => Number(n).toLocaleString('en-IN')).join('–')}/${j.pay_unit || 'month'}`
  : '';

function emailBody(a, jobs) {
  const link = alertSearchUrl(a);
  const text = [`${jobs.length} new job${jobs.length > 1 ? 's' : ''} matching your alert:`, '',
    ...jobs.map((j) => `• ${j.title} — ${j.company}, ${j.is_remote ? 'Remote' : j.city} ${pay(j)}\n  ${SITE}/jobs/${j.id}`),
    '', `See all: ${link}`, `Manage or stop alerts: ${SITE}/dashboard?tab=alerts`].join('\n');
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px">
    <h2 style="color:#4f46e5">${jobs.length} new job${jobs.length > 1 ? 's' : ''} for you</h2>
    ${jobs.map((j) => `<p style="margin:0 0 14px"><a href="${SITE}/jobs/${j.id}" style="font-weight:bold;color:#111">${esc(j.title)}</a><br>
      <span style="color:#555">${esc(j.company)} · ${j.is_remote ? 'Remote' : esc(j.city)} · ${esc(j.job_type)}${pay(j) ? ` · ${esc(pay(j))}` : ''}</span></p>`).join('')}
    <p><a href="${esc(link)}" style="background:#4f46e5;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">See all matching jobs</a></p>
    <p style="color:#888;font-size:12px">You get this because you created a job alert on StudyEarnstay. <a href="${SITE}/dashboard?tab=alerts">Manage or stop alerts</a>.</p></div>`;
  return { text, html };
}

const sendWhatsapp = (to, text) => sendJobAlert(to, text);

export async function runJobAlerts({ dryRun = false } = {}) {
  const now = Date.now();
  const { data: alerts, error } = await supabase.from('job_alerts').select('*, profiles(email, full_name, is_blocked)').eq('is_active', true).limit(5000);
  if (error) throw error;
  const stats = { checked: 0, sent: 0, empty: 0, failed: 0 };
  for (const a of alerts || []) {
    const gap = a.frequency === 'weekly' ? 7 * DAY : DAY;
    const last = a.last_sent_at ? Date.parse(a.last_sent_at) : Date.parse(a.created_at);
    if (now - last < gap - 5 * 60_000 || a.profiles?.is_blocked) continue;
    stats.checked++;
    try {
      const jobs = await matchingJobs(a, new Date(last).toISOString());
      if (!jobs.length) { stats.empty++; if (!dryRun) await supabase.from('job_alerts').update({ last_sent_at: new Date().toISOString() }).eq('id', a.id); continue; }
      let ok = false;
      if (!dryRun) {
        if (a.channel === 'whatsapp' && whatsappEnabled()) {
          const where = a.city || (a.remote_ok ? 'remote' : 'your area');
          ok = await sendWhatsapp(a.whatsapp, `${jobs.length} new ${a.job_type || ''} job${jobs.length > 1 ? 's' : ''} (${where}) — ${alertSearchUrl(a)}`.replace(/\s+/g, ' '));
        }
        if (!ok && a.profiles?.email) {
          const { text, html } = emailBody(a, jobs);
          ok = await sendMail({ to: a.profiles.email, subject: `${jobs.length} new job${jobs.length > 1 ? 's' : ''}: ${jobs[0].title}${jobs.length > 1 ? ' and more' : ''}`, text, html });
        }
        await supabase.from('job_alerts').update({ last_sent_at: new Date().toISOString() }).eq('id', a.id);
      }
      if (ok || dryRun) stats.sent++; else stats.failed++;
    } catch (e) {
      stats.failed++;
      console.error('[job-alerts]', a.id, e.message);
    }
  }
  return stats;
}

export function startJobAlertScheduler() {
  if (process.env.JOB_ALERTS === 'off') return;
  if (!mailEnabled() && !whatsappEnabled()) { console.log('[job-alerts] SMTP_URL / WhatsApp not set — alerts are saved but not sent'); return; }
  const tick = () => runJobAlerts().then((s) => s.checked && console.log('[job-alerts]', s)).catch((e) => console.error('[job-alerts]', e.message));
  setTimeout(tick, 60_000);
  setInterval(tick, 60 * 60_000).unref();
}
