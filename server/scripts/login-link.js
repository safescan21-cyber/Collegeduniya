// One-time login link for a Collegeolo account (works without email). Run on the server:
//   cd /var/www/collegeolo/server && node scripts/login-link.js you@example.com [--admin]
// Creates the account if it doesn't exist, optionally makes it super admin, and prints a link valid for 1 hour.
import 'dotenv/config';
import { supabase } from '../src/supabase.js';

const email = (process.argv[2] || '').trim().toLowerCase();
const makeAdmin = process.argv.includes('--admin');
if (!/^\S+@\S+\.\S+$/.test(email)) { console.error('Usage: node scripts/login-link.js you@example.com [--admin]'); process.exit(1); }

let userId = null;
for (let page = 1; page < 50 && !userId; page++) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) { console.error(error.message); process.exit(1); }
  userId = data.users.find((u) => (u.email || '').toLowerCase() === email)?.id || null;
  if (data.users.length < 1000) break;
}
if (!userId) {
  const { data, error } = await supabase.auth.admin.createUser({ email, email_confirm: true, user_metadata: { full_name: email.split('@')[0] } });
  if (error) { console.error(error.message); process.exit(1); }
  userId = data.user.id;
  console.log('Account created');
}
if (makeAdmin) {
  const { error } = await supabase.from('profiles').update({ role: 'super_admin' }).eq('id', userId);
  console.log(error ? `Could not make admin: ${error.message}` : 'Made super admin');
}
const { data, error } = await supabase.auth.admin.generateLink({ type: 'magiclink', email });
if (error) { console.error(error.message); process.exit(1); }
const site = (process.env.SITE_URL || 'https://www.collegeolo.com').replace(/\/$/, '');
console.log(`\nLogin link (one use, 1 hour):\n${site}/auth/confirm?token_hash=${data.properties.hashed_token}&type=magiclink&next=${makeAdmin ? '/admin' : '/dashboard'}\n`);
