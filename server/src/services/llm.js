// AI for mock tests (question writing, double-check, result feedback) — a POOL of providers with automatic failover.
//
// Add a key for every free service you sign up for; the API uses them in order and moves on when one is rate-limited,
// out of daily quota or down. The answer double-check always prefers a DIFFERENT provider from the one that wrote the
// question (two different AIs catch more mistakes).
//
// Free tiers (no card) as of late 2026 — limits change, check each dashboard:
//   GEMINI_API_KEY      Google AI Studio  (aistudio.google.com)          free Flash / Gemma models
//   GROQ_API_KEY        Groq              (console.groq.com)             ~1,000 requests / 200K tokens per day
//   OPENROUTER_API_KEY  OpenRouter        (openrouter.ai)                ":free" models, 50 req/day (1,000 after a one-time $10 top-up)
//   SAMBANOVA_API_KEY   SambaNova Cloud   (cloud.sambanova.ai)           ~20 req/day per model
//   MISTRAL_API_KEY     Mistral           (console.mistral.ai)           free "Experiment" plan
//   NVIDIA_API_KEY      NVIDIA API catalog (build.nvidia.com)            prototyping access
//   COHERE_API_KEY      Cohere trial key  (dashboard.cohere.com)         1,000 calls / month
//   CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID  Workers AI            10,000 neurons / day (small models)
//   CEREBRAS_API_KEY    Cerebras          (cloud.cerebras.ai)            starter credits
// Self-hosted (free, your hardware):  OLLAMA_MODEL=qwen2.5:14b-instruct  (OLLAMA_URL default http://localhost:11434/v1)
// Any other OpenAI-compatible API:     LLM_BASE_URL + LLM_API_KEY + LLM_MODEL   (e.g. Sarvam, vLLM, Together)
// Paid, strongest:                     ANTHROPIC_API_KEY (+ LLM_ANTHROPIC_MODEL, default claude-sonnet-5-5)
//
// Override any model with <ID>_MODEL (e.g. GROQ_MODEL=qwen/qwen3.8-27b). Change the order with
// LLM_ORDER=gemini,groq,sambanova,openrouter,... (first = preferred writer).

const env = (k) => (process.env[k] || '').trim();

export const CATALOG = [
  { id: 'anthropic', name: 'Anthropic Claude (paid)', key: 'ANTHROPIC_API_KEY', model: 'claude-sonnet-5-5', modelEnv: 'LLM_ANTHROPIC_MODEL', kind: 'anthropic',
    base: () => env('ANTHROPIC_API_URL') || 'https://api.anthropic.com/v1/messages', signup: 'https://console.anthropic.com' },
  { id: 'gemini', name: 'Google Gemini', key: 'GEMINI_API_KEY', model: 'gemini-3.8-flash', base: () => 'https://generativelanguage.googleapis.com/v1beta/openai', signup: 'https://aistudio.google.com/apikey' },
  { id: 'groq', name: 'Groq', key: 'GROQ_API_KEY', model: 'openai/gpt-oss-120b', base: () => 'https://api.groq.com/openai/v1', signup: 'https://console.groq.com/keys' },
  { id: 'sambanova', name: 'SambaNova Cloud', key: 'SAMBANOVA_API_KEY', model: 'DeepSeek-V3.2', base: () => 'https://api.sambanova.ai/v1', signup: 'https://cloud.sambanova.ai' },
  { id: 'openrouter', name: 'OpenRouter (free models)', key: 'OPENROUTER_API_KEY', model: 'nvidia/nemotron-3-super-120b-a12b:free', base: () => 'https://openrouter.ai/api/v1', signup: 'https://openrouter.ai/keys' },
  { id: 'nvidia', name: 'NVIDIA API catalog', key: 'NVIDIA_API_KEY', model: 'meta/llama-3.3-70b-instruct', base: () => 'https://integrate.api.nvidia.com/v1', signup: 'https://build.nvidia.com' },
  { id: 'mistral', name: 'Mistral', key: 'MISTRAL_API_KEY', model: 'mistral-small-latest', base: () => 'https://api.mistral.ai/v1', signup: 'https://console.mistral.ai' },
  { id: 'cerebras', name: 'Cerebras', key: 'CEREBRAS_API_KEY', model: 'gpt-oss-120b', base: () => 'https://api.cerebras.ai/v1', signup: 'https://cloud.cerebras.ai' },
  { id: 'cohere', name: 'Cohere (trial)', key: 'COHERE_API_KEY', model: 'command-a-plus-05-2026', base: () => 'https://api.cohere.ai/compatibility/v1', signup: 'https://dashboard.cohere.com/api-keys' },
  { id: 'cloudflare', name: 'Cloudflare Workers AI', key: 'CLOUDFLARE_API_TOKEN', model: '@cf/meta/llama-3.1-8b-instruct', needs: ['CLOUDFLARE_ACCOUNT_ID'],
    base: () => `https://api.cloudflare.com/client/v4/accounts/${env('CLOUDFLARE_ACCOUNT_ID')}/ai/v1`, signup: 'https://dash.cloudflare.com' },
  { id: 'ollama', name: 'Ollama (self-hosted)', key: 'OLLAMA_MODEL', model: '', modelEnv: 'OLLAMA_MODEL', noAuth: true,
    base: () => env('OLLAMA_URL') || 'http://localhost:11434/v1', signup: 'https://ollama.com/download' },
  { id: 'custom', name: 'Custom OpenAI-compatible', key: 'LLM_BASE_URL', model: 'llama3.1:8b-instruct', modelEnv: 'LLM_MODEL', authEnv: 'LLM_API_KEY',
    base: () => env('LLM_BASE_URL'), signup: '' },
];
const DEFAULT_ORDER = ['anthropic', 'gemini', 'groq', 'sambanova', 'openrouter', 'nvidia', 'mistral', 'cerebras', 'custom', 'ollama', 'cohere', 'cloudflare'];

