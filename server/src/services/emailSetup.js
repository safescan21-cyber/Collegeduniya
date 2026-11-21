import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import nodemailer from 'nodemailer';
import { saveSecret } from './secrets.js';
import { resetMailer, sendMail } from './mailer.js';

// Connect an email account (Gmail + App Password by default) from the admin panel:
//   1. check the login with the mail server, 2. save it for the API (alerts, digests, notifications),
//   3. write it into the self-hosted Supabase .env and restart its login service, so login/sign-up codes are emailed,
//   4. send a test email.
const SUPABASE_DIR = process.env.SUPABASE_DIR || '/opt/collegeolo-supabase';
const here = path.dirname(fileURLToPath(import.meta.url));
const OVERRIDE = path.resolve(here, '../../../deploy/supabase-collegeolo.override.yml');

const run = (cmd, args, opts) => new Promise((resolve, reject) =>
  execFile(cmd, args, { timeout: 180000, ...opts }, (e, out, err) => (e ? reject(new Error(String(err || e.message).trim().slice(-300))) : resolve(out))));

// Replace every copy of each setting (docker compose uses the LAST one if a key appears twice), then add one line each
function setEnvLines(file, values) {
  const keys = new Set(Object.keys(values));
  const lines = fs.readFileSync(file, 'utf8').split('\n').filter((l) => !keys.has(l.split('=')[0].trim()));
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  for (const [k, v] of Object.entries(values)) lines.push(`${k}=${v}`);
  fs.writeFileSync(file, `${lines.join('\n')}\n`, { mode: 0o600 });
}

// Point the login service (GoTrue) at this mail account and restart it
async function applyToLoginService({ email, password, host, port }) {
  const envFile = path.join(SUPABASE_DIR, '.env');
  if (!fs.existsSync(envFile)) return `Login service not on this server (${SUPABASE_DIR} missing) — set SMTP in your Supabase dashboard instead`;
  if (/[\n\r]/.test(password)) throw new Error('Invalid password');
  const cur = fs.readFileSync(envFile, 'utf8');
  const cfs = [...cur.matchAll(/^COMPOSE_FILE=(.*)$/gm)].map((m) => m[1].trim());
  const cf = cfs[cfs.length - 1] || '';
  const values = { SMTP_ADMIN_EMAIL: email, SMTP_HOST: host, SMTP_PORT: String(port), SMTP_USER: email, SMTP_PASS: password, SMTP_SENDER_NAME: 'Collegeolo' };
  if (fs.existsSync(OVERRIDE)) {
    fs.copyFileSync(OVERRIDE, path.join(SUPABASE_DIR, 'docker-compose.collegeolo.yml'));
    const parts = (cf || 'docker-compose.yml').split(':').filter(Boolean);
    values.COMPOSE_FILE = (parts.includes('docker-compose.collegeolo.yml') ? parts : [...parts, 'docker-compose.collegeolo.yml']).join(':');
  }
  setEnvLines(envFile, values);
  await run('docker', ['compose', 'up', '-d', '--force-recreate', 'auth'], { cwd: SUPABASE_DIR });
  // confirm the running service really has the new settings
  await new Promise((r) => setTimeout(r, 4000));
  const got = await run('docker', ['compose', 'exec', '-T', 'auth', 'sh', '-c', 'echo "$GOTRUE_SMTP_HOST|$GOTRUE_SMTP_USER"'], { cwd: SUPABASE_DIR }).catch((e) => e.message);
  if (!String(got).includes(host)) throw new Error(`Login service did not pick up the mail settings (it reports: ${String(got).trim().slice(0, 120)})`);
  return 'Login service restarted with the new email settings (checked)';
}

// Re-apply the saved account (SMTP_URL) to the login service — no password needed again
export async function reapplyEmail() {
  const u = process.env.SMTP_URL;
  if (!u) throw Object.assign(new Error('No email account saved yet — connect Gmail first'), { status: 400 });
  const url = new URL(u);
  const email = decodeURIComponent(url.username); const password = decodeURIComponent(url.password);
  return { ok: true, steps: [await applyToLoginService({ email, password, host: url.hostname, port: Number(url.port) || 587 })] };
}

export async function setupEmail({ email, password, host = 'smtp.gmail.com', port = 587, testTo, userId = null }) {
  email = String(email || '').trim().toLowerCase();
  password = String(password || '').replace(/\s+/g, '');
  host = String(host || 'smtp.gmail.com').trim(); port = Number(port) || 587;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw Object.assign(new Error('Enter the email address that will send the codes'), { status: 400 });
  if (password.length < 8) throw Object.assign(new Error('Enter the password (for Gmail: the 16-letter App Password)'), { status: 400 });
  const steps = [];

  // 1. check the login
  const url = `${port === 465 ? 'smtps' : 'smtp'}://${encodeURIComponent(email)}:${encodeURIComponent(password)}@${host}:${port}`;
  try { await nodemailer.createTransport(url).verify(); steps.push('Mail server accepted the login'); } catch (e) {
    const m = String(e.message || e);
    const hint = /gmail/i.test(host) && /535|Username and Password not accepted|BadCredentials|534|Application-specific/i.test(m)
      ? 'Gmail refused the password. Use an App Password (myaccount.google.com/apppasswords, needs 2-Step Verification), not your normal Gmail password.' : m.slice(0, 200);
    throw Object.assign(new Error(hint), { status: 400 });
  }

  // 2. the API's own email (alerts, digests, notifications)
  await saveSecret('SMTP_URL', url, userId);
  await saveSecret('MAIL_FROM', `Collegeolo <${email}>`, userId);
  resetMailer();
  steps.push('Saved for site emails (alerts, exam news, notifications)');

  // 3. the login service (Supabase GoTrue) on this server
  steps.push(await applyToLoginService({ email, password, host, port }));

  // 4. test email
  if (testTo) {
    await sendMail({ to: testTo, subject: 'Collegeolo email is working', text: `This test email confirms that Collegeolo can send email from ${email}. Login codes will now arrive by email.` });
    steps.push(`Test email sent to ${testTo}`);
  }
  return { ok: true, steps };
}
