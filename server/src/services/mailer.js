import nodemailer from 'nodemailer';

// Optional outgoing email (lead sharing, notifications). Set SMTP_URL, e.g.
//   smtps://user:password@smtp.zoho.in:465     or   smtp://apikey:KEY@smtp-relay.brevo.com:587
// and MAIL_FROM="StudyEarnstay <hello@studyearnstay.com>". Without SMTP_URL, mail is skipped.
let transport = null;
export const mailEnabled = () => Boolean(process.env.SMTP_URL);

export async function sendMail({ to, subject, text, html, replyTo, headers }) {
  if (!mailEnabled() || !to) return false;
  transport ||= nodemailer.createTransport(process.env.SMTP_URL);
  await transport.sendMail({ from: process.env.MAIL_FROM || 'StudyEarnstay <no-reply@studyearnstay.com>', to, subject, text, html, replyTo, headers });
  return true;
}