const modelOf = (p) => env(p.modelEnv || `${p.id.toUpperCase()}_MODEL`)
  || (p.id === 'anthropic' && /^claude/.test(env('LLM_MODEL')) ? env('LLM_MODEL') : '') || p.model;
const configured = (p) => Boolean(env(p.key)) && (p.needs || []).every((k) => env(k)) && Boolean(modelOf(p));

// legacy single-provider settings still work: LLM_PROVIDER=openai + LLM_BASE_URL… → "custom"; LLM_CHECK_BASE_URL → extra checker
function legacyChecker() {
  if (!env('LLM_CHECK_BASE_URL')) return null;
  return { id: 'checker', name: 'Custom checker', kind: 'openai', base: () => env('LLM_CHECK_BASE_URL'), model: env('LLM_CHECK_MODEL') || env('LLM_MODEL'), authEnv: 'LLM_CHECK_API_KEY', checkerOnly: true };
}

export function pool() {
  const order = (env('LLM_ORDER') ? env('LLM_ORDER').split(',').map((s) => s.trim()) : []).concat(DEFAULT_ORDER);
  const seen = new Set(); const out = [];
  for (const id of order) {
    const p = CATALOG.find((x) => x.id === id);
    if (!p || seen.has(id)) continue;
    seen.add(id);
    const override = env(`${p.id.toUpperCase()}_BASE_URL`);   // optional proxy / testing override
    if (configured(p)) out.push({ ...p, kind: p.kind || 'openai', modelName: modelOf(p), ...(override && p.id !== 'custom' ? { base: () => override } : {}) });
  }
  const chk = legacyChecker();
  if (chk && chk.model) out.push({ ...chk, modelName: chk.model });
  return out;
}

// ---------------------------------------------------------------- health / cooldowns (in memory)
const health = new Map();   // id → { ok, fail, last_error, last_ok, cooldown_until, disabled_until }
const h = (id) => { if (!health.has(id)) health.set(id, { ok: 0, fail: 0, last_error: null, last_ok: null, cooldown_until: 0 }); return health.get(id); };
const available = (p) => h(p.id).cooldown_until < Date.now();

