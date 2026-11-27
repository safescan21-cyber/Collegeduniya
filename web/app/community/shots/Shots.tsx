'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Heart, ThumbsDown, MessageCircle, Share2, Plus, Volume2, VolumeX, Loader2, X, Clapperboard, Trash2 } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { supabaseBrowser } from '@/lib/supabase/client';
import { uploadMedia, uploadPoster, mediaUrl, MAX_VIDEO_MB } from '@/lib/media';
import { shotPath } from '@/lib/shotUrl';
import { timeAgo } from '@/lib/format';
import Verified from '@/components/campus/Verified';
import Watermark from '@/components/Watermark';
import FollowButton from '@/components/community/FollowButton';
import ShareMenu from '@/components/community/ShareMenu';
import Comments from '@/components/community/Comments';
import ReportButton from '@/components/community/ReportButton';
import type { FeedPost } from '@/components/community/types';

const PAGE = 10;
const MAX_SECONDS = 60;
const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : n ? String(n) : '');

export default function Shots() {
  const { user, loading: authLoading } = useAuth();
  const params = useSearchParams();
  const start = params.get('start');
  const [tab, setTab] = useState<'trending' | 'new' | 'following'>('trending');
  const [rows, setRows] = useState<FeedPost[] | null>(null); const [more, setMore] = useState(false);
  const [muted, setMuted] = useState(true);
  const [upload, setUpload] = useState(params.get('new') === '1');
  const loading = useRef(false);
  const loggedIn = !!user && !(user as any).is_anonymous;
  const toLogin = () => location.assign(`/login?mode=register&next=${encodeURIComponent('/community/shots?new=1')}`);
  // ?new=1 (home page "Post your shot") — guests log in / sign up first, then come straight back to the upload screen
  useEffect(() => { if (upload && !authLoading && !loggedIn) { setUpload(false); toLogin(); } }, [upload, authLoading, loggedIn]);   // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(async (offset = 0) => {
    if (loading.current) return; loading.current = true;
    const sb = supabaseBrowser();
    const { data } = await sb.rpc('feed', { p_kind: 'shot', p_sort: tab === 'following' ? 'new' : tab, p_following: tab === 'following', p_offset: offset, p_lim: PAGE });
    let list = (data || []) as FeedPost[];
    if (!offset && start) {                                      // opened from a shared link / feed card: that shot first
      const { data: one } = await sb.rpc('feed', { p_post: start });
      const first = ((one || []) as FeedPost[])[0];
      if (first) list = [first, ...list.filter((x) => x.id !== first.id)];
    }
    setRows((r) => (offset ? [...(r || []), ...list.filter((x) => !(r || []).some((y) => y.id === x.id))] : list));
    setMore((data || []).length === PAGE); loading.current = false;
  }, [tab, start]);
  useEffect(() => { setRows(null); load(0); }, [load, user?.id]);

  return (
    <div className="relative mx-auto h-[calc(100dvh-4rem)] max-w-md bg-black text-white">
      <div className="absolute inset-x-0 top-0 z-20 flex items-center gap-2 bg-gradient-to-b from-black/70 to-transparent p-3">
        <Link href="/community" aria-label="Back to community" className="rounded-full p-1 hover:bg-white/10"><ArrowLeft size={20} /></Link>
        <div className="flex flex-1 justify-center gap-4 text-sm font-semibold">
          {([['trending', 'Trending'], ['new', 'Latest'], ['following', 'Following']] as const).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={tab === k ? 'border-b-2 border-white pb-0.5' : 'text-white/60'}>{l}</button>))}
        </div>
        <button onClick={() => (loggedIn ? setUpload(true) : toLogin())} className="flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-900"><Plus size={14} />Shot</button>
      </div>

      <div className="h-full snap-y snap-mandatory overflow-y-scroll [scrollbar-width:none]">
        {rows === null ? <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin" /></div>
          : rows.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
              <Clapperboard size={40} className="text-white/60" />
              <p className="font-semibold">{tab === 'following' ? 'No shots from people you follow yet' : 'No shots yet'}</p>
              <p className="text-sm text-white/60">{tab === 'following' ? 'Follow students from the Trending tab to see their shots here.' : 'Post the first one — a campus tour, fest moment or hostel room.'}</p>
            </div>)
          : rows.map((s, i) => <Shot key={s.id} shot={s} muted={muted} setMuted={setMuted} onNear={i === rows.length - 3 && more ? () => load(rows.length) : undefined}
              onDeleted={() => setRows((r) => (r || []).filter((x) => x.id !== s.id))} />)}
      </div>
      {upload && loggedIn && <UploadShot onClose={() => setUpload(false)} onDone={() => { setUpload(false); setTab('new'); setRows(null); load(0); }} />}
    </div>
  );
}

