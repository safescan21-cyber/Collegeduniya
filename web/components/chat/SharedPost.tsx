'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Clapperboard, ImageIcon } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { mediaUrl } from '@/lib/mediaUrl';
import type { FeedPost } from '@/components/community/types';

// A post / shot link sent in chat shows as a small card instead of a bare URL.
export default function SharedPost({ id }: { id: string }) {
  const [p, setP] = useState<FeedPost | null | undefined>(undefined);
  useEffect(() => { supabaseBrowser().rpc('feed', { p_post: id }).then(({ data }: { data: FeedPost[] | null }) => setP(data?.[0] || null)); }, [id]);
  if (p === undefined) return <div className="h-16 w-56 animate-pulse rounded-xl bg-black/10" />;
  if (p === null) return <p className="text-xs italic opacity-70">This post was removed</p>;
  const m = p.media[0];
  const href = p.kind === 'shot' ? `/community/shots?start=${p.id}` : `/community/post/${p.id}`;
  return (
    <Link href={href} className="flex w-60 max-w-full items-center gap-2 overflow-hidden rounded-xl bg-white text-slate-800 shadow-sm hover:bg-slate-50">
      <span className="relative grid h-16 w-14 shrink-0 place-items-center bg-slate-900 text-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {m?.type === 'image' ? <img src={mediaUrl(m.path)} alt="" draggable={false} className="h-full w-full object-cover" /> : m ? <Clapperboard size={20} /> : <ImageIcon size={18} />}
      </span>
      <span className="min-w-0 py-1 pe-2 text-xs">
        <b className="block truncate">{p.kind === 'shot' ? '▶ Shot' : p.title || 'Post'} · @{p.author_username || p.author_name}</b>
        <span className="line-clamp-2 text-slate-500">{p.body || p.college_name || 'Tap to open'}</span>
      </span>
    </Link>
  );
}