export const llmReady = () => pool().some((p) => !p.checkerOnly);
export const llmProvider = () => pool().filter((p) => !p.checkerOnly).map((p) => p.id).join(' → ') || '';
export const llmModel = (check = false) => {
  const ps = pool().filter((p) => (check ? true : !p.checkerOnly));
  const p = check ? (ps.find((x) => x.checkerOnly) || ps[1] || ps[0]) : ps[0];
  return p ? `${p.id}:${p.modelName}` : null;
};
export function providerStatus() {
  return CATALOG.map((p) => {
    const st = health.get(p.id) || {};
    return { id: p.id, name: p.name, configured: configured(p), model: modelOf(p) || null, key_env: p.key, signup: p.signup,
      ok: st.ok || 0, fail: st.fail || 0, last_error: st.last_error || null, last_ok: st.last_ok || null,
      cooling_down_until: st.cooldown_until > Date.now() ? new Date(st.cooldown_until).toISOString() : null };
  });
}

class ProviderError extends Error {
  constructor(message, { status = 0, retryAfter = 0 } = {}) { super(message); this.status = status; this.retryAfter = retryAfter; }
}

function cool(p, e) {
  const st = h(p.id); st.fail++; st.last_error = `${new Date().toISOString().slice(11, 16)} ${String(e.message).slice(0, 160)}`;
  const msg = String(e.message).toLowerCase();
  let ms;
  if (e.status === 401 || e.status === 403) ms = 6 * 3600e3;                                       // bad key / not allowed
  else if (e.status === 429 && /day|daily|quota|exhaust|limit reached|credits/.test(msg)) ms = 3600e3;   // daily quota
  else if (e.status === 429) ms = Math.max(20e3, (e.retryAfter || 30) * 1000);
  else if (e.status === 402) ms = 12 * 3600e3;                                                     // needs payment
  else if (e.status === 404 || e.status === 400) ms = 30 * 60e3;                                   // model name changed?
  else ms = 2 * 60e3;                                                                              // 5xx / timeout
  st.cooldown_until = Date.now() + ms;
}

const TIMEOUT = Number(process.env.LLM_TIMEOUT_MS || 120000);

async function callOne(p, { system, prompt, maxTokens, temperature, json }) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), TIMEOUT);
  try {
    if (p.kind === 'anthropic') {
      const r = await fetch(p.base(), {
        method: 'POST', signal: ctl.signal,
        headers: { 'content-type': 'application/json', 'x-api-key': env('ANTHROPIC_API_KEY'), 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: p.modelName, max_tokens: maxTokens, temperature, system, messages: [{ role: 'user', content: prompt }] }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new ProviderError(d?.error?.message || `HTTP ${r.status}`, { status: r.status, retryAfter: Number(r.headers.get('retry-after')) || 0 });
      return (d.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n');
    }
    const key = p.noAuth ? '' : env(p.authEnv || p.key);
    const send = (jsonMode) => fetch(`${p.base().replace(/\/$/, '')}/chat/completions`, {
      method: 'POST', signal: ctl.signal,
      headers: { 'content-type': 'application/json', ...(key ? { authorization: `Bearer ${key}` } : {}),
        ...(p.id === 'openrouter' ? { 'HTTP-Referer': env('SITE_URL') || 'https://studyearnstay.com', 'X-Title': 'StudyEarnstay' } : {}) },
      body: JSON.stringify({ model: p.modelName, max_tokens: maxTokens, temperature, ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
        messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }] }),
    });
    let r = await send(json);
    let d = await r.json().catch(() => ({}));
    if (json && r.status === 400 && /response_format|json/i.test(JSON.stringify(d))) { r = await send(false); d = await r.json().catch(() => ({})); }
    if (!r.ok) {
      const m = d?.error?.message || d?.errors?.[0]?.message || d?.message || `HTTP ${r.status}`;
      throw new ProviderError(m, { status: r.status, retryAfter: Number(r.headers.get('retry-after')) || 0 });
    }
    const text = d.choices?.[0]?.message?.content;
    if (!text) throw new ProviderError('empty reply', { status: 502 });
    return text;
  } catch (e) {
    if (e instanceof ProviderError) throw e;
    throw new ProviderError(e.name === 'AbortError' ? 'timeout' : e.message, { status: 504 });
  } finally { clearTimeout(t); }
}

