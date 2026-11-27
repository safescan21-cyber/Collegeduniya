'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MessageCircle, UserPlus, Loader2, Lock } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { supabaseBrowser } from '@/lib/supabase/client';

export type ChatMode = 'direct' | 'request' | 'closed' | 'login' | 'self' | 'not_student' | 'blocked' | 'unavailable';

// "Message" on a profile / person card. Same college or mutual follow → opens the chat; otherwise a short request the
// other student accepts. Pass `mode` (and `chatId` if a chat exists) when the list already knows them.
export default function MessageButton({ userId, mode: given, chatId, size = 'md', className = '' }:
  { userId: string; mode?: ChatMode; chatId?: string | null; size?: 'sm' | 'md'; className?: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const loggedIn = !!user && !(user as any).is_anonymous;
  const [mode, setMode] = useState<ChatMode | undefined>(given);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [sent, setSent] = useState(false);
  useEffect(() => { setMode(given); }, [given]);
  useEffect(() => {
    if (given || !loggedIn) return;
    supabaseBrowser().rpc('people_mode', { p_other: userId }).then(({ data }: { data: string | null }) => setMode((data || 'unavailable') as ChatMode));
  }, [given, loggedIn, userId]);

  const cls = `${size === 'sm' ? 'py-1 px-2.5 text-xs' : 'py-2 px-3.5 text-sm'} inline-flex items-center gap-1.5 rounded-xl font-semibold ${className}`;
  if (!loggedIn) return <button onClick={() => router.push(`/login?next=${encodeURIComponent(location.pathname)}`)} className={`${cls} bg-brand-600 text-white hover:bg-brand-700`}><MessageCircle size={14} />Message</button>;
  if (chatId) return <button onClick={() => router.push(`/messages?c=${chatId}`)} className={`${cls} bg-brand-50 text-brand-700 hover:bg-brand-100`}><MessageCircle size={14} />Open chat</button>;
  if (!mode || mode === 'self') return null;
  if (mode !== 'direct' && mode !== 'request') return <span title="This student chats only with their own college or people they follow" className={`${cls} cursor-default bg-slate-100 text-slate-400`}><Lock size={13} />Follow to chat</span>;

  const go = async (withNote?: string) => {
    setBusy(true); setErr('');
    const { data, error } = await supabaseBrowser().rpc('start_people_chat', { p_other: userId, p_note: withNote || null });
    setBusy(false);
    if (error) return setErr(error.message);
    if (mode === 'request') { setSent(true); setNote(null); return; }
    router.push(`/messages?c=${data}`);
  };
  if (sent) return <span className={`${cls} bg-emerald-50 text-emerald-700`}>Request sent ✓</span>;
  return (
    <span className="relative inline-block">
      <button onClick={() => (mode === 'request' ? setNote('') : go())} disabled={busy} className={`${cls} ${mode === 'direct' ? 'bg-brand-600 text-white hover:bg-brand-700' : 'border border-brand-200 bg-white text-brand-700 hover:bg-brand-50'}`}>
        {busy ? <Loader2 size={14} className="animate-spin" /> : mode === 'direct' ? <MessageCircle size={14} /> : <UserPlus size={14} />}{mode === 'direct' ? 'Message' : 'Request chat'}
      </button>
      {note !== null && (
        <div className="absolute end-0 top-full z-30 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-3 text-start shadow-xl">
          <p className="text-xs text-slate-600">They’ll see your request and can accept it. Say hi or why you’d like to chat:</p>
          <textarea autoFocus className="input mt-2 text-sm" rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Same course — can you tell me about placements?" />
          <div className="mt-2 flex justify-end gap-2"><button onClick={() => setNote(null)} className="btn-ghost py-1 text-xs">Cancel</button>
            <button onClick={() => go(note)} disabled={busy} className="btn-primary py-1 text-xs">{busy ? <Loader2 size={12} className="animate-spin" /> : null}Send request</button></div>
        </div>)}
      {err && <span className="absolute end-0 top-full z-30 mt-1 w-60 rounded-lg bg-rose-50 p-2 text-xs text-rose-700 shadow">{err}</span>}
    </span>
  );
}
