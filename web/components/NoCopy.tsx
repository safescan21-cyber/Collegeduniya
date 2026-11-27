'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

// Screenshots: no website can block a phone's screenshot buttons or screen recording. What we do instead —
//   * the PrintScreen key wipes the clipboard and blanks the page for a moment
//   * when the window loses focus (Snipping Tool, Win+Shift+S, ⌘+Shift+4, app switcher) the page blurs until you come back
//   * photos and videos carry a watermark with the viewer's @username (components/Watermark.tsx)
//   * long-press "save image", drag-to-desktop, video download and picture-in-picture are turned off
// Discourages copying the site's content: no text selection, copy, cut, right-click menu or image dragging on public
// pages, plus copy/save/print/view-source shortcuts. Typing fields and the admin panel are left alone. (A determined person can still read the page
// source — this stops casual copy-paste, it is not a lock.)
const FREE = ['/admin'];   // only the admin panel may copy (codes, data checks)
const editable = (el: EventTarget | null) => el instanceof Element && !!el.closest('input, textarea, select, [contenteditable="true"], [data-copy-ok]');

export default function NoCopy() {
  const path = usePathname() || '/';
  const [note, setNote] = useState<string | false>(false);
  const on = !FREE.some((p) => path === p || path.startsWith(`${p}/`));
  useEffect(() => {
    document.documentElement.classList.toggle('no-copy', on);
    if (!on) return;
    let t: any; let s: any;
    const say = (msg = 'Copying is turned off on Collegeolo — use Share to send a page') => { setNote(msg); clearTimeout(t); t = setTimeout(() => setNote(false), 2200); };
    const root = document.documentElement;
    const shield = (ms?: number) => { root.classList.add('shield'); clearTimeout(s); if (ms) s = setTimeout(() => root.classList.remove('shield'), ms); };
    const unshield = () => { clearTimeout(s); root.classList.remove('shield'); };
    // focus moved to another app / screenshot tool (but not into an embedded video on the page)
    const onBlur = () => setTimeout(() => { if (document.activeElement?.tagName !== 'IFRAME') shield(); }, 0);
    const onVis = () => (document.hidden ? shield() : unshield());
    const shotKeys = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const macShot = e.metaKey && e.shiftKey && ['3', '4', '5', '6'].includes(k);
      if (k === 'printscreen' || macShot) {
        shield(1500); say('Screenshots are turned off — use Share to send this page');
        try { navigator.clipboard?.writeText('Screenshots are turned off on Collegeolo — share the link instead: ' + location.href); } catch { /* not allowed */ }
      }
    };
    const block = (e: Event) => {
      if (editable(e.target) || (e.type !== 'contextmenu' && editable(document.activeElement))) return;
      e.preventDefault();
      if (e.type !== 'dragstart') say((e.target as Element)?.closest?.('img, video') ? 'Photos and videos can’t be saved — use Share instead' : undefined);
    };
    // keyboard: Ctrl/⌘ + C, X, A, S, P, U, Shift+I/J/C and F12 (save, print, view source, developer tools)
    const keys = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase(); const mod = e.ctrlKey || e.metaKey;
      const inField = editable(e.target) || editable(document.activeElement);
      const copyKeys = mod && ['c', 'x', 'a'].includes(k) && !inField;
      const pageKeys = (mod && ['s', 'p', 'u'].includes(k)) || (mod && e.shiftKey && ['i', 'j', 'c'].includes(k)) || k === 'f12';
      if (copyKeys || pageKeys) { e.preventDefault(); e.stopPropagation(); say(); }
    };
    const evs = ['copy', 'cut', 'contextmenu', 'dragstart', 'selectstart'] as const;
    const sel = (e: Event) => { if (e.type === 'selectstart') { if (!editable(e.target)) e.preventDefault(); return; } block(e); };
    evs.forEach((ev) => document.addEventListener(ev, sel));
    document.addEventListener('keydown', keys, true);
    document.addEventListener('keydown', shotKeys, true); document.addEventListener('keyup', shotKeys, true);
    window.addEventListener('blur', onBlur); window.addEventListener('focus', unshield); document.addEventListener('visibilitychange', onVis);
    // videos: no download button, no picture-in-picture (also for videos added later)
    const lock = () => document.querySelectorAll('video').forEach((v) => { v.setAttribute('controlsList', 'nodownload noremoteplayback'); v.disablePictureInPicture = true; });
    lock(); const mo = new MutationObserver(lock); mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      evs.forEach((ev) => document.removeEventListener(ev, sel)); document.removeEventListener('keydown', keys, true);
      document.removeEventListener('keydown', shotKeys, true); document.removeEventListener('keyup', shotKeys, true);
      window.removeEventListener('blur', onBlur); window.removeEventListener('focus', unshield); document.removeEventListener('visibilitychange', onVis);
      mo.disconnect(); unshield(); clearTimeout(t);
    };
  }, [on]);
  if (!note) return null;
  return <div role="status" className="fixed bottom-6 left-1/2 z-[70] -translate-x-1/2 rounded-full bg-slate-900/90 px-4 py-2 text-center text-sm text-white shadow-lg">{note}</div>;
}
