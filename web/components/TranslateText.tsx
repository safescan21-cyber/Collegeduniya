'use client';
import { useState } from 'react';
import { Languages, Loader2 } from 'lucide-react';
import { API_URL } from '@/lib/api';
import { useLang } from './LangProvider';

// Shows text with a "Translate" link into the visitor's chosen language (source language auto-detected).
export default function TranslateText({ text, className = '', as: Tag = 'p' }: { text: string; className?: string; as?: 'p' | 'div' | 'span' }) {
  const { lang, t } = useLang();
  const [out, setOut] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  if (!text) return null;

  const run = async () => {
    if (out) { setOut(null); return; }
    setBusy(true);
    try {
      const r = await fetch(`${API_URL}/api/translate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts: [text.slice(0, 5000)], target: lang }),
      });
      const body = await r.json();
      if (body.provider && body.data?.[0] && body.data[0] !== text) setOut(body.data[0]); else setFailed(true);
    } catch { setFailed(true); }
    setBusy(false);
  };

  return (
    <>
      <Tag className={className}>{out ?? text}</Tag>
      {lang !== 'en' && !failed && (
        <button type="button" onClick={run} className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline">
          {busy ? <Loader2 size={12} className="animate-spin" /> : <Languages size={12} />}{out ? t('live.original') : t('live.translate')}
        </button>
      )}
    </>
  );
}
