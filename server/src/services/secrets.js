import { supabase } from '../supabase.js';

// Keys saved from the admin panel (table app_secrets, server-only). Loaded into process.env at start-up, so
// services read them exactly like keys from server/.env. A key saved in the panel wins over the .env value.
export const ALLOWED = new Set(['ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'GROQ_API_KEY', 'SAMBANOVA_API_KEY', 'OPENROUTER_API_KEY',
  'NVIDIA_API_KEY', 'MISTRAL_API_KEY', 'CEREBRAS_API_KEY', 'COHERE_API_KEY', 'CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID', 'SMTP_URL', 'MAIL_FROM',
  'JOOBLE_API_KEY', 'ADZUNA_APP_ID', 'ADZUNA_APP_KEY', 'COLLEGE_SCORECARD_API_KEY']);
const MIN_LEN = { ADZUNA_APP_ID: 6, CLOUDFLARE_ACCOUNT_ID: 16 };

const isModel = (n) => /^(GEMINI|GROQ|SAMBANOVA|OPENROUTER|NVIDIA|MISTRAL|CEREBRAS|COHERE|CLOUDFLARE|LLM_ANTHROPIC)_MODEL$/.test(n);

export async function loadSecrets() {
  const { data, error } = await supabase.from('app_secrets').select('name, value');
  if (error) { console.warn('[secrets]', error.message); return 0; }
  for (const s of data || []) if ((ALLOWED.has(s.name) || isModel(s.name)) && s.value) process.env[s.name] = s.value;
  return (data || []).length;
}

export async function saveSecret(name, value, userId = null) {
  if (!ALLOWED.has(name) && !isModel(name)) throw Object.assign(new Error('This key cannot be set here'), { status: 400 });
  const v = String(value || '').replace(/\s+/g, '');
  if (isModel(name) ? !/^[\w.:/@-]{2,120}$/.test(v) : (v.length < (MIN_LEN[name] || 16) || v.length > 400)) throw Object.assign(new Error('That does not look like a full key'), { status: 400 });
  const { error } = await supabase.from('app_secrets').upsert({ name, value: v, updated_by: userId, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
  process.env[name] = v;
}

export async function deleteSecret(name) {
  if (!ALLOWED.has(name)) throw Object.assign(new Error('Unknown key'), { status: 400 });
  await supabase.from('app_secrets').delete().eq('name', name);
  delete process.env[name];
}

export async function savedSecretNames() {
  const { data } = await supabase.from('app_secrets').select('name, updated_at');
  return Object.fromEntries((data || []).map((d) => [d.name, d.updated_at]));
}