function Shot({ shot, muted, setMuted, onNear, onDeleted }: { shot: FeedPost; muted: boolean; setMuted: (m: boolean) => void; onNear?: () => void; onDeleted: () => void }) {
  const { user } = useAuth();
  const router = useRouter();
  const sb = supabaseBrowser();
  const [p, setP] = useState(shot);
  const [comments, setComments] = useState(false); const [share, setShare] = useState(false); const [full, setFull] = useState(false);
  const [burst, setBurst] = useState(false);
  const box = useRef<HTMLDivElement>(null); const vid = useRef<HTMLVideoElement>(null);
  const m = p.media[0];
  const loggedIn = !!user && !(user as any).is_anonymous;

  useEffect(() => {   // play when on screen, pause when scrolled away; load the next page near the end
    const el = box.current; if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { vid.current?.play().catch(() => {}); onNear?.(); } else { vid.current?.pause(); }
    }, { threshold: 0.65 });
    io.observe(el); return () => io.disconnect();
  }, [onNear]);

  const react = async (v: number) => {
    if (!loggedIn) return router.push('/login?mode=register&next=/community/shots');
    const next = p.my_reaction === v ? 0 : v;
    const { data, error } = await sb.rpc('react_post', { p_post: p.id, p_value: next });
    if (!error && data?.[0]) setP({ ...p, likes: data[0].likes, dislikes: data[0].dislikes, my_reaction: data[0].mine });
  };
  const lastTap = useRef(0);
  const tap = () => {   // double-tap = like (with a heart burst); single tap = sound on/off
    const now = Date.now();
    if (now - lastTap.current < 300) { if (p.my_reaction !== 1) react(1); setBurst(true); setTimeout(() => setBurst(false), 700); }
    else if (m?.type === 'video') setMuted(!muted);
    lastTap.current = now;
  };
  const del = async () => { if (!confirm('Delete this shot?')) return; await sb.from('posts').delete().eq('id', p.id); onDeleted(); };

  return (
    <section ref={box} className="relative h-full snap-start snap-always overflow-hidden" onContextMenu={(e) => e.preventDefault()}>
      <div className="absolute inset-0 flex items-center justify-center" onClick={tap}>
        {m?.type === 'video'
          ? <video ref={vid} src={mediaUrl(m.path)} poster={m.poster ? mediaUrl(m.poster) : undefined} muted={muted} loop playsInline preload="metadata" controlsList="nodownload noremoteplayback" disablePictureInPicture className="h-full w-full object-contain" />
          // eslint-disable-next-line @next/next/no-img-element
          : m && <img src={mediaUrl(m.path)} alt="" draggable={false} className="h-full w-full object-contain" />}
        <Watermark dense />
        {burst && <Heart size={110} className="absolute animate-ping fill-rose-500 text-rose-500" />}
        {m?.type === 'video' && <span className="absolute end-3 top-14 z-10 rounded-full bg-black/40 p-1.5">{muted ? <VolumeX size={16} /> : <Volume2 size={16} />}</span>}
      </div>

      <div className="absolute bottom-24 end-2 z-10 flex flex-col items-center gap-4 text-xs font-semibold [text-shadow:0_1px_2px_rgba(0,0,0,.8)]">
        <button onClick={() => react(1)} className="flex flex-col items-center gap-0.5" aria-label="Like"><Heart size={30} className={p.my_reaction === 1 ? 'fill-rose-500 text-rose-500' : ''} />{fmt(p.likes)}</button>
        <button onClick={() => react(-1)} className="flex flex-col items-center gap-0.5" aria-label="Dislike"><ThumbsDown size={26} className={p.my_reaction === -1 ? 'fill-white' : ''} />{fmt(p.dislikes)}</button>
        <button onClick={() => setComments(true)} className="flex flex-col items-center gap-0.5" aria-label="Comments"><MessageCircle size={28} />{fmt(p.comments)}</button>
        <button onClick={() => setShare(true)} className="flex flex-col items-center gap-0.5" aria-label="Share"><Share2 size={27} />{fmt(p.shares)}</button>
        {p.is_mine ? <button onClick={del} aria-label="Delete shot"><Trash2 size={22} /></button> : <ReportButton type="post" id={p.id} label="" className="!p-0 !text-white" />}
      </div>

      <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-4 pe-16">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {p.author_username ? <Link href={`/u/${p.author_username}`} className="font-bold hover:underline">@{p.author_username}</Link> : <span className="font-bold">{p.author_name}</span>}
          <Verified on={p.author_verified} size={14} />
          {!p.is_mine && <FollowButton userId={p.author_id} initial={loggedIn ? !!p.author_followed : undefined} variant="dark" onChange={(f) => setP((x) => ({ ...x, author_followed: f }))} />}
        </div>
        <p className="mt-0.5 truncate text-xs text-white/70">{p.college_name && <>{p.college_slug ? <Link href={`/colleges/${p.college_slug}`} className="hover:underline">{p.college_name}</Link> : p.college_name} · </>}
          <Link href={shotPath(p.id, p.body)} className="hover:underline" title="This shot's own page — link to share">{timeAgo(p.created_at)}</Link></p>
        {p.body && <p onClick={() => setFull(!full)} className={`mt-1 whitespace-pre-wrap break-words text-sm ${full ? '' : 'line-clamp-2'}`}>{p.body}</p>}
      </div>

      {comments && (
        <div className="absolute inset-0 z-30 flex flex-col justify-end bg-black/40" onClick={() => setComments(false)}>
          <div className="max-h-[70%] overflow-y-auto rounded-t-2xl bg-white text-slate-800" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white p-3"><p className="font-bold">Comments</p><button onClick={() => setComments(false)} aria-label="Close"><X size={18} /></button></div>
            <Comments postId={p.id} onCount={(n) => n !== p.comments && setP((x) => ({ ...x, comments: n }))} />
          </div>
        </div>)}
      {share && <ShareMenu postId={p.id} path={shotPath(p.id, p.body)} text={(p.body || '').slice(0, 100)} onShared={(n) => setP((x) => ({ ...x, shares: n }))} onClose={() => setShare(false)} />}
    </section>
  );
}

