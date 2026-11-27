'use client';
import { useState } from 'react';
import { Loader2, RefreshCw, Upload } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/client';

const API = process.env.NEXT_PUBLIC_API_URL || '';

// IIT / NIT / IIIT / GFTI programmes with seats from the official JoSAA seat matrix. Runs by itself once and then yearly;
// this card is for running it now, or uploading the page saved from a browser if the JoSAA site refuses the server.
export default function JosaaImport({ onStarted }: { onStarted?: () => void }) {
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState(''); const [file, setFile] = useState<File | null>(null);
  const go = async () => {
    setBusy(true); setMsg('');
    try {
      const { data } = await supabaseBrowser().auth.getSession();
      const fd = new FormData(); if (file) fd.append('file', file);
      const r = await fetch(`${API}/api/admin/import/josaa`, { method: 'POST', body: fd, headers: { Authorization: `Bearer ${data.session?.access_token}` } });
      const b = await r.json().catch(() => ({ error: `The server answered ${r.status}` }));
      if (!r.ok) throw new Error(b.error || 'Failed'); setMsg(b.message); onStarted?.();
    } catch (e: any) { setMsg(e.message); }
    setBusy(false);
  };
  return (
    <div className="card p-5">
      <h2 className="font-bold text-slate-900">🇮🇳 IITs, NITs, IIITs — JoSAA seat matrix</h2>
      <p className="mt-1 text-sm text-slate-500">Every B.Tech, dual-degree, B.Arch and BS programme at the IITs, IISc, NITs, IIEST, IIITs and other government-funded institutes, with total seats — from the official JoSAA counselling list (Ministry of Education). Runs automatically once and then every year. Fees come from each institute’s own website (Official fees).</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={go} disabled={busy} className="btn-primary">{busy ? <Loader2 size={16} className="animate-spin" /> : file ? <Upload size={16} /> : <RefreshCw size={16} />}{file ? `Import ${file.name}` : 'Import from JoSAA now'}</button>
        <label className="text-xs text-slate-500">If it fails: open <a href="https://josaa.admissions.nic.in/applicant/seatmatrix/seatmatrixinfo.aspx" target="_blank" rel="noopener noreferrer" className="text-brand-700 underline">the seat matrix</a>, press Submit, save the page (Ctrl+S, “HTML only”) and choose it here:
          <input type="file" accept=".html,.htm,text/html" className="ms-1 text-xs" onChange={(e) => setFile(e.target.files?.[0] || null)} /></label>
      </div>
      {msg && <p className="mt-2 text-sm text-slate-600">{msg}</p>}
    </div>
  );
}
