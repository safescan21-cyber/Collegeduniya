'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessageCircle, X } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { supabaseBrowser } from '@/lib/supabase/client';

// Site-wide: a short chime + pop-up when a new chat message (or notification) arrives, on any page.
// Browsers only allow sound after the visitor has clicked/tapped the page once, so the audio is unlocked on first input.
// Students can switch the sound off (saved in this browser).
const KEY = 'collegeolo:msg-sound';
let ctx: AudioContext | null = null;

export const soundOn = () => { try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; } };
export const setSoundOn = (on: boolean) => { try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* private mode */ } };

export function chime(kind: 'message' | 'notice' = 'message') {
  if (!soundOn()) return;
  try {
    ctx ||= new (window.AudioContext || (window as any).webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume().catch(() => undefined);
    const notes = kind === 'message' ? [880, 1318.5] : [659.3];
    notes.forEach((f, i) => {
      const o = ctx!.createOscillator(); const g = ctx!.createGain();
      const t = ctx!.currentTime + i * 0.13;
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      o.connect(g); g.connect(ctx!.destination); o.start(t); o.stop(t + 0.4);
    });
  } catch { /* no audio available */ }
  try { navigator.vibrate?.(120); } catch { /* ignore */ }
}

export default function MessageAlert() {
  const { user } = useAuth();
  const path = usePathname();
  const [pop, setPop] = useState<{ text: string; href: string } | null>(null);
  const title = useRef<string>('');
  const unseen = useRef(0);

  // unlock audio on first interaction
  useEffect(() => {
    const unlock = () => { try { ctx ||= new (window.AudioContext || (window as any).webkitAudioContext)(); ctx.resume().catch(() => undefined); } catch { /* ignore */ } };
    window.addEventListener('pointerdown', unlock, { once: true }); window.addEventListener('keydown', unlock, { once: true });
    return () => { window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
  }, []);

  // "(2) New message" in the tab title while the tab is in the background
  useEffect(() => {
    const back = () => { if (!document.hidden && unseen.current) { document.title = title.current || document.title.replace(/^\(\d+\) /, ''); unseen.current = 0; } };
    document.addEventListener('visibilitychange', back);
    return () => document.removeEventListener('visibilitychange', back);
  }, []);

  useEffect(() => {
    if (!user || (user as any).is_anonymous) return;
    const sb = supabaseBrowser();
    const ch = sb.channel(`incoming-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (p: any) => {
        const m = p.new || {};
        if (!m.sender_id || m.sender_id === user.id) return;
        chime('message');
        window.dispatchEvent(new Event('collegeolo:chat'));   // header / bottom-bar badge refresh
        const onChat = window.location.pathname.startsWith('/messages');
        if (!onChat || document.hidden) setPop({ text: String(m.body || 'New message').slice(0, 90), href: `/messages?c=${m.conversation_id}` });
        if (document.hidden) { unseen.current++; title.current ||= document.title.replace(/^\(\d+\) /, ''); document.title = `(${unseen.current}) New message · ${title.current}`; }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, (p: any) => {
        if (p.new?.kind === 'message') return;          // already chimed for the message itself
        chime('notice');
      })
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [user]);

  useEffect(() => { if (!pop) return; const t = setTimeout(() => setPop(null), 7000); return () => clearTimeout(t); }, [pop]);
  useEffect(() => { if (path?.startsWith('/messages')) setPop(null); }, [path]);

  if (!pop) return null;
  return (
    <div className="fixed bottom-24 end-4 z-[60] w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-3 shadow-xl" role="status">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-600 text-white"><MessageCircle size={17} /></span>
        <Link href={pop.href} onClick={() => setPop(null)} className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">New message</p>
          <p className="truncate text-sm text-slate-600">{pop.text}</p>
        </Link>
        <button onClick={() => setPop(null)} aria-label="Close" className="text-slate-400 hover:text-slate-700"><X size={16} /></button>
      </div>
    </div>
  );
}
