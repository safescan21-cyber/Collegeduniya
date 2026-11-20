'use client';
import { supabaseBrowser } from './supabase/client';

export const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').replace(/\/$/, '');

async function token() {
  const { data } = await supabaseBrowser().auth.getSession();
  return data.session?.access_token;
}

// Call the Node.js API with the logged-in user's Supabase token.
export async function api<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const t = await token();
  const isForm = typeof FormData !== 'undefined' && init.body instanceof FormData;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(isForm ? {} : { 'Content-Type': 'application/json' }),
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
      ...(init.headers || {}),
    },
  });
  } catch {
    throw new Error('Cannot reach the server right now. Please check your internet and try again.');
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const issues = body?.issues?.fieldErrors
      ? ' — ' + Object.entries(body.issues.fieldErrors).map(([k, v]) => `${k}: ${(v as string[]).join(', ')}`).join('; ')
      : '';
    throw new Error((body?.error || `Request failed (${res.status})`) + issues);
  }
  return body as T;
}

export async function uploadImages(files: FileList | File[], folder: string): Promise<string[]> {
  const fd = new FormData();
  Array.from(files).forEach((f) => fd.append('files', f));
  fd.append('folder', folder);
  const { urls } = await api<{ urls: string[] }>('/api/admin/upload', { method: 'POST', body: fd });
  return urls;
}
