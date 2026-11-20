import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { LANG_COOKIE, isLang } from '@/lib/i18n';

// 1. ?hl=ta (any supported language) switches the site language and remembers it — shareable links,
//    and how search engines reach each language version (see hreflang tags in app/layout.tsx).
// 2. Keeps the Supabase session cookie fresh and protects private pages.
export async function proxy(request: NextRequest) {
  const hl = request.nextUrl.searchParams.get('hl');
  const langFromUrl = hl && isLang(hl) ? hl : null;
  if (langFromUrl) request.cookies.set(LANG_COOKIE, langFromUrl);

  // path (without hl) for hreflang / canonical tags
  const clean = new URL(request.nextUrl);
  clean.searchParams.delete('hl');
  const forward = () => {
    const h = new Headers(request.headers);
    h.set('x-ses-path', clean.pathname + clean.search);
    return NextResponse.next({ request: { headers: h } });
  };
  const finish = (res: NextResponse) => {
    if (langFromUrl) res.cookies.set(LANG_COOKIE, langFromUrl, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
    return res;
  };

  let response = forward();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return finish(response);

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookies) => {
        cookies.forEach(({ name, value }) => request.cookies.set(name, value));
        response = forward();
        cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPrivate = path.startsWith('/dashboard') || path.startsWith('/admin');
  if (isPrivate && !user) {
    const login = request.nextUrl.clone();
    login.pathname = '/login';
    login.searchParams.set('next', path);
    return NextResponse.redirect(login);
  }
  return finish(response);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap|manifest|sw.js|icons/|.*\\.(?:png|jpg|jpeg|svg|webp|gif|ico|xml)$).*)'],
};
