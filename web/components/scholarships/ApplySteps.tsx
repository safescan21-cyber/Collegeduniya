import TranslateText from '@/components/TranslateText';

// "1. Do this\n2. Then this" (admin text) → numbered step cards. Text without numbers stays a paragraph.
// "1. a 2. b 3. c" → split only at the NEXT expected number, so "Class 12. marks" is not a step
function byNumbers(text: string): string[] {
  const out: string[] = []; let rest = text; let n = 2;
  for (;;) {
    const m = new RegExp(`\\s${n}[.)]\\s`).exec(rest);
    if (!m) { out.push(rest); return out; }
    out.push(rest.slice(0, m.index)); rest = rest.slice(m.index + 1); n++;
  }
}

export function splitSteps(text?: string | null): string[] {
  if (!text) return [];
  // one step per line; a single-line text is split only if it is itself a numbered list ("1. … 2. …")
  const raw = /\n/.test(text) ? text.split(/\n+/) : /^\s*1[.)]\s/.test(text) ? byNumbers(text) : [text];
  return raw.map((s) => s.replace(/^\s*\d{1,2}[.)]\s*/, '').trim()).filter(Boolean);
}

export default function ApplySteps({ text, compact = false }: { text?: string | null; compact?: boolean }) {
  const steps = splitSteps(text);
  if (!steps.length) return null;
  if (steps.length === 1) return <TranslateText text={steps[0]} className="text-slate-600" />;
  return (
    <ol className={compact ? 'space-y-2' : 'space-y-3'}>
      {steps.map((s, i) => (
        <li key={i} className="flex gap-3">
          <span className={`flex shrink-0 items-center justify-center rounded-full bg-brand-600 font-bold text-white ${compact ? 'h-5 w-5 text-[11px]' : 'h-7 w-7 text-sm'}`}>{i + 1}</span>
          <TranslateText text={s} className={compact ? 'text-sm text-slate-600' : 'text-slate-700'} />
        </li>
      ))}
    </ol>
  );
}
