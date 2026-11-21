'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ThumbsUp, ThumbsDown, MessageCircle, Share2, MapPin, Trash2, Trophy, BookOpen, Check } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { supabaseBrowser } from '@/lib/supabase/client';
import { timeAgo } from '@/lib/format';
import { mediaUrl } from '@/lib/media';
import Verified from '@/components/campus/Verified';
import Comments from './Comments';
import ReportButton from './ReportButton';
import { FeedPost, fullDate } from './types';

export default function PostCard({ post, full = false, onDeleted }: { post: FeedPost; full?: boolean; onDeleted?: () => void }) {
  const { user } = useAuth();
  const router = useRouter();
  const sb = supabaseBrowser();
  const [p, setP] = useState(post);
  const [open, setOpen] = useState(full);
  const [shared, setShared] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);
  const loggedIn = user && !(user as any).is_anonymous;
  const react = async (v: number) => {
    if (!loggedIn) return router.push('/login?mode=register&next=/community');
    const next = p.my_reaction === v ? 0 : v;
    const { data, error } = await sb.rpc('react_post', { p_post: p.id, p_value: next });
    if (!error && data?.[0]) setP({ ...p, likes: data[0].likes, dislikes: data[0].dislikes, my_reaction: data[0].mine });
  };
  const share = async () => {
    const url = `${location.origin}/community/post/${p.id}`;
    const text = p.title || (p.body || '').slice(0, 100) || 'Post on Collegeolo';
    try { if (navigator.share) await navigator.share({ title: text, url }); else { await navigator.clipboard.writeText(url); setShared(true); setTimeout(() => setShared(false), 1500); } }
    catch { return; }
    const { data } = await sb.rpc('share_post', { p_post: p.id }); if (typeof data === 'number') setP({ ...p, shares: data });
  };
  const del = async () => { if (!confirm('Delete this post?')) return; await sb.from('posts').delete().eq('id', p.id); onDeleted?.(); };
  const long = !full && p.kind === 'blog' && (p.body || '').length > 420;
  const author = p.author_username ? <Link href={`/u/${p.author_username}`} className="font-semibold text-slate-900 hover:underline">{p.author_name}</Link> : <span className="font-semibold text-slate-900">{p.author_name}</span>;
  return (
    <article className="card overflow-hidden">
      <header className="flex items-start gap-3 p-4">
        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-brand-100">
          {p.author_avatar ? <img src={p.author_avatar} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center font-bold text-brand-700">{p.author_name[0]?.toUpperCase()}</span>}
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1 text-sm">{author}<Verified on={p.author_verified} />
            {p.kind === 'blog' && <span className="chip ms-1"><BookOpen size={11} />Blog</span>}{p.kind === 'result' && <span className="chip ms-1"><Trophy size={11} />Result</span>}</p>
          <p className="truncate text-xs text-slate-500">
            {p.college_name && (p.college_slug ? <Link href={`/colleges/${p.college_slug}`} className="hover:underline">{p.college_name}</Link> : p.college_name)}
            {p.college_name ? ' · ' : ''}<time dateTime={p.created_at} title={fullDate(p.created_at)}>{fullDate(p.created_at)} ({timeAgo(p.created_at)})</time>{p.edited_at ? ' · edited' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">{p.is_mine ? <button onClick={del} className="text-slate-400 hover:text-rose-600" aria-label="Delete post"><Trash2 size={15} /></button> : <ReportButton type="post" id={p.id} label="" />}</div>
      </header>
      <div className="px-4">
        {p.title && (full ? <h1 className="mb-2 text-2xl font-extrabold text-slate-900">{p.title}</h1> : <Link href={`/community/post/${p.id}`}><h2 className="mb-1 text-lg font-bold text-slate-900 hover:underline">{p.title}</h2></Link>)}
        {p.body && <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-slate-800">{long ? `${p.body.slice(0, 400)}…` : p.body}</p>}
        {long && <Link href={`/community/post/${p.id}`} className="text-sm font-semibold text-brand-700">Read full blog →</Link>}
        {p.result && (
          <div className="mt-3 rounded-2xl bg-gradient-to-br from-brand-700 to-brand-500 p-4 text-white">
            <p className="text-sm text-brand-100">{p.result.title}</p>
            <p className="mt-1 text-3xl font-extrabold">{Number(p.result.score)}<span className="text-lg text-brand-100"> / {Number(p.result.max)}</span> <span className="text-lg">· {Number(p.result.percent)}%</span></p>
            <p className="text-sm text-brand-100">{p.result.correct} right · {p.result.wrong} wrong{p.result.rank ? ` · All India rank ${p.result.rank} of ${p.result.total}` : ''}</p>
            <Link href={p.result.paper_id ? `/mock-tests/leaderboard/${p.result.paper_id}` : `/mock-tests/${p.result.exam_slug}`} className="mt-2 inline-block rounded-lg bg-white/15 px-3 py-1 text-xs font-semibold hover:bg-white/25">{p.result.paper_id ? 'See leaderboard & take this test' : 'Take this test'} →</Link>
          </div>)}
      </div>
      {p.media.length > 0 && (
        <div className={`mt-3 grid gap-0.5 ${p.media.length > 1 ? 'grid-cols-2' : ''}`}>
          {p.media.slice(0, full ? 10 : 4).map((m, i) => m.type === 'video'
            ? <video key={i} src={mediaUrl(m.path)} controls preload="metadata" playsInline className="max-h-[480px] w-full bg-black" />
            : <button key={i} type="button" onClick={() => setZoom(mediaUrl(m.path))} className="relative block bg-slate-100">
                <img src={mediaUrl(m.path)} alt="" loading="lazy" className={`w-full object-cover ${p.media.length > 1 ? 'aspect-square' : 'max-h-[520px]'}`} />
                {!full && i === 3 && p.media.length > 4 && <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-2xl font-bold text-white">+{p.media.length - 4}</span>}
              </button>)}
        </div>)}
      {p.place && <p className="mt-2 px-4 text-xs text-slate-500"><MapPin size={12} className="inline" /> {p.lat != null ? <a href={`https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lng}#map=16/${p.lat}/${p.lng}`} target="_blank" rel="noopener noreferrer" className="hover:underline">{p.place}</a> : p.place}</p>}
      <footer className="mt-3 flex items-center gap-1 border-t border-slate-100 px-2 py-1.5 text-sm text-slate-600">
        <button onClick={() => react(1)} className={`flex items-center gap-1 rounded-lg px-3 py-1.5 hover:bg-slate-50 ${p.my_reaction === 1 ? 'font-semibold text-brand-700' : ''}`} aria-label="Like"><ThumbsUp size={16} className={p.my_reaction === 1 ? 'fill-brand-600' : ''} />{p.likes || ''}</button>
        <button onClick={() => react(-1)} className={`flex items-center gap-1 rounded-lg px-3 py-1.5 hover:bg-slate-50 ${p.my_reaction === -1 ? 'font-semibold text-rose-600' : ''}`} aria-label="Dislike"><ThumbsDown size={16} />{p.dislikes || ''}</button>
        <button onClick={() => setOpen(!open)} className="flex items-center gap-1 rounded-lg px-3 py-1.5 hover:bg-slate-50" aria-label="Comments"><MessageCircle size={16} />{p.comments || ''}</button>
        <button onClick={share} className="ms-auto flex items-center gap-1 rounded-lg px-3 py-1.5 hover:bg-slate-50" aria-label="Share">{shared ? <Check size={16} /> : <Share2 size={16} />}{shared ? 'Link copied' : p.shares || ''}</button>
      </footer>
      {open && <Comments postId={p.id} onCount={(n) => n !== p.comments && setP((x) => ({ ...x, comments: n }))} />}
      {zoom && <button type="button" onClick={() => setZoom(null)} className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" aria-label="Close"><img src={zoom} alt="" className="max-h-full max-w-full object-contain" /></button>}
    </article>
  );
}
