'use client';
import { supabaseBrowser } from '@/lib/supabase/client';

// Public "community" bucket: <user id>/<file>. Photos are shrunk in the browser before upload (saves students' data).
import { mediaUrl } from '@/lib/mediaUrl';
export { mediaUrl };
export const MAX_VIDEO_MB = 20;

export async function shrinkImage(file: File, max = 1600, quality = 0.85): Promise<Blob> {
  if (file.type === 'image/gif') return file;
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) return file;
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  return await new Promise<Blob>((ok) => c.toBlob((b) => ok(b || file), 'image/jpeg', quality));
}

export async function uploadMedia(userId: string, file: File): Promise<{ type: 'image' | 'video'; path: string }> {
  const video = file.type.startsWith('video/');
  if (!video && !file.type.startsWith('image/')) throw new Error('Only photos and videos');
  if (video && file.size > MAX_VIDEO_MB * 1024 * 1024) throw new Error(`Videos up to ${MAX_VIDEO_MB} MB`);
  const body = video ? file : await shrinkImage(file);
  const ext = video ? (file.name.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) : (file.type === 'image/gif' ? 'gif' : 'jpg');
  const path = `${userId}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabaseBrowser().storage.from('community').upload(path, body, { contentType: video ? file.type : (file.type === 'image/gif' ? 'image/gif' : 'image/jpeg'), upsert: false });
  if (error) throw new Error(error.message);
  return { type: video ? 'video' : 'image', path };
}

// A thumbnail for a video shot: one frame (about half a second in) drawn to a canvas in the browser, saved as a small JPG
// next to the video. Used as the poster in the player, in "More shots" and for Google's video results.
export async function uploadPoster(userId: string, file: File): Promise<string | null> {
  const src = URL.createObjectURL(file);
  try {
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = src;
    await new Promise<void>((ok, bad) => { v.onloadeddata = () => ok(); v.onerror = () => bad(new Error('cannot read video')); setTimeout(() => bad(new Error('timeout')), 8000); });
    v.currentTime = Math.min(0.5, (v.duration || 1) / 2);
    await new Promise<void>((ok) => { v.onseeked = () => ok(); setTimeout(ok, 3000); });
    const w = v.videoWidth, h = v.videoHeight; if (!w || !h) return null;
    const scale = Math.min(1, 720 / Math.max(w, h));
    const c = document.createElement('canvas'); c.width = Math.round(w * scale); c.height = Math.round(h * scale);
    c.getContext('2d')!.drawImage(v, 0, 0, c.width, c.height);
    const blob: Blob | null = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.8));
    if (!blob) return null;
    const path = `${userId}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}-poster.jpg`;
    const { error } = await supabaseBrowser().storage.from('community').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
    return error ? null : path;
  } finally { URL.revokeObjectURL(src); }
}