// check=true → prefer providers other than `avoid` (the one that wrote the question)
function candidates({ check, avoid }) {
  let ps = pool();
  if (!check) ps = ps.filter((p) => !p.checkerOnly);
  else ps = [...ps.filter((p) => p.checkerOnly), ...ps.filter((p) => !p.checkerOnly)];
  if (avoid) ps = [...ps.filter((p) => p.id !== avoid), ...ps.filter((p) => p.id === avoid)];
  else if (check && ps.length > 1 && !ps[0].checkerOnly) ps = [...ps.slice(1), ps[0]];   // default checker = 2nd provider
  const ready = ps.filter(available);
  return ready.length ? ready : ps.sort((a, b) => h(a.id).cooldown_until - h(b.id).cooldown_until).slice(0, 1);   // all cooling → try the soonest
}

export async function complete({ system, prompt, maxTokens = 4000, temperature = 0.7, check = false, avoid = null, json = false }) {
  if (!llmReady()) throw new Error('AI is not configured — add at least one provider key in server/.env (see services/llm.js)');
  const errors = [];
  for (const p of candidates({ check, avoid })) {
    try {
      const text = await callOne(p, { system, prompt, maxTokens, temperature, json });
      const st = h(p.id); st.ok++; st.last_ok = new Date().toISOString();
      return { text, model: `${p.id}:${p.modelName}`, provider: p.id };
    } catch (e) {
      cool(p, e);
      errors.push(`${p.id}: ${e.message}`);
      console.warn(`[llm] ${p.id} failed (${e.status || '-'}) ${String(e.message).slice(0, 120)} — trying next`);
    }
  }
  throw new Error(`All AI providers failed: ${errors.join(' | ').slice(0, 600)}`);
}

// Models sometimes wrap JSON in prose or ``` fences — take the outermost object
export function parseJson(text) {
  const s = String(text || '').replace(/<think>[\s\S]*?<\/think>/g, '');   // reasoning models
  const a = s.indexOf('{'); const b = s.lastIndexOf('}');
  if (a < 0 || b <= a) throw new Error('AI did not return JSON');
  return JSON.parse(s.slice(a, b + 1));
}

export async function completeJson(opts) {
  const sys = `${opts.system}\nReply with ONE JSON object only — no markdown, no commentary.`;
  const first = await complete({ ...opts, system: sys, json: true });
  try { return { data: parseJson(first.text), model: first.model, provider: first.provider }; } catch {
    // bad JSON: retry once, on a different provider if there is one
    const again = await complete({ ...opts, system: sys, json: true, temperature: 0.2, avoid: first.provider });
    return { data: parseJson(again.text), model: again.model, provider: again.provider };
  }
}

// Admin "Test" button: one tiny request to a single provider
export async function testProvider(id) {
  const p = pool().find((x) => x.id === id);
  if (!p) throw new Error('Not configured — add its key in server/.env');
  const t0 = Date.now();
  try {
    const text = await callOne(p, { system: 'Reply with JSON only.', prompt: 'Return {"ok": true, "sum": 17 + 25}', maxTokens: 200, temperature: 0, json: true });
    const d = parseJson(text);
    const st = h(p.id); st.ok++; st.last_ok = new Date().toISOString(); st.cooldown_until = 0;
    return { ok: true, ms: Date.now() - t0, model: p.modelName, correct: Number(d.sum) === 42 };
  } catch (e) { cool(p, e); return { ok: false, ms: Date.now() - t0, model: p.modelName, error: e.message }; }
}

// Live model list (to fix a renamed model): GET <base>/models
export async function listModels(id) {
  const p = pool().find((x) => x.id === id);
  if (!p || p.kind === 'anthropic') return [];
  const key = p.noAuth ? '' : env(p.authEnv || p.key);
  const r = await fetch(`${p.base().replace(/\/$/, '')}/models`, { headers: key ? { authorization: `Bearer ${key}` } : {} });
  const d = await r.json().catch(() => ({}));
  const ids = (d.data || d.models || []).map((m) => m.id || m.name).filter(Boolean);
  return id === 'openrouter' ? ids.filter((x) => x.endsWith(':free')) : ids;
}
