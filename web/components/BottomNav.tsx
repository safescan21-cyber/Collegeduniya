'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, GraduationCap, Clapperboard, MessageCircle, UserRound } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { useChatUnread, badge } from './chat/useChatUnread';

// Phones: a fixed bar with the five things students use most — chat is one tap from every page, with an unread badge.
const HIDE = [/^\/messages/, /^\/admin/, /^\/login/, /^\/community\/shots$/, /^\/owner/, /^\/employer/, /^\/mock-tests\/[^/]+\/attempt/];

export default function BottomNav() {
  const path = usePathname() || '/';
  const { user } = useAuth();
  const unread = useChatUnread(path);
  if (HIDE.some((r) => r.test(path))) return null;
  const loggedIn = !!user && !(user as any).is_anonymous;
  const items = [
    { href: '/', label: 'Home', icon: Home, on: path === '/' },
    { href: '/colleges', label: 'Colleges', icon: GraduationCap, on: path.startsWith('/colleges') || path.startsWith('/rankings') },
    { href: '/community/shots', label: 'Shots', icon: Clapperboard, on: path.startsWith('/community/shots') },
    { href: loggedIn ? '/messages' : '/login?next=/messages', label: 'Chat', icon: MessageCircle, on: false, count: unread },
    { href: loggedIn ? '/dashboard' : '/login', label: loggedIn ? 'Me' : 'Login', icon: UserRound, on: path.startsWith('/dashboard') },
  ];
  return (
    <>
      <div className="h-16 lg:hidden" aria-hidden />
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label="Main">
        <div className="grid h-16 grid-cols-5">
          {items.map((it) => (
            <Link key={it.label} href={it.href} className={`relative flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${it.on ? 'text-brand-700' : 'text-slate-500'}`}>
              {it.label === 'Chat'
                ? <span className="relative grid h-9 w-9 place-items-center rounded-full bg-brand-600 text-white shadow-md shadow-brand-600/30"><it.icon size={19} />
                    {!!it.count && <span className="absolute -end-1.5 -top-1 min-w-[18px] rounded-full bg-rose-500 px-1 text-center text-[10px] font-bold leading-[18px] text-white ring-2 ring-white">{badge(it.count)}</span>}</span>
                : <it.icon size={21} />}
              <span className={it.label === 'Chat' ? 'font-bold text-brand-700' : ''}>{it.label}</span>
            </Link>))}
        </div>
      </nav>
    </>
  );
}
