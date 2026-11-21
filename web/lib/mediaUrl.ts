// Public URL of a file in the "community" bucket (safe on server and client)
const BASE = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
export const mediaUrl = (path: string) => `${BASE}/storage/v1/object/public/community/${path.split('/').map(encodeURIComponent).join('/')}`;
