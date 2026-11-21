'use client';
import { useState } from 'react';
import { Flag } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { supabaseBrowser } from '@/lib/supabase/client';

const REASONS = ['Spam or scam', 'Harassment or bullying', 'Fake account', 'Nudity or sexual content', 'Hate or violence', 'Asking for money', 'Other'];

export default function ReportButton({ type, id, label = 'Report', className = '' }: { type: 'post' | 'comment' | 'user' | 'conversation'; id: string; label?: string; className?: string }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false); const [reason, setReason] = useState(REASONS[0]); const [note, setNote] = useState(''); const [done, setDone] = useState('');
  if (!user || (user as any).is_anonymous) return null;
  const send = async () => {
    const { error } = await supabaseBrowser().from('content_reports').insert({ reporter_id: user.id, target_type: type, target_id: id, reason: `${reason}${note.trim() ? ` — ${note.trim()}` : ''}`.slice(0, 1000) });
    setDone(error ? (/duplicate|unique/i.test(error.message) ? 'You already reported this.' : error.message) : 'Thanks — our team will look into it.');
  };
  return (
    <span className="relative">
      <button type="button" onClick={() => setOpen(!open)} className={`inline-flex items-center gap-1 text-xs text-slate-500 hover:text-rose-600 ${className}`}><Flag size={13} />{label}</button>
      {open && (
        <div className="absolute end-0 z-30 mt-1 w-64 space-y-2 rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-xl">
          {done ? <p className="text-slate-700">{done}</p> : <>
            <p className="font-semibold">Why are you reporting this?</p>
            <select className="input py-1.5" value={reason} onChange={(e) => setReason(e.target.value)}>{REASONS.map((r) => <option key={r}>{r}</option>)}</select>
            <textarea className="input" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Details (optional)" />
            <div className="flex justify-end gap-2"><button type="button" onClick={() => setOpen(false)} className="btn-ghost py-1 text-xs">Cancel</button><button type="button" onClick={send} className="btn-primary bg-rose-600 py-1 text-xs hover:bg-rose-700">Report</button></div>
          </>}
        </div>)}
    </span>
  );
}
