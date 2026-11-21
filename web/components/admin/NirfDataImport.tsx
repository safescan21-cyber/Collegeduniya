'use client';
import { useState } from 'react';
import { KeyRound, Copy, Check } from 'lucide-react';
import { api } from '@/lib/api';

// NIRF placements & courses: nirfindia.org refuses downloads from servers, so the sheets are collected in an admin's
// browser on nirfindia.org and posted to the API with a short-lived import code created here (super admin).
export default function NirfDataImport() {
  const [code, setCode] = useState<{ code: string; expires_at: string } | null>(null);
  const [err, setErr] = useState(''); const [copied, setCopied] = useState(false);
  const make = async () => { setErr(''); try { setCode(await api('/api/admin/import-codes', { method: 'POST', body: JSON.stringify({ purpose: 'nirf' }) })); } catch (e: any) { setErr(e.message); } };
  return (
    <div className="card p-5">
      <h2 className="font-bold text-slate-900">🏛️ NIRF placements, courses & seats</h2>
      <p className="mt-1 text-sm text-slate-500">Reads each NIRF-ranked institution’s official data sheet: programmes with approved seats, students placed, median salary and higher studies for three batches, and the NIRF score. nirfindia.org blocks server downloads, so the sheets are collected in your browser on nirfindia.org and sent here with a one-time code (valid 3 hours, only for this upload).</p>
      {!code ? <button className="btn-primary mt-3" onClick={make}><KeyRound size={16} />Create import code</button> : (
        <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm">
          <p className="text-slate-600">Paste this code into the “Collegeolo NIRF import” box on nirfindia.org:</p>
          <div className="mt-2 flex items-center gap-2"><code className="rounded bg-white px-2 py-1 font-mono text-base">{code.code}</code>
            <button className="btn-ghost px-2 py-1" onClick={async () => { try { await navigator.clipboard.writeText(code.code); setCopied(true); } catch { /* select manually */ } }}>{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? 'Copied' : 'Copy'}</button></div>
          <p className="mt-1 text-xs text-slate-500">Expires {new Date(code.expires_at).toLocaleTimeString()}. Anyone with this code can only send NIRF sheets to this import.</p>
        </div>
      )}
      {err && <p className="mt-2 text-sm text-rose-600">{err}</p>}
    </div>
  );
}
