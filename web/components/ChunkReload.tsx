'use client';
import { useEffect } from 'react';

// After a new version of the site goes live, a page that was opened earlier can ask for a script file that no longer
// exists ("GET /_next/static/chunks/….js 404", buttons and login stop working). When that happens the page reloads
// itself once to pick up the current version (at most once every 5 minutes, so it can never loop).
export default function ChunkReload() {
  useEffect(() => {
    const reloadOnce = () => {
      try {
        const last = Number(sessionStorage.getItem('chunk-reload') || 0);
        if (Date.now() - last < 5 * 60e3) return;
        sessionStorage.setItem('chunk-reload', String(Date.now()));
      } catch { /* storage blocked: still reload once */ }
      window.location.reload();
    };
    const onError = (e: Event) => {
      const t = e.target as HTMLScriptElement | HTMLLinkElement | null;
      const src = (t as HTMLScriptElement)?.src || (t as HTMLLinkElement)?.href || '';
      if (src.includes('/_next/static/')) reloadOnce();
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      const m = String(e.reason?.name || '') + String(e.reason?.message || e.reason || '');
      if (/ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed/i.test(m)) reloadOnce();
    };
    window.addEventListener('error', onError, true);
    window.addEventListener('unhandledrejection', onRejection);
    return () => { window.removeEventListener('error', onError, true); window.removeEventListener('unhandledrejection', onRejection); };
  }, []);
  return null;
}
