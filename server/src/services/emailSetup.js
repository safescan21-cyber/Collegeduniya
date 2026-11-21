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

function setEnvLines(file, values) {
  let lines = fs.readFileSync(file, 'utf8').split('\n');
  for (const [k, v] of Object.entries(values)) {
    const line = `${k}=${v}`;
    const i = lines.findIndex((l) => l.startsWith(`${k}=`));
    if (i >= 0) lines[i] = line; else lines.splice(lines.length - (lines[lines.length - 1] === '' ? 1 : 0), 0, line);
  }
  fs.writeFileSync(file, lines.join('\n'), { mode: 0o600 });
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
  const envFile = path.join(SUPABASE_DIR, '.env');
  if (fs.existsSync(envFile)) {
    if (/[\n\r]/.test(password)) throw new Error('Invalid password');
    const cur = fs.readFileSync(envFile, 'utf8');
    const cf = (cur.match(/^COMPOSE_FILE=(.*)$/m)?.[1] || '').trim();
    const values = { SMTP_ADMIN_EMAIL: email, SMTP_HOST: host, SMTP_PORT: String(port), SMTP_USER: email, SMTP_PASS: password, SMTP_SENDER_NAME: 'Collegeolo' };
    if (fs.existsSync(OVERRIDE)) {
      fs.copyFileSync(OVERRIDE, path.join(SUPABASE_DIR, 'docker-compose.collegeolo.yml'));
      const parts = (cf || 'docker-compose.yml').split(':').filter(Boolean);
      if (!parts.includes('docker-compose.collegeolo.yml')) values.COMPOSE_FILE = [...parts, 'docker-compose.collegeolo.yml'].join(':');
    }
    setEnvLines(envFile, values);
    await run('docker', ['compose', 'up', '-d', 'auth'], { cwd: SUPABASE_DIR });
    steps.push('Login service restarted with the new email settings');
  } else {
    steps.push(`Login service not on this server (${SUPABASE_DIR} missing) — set SMTP in your Supabase dashboard instead`);
  }

  // 4. test email
  if (testTo) {
    await sendMail({ to: testTo, subject: 'Collegeolo email is working', text: `This test email confirms that Collegeolo can send email from ${email}. Login codes will now arrive by email.` });
    steps.push(`Test email sent to ${testTo}`);
  }
  return { ok: true, steps };
}
