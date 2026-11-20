'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  GraduationCap, Menu, X, LogOut, LayoutDashboard, ShieldCheck, MapPin, ChevronDown, Target, Scale,
  FilePlus2, Calculator, Newspaper, BookOpen, MessagesSquare, PlusCircle, PhoneCall, Globe2, Building2, BedDouble,
  Armchair, Sparkles, Compass, UsersRound, MessageCircle, Award, Plane, Trophy, FileStack, TrendingUp, FileText, Gift, Megaphone,
} from 'lucide-react';
import { useAuth } from './AuthProvider';
import { useLang, LangSwitch } from './LangProvider';
import type { DictKey } from '@/lib/i18n';

const MAIN: { href: string; key: DictKey }[] = [
  { href: '/colleges', key: 'nav.colleges' },
  { href: '/hostels', key: 'nav.hostels' },
  { href: '/jobs', key: 'nav.jobs' },
  { href: '/exams', key: 'nav.exams' },
];

const MORE: { href: string; key: DictKey; icon: any }[] = [
  { href: '/top', key: 'nav.top', icon: Trophy },
  { href: '/cities', key: 'nav.cities', icon: Globe2 },
  { href: '/predictor', key: 'nav.predictor', icon: Target },
  { href: '/papers', key: 'nav.papers', icon: FileStack },
  { href: '/compare', key: 'nav.compare', icon: Scale },
  { href: '/trends', key: 'nav.trends', icon: TrendingUp },
  { href: '/apply', key: 'nav.apply', icon: FilePlus2 },
  { href: '/management-quota', key: 'nav.quota', icon: Armchair },
  { href: '/recommend', key: 'nav.recommend', icon: Sparkles },
  { href: '/career-quiz', key: 'nav.quiz', icon: Compass },
  { href: '/roommates', key: 'nav.roommates', icon: UsersRound },
  { href: '/messages', key: 'nav.messages', icon: MessageCircle },
  { href: '/scholarships', key: 'nav.scholarships', icon: Award },
  { href: '/study-abroad/visa', key: 'nav.visa', icon: Plane },
  { href: '/study-abroad/calculator', key: 'nav.calculator', icon: Calculator },
  { href: '/resume', key: 'nav.resume', icon: FileText },
  { href: '/rewards', key: 'nav.rewards', icon: Gift },
  { href: '/ambassador', key: 'nav.ambassador', icon: Megaphone },
  { href: '/news', key: 'nav.news', icon: Newspaper },
  { href: '/questions', key: 'nav.qa', icon: MessagesSquare },
  { href: '/near-me', key: 'nav.nearMe', icon: MapPin },
  { href: '/partners?as=pg_owner', key: 'nav.forOwners', icon: BedDouble },
  { href: '/partners?as=employer', key: 'nav.forCompanies', icon: Building2 },
  { href: '/counselling', key: 'nav.counselling', icon: PhoneCall },
];

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-2">
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
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [more, setMore] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMore(false); setOpen(false); }, [pathname]);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMore(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const logout = async () => { await signOut(); router.push('/'); router.refresh(); };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="container-x flex h-16 items-center justify-between gap-3">
        <Logo />
        <nav className="hidden items-center gap-0.5 lg:flex">
          {MAIN.map((n) => (
            <Link key={n.href} href={n.href}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition hover:bg-slate-100 ${pathname.startsWith(n.href) ? 'text-brand-700' : 'text-slate-600'}`}>
              {t(n.key)}
            </Link>
          ))}
          <div className="relative" ref={moreRef}>
            <button onClick={() => setMore(!more)} className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
              {t('nav.more')}<ChevronDown size={14} className={more ? 'rotate-180 transition' : 'transition'} />
            </button>
            {more && (
              <div className="absolute left-0 top-full mt-2 grid w-[440px] grid-cols-2 gap-1 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                {MORE.map((m) => (
                  <Link key={m.href} href={m.href} className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-brand-50 hover:text-brand-700">
                    <m.icon size={16} className="text-brand-600" />{t(m.key)}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </nav>
        <div className="hidden items-center gap-2 lg:flex">
          <LangSwitch />
          {user ? (
            <>
              {isAdmin && <Link href="/admin" className="btn-ghost px-3"><ShieldCheck size={16} />{t('auth.admin')}</Link>}
              {profile?.account_type === 'pg_owner' && <Link href="/owner" className="btn-ghost px-3"><BedDouble size={16} />{t('nav.ownerPortal')}</Link>}
              {profile?.account_type === 'employer' && <Link href="/employer" className="btn-ghost px-3"><Building2 size={16} />{t('nav.employerPortal')}</Link>}
              <Link href="/dashboard" className="btn-ghost px-3"><LayoutDashboard size={16} />{profile?.full_name?.split(' ')[0] || t('auth.dashboard')}</Link>
              <button onClick={logout} className="btn-ghost px-3" aria-label={t('auth.logout')}><LogOut size={16} /></button>
            </>
          ) : (
            <>
              <Link href="/login" className="btn-ghost">{t('auth.login')}</Link>
              <Link href="/login?mode=register" className="btn-primary">{t('auth.register')}</Link>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 lg:hidden">
          <LangSwitch />
          <button onClick={() => setOpen(!open)} aria-label="Menu">{open ? <X /> : <Menu />}</button>
        </div>
      </div>
      {open && (
        <div className="max-h-[80vh] overflow-y-auto border-t border-slate-200 bg-white lg:hidden">
          <div className="container-x grid grid-cols-2 gap-1 py-3">
            {MAIN.map((n) => <Link key={n.href} href={n.href} className="rounded-lg px-3 py-2 font-medium hover:bg-slate-100">{t(n.key)}</Link>)}
            {MORE.map((m) => <Link key={m.href} href={m.href} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-slate-100"><m.icon size={15} className="text-brand-600" />{t(m.key)}</Link>)}
          </div>
          <div className="container-x border-t border-slate-200 py-3">
            {user ? (
              <div className="flex flex-wrap gap-2">
                {isAdmin && <Link href="/admin" className="btn-ghost flex-1">{t('auth.admin')}</Link>}
                {profile?.account_type === 'pg_owner' && <Link href="/owner" className="btn-ghost flex-1">{t('nav.ownerPortal')}</Link>}
                {profile?.account_type === 'employer' && <Link href="/employer" className="btn-ghost flex-1">{t('nav.employerPortal')}</Link>}
                <Link href="/dashboard" className="btn-ghost flex-1">{t('auth.dashboard')}</Link>
                <button onClick={logout} className="btn-ghost flex-1 text-rose-600">{t('auth.logout')}</button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Link href="/login" className="btn-ghost flex-1">{t('auth.login')}</Link>
                <Link href="/login?mode=register" className="btn-primary flex-1">{t('auth.register')}</Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
