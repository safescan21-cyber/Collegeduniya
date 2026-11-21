'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessageCircle, X, Send, Loader2, Sparkles } from 'lucide-react';
import { api } from '@/lib/api';
import { useLang } from './LangProvider';

type Msg = { role: 'user' | 'assistant'; content: string; links?: { label: string; href: string }[] };

// Renders **bold**, [text](/link) and line breaks safely (no HTML injection)
function RichText({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <>
      {lines.map((line, li) => {
        const parts: React.ReactNode[] = [];
        const re = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*/g;
        let last = 0; let m: RegExpExecArray | null; let k = 0;
        while ((m = re.exec(line))) {
          if (m.index > last) parts.push(line.slice(last, m.index));
          if (m[1]) {
            const href = m[2];
            parts.push(href.startsWith('/')
              ? <Link key={k++} href={href} className="font-medium text-brand-700 underline">{m[1]}</Link>
              : /^https?:\/\//.test(href) ? <a key={k++} href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-brand-700 underline">{m[1]}</a> : m[1]);
          } else parts.push(<strong key={k++}>{m[3]}</strong>);
          last = m.index + m[0].length;
        }
        if (last < line.length) parts.push(line.slice(last));
        return <span key={li}>{parts}{li < lines.length - 1 && <br />}</span>;
      })}
    </>
  );
}

export default function ChatWidget() {
  const { t } = useLang();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, busy]);
  if (pathname.startsWith('/admin')) return null;

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    const next: Msg[] = [...msgs, { role: 'user', content: text }];
    setMsgs(next); setInput(''); setBusy(true);
    try {
      const r = await api<{ reply: string; links: Msg['links'] }>('/api/chat', {
        method: 'POST',
        body: JSON.stringify({ messages: next.slice(-10).map(({ role, content }) => ({ role, content })), path: pathname }),
      });
      setMsgs([...next, { role: 'assistant', content: r.reply, links: r.links }]);
    } catch (err: any) {
      setMsgs([...next, { role: 'assistant', content: err.message || 'Something went wrong.' }]);
    }
    setBusy(false);
  };

  return (
    <>
      {!open && (
        <button onClick={() => setOpen(true)} aria-label={t('chat.title')}
          className="fixed bottom-20 right-4 z-40 flex items-center gap-2 rounded-full bg-brand-600 px-4 py-3 font-semibold text-white shadow-xl transition hover:bg-brand-700 sm:bottom-6">
          <MessageCircle size={20} /><span className="hidden sm:inline">{t('chat.title')}</span>
        </button>
      )}
      {open && (
        <div className="fixed inset-x-2 bottom-2 z-50 flex h-[75vh] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:inset-x-auto sm:right-6 sm:w-[380px]">
          <div className="flex items-center justify-between bg-brand-700 px-4 py-3 text-white">
            <p className="flex items-center gap-2 font-semibold"><Sparkles size={18} className="text-accent-400" />{t('chat.title')}</p>
            <button onClick={() => setOpen(false)} aria-label="Close"><X size={20} /></button>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4 text-sm">
            <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-white p-3 text-slate-700 shadow-sm">{t('chat.hello')}</div>
            {msgs.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'flex justify-end' : ''}>
                <div className={`max-w-[85%] rounded-2xl p-3 shadow-sm ${m.role === 'user' ? 'rounded-tr-sm bg-brand-600 text-white' : 'rounded-tl-sm bg-white text-slate-700'}`}>
                  {m.role === 'assistant' ? <RichText text={m.content} /> : m.content}
                  {m.links && m.links.length > 0 && (
                    <ul className="mt-2 space-y-1 border-t border-slate-100 pt-2">
                      {m.links.map((l) => <li key={l.href}><Link href={l.href} className="text-brand-700 hover:underline">→ {l.label}</Link></li>)}
                    </ul>
                  )}
                </div>
              </div>
            ))}
            {busy && <Loader2 className="animate-spin text-slate-400" size={18} />}
            <div ref={endRef} />
          </div>
          <form onSubmit={send} className="flex gap-2 border-t border-slate-200 p-3">
            <input value={input} onChange={(e) => setInput(e.target.value)} maxLength={1000} placeholder={t('chat.placeholder')} className="input flex-1" />
            <button disabled={busy || !input.trim()} className="btn-primary px-3" aria-label={t('chat.send')}><Send size={16} /></button>
          </form>
        </div>
      )}
    </>
  );
}
