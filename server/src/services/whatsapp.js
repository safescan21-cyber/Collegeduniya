// WhatsApp Cloud API (Meta) — used for login codes, notifications and job alerts.
// Nothing is sent until these are set in server/.env (add your WhatsApp Business number later):
//   WHATSAPP_TOKEN          permanent access token (System User) with whatsapp_business_messaging
//   WHATSAPP_PHONE_ID       "Phone number ID" of your WhatsApp Business number (not the number itself)
//   WHATSAPP_OTP_TEMPLATE   approved AUTHENTICATION template, e.g. "login_code" (copy-code button)
//   WHATSAPP_NOTIFY_TEMPLATE approved UTILITY template with 2 body variables: {{1}} = title, {{2}} = details + link
//   WHATSAPP_TEMPLATE       (job alerts) UTILITY template with 1 body variable; falls back to the notify template
//   WHATSAPP_TEMPLATE_LANG  template language code, default "en"
const GRAPH = process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v21.0';
const lang = () => process.env.WHATSAPP_TEMPLATE_LANG || 'en';

export const whatsappReady = () => Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID);
export const otpReady = () => whatsappReady() && Boolean(process.env.WHATSAPP_OTP_TEMPLATE);
export const notifyReady = () => whatsappReady() && Boolean(process.env.WHATSAPP_NOTIFY_TEMPLATE);
export const alertsReady = () => whatsappReady() && Boolean(process.env.WHATSAPP_TEMPLATE || process.env.WHATSAPP_NOTIFY_TEMPLATE);

// "+91 98765-43210" → "919876543210" (country code required)
export const waNumber = (s) => {
  const d = String(s || '').replace(/[^\d]/g, '').replace(/^00/, '');
  return d.length >= 10 && d.length <= 15 ? d : null;
};

// Template variables can't contain newlines/tabs or 4+ spaces in a row
const clean = (s, max = 900) => String(s ?? '').replace(/[\n\t]+/g, ' ').replace(/ {4,}/g, '   ').trim().slice(0, max) || '-';

async function send(to, template, components) {
  const phone = waNumber(to);
  if (!phone) throw new Error('Invalid WhatsApp number');
  const res = await fetch(`${GRAPH}/${process.env.WHATSAPP_PHONE_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: phone, type: 'template',
      template: { name: template, language: { code: lang() }, components } }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`WhatsApp ${res.status}: ${body?.error?.message || 'send failed'}`);
  return body?.messages?.[0]?.id || true;
}

// Authentication template: the code goes in the body AND in the copy-code button
export function sendOtp(to, code) {
  return send(to, process.env.WHATSAPP_OTP_TEMPLATE, [
    { type: 'body', parameters: [{ type: 'text', text: String(code) }] },
    { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: String(code) }] },
  ]);
}

export function sendNotification(to, title, details) {
  return send(to, process.env.WHATSAPP_NOTIFY_TEMPLATE, [
    { type: 'body', parameters: [{ type: 'text', text: clean(title, 200) }, { type: 'text', text: clean(details) }] },
  ]);
}

export function sendJobAlert(to, text) {
  if (process.env.WHATSAPP_TEMPLATE) {
    return send(to, process.env.WHATSAPP_TEMPLATE, [{ type: 'body', parameters: [{ type: 'text', text: clean(text) }] }]);
  }
  return sendNotification(to, 'New jobs for you', text);
}
