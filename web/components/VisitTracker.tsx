'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { api } from '@/lib/api';

function visitorId() {
  try {
    let id = localStorage.getItem('ses_vid');
    if (!id) {
      id = (crypto.randomUUID?.() || Math.random().toString(36).slice(2) + Date.now().toString(36));
      localStorage.setItem('ses_vid', id);
    }
    return id;
  } catch {
    return 'anon-' + Math.random().toString(36).slice(2, 10);
  }
}

// Sends one page-view per route change to the Node API (/api/track).
export default function VisitTracker() {
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname || pathname.startsWith('/admin')) return;
    api('/api/track', {
      method: 'POST',
      body: JSON.stringify({ visitor_id: visitorId(), path: pathname, referrer: document.referrer || null }),
    }).catch(() => {});
  }, [pathname]);
  return null;
}
