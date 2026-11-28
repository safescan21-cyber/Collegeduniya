'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Heart, Scale, Share2, Check, FilePlus2, X , MessageCircle } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { supabaseBrowser } from '@/lib/supabase/client';
import { toggleItem, useList, removeItem, clearList, type ListItem } from '@/lib/localList';
import { SITE_URL } from '@/lib/format';

const stop = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); };

// ❤ Save to shortlist (needs login)
export function SaveButton({ type, id, variant = 'icon' }: { type: 'college' | 'hostel' | 'job'; id: string; variant?: 'icon' | 'button' }) {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const supabase = supabaseBrowser();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) { setSaved(false); return; }
    supabase.from('saved_items').select('id').eq('user_id', user.id).eq('item_type', type).eq('item_id', id).maybeSingle()
      .then(({ data }: { data: { id: string } | null }) => setSaved(!!data));
  }, [user, type, id, supabase]);

  const onClick = async (e: React.MouseEvent) => {
    stop(e);
    if (!user) return router.push(`/login?next=${encodeURIComponent(pathname)}`);
    setBusy(true);
    if (saved) await supabase.from('saved_items').delete().eq('user_id', user.id).eq('item_type', type).eq('item_id', id);
    else await supabase.from('saved_items').insert({ user_id: user.id, item_type: type, item_id: id });
    setSaved(!saved);
    setBusy(false);
  };

  if (variant === 'button') {
    return (
      <button onClick={onClick} disabled={busy} className={saved ? 'btn-ghost border-rose-200 text-rose-600' : 'btn-ghost'}>
        <Heart size={16} className={saved ? 'fill-rose-500 text-rose-500' : ''} />{saved ? 'Saved' : 'Save'}
      </button>
    );
  }
  return (
    <button onClick={onClick} disabled={busy} aria-label={saved ? 'Remove from shortlist' : 'Save to shortlist'}
      className="grid h-9 w-9 place-items-center rounded-full bg-white/95 shadow transition hover:scale-110">
      <Heart size={17} className={saved ? 'fill-rose-500 text-rose-500' : 'text-slate-600'} />
    </button>
  );
}

// ⚖ Add college to compare (max 4, stored in browser)
export function CompareButton({ item, variant = 'icon' }: { item: ListItem; variant?: 'icon' | 'button' }) {
  const list = useList('compare');
  const active = list.some((i) => i.id === item.id);
  const onClick = (e: React.MouseEvent) => {
    stop(e);
    const r = toggleItem('compare', item);
    if (!r.ok && r.message) alert(r.message);
  };
  if (variant === 'button') {
    return (
      <button onClick={onClick} className={active ? 'btn-ghost border-brand-300 text-brand-700' : 'btn-ghost'}>
        {active ? <Check size={16} /> : <Scale size={16} />}{active ? 'In compare' : 'Compare'}
      </button>
    );
  }
  return (
    <button onClick={onClick} aria-label="Add to compare" title={active ? 'Remove from compare' : 'Add to compare'}
      className={`grid h-9 w-9 place-items-center rounded-full shadow transition hover:scale-110 ${active ? 'bg-brand-600 text-white' : 'bg-white/95 text-slate-600'}`}>
      {active ? <Check size={17} /> : <Scale size={17} />}
    </button>
  );
}

// ➕ Add to common application cart
export function ApplyCartButton({ item }: { item: ListItem }) {
  const list = useList('apply');
  const active = list.some((i) => i.id === item.id);
  return (
    <button onClick={(e) => { stop(e); const r = toggleItem('apply', item); if (!r.ok && r.message) alert(r.message); }}
      className={active ? 'btn-ghost w-full border-emerald-300 text-emerald-700' : 'btn-accent w-full'}>
      {active ? <Check size={16} /> : <FilePlus2 size={16} />}{active ? 'Added to application' : 'Add to my application'}
    </button>
  );
}

// Floating bar shown when colleges are in compare / application lists
export function ListTray() {
  const compare = useList('compare');
  const apply = useList('apply');
  const pathname = usePathname();
  if (pathname.startsWith('/admin') || (!compare.length && !apply.length)) return null;
  return (
    <>
    <div className="h-20" aria-hidden />
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 shadow-2xl backdrop-blur">
      <div className="container-x flex flex-wrap items-center gap-3 py-3 text-sm">
        {compare.length > 0 && pathname !== '/compare' && (
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-700"><Scale size={14} className="mr-1 inline" />Compare:</span>
            {compare.map((c) => (
              <span key={c.id} className="chip-brand">{c.name.length > 22 ? c.name.slice(0, 22) + '…' : c.name}
                <button onClick={() => removeItem('compare', c.id)} aria-label="Remove"><X size={12} /></button></span>
            ))}
            <Link href={`/compare?c=${compare.map((c) => c.slug).join(',')}`} className={`btn-primary py-1.5 ${compare.length < 2 ? 'pointer-events-none opacity-50' : ''}`}>
              Compare {compare.length}
            </Link>
            <button onClick={() => clearList('compare')} className="text-xs text-slate-500 hover:underline">Clear</button>
          </div>
        )}
        {apply.length > 0 && pathname !== '/apply' && (
          <Link href="/apply" className="btn-accent py-1.5"><FilePlus2 size={14} />Apply to {apply.length} college{apply.length > 1 ? 's' : ''}</Link>
        )}
      </div>
    </div>
    </>
  );
}

// Share on WhatsApp / copy link
export function ShareButtons({ title, path }: { title: string; path: string }) {
  const [copied, setCopied] = useState(false);
  const url = `${SITE_URL}${path}`;
  const share = async () => {
    if (navigator.share) { try { await navigator.share({ title, url }); return; } catch { /* cancelled */ } }
    await navigator.clipboard?.writeText(url);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="flex flex-wrap gap-2">
      <a target="_blank" rel="noopener noreferrer" className="btn-ghost border-emerald-300 text-emerald-700"
        href={`https://wa.me/?text=${encodeURIComponent(`${title} — ${url}`)}`}><MessageCircle size={16} />WhatsApp</a>
      <button onClick={share} className="btn-ghost">{copied ? <Check size={16} /> : <Share2 size={16} />}{copied ? 'Link copied' : 'Share'}</button>
    </div>
  );
}
