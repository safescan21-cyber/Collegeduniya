'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { ImagePlus, Loader2, MapPin, Send, Smile, X, BookOpen, PenSquare, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { supabaseBrowser } from '@/lib/supabase/client';
import { uploadMedia, mediaUrl, MAX_VIDEO_MB } from '@/lib/media';

const EMOJI = ['😀', '😂', '😍', '🥳', '😎', '🤔', '😢', '🙏', '👍', '👏', '🔥', '💯', '❤️', '🎉', '📚', '🎓', '✍️', '☕', '🏏', '🎶'];

export default function Composer({ onPosted }: { onPosted: () => void }) {
  const { user, profile } = useAuth();
  const sb = supabaseBrowser();
  const [kind, setKind] = useState<'post' | 'blog'>('post');
  const [title, setTitle] = useState(''); const [body, setBody] = useState('');
  const [media, setMedia] = useState<{ type: 'image' | 'video'; path: string }[]>([]);
  const [place, setPlace] = useState(''); const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null); const [showPlace, setShowPlace] = useState(false);
  const [emoji, setEmoji] = useState(false); const [busy, setBusy] = useState(''); const [err, setErr] = useState('');
  const file = useRef<HTMLInputElement>(null); const ta = useRef<HTMLTextAreaElement>(null);

  if (!user || (user as any).is_anonymous) return (
    <div className="card flex flex-wrap items-center justify-between gap-3 p-4 text-sm"><span className="text-slate-600">Share photos, news and tips from your college with every student.</span>
      <Link href="/login?mode=register&next=/community" className="btn-primary py-2">Join free to post</Link></div>);
  if (profile?.account_type && profile.account_type !== 'student') return null;

  const add = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 10 - media.length); e.target.value = '';
    if (!files.length) return;
    setBusy('upload'); setErr('');
    for (const f of files) { try { const m = await uploadMedia(user.id, f); setMedia((x) => [...x, m]); } catch (er: any) { setErr(`${f.name}: ${er.message}`); } }
    setBusy('');
  };
  const insertEmoji = (em: string) => {
    const el = ta.current; const s = el?.selectionStart ?? body.length; const t = el?.selectionEnd ?? body.length;
    setBody(body.slice(0, s) + em + body.slice(t)); setTimeout(() => { el?.focus(); el?.setSelectionRange(s + em.length, s + em.length); }, 0);
  };
  const locate = () => {
    if (!navigator.geolocation) return setErr('Location is not available on this device');
    setBusy('geo');
    navigator.geolocation.getCurrentPosition((pos) => { setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setBusy(''); if (!place) setPlace('My location'); },
      () => { setBusy(''); setErr('Could not get your location — type the place instead'); }, { timeout: 10000, maximumAge: 60000 });
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr('');
    if (kind === 'blog' && (title.trim().length < 3 || body.trim().length < 50)) return setErr('A blog needs a title and at least 50 characters.');
    if (kind === 'post' && !body.trim() && !media.length) return setErr('Write something or add a photo.');
    setBusy('post');
    const { error } = await sb.from('posts').insert({ user_id: user.id, kind, title: kind === 'blog' ? title.trim() : null, body: body.trim() || null, media,
      place: place.trim() || null, lat: geo?.lat ?? null, lng: geo?.lng ?? null });
    setBusy('');
    if (error) return setErr(error.message);
    setTitle(''); setBody(''); setMedia([]); setPlace(''); setGeo(null); setShowPlace(false); onPosted();
  };
  return (
    <form onSubmit={submit} className="card space-y-3 p-4">
      <div className="flex items-center gap-2">
        {([['post', 'Post', PenSquare], ['blog', 'Write a blog', BookOpen]] as const).map(([k, l, I]) => (
          <button key={k} type="button" onClick={() => setKind(k)} className={`${kind === k ? 'btn-primary' : 'btn-ghost'} py-1.5 text-sm`}><I size={15} />{l}</button>))}
        {profile?.verification !== 'verified' && <Link href="/verify" className="ms-auto hidden items-center gap-1 text-xs text-sky-700 hover:underline sm:flex"><ShieldCheck size={14} />Get the verified tick</Link>}
      </div>
      {kind === 'blog' && <input className="input text-lg font-semibold" maxLength={160} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Blog title" />}
      <textarea ref={ta} className="input min-h-[90px]" rows={kind === 'blog' ? 8 : 3} maxLength={20000} value={body} onChange={(e) => setBody(e.target.value)}
        placeholder={kind === 'blog' ? 'Write your blog — hostel life, placements, exam tips, campus events…' : `What's happening at ${profile?.college_id ? 'your college' : 'college'}?`} />
      {emoji && <div className="flex flex-wrap gap-1">{EMOJI.map((em) => <button key={em} type="button" onClick={() => insertEmoji(em)} className="rounded-lg p-1 text-xl hover:bg-slate-100">{em}</button>)}</div>}
      {media.length > 0 && <div className="flex flex-wrap gap-2">{media.map((m, i) => (
        <div key={m.path} className="relative h-20 w-20 overflow-hidden rounded-lg bg-slate-100">
          {m.type === 'video' ? <video src={mediaUrl(m.path)} className="h-full w-full object-cover" muted /> : <img src={mediaUrl(m.path)} alt="" className="h-full w-full object-cover" />}
          <button type="button" onClick={() => setMedia(media.filter((_, j) => j !== i))} className="absolute end-1 top-1 rounded-full bg-black/60 p-0.5 text-white" aria-label="Remove"><X size={12} /></button>
        </div>))}</div>}
      {showPlace && <div className="flex gap-2"><input className="input flex-1 py-2" maxLength={120} value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Place, e.g. Central Library" />
        <button type="button" onClick={locate} className="btn-ghost py-2 text-sm">{busy === 'geo' ? <Loader2 size={15} className="animate-spin" /> : <MapPin size={15} />}{geo ? 'Location added' : 'Use my location'}</button></div>}
      <div className="flex flex-wrap items-center gap-1">
        <button type="button" onClick={() => file.current?.click()} disabled={media.length >= 10 || !!busy} aria-label="Add photos or videos" className="btn-ghost px-2.5 py-1.5 text-sm" title={`Photos & videos (videos up to ${MAX_VIDEO_MB} MB)`}>{busy === 'upload' ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} className="text-emerald-600" />}<span className="hidden sm:inline">Photo/video</span></button>
        <button type="button" onClick={() => setEmoji(!emoji)} aria-label="Emoji" className="btn-ghost px-2.5 py-1.5 text-sm"><Smile size={16} className="text-amber-500" /><span className="hidden sm:inline">Emoji</span></button>
        <button type="button" onClick={() => setShowPlace(!showPlace)} aria-label="Location" className="btn-ghost px-2.5 py-1.5 text-sm"><MapPin size={16} className="text-rose-500" /><span className="hidden sm:inline">Location</span></button>
        <input ref={file} type="file" accept="image/*,video/mp4,video/webm,video/quicktime" multiple className="hidden" onChange={add} />
        <button disabled={!!busy} className="btn-primary ms-auto py-1.5">{busy === 'post' ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}{kind === 'blog' ? 'Publish' : 'Post'}</button>
      </div>
      {err && <p className="text-sm text-rose-600">{err}</p>}
      <p className="text-[11px] text-slate-400">Posts are public and stay on the site. Be kind — no personal phone numbers, no hate, nothing you don't own. Our team removes anything reported that breaks the rules.</p>
    </form>
  );
}
