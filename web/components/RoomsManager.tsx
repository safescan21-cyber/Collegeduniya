'use client';
import { useCallback, useEffect, useState } from 'react';
import { Plus, Minus, Trash2, Save, Loader2 } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/client';

const TYPES = ['Single', 'Double', 'Triple', 'Four sharing', 'Dormitory', 'Studio', '1 BHK', '2 BHK', '3 BHK'];
type Room = { id?: string; hostel_id: string; room_type: string; beds_total: number; beds_available: number; rent: number | null; currency: string; rent_period: string;
  deposit: number | null; ac: boolean; attached_bath: boolean; food_included: boolean; available_from: string | null; notes: string | null; updated_at?: string };

// Owner edits room types and taps +/- to keep free beds current. Changes go live immediately (no re-approval).
export default function RoomsManager({ hostelId, currency = 'INR' }: { hostelId: string; currency?: string }) {
  const supabase = supabaseBrowser();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    const { data } = await supabase.from('hostel_rooms').select('*').eq('hostel_id', hostelId).order('created_at');
    setRooms((data || []) as Room[]); setLoading(false);
  }, [hostelId, supabase]);
  useEffect(() => { load(); }, [load]);

  const blank = (): Room => ({ hostel_id: hostelId, room_type: 'Double', beds_total: 2, beds_available: 0, rent: null, currency, rent_period: 'month', deposit: null, ac: false, attached_bath: false, food_included: true, available_from: null, notes: null });
  const set = (i: number, patch: Partial<Room>) => setRooms((r) => r.map((x, k) => (k === i ? { ...x, ...patch } : x)));

  const save = async (i: number) => {
    const r = rooms[i];
    setErr('');
    if (r.beds_available > r.beds_total) return setErr('Free beds cannot be more than total beds.');
    setSaving(r.id || `new-${i}`);
    const row = { ...r, rent: r.rent === null || (r.rent as any) === '' ? null : Number(r.rent), deposit: r.deposit === null || (r.deposit as any) === '' ? null : Number(r.deposit), available_from: r.available_from || null };
    delete (row as any).updated_at; delete (row as any).created_at;
    const { error } = r.id ? await supabase.from('hostel_rooms').update(row).eq('id', r.id) : await supabase.from('hostel_rooms').insert(row);
    setSaving(null);
    if (error) setErr(error.message); else load();
  };

  const bump = async (i: number, d: number) => {
    const r = rooms[i];
    const v = Math.min(Math.max(r.beds_available + d, 0), r.beds_total);
    set(i, { beds_available: v });
    if (r.id) await supabase.from('hostel_rooms').update({ beds_available: v }).eq('id', r.id);
  };

  const remove = async (i: number) => {
    const r = rooms[i];
    if (r.id && !confirm('Delete this room type?')) return;
    if (r.id) await supabase.from('hostel_rooms').delete().eq('id', r.id);
    setRooms((x) => x.filter((_, k) => k !== i));
  };

  if (loading) return <div className="grid h-20 place-items-center"><Loader2 className="animate-spin text-slate-300" /></div>;
  const free = rooms.reduce((n, r) => n + (r.beds_available || 0), 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600"><strong className={free ? 'text-emerald-700' : 'text-rose-600'}>{free} bed{free === 1 ? '' : 's'} free</strong> · {rooms.length} room type{rooms.length === 1 ? '' : 's'}</p>
        <button onClick={() => setRooms((r) => [...r, blank()])} className="btn-ghost py-1.5"><Plus size={14} />Add room type</button>
      </div>
      {rooms.map((r, i) => (
        <div key={r.id || `n${i}`} className="rounded-xl border border-slate-200 p-3">
          <div className="grid gap-2 sm:grid-cols-6">
            <select className="input py-2 text-sm sm:col-span-2" value={r.room_type} onChange={(e) => set(i, { room_type: e.target.value })}>{TYPES.map((x) => <option key={x}>{x}</option>)}</select>
            <label className="text-xs text-slate-500 sm:col-span-1">Total beds<input type="number" min={0} className="input py-2 text-sm" value={r.beds_total} onChange={(e) => set(i, { beds_total: Number(e.target.value) })} /></label>
            <label className="text-xs text-slate-500 sm:col-span-1">Rent / {r.rent_period}<input type="number" className="input py-2 text-sm" value={r.rent ?? ''} onChange={(e) => set(i, { rent: e.target.value as any })} /></label>
            <label className="text-xs text-slate-500 sm:col-span-1">Deposit<input type="number" className="input py-2 text-sm" value={r.deposit ?? ''} onChange={(e) => set(i, { deposit: e.target.value as any })} /></label>
            <label className="text-xs text-slate-500 sm:col-span-1">Free from<input type="date" className="input py-2 text-sm" value={r.available_from || ''} onChange={(e) => set(i, { available_from: e.target.value })} /></label>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
            <span className="text-xs font-semibold uppercase text-slate-500">Free beds</span>
            <div className="flex items-center gap-1">
              <button onClick={() => bump(i, -1)} className="btn-ghost p-1.5" aria-label="One less free bed"><Minus size={14} /></button>
              <span className={`w-10 text-center text-lg font-bold ${r.beds_available ? 'text-emerald-700' : 'text-slate-400'}`}>{r.beds_available}</span>
              <button onClick={() => bump(i, 1)} className="btn-ghost p-1.5" aria-label="One more free bed"><Plus size={14} /></button>
            </div>
            {(['ac', 'attached_bath', 'food_included'] as const).map((k) => (
              <label key={k} className="flex items-center gap-1 text-xs text-slate-600"><input type="checkbox" checked={!!r[k]} onChange={(e) => set(i, { [k]: e.target.checked } as any)} className="accent-brand-600" />{k === 'ac' ? 'AC' : k === 'attached_bath' ? 'Attached bath' : 'Food'}</label>
            ))}
            <div className="ms-auto flex gap-1">
              <button onClick={() => save(i)} className="btn-primary py-1.5">{saving === (r.id || `new-${i}`) ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}Save</button>
              <button onClick={() => remove(i)} className="btn-ghost py-1.5 text-rose-600" aria-label="Delete"><Trash2 size={14} /></button>
            </div>
          </div>
        </div>
      ))}
      {!rooms.length && <p className="text-sm text-slate-500">Add your room types (single, double…) so students can see what’s free.</p>}
      {err && <p className="text-sm text-rose-600">{err}</p>}
    </div>
  );
}
