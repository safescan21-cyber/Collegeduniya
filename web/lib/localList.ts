'use client';
import { useEffect, useState } from 'react';

// Small localStorage-backed lists shared across tabs/components:
//   compare  → up to 4 college slugs for /compare
//   apply    → colleges added to the common application (/apply)

export type ListItem = { id: string; slug: string; name: string; city?: string };

const LIMITS: Record<string, number> = { compare: 4, apply: 10 };
const key = (name: string) => `ses_${name}`;
const EVT = 'ses-list-change';

export function readList(name: string): ListItem[] {
  try { return JSON.parse(localStorage.getItem(key(name)) || '[]'); } catch { return []; }
}

function write(name: string, items: ListItem[]) {
  try { localStorage.setItem(key(name), JSON.stringify(items)); } catch {}
  window.dispatchEvent(new CustomEvent(EVT, { detail: name }));
}

export function toggleItem(name: string, item: ListItem): { ok: boolean; message?: string } {
  const items = readList(name);
  if (items.some((i) => i.id === item.id)) { write(name, items.filter((i) => i.id !== item.id)); return { ok: true }; }
  const limit = LIMITS[name] ?? 10;
  if (items.length >= limit) return { ok: false, message: `You can add up to ${limit} colleges.` };
  write(name, [...items, item]);
  return { ok: true };
}

export function removeItem(name: string, id: string) { write(name, readList(name).filter((i) => i.id !== id)); }
export function clearList(name: string) { write(name, []); }

export function useList(name: string) {
  const [items, setItems] = useState<ListItem[]>([]);
  useEffect(() => {
    const sync = () => setItems(readList(name));
    sync();
    const onEvt = (e: Event) => { if ((e as CustomEvent).detail === name) sync(); };
    window.addEventListener(EVT, onEvt);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener(EVT, onEvt); window.removeEventListener('storage', sync); };
  }, [name]);
  return items;
}
