'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Download, X, Share } from 'lucide-react';

const KEY = 'install-dismissed';
const VISITS = 'install-visits';
const get = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const set = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };

// "Install Collegeolo" — Android/desktop Chrome use the browser's install prompt; iPhone gets the Share → Add to Home Screen hint.
// Shown from the 2nd visit, never on admin/login pages, and hidden for 14 days after "Not now".
export default function InstallPrompt() {
  const path = usePathname();
  const [evt, setEvt] = useState<any>(null);
  const [ios, setIos] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
    if (standalone) return;
    const until = Number(get(KEY) || 0);
    if (until > Date.now()) return;
    const visits = Number(get(VISITS) || 0) + 1;
    if (!sessionStorage.getItem('install-counted')) { set(VISITS, String(visits)); try { sessionStorage.setItem('install-counted', '1'); } catch { /* ignore */ } }
    if (visits < 2) return;
    const onPrompt = (e: any) => { e.preventDefault(); setEvt(e); setTimeout(() => setShow(true), 15000); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/.test(ua) && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua)) { setIos(true); setTimeout(() => setShow(true), 15000); }
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  if (!show || /^\/(admin|login|auth)/.test(path || '') || (!evt && !ios)) return null;
  const close = () => { set(KEY, String(Date.now() + 14 * 86400e3)); setShow(false); };
  const install = async () => { evt.prompt(); const r = await evt.userChoice.catch(() => null); if (r?.outcome !== 'accepted') close(); else setShow(false); };

  return (
    <div className="fixed inset-x-3 bottom-20 z-50 mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-xl lg:bottom-6" role="dialog" aria-label="Install Collegeolo">
      <button onClick={close} className="absolute right-2 top-2 p-1 text-slate-400 hover:text-slate-700" aria-label="Close"><X size={16} /></button>
      <div className="flex items-start gap-3">
        <img src="/icons/icon-192.png" alt="" width={40} height={40} className="rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="font-bold text-slate-900">Get the Collegeolo app</p>
          {ios
            ? <p className="mt-0.5 text-sm text-slate-600">Tap <Share size={14} className="inline" /> <strong>Share</strong>, then <strong>Add to Home Screen</strong>. Free, no App Store needed.</p>
            : <p className="mt-0.5 text-sm text-slate-600">Opens instantly, works on slow internet, and gets you deadline and message alerts. Free, takes 2 seconds.</p>}
          <div className="mt-3 flex gap-2">
            {!ios && <button onClick={install} className="btn-primary py-1.5 text-sm"><Download size={15} />Install</button>}
            <button onClick={close} className="btn-ghost py-1.5 text-sm">Not now</button>
          </div>
        </div>
      </div>
    </div>
  );
}
