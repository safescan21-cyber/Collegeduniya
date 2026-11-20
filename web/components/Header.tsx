'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { GraduationCap, Menu, X, LogOut, LayoutDashboard, ShieldCheck, MapPin } from 'lucide-react';
import { useAuth } from './AuthProvider';

const NAV = [
  { href: '/colleges', label: 'Colleges' },
  { href: '/hostels', label: 'PG & Hostels' },
  { href: '/jobs', label: 'Part-time Jobs' },
  { href: '/near-me', label: 'Near Me' },
];

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-white"><GraduationCap size={20} /></span>
      <span className={`text-lg font-extrabold tracking-tight ${light ? 'text-white' : 'text-slate-900'}`}>
        Study<span className="text-accent-500">Earn</span>stay
      </span>
    </Link>
  );
}

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, isAdmin, signOut } = useAuth();
  const [open, setOpen] = useState(false);

  const logout = async () => { await signOut(); router.push('/'); router.refresh(); };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="container-x flex h-16 items-center justify-between gap-4">
        <Logo />
        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition hover:bg-slate-100 ${pathname.startsWith(n.href) ? 'text-brand-700' : 'text-slate-600'}`}>
              {n.href === '/near-me' && <MapPin size={14} className="mr-1 inline" />}{n.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          {user ? (
            <>
              {isAdmin && <Link href="/admin" className="btn-ghost"><ShieldCheck size={16} />Admin</Link>}
              <Link href="/dashboard" className="btn-ghost"><LayoutDashboard size={16} />{profile?.full_name?.split(' ')[0] || 'Dashboard'}</Link>
              <button onClick={logout} className="btn-ghost" aria-label="Log out"><LogOut size={16} /></button>
            </>
          ) : (
            <>
              <Link href="/login" className="btn-ghost">Login</Link>
              <Link href="/login?mode=register" className="btn-primary">Register free</Link>
            </>
          )}
        </div>
        <button className="md:hidden" onClick={() => setOpen(!open)} aria-label="Menu">{open ? <X /> : <Menu />}</button>
      </div>
      {open && (
        <div className="border-t border-slate-200 bg-white md:hidden">
          <div className="container-x flex flex-col gap-1 py-3" onClick={() => setOpen(false)}>
            {NAV.map((n) => <Link key={n.href} href={n.href} className="rounded-lg px-3 py-2 font-medium hover:bg-slate-100">{n.label}</Link>)}
            <hr className="my-2 border-slate-200" />
            {user ? (
              <>
                {isAdmin && <Link href="/admin" className="rounded-lg px-3 py-2 font-medium hover:bg-slate-100">Admin panel</Link>}
                <Link href="/dashboard" className="rounded-lg px-3 py-2 font-medium hover:bg-slate-100">My dashboard</Link>
                <button onClick={logout} className="rounded-lg px-3 py-2 text-left font-medium text-rose-600 hover:bg-rose-50">Log out</button>
              </>
            ) : (
              <div className="flex gap-2">
                <Link href="/login" className="btn-ghost flex-1">Login</Link>
                <Link href="/login?mode=register" className="btn-primary flex-1">Register</Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