function UploadShot({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { user, profile } = useAuth();
  const [file, setFile] = useState<File | null>(null); const [preview, setPreview] = useState('');
  const [caption, setCaption] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  if (profile?.account_type && profile.account_type !== 'student') return (
    <Sheet onClose={onClose}><p className="py-6 text-center text-sm">Only student accounts can post shots.</p></Sheet>);

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = ''; setErr('');
    if (!f) return;
    if (f.type.startsWith('video/') && f.size > MAX_VIDEO_MB * 1024 * 1024) return setErr(`Videos up to ${MAX_VIDEO_MB} MB`);
    const url = URL.createObjectURL(f);
    if (f.type.startsWith('video/')) {   // keep shots short
      const v = document.createElement('video'); v.preload = 'metadata'; v.src = url;
      v.onloadedmetadata = () => { if (v.duration > MAX_SECONDS + 1) { setErr(`Shots can be up to ${MAX_SECONDS} seconds — trim the video first`); URL.revokeObjectURL(url); } else { setFile(f); setPreview(url); } };
      v.onerror = () => { setFile(f); setPreview(url); };
    } else { setFile(f); setPreview(url); }
  };
  const post = async () => {
    if (!file || !user) return;
    setBusy(true); setErr('');
    try {
      const m: { type: 'image' | 'video'; path: string; poster?: string } = await uploadMedia(user.id, file);
      if (m.type === 'video') { const poster = await uploadPoster(user.id, file).catch(() => null); if (poster) m.poster = poster; }   // thumbnail for search & previews
      const { error } = await supabaseBrowser().from('posts').insert({ user_id: user.id, kind: 'shot', body: caption.trim() || null, media: [m] });
      if (error) throw new Error(error.message);
      onDone();
    } catch (e: any) { setErr(e.message); setBusy(false); }
  };
  return (
    <Sheet onClose={onClose}>
      <p className="mb-3 font-bold">New shot</p>
      {preview ? (
        <div className="relative mx-auto mb-3 aspect-[9/16] max-h-[45vh] overflow-hidden rounded-xl bg-black">
          {file?.type.startsWith('video/') ? <video src={preview} autoPlay muted loop playsInline className="h-full w-full object-contain" />
            /* eslint-disable-next-line @next/next/no-img-element */
            : <img src={preview} alt="" className="h-full w-full object-contain" />}
          <button onClick={() => { setFile(null); setPreview(''); }} className="absolute end-2 top-2 rounded-full bg-black/60 p-1 text-white" aria-label="Remove"><X size={14} /></button>
        </div>
      ) : (
        <label className="mb-3 flex aspect-[9/16] max-h-[45vh] mx-auto cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 text-sm text-slate-500 hover:border-brand-400">
          <Clapperboard size={32} className="text-brand-600" />Choose a video (up to {MAX_SECONDS} s) or a photo
          <input type="file" accept="video/mp4,video/webm,video/quicktime,image/*" className="hidden" onChange={pick} />
        </label>)}
      <textarea className="input" rows={2} maxLength={500} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Caption — #fest #hostel #placements" />
      {err && <p className="mt-2 text-sm text-rose-600">{err}</p>}
      <button onClick={post} disabled={!file || busy} className="btn-primary mt-3 w-full">{busy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}{busy ? 'Uploading…' : 'Post shot'}</button>
      <p className="mt-2 text-[11px] text-slate-400">Shots are public. Only post what you filmed yourself — no other people’s videos, no faces of people who didn’t agree.</p>
    </Sheet>
  );
}

function Sheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-40 flex items-end bg-black/60" onClick={onClose}>
      <div className="max-h-full w-full overflow-y-auto rounded-t-2xl bg-white p-4 text-slate-800" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="float-end" aria-label="Close"><X size={18} /></button>{children}
      </div>
    </div>
  );
}
