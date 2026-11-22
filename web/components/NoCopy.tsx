'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

// Discourages copying the site's content: no text selection, copy, cut, right-click menu or image dragging on public
// pages. Typing fields, the admin panel, dashboard and chat are left alone. (A determined person can still read the page
// source — this stops casual copy-paste, it is not a lock.)
const FREE = ['/admin', '/dashboard', '/messages', '/login', '/auth', '/post', '/resume'];
const editable = (el: EventTarget | null) => el instanceof Element && !!el.closest('input, textarea, select, [contenteditable="true"], [data-copy-ok]');

export default function NoCopy() {
  const path = usePathname() || '/';
  const [note, setNote] = useState(false);
  const on = !FREE.some((p) => path === p || path.startsWith(`${p}/`));
  useEffect(() => {
    document.documentElement.classList.toggle('no-copy', on);
    if (!on) return;
    let t: any;
    const block = (e: Event) => {
      if (editable(e.target) || (e.type !== 'contextmenu' && editable(document.activeElement))) return;
      e.preventDefault();
      if (e.type !== 'dragstart') { setNote(true); clearTimeout(t); t = setTimeout(() => setNote(false), 1800); }
    };
    const evs = ['copy', 'cut', 'contextmenu', 'dragstart'] as const;
    evs.forEach((ev) => document.addEventListener(ev, block));
    return () => { evs.forEach((ev) => document.removeEventListener(ev, block)); clearTimeout(t); };
  }, [on]);
  if (!note) return null;
  return <div role="status" className="fixed bottom-6 left-1/2 z-[70] -translate-x-1/2 rounded-full bg-slate-900/90 px-4 py-2 text-sm text-white shadow-lg">Copying is turned off on Collegeolo — use Share to send a page</div>;
}
