'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MessageCircle, Loader2 } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { supabaseBrowser } from '@/lib/supabase/client';

// Opens (or reuses) a private conversation with another user about a college or a roommate post.
export default function StartChat({ otherId, contextType, contextId, label = 'Message', className = 'btn-ghost py-1.5' }: {
  otherId: string; contextType: 'college' | 'roommate'; contextId: string; label?: string; className?: string;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (user?.id === otherId) return null;
  const go = async () => {
    if (!user) { router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`); return; }
    setBusy(true);
    const { data, error } = await supabaseBrowser().rpc('start_conversation', { p_other: otherId, p_context_type: contextType, p_context_id: contextId });
    setBusy(false);
    if (error) return alert(error.message);
    router.push(`/messages?c=${data}`);
  };
  return <button type="button" onClick={go} disabled={busy} className={className}>{busy ? <Loader2 size={14} className="animate-spin" /> : <MessageCircle size={14} />}{label}</button>;
}
