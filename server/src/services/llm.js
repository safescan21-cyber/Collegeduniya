// One place for AI text generation (mock-test questions, test patterns, result feedback).
//
//   LLM_PROVIDER=anthropic (default)  ANTHROPIC_API_KEY, LLM_MODEL (default claude-sonnet-5-5)
//   LLM_PROVIDER=openai               any OpenAI-compatible server — a model you install yourself:
//        LLM_BASE_URL=http://localhost:11434/v1   (Ollama)   or http://localhost:8000/v1 (vLLM)  or https://api.groq.com/openai/v1
//        LLM_API_KEY=… (if the server needs one)   LLM_MODEL=qwen2.5:14b-instruct / llama3.1:8b-instruct …
//   LLM_CHECK_MODEL (optional) — a different model to double-check answers (default: same model)
//   LLM_CHECK_BASE_URL + LLM_CHECK_API_KEY (optional) — run the double-check on ANOTHER OpenAI-compatible provider,
//        e.g. write with Gemini's free tier and check with Groq's free tier (two different AIs catch more mistakes)
//
// Free setup example (no card):
//   LLM_PROVIDER=openai
//   LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai   LLM_API_KEY=<Google AI Studio key>   LLM_MODEL=<current Gemini Flash model>
//   LLM_CHECK_BASE_URL=https://api.groq.com/openai/v1                       LLM_CHECK_API_KEY=<Groq key>          LLM_CHECK_MODEL=openai/gpt-oss-120b
export const llmProvider = () => (process.env.LLM_PROVIDER || (process.env.ANTHROPIC_API_KEY ? 'anthropic' : process.env.LLM_BASE_URL ? 'openai' : '')).toLowerCase();
export const llmReady = () => (llmProvider() === 'anthropic' ? Boolean(process.env.ANTHROPIC_API_KEY) : llmProvider() === 'openai' ? Boolean(process.env.LLM_BASE_URL) : false);
export const llmModel = (check = false) => (check && process.env.LLM_CHECK_MODEL) || process.env.LLM_MODEL || (llmProvider() === 'anthropic' ? 'claude-sonnet-5-5' : 'llama3.1:8b-instruct');
// A check provider on another OpenAI-compatible service only applies when the main provider is also OpenAI-compatible
const checkElsewhere = () => Boolean(process.env.LLM_CHECK_BASE_URL);

const TIMEOUT = Number(process.env.LLM_TIMEOUT_MS || 120000);

export async function complete({ system, prompt, maxTokens = 4000, temperature = 0.7, check = false }) {
  if (!llmReady()) throw new Error('AI is not configured (set ANTHROPIC_API_KEY, or LLM_PROVIDER=openai + LLM_BASE_URL)');
  const model = llmModel(check);
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), TIMEOUT);
  try {
    if (llmProvider() === 'anthropic' && !(check && checkElsewhere())) {
      const r = await fetch(process.env.ANTHROPIC_API_URL || 'https://api.anthropic.com/v1/messages', {
        method: 'POST', signal: ctl.signal,
        headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model, max_tokens: maxTokens, temperature, system, messages: [{ role: 'user', content: prompt }] }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error?.message || `AI error ${r.status}`);
      return { text: (d.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n'), model };
    }
    const useCheck = check && process.env.LLM_CHECK_BASE_URL;
    const base = (useCheck ? process.env.LLM_CHECK_BASE_URL : process.env.LLM_BASE_URL).replace(/\/$/, '');
    const key = useCheck ? process.env.LLM_CHECK_API_KEY : process.env.LLM_API_KEY;
    const call = (jsonMode) => fetch(`${base}/chat/completions`, {
      method: 'POST', signal: ctl.signal,
      headers: { 'content-type': 'application/json', ...(key ? { authorization: `Bearer ${key}` } : {}) },
      body: JSON.stringify({ model, max_tokens: maxTokens, temperature, ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
        messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }] }),
    });
    let r = await call(true);
    for (let tries = 0; r.status === 429 && tries < 2; tries++) {   // free tiers rate-limit: wait and retry
      const wait = Math.min(60, Number(r.headers.get('retry-after')) || 20 * (tries + 1));
      await new Promise((ok) => setTimeout(ok, wait * 1000));
      r = await call(true);
    }
    let d = await r.json().catch(() => ({}));
    if (r.status === 400 && /response_format|json/i.test(JSON.stringify(d))) { r = await call(false); d = await r.json().catch(() => ({})); }   // provider without JSON mode
    if (!r.ok) throw new Error(d?.error?.message || `AI error ${r.status}`);
    return { text: d.choices?.[0]?.message?.content || '', model };
  } finally { clearTimeout(t); }
}

// Models sometimes wrap JSON in prose or ``` fences — take the outermost object
export function parseJson(text) {
  const s = String(text || '');
  const a = s.indexOf('{'); const b = s.lastIndexOf('}');
  if (a < 0 || b <= a) throw new Error('AI did not return JSON');
  return JSON.parse(s.slice(a, b + 1));
}

export async function completeJson(opts) {
  const sys = `${opts.system}\nReply with ONE JSON object only — no markdown, no commentary.`;
  const first = await complete({ ...opts, system: sys });
  try { return { data: parseJson(first.text), model: first.model }; } catch {
    const again = await complete({ ...opts, system: sys, temperature: 0.2 });
    return { data: parseJson(again.text), model: again.model };
  }
}
