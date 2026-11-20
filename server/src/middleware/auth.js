import { supabase } from '../supabase.js';

// Reads "Authorization: Bearer <supabase access token>", verifies it with
// Supabase, and attaches { user, profile } to req. Never throws on missing
// token — use requireUser / requireAdmin to enforce.
export async function loadUser(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next();
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) return next();
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, is_blocked')
      .eq('id', data.user.id)
      .single();
    req.user = data.user;
    req.profile = profile || null;
  } catch (e) {
    console.error('[auth]', e.message);
  }
  next();
}

export function requireUser(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Login required' });
  if (req.profile?.is_blocked) return res.status(403).json({ error: 'Account blocked' });
  next();
}

export function requireAdmin(req, res, next) {
  const role = req.profile?.role;
  if (!req.user) return res.status(401).json({ error: 'Login required' });
  if (req.profile?.is_blocked || !['admin', 'super_admin'].includes(role)) {
    return res.status(403).json({ error: 'Admin access only' });
  }
  next();
}

export function requireSuperAdmin(req, res, next) {
  if (req.profile?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Super admin access only' });
  }
  next();
}
