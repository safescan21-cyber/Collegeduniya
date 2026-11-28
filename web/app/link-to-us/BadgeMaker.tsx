'use client';
import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

const SITE = 'https://www.collegeolo.com';
const BADGES = [
  { file: 'listed-on-collegeolo.svg', label: 'Listed on Collegeolo', alt: 'Listed on Collegeolo' },
  { file: 'reviews-on-collegeolo.svg', label: 'Student reviews on Collegeolo', alt: 'Read student reviews on Collegeolo' },
];

// Paste your Collegeolo page link → get badge HTML that points to that page.
export default function BadgeMaker() {
  const [url, setUrl] = useState('');
  const [badge, setBadge] = useState(0);
  const [copied, setCopied] = useState('');
  let target = SITE;
  try {
    const u = new URL(url.trim());
    if (/(^|\.)collegeolo\.com$/i.test(u.hostname)) target = `${SITE}${u.pathname}`.replace(/\/$/, '');
  } catch { /* keep the home page */ }
  const b = BADGES[badge];
  const html = `<a href="${target}" target="_blank" rel="noopener" title="${b.alt}"><img src="${SITE}/badge/${b.file}" alt="${b.alt}" width="220" height="64" loading="lazy"></a>`;
  const text = `<a href="${target}" target="_blank" rel="noopener">${target === SITE ? 'Collegeolo — colleges, fees, exams & scholarships' : 'See us on Collegeolo'}</a>`;
  const copy = async (k: string, v: string) => { try { await navigator.clipboard.writeText(v); setCopied(k); setTimeout(() => setCopied(''), 2000); } catch { /* ignore */ } };
  return (
    <section className="card space-y-4 p-6">
      <h2 className="text-lg font-bold text-slate-900">Get your badge</h2>
      <label className="block text-sm">Your page on Collegeolo (optional)
        <input className="input mt-1" placeholder="https://www.collegeolo.com/colleges/your-college" value={url} onChange={(e) => setUrl(e.target.value)} />
        <span className="mt-1 block text-xs text-slate-500">Open your college or exam page on Collegeolo and copy its address here. Leave empty to link to the home page.</span>
      </label>
      <div className="flex flex-wrap gap-3">
        {BADGES.map((x, i) => (
          <button key={x.file} type="button" onClick={() => setBadge(i)} className={`rounded-xl border-2 p-1 ${i === badge ? 'border-brand-600' : 'border-transparent'}`} aria-pressed={i === badge}>
            <img src={`/badge/${x.file}`} alt={x.label} width={220} height={64} />
          </button>
        ))}
      </div>
      {[['badge', 'Badge code (paste into your website’s HTML)', html], ['text', 'Text link', text]].map(([k, label, v]) => (
        <div key={k}>
          <p className="text-sm font-semibold text-slate-800">{label}</p>
          <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-slate-900 p-3 text-xs text-slate-100">{v}</pre>
          <button type="button" onClick={() => copy(k, v)} className="btn-ghost mt-2 py-1.5 text-sm">{copied === k ? <Check size={14} /> : <Copy size={14} />}{copied === k ? 'Copied' : 'Copy code'}</button>
        </div>
      ))}
      <p className="text-xs text-slate-500">Links to: <span className="font-mono">{target}</span></p>
    </section>
  );
}
