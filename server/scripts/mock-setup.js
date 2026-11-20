// Mock tests for every exam in one go:
//   npm run mock:setup                    → AI-draft a pattern (unpublished) for each exam that has none
//   npm run mock:setup -- --questions 3   → …and generate 3 draft questions per topic for every exam
//   npm run mock:setup -- jee-main neet-ug --questions 5    → only these exams
// Patterns stay UNPUBLISHED and questions stay DRAFT (unless the pattern auto-approves AI-checked ones):
// check them in Admin → Mock tests before students see anything.
import 'dotenv/config';
import { supabase } from '../src/supabase.js';
import { llmReady, llmModel, llmProvider } from '../src/services/llm.js';
import { draftBlueprint, generateQuestions } from '../src/services/mockGen.js';

const args = process.argv.slice(2);
const qi = args.indexOf('--questions');
const perTopic = qi >= 0 ? Math.max(1, Math.min(10, parseInt(args[qi + 1], 10) || 3)) : 0;
const only = args.filter((a, i) => !a.startsWith('--') && (qi < 0 || i !== qi + 1));

if (!llmReady()) { console.error('Set ANTHROPIC_API_KEY (or LLM_PROVIDER=openai + LLM_BASE_URL) in server/.env first.'); process.exit(1); }
console.log(`AI: ${llmProvider()} · ${llmModel()}`);

let q = supabase.from('exams').select('slug, short_name').eq('is_published', true).order('short_name');
if (only.length) q = q.in('slug', only);
const { data: exams, error } = await q;
if (error) { console.error(error.message); process.exit(1); }

for (const e of exams) {
  let { data: bp } = await supabase.from('mock_blueprints').select('*').eq('exam_slug', e.slug).maybeSingle();
  if (!bp) {
    try {
      const d = await draftBlueprint(e.slug);
      const { note, ...row } = d;
      const ins = await supabase.from('mock_blueprints').insert({ ...row, is_published: false }).select().single();
      if (ins.error) throw ins.error;
      bp = ins.data;
      console.log(`✓ ${e.short_name}: pattern drafted (${bp.sections.length} sections) — verify: ${note || 'against the official notice'}`);
    } catch (err) { console.log(`✗ ${e.short_name}: pattern — ${err.message}`); continue; }
  } else console.log(`· ${e.short_name}: pattern exists`);
  if (!perTopic) continue;
  for (const s of bp.sections) {
    for (const t of s.topics?.length ? s.topics : [null]) {
      try {
        const r = await generateQuestions({ slug: e.slug, section: s.name, topic: t, count: perTopic });
        console.log(`   ${s.name}/${t || 'mixed'}: +${r.created} (AI check agreed ${r.agree})`);
      } catch (err) { console.log(`   ${s.name}/${t || 'mixed'}: ${err.message}`); }
    }
  }
}
console.log('\nDone. Review in Admin → Mock tests, then publish each pattern.');
process.exit(0);
