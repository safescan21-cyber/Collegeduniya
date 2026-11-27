'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3, GraduationCap, Home, Briefcase, Star, FileText, Users, ShieldAlert, PhoneCall, FilePlus2, MessagesSquare, Newspaper, BookOpen, Mail,
  MessageSquareHeart, Building2, DatabaseZap, Armchair, ClipboardList, ChartColumn, Trophy, Award, Plane, Handshake, Rocket, CreditCard, Flag, UsersRound,
  CalendarCheck, FileStack, Gift, Megaphone, ClipboardCheck, Radio, BadgeCheck, Rss, Inbox, Activity, Search, ChevronDown, ChevronsLeft, ChevronsRight,
  Menu, X, ExternalLink, LayoutDashboard, School, PenSquare, ShieldCheck, Settings, Sparkles, type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { supabaseBrowser } from '@/lib/supabase/client';

type Item = { href: string; label: string; icon: LucideIcon; badge?: string; keywords?: string };
type Group = { id: string; label: string; icon: LucideIcon; items: Item[] };

// Pages grouped by job. `badge` = key in the pending-work counts below.
const GROUPS: Group[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, items: [
    { href: '/admin', label: 'Dashboard', icon: BarChart3, keywords: 'home stats visitors bots' },
    { href: '/admin/health', label: 'System health', icon: Activity, keywords: 'errors server cpu memory fix' },
    { href: '/admin/online', label: 'Online now', icon: Radio, keywords: 'live users' },
  ] },
  { id: 'leads', label: 'Leads & admissions', icon: PhoneCall, items: [
    { href: '/admin/leads', label: 'Leads', icon: PhoneCall, badge: 'leads', keywords: 'enquiries counselling' },
    { href: '/admin/college-applications', label: 'College applications', icon: FilePlus2, badge: 'capps' },
    { href: '/admin/quota-applications', label: 'Quota applications', icon: ClipboardList, badge: 'qapps', keywords: 'management quota' },
    { href: '/admin/partners', label: 'Lead partners', icon: Handshake },
    { href: '/admin/payments', label: 'Payments', icon: CreditCard, keywords: 'razorpay money' },
  ] },
  { id: 'colleges', label: 'Colleges & courses', icon: School, items: [
    { href: '/admin/colleges', label: 'Colleges', icon: GraduationCap, keywords: 'university fees photos' },
    { href: '/admin/official-fees', label: 'Official fees', icon: CreditCard, badge: 'fees', keywords: 'fees scraper website review' },
    { href: '/admin/management-quota', label: 'Management quota', icon: Armchair },
    { href: '/admin/course-catalog', label: 'Course pages', icon: GraduationCap },
    { href: '/admin/rankings', label: 'Rankings', icon: Trophy, keywords: 'nirf world leiden' },
    { href: '/admin/rank-bands', label: 'Marks → rank', icon: ChartColumn, keywords: 'predictor' },
    { href: '/admin/rank-reports', label: 'Rank results (students)', icon: Users },
    { href: '/admin/scholarships', label: 'Scholarships', icon: Award },
    { href: '/admin/visa-guides', label: 'Visa guides', icon: Plane, keywords: 'study abroad' },
    { href: '/admin/visa-news', label: 'Visa news', icon: Newspaper, keywords: 'study abroad immigration updates' },
  ] },
  { id: 'exams', label: 'Exams & mock tests', icon: BookOpen, items: [
    { href: '/admin/exams', label: 'Exams', icon: BookOpen },
    { href: '/admin/exam-news', label: 'Exam news', icon: Rss },
    { href: '/admin/exam-dates', label: 'Exam dates', icon: CalendarCheck, badge: 'examdates', keywords: 'calendar deadlines reminders' },
    { href: '/admin/exam-library', label: 'Exam library', icon: FileStack, keywords: 'papers pdf' },
    { href: '/admin/mock-tests', label: 'Mock tests', icon: ClipboardCheck, keywords: 'questions test' },
  ] },
  { id: 'hostels', label: 'Hostels & jobs', icon: Home, items: [
    { href: '/admin/hostels', label: 'PG & hostels', icon: Home },
    { href: '/admin/pg-visits', label: 'PG visits', icon: CalendarCheck },
    { href: '/admin/hostel-reviews', label: 'PG reviews', icon: MessageSquareHeart, badge: 'hreviews' },
    { href: '/admin/jobs', label: 'Jobs', icon: Briefcase },
    { href: '/admin/applications', label: 'Job applications', icon: FileText },
    { href: '/admin/companies', label: 'Companies', icon: Building2, keywords: 'employers' },
  ] },
  { id: 'content', label: 'Content', icon: PenSquare, items: [
    { href: '/admin/articles', label: 'News & guides', icon: Newspaper, keywords: 'blog articles' },
    { href: '/admin/newsletter', label: 'Newsletter', icon: Mail, keywords: 'email' },
    { href: '/admin/promotions', label: 'Sponsored', icon: Rocket, keywords: 'ads promotions' },
  ] },
  { id: 'moderation', label: 'Community & moderation', icon: ShieldCheck, items: [
    { href: '/admin/feed', label: 'Posts, shots & reports', icon: Rss, badge: 'reports', keywords: 'community posts shots flagged' },
    { href: '/admin/community', label: 'Community', icon: UsersRound },
    { href: '/admin/reviews', label: 'College reviews', icon: Star, badge: 'reviews' },
    { href: '/admin/qa', label: 'Q&A', icon: MessagesSquare, badge: 'questions', keywords: 'questions answers' },
    { href: '/admin/verifications', label: 'Verifications', icon: BadgeCheck, badge: 'verify', keywords: 'blue tick selfie' },
    { href: '/admin/messages', label: 'Contact & grievances', icon: Inbox, badge: 'contact', keywords: 'complaints support' },
    { href: '/admin/reports', label: 'Reports (old)', icon: Flag },
  ] },
  { id: 'growth', label: 'Growth', icon: Sparkles, items: [
    { href: '/admin/rewards', label: 'Rewards', icon: Gift },
    { href: '/admin/ambassadors', label: 'Ambassadors', icon: Megaphone },
  ] },
  { id: 'settings', label: 'Data & settings', icon: Settings, items: [
    { href: '/admin/import', label: 'Import & APIs', icon: DatabaseZap, keywords: 'upload csv cricos leiden spreadsheet' },
    { href: '/admin/users', label: 'Users & admins', icon: Users, keywords: 'roles block' },
  ] },
];

// pending work shown as red numbers — each is one cheap "count only" query
const PENDING: [string, string, string, string[]][] = [
  ['leads', 'leads', 'status', ['new']],
  ['capps', 'college_applications', 'status', ['submitted']],
  ['qapps', 'quota_applications', 'status', ['submitted']],
  ['reviews', 'reviews', 'status', ['pending']],
  ['hreviews', 'hostel_reviews', 'status', ['pending']],
  ['questions', 'questions', 'status', ['pending']],
  ['reports', 'content_reports', 'status', ['open']],
  ['verify', 'identity_verifications', 'status', ['pending', 'review']],
  ['contact', 'contact_messages', 'status', ['open']],
  ['examdates', 'exam_dates', 'review_status', ['pending']],
  ['fees', 'fee_findings', 'review_status', ['pending']],
];

const isActive = (href: string, path: string) => (href === '/admin' ? path === '/admin' : path === href || path.startsWith(`${href}/`));
const store = { get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } } };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { loading, isAdmin, profile } = useAuth();
  const pathname = usePathname() || '/admin';
  const [q, setQ] = useState('');
  const [mini, setMini] = useState(false);                 // desktop: icons only
  const [drawer, setDrawer] = useState(false);             // phone: menu open
  const [closed, setClosed] = useState<string[]>([]);      // collapsed groups
  const [counts, setCounts] = useState<Record<string, number>>({});
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setMini(store.get('admin.mini') === '1'); setClosed(JSON.parse(store.get('admin.closed') || '[]')); }, []);
  useEffect(() => { setDrawer(false); }, [pathname]);
  useEffect(() => {   // "/" or Ctrl+K jumps to the menu search
    const k = (e: KeyboardEvent) => {
      const typing = (e.target as Element)?.closest?.('input, textarea, select, [contenteditable="true"]');
      if ((e.key === '/' && !typing) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) {
        e.preventDefault(); setMini(false); setDrawer(true); setTimeout(() => searchRef.current?.focus(), 50);
      }
    };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, []);
  useEffect(() => {
    if (!isAdmin) return;
    const sb = supabaseBrowser();
    const load = async () => {
      const out: Record<string, number> = {};
      await Promise.all(PENDING.map(async ([key, table, col, vals]) => {
        const { count, error } = await sb.from(table).select('*', { count: 'exact', head: true }).in(col, vals);
        if (!error && count) out[key] = count;
      }));
      setCounts(out);
    };
    load(); const t = setInterval(load, 60000); return () => clearInterval(t);
  }, [isAdmin, pathname]);

  const groups = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return GROUPS;
    return GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => `${i.label} ${g.label} ${i.keywords || ''}`.toLowerCase().includes(s)) })).filter((g) => g.items.length);
  }, [q]);
  const current = useMemo(() => {
    for (const g of GROUPS) for (const i of g.items) if (isActive(i.href, pathname)) return { g, i };
    return null;
  }, [pathname]);
  const todo = Object.values(counts).reduce((a, b) => a + b, 0);

  if (loading) return <div className="container-x py-10"><div className="card h-96 animate-pulse" /></div>;
  if (!isAdmin) {
    return (
      <div className="container-x py-20">
        <div className="card mx-auto max-w-md p-8 text-center">
          <ShieldAlert className="mx-auto text-rose-500" size={40} />
          <h1 className="mt-3 text-xl font-bold">Admins only</h1>
          <p className="mt-2 text-sm text-slate-500">Your account does not have admin access. A super admin can grant it from Users & admins.</p>
          <Link href="/" className="btn-primary mt-5">Back to home</Link>
        </div>
      </div>
    );
  }

  const toggleGroup = (id: string) => { const next = closed.includes(id) ? closed.filter((x) => x !== id) : [...closed, id]; setClosed(next); store.set('admin.closed', JSON.stringify(next)); };
  const toggleMini = () => { setMini(!mini); store.set('admin.mini', mini ? '0' : '1'); };
  const Badge = ({ n, dot }: { n?: number; dot?: boolean }) => (n ? (dot
    ? <span className="absolute end-1 top-1 h-2 w-2 rounded-full bg-rose-500" />
    : <span className="ms-auto rounded-full bg-rose-500 px-1.5 text-[10px] font-bold leading-4 text-white">{n > 99 ? '99+' : n}</span>) : null);

  const nav = (compact: boolean) => (
    <nav className="space-y-1">
      {groups.map((g) => {
        const open = !!q || !closed.includes(g.id) || g.items.some((i) => isActive(i.href, pathname));
        const groupCount = g.items.reduce((a, i) => a + (i.badge ? counts[i.badge] || 0 : 0), 0);
        if (compact) return (
          <div key={g.id} className="space-y-0.5 border-b border-slate-100 pb-1 last:border-0">
            {g.items.map((i) => (
              <Link key={i.href} href={i.href} title={i.label} aria-label={i.label}
                className={`relative flex h-9 w-9 items-center justify-center rounded-lg ${isActive(i.href, pathname) ? 'bg-brand-600 text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}>
                <i.icon size={17} /><Badge n={i.badge ? counts[i.badge] : 0} dot />
              </Link>))}
          </div>);
        return (
          <div key={g.id}>
            <button type="button" onClick={() => toggleGroup(g.id)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400 hover:text-slate-600">
              <g.icon size={13} />{g.label}
              {!open && groupCount > 0 && <span className="rounded-full bg-rose-500 px-1.5 text-[10px] leading-4 text-white">{groupCount}</span>}
              <ChevronDown size={13} className={`ms-auto transition ${open ? '' : '-rotate-90'}`} />
            </button>
            {open && <div className="mb-1 space-y-0.5">{g.items.map((i) => {
              const on = isActive(i.href, pathname);
              return (
                <Link key={i.href} href={i.href} aria-current={on ? 'page' : undefined}
                  className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm ${on ? 'bg-brand-600 font-semibold text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}>
                  <i.icon size={16} className={on ? '' : 'text-slate-400'} /><span className="truncate">{i.label}</span><Badge n={i.badge ? counts[i.badge] : 0} />
                </Link>);
            })}</div>}
          </div>);
      })}
      {groups.length === 0 && <p className="px-2 py-4 text-sm text-slate-400">No page matches “{q}”.</p>}
    </nav>
  );

  const searchBox = (
    <div className="relative">
      <Search size={14} className="absolute start-2.5 top-2.5 text-slate-400" />
      <input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a page…  ( / )"
        onKeyDown={(e) => { if (e.key === 'Enter' && groups[0]?.items[0]) { location.assign(groups[0].items[0].href); setQ(''); } if (e.key === 'Escape') setQ(''); }}
        className="input py-2 ps-8 text-sm" aria-label="Find an admin page" />
    </div>
  );

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50/60">
      {/* phone: top bar with menu button */}
      <div className="sticky top-16 z-30 flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-2 lg:hidden">
        <button onClick={() => setDrawer(true)} className="relative rounded-lg p-1.5 hover:bg-slate-100" aria-label="Open admin menu"><Menu size={20} />{todo > 0 && <span className="absolute end-0 top-0 h-2.5 w-2.5 rounded-full bg-rose-500" />}</button>
        <p className="min-w-0 flex-1 truncate text-sm"><span className="text-slate-400">{current?.g.label || 'Admin'} › </span><b>{current?.i.label || 'Admin'}</b></p>
      </div>
      {drawer && (
        <div className="fixed inset-0 z-[55] lg:hidden" onClick={() => setDrawer(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <aside className="absolute inset-y-0 start-0 flex w-72 max-w-[85vw] flex-col bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 p-3">
              <p className="font-bold text-slate-900">Admin <span className="text-xs font-normal text-slate-400">· {profile?.role === 'super_admin' ? 'super admin' : 'admin'}</span></p>
              <button onClick={() => setDrawer(false)} aria-label="Close menu"><X size={18} /></button>
            </div>
            <div className="p-3">{searchBox}</div>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-6">{nav(false)}</div>
          </aside>
        </div>)}

      <div className={`mx-auto grid max-w-[1500px] gap-6 px-4 py-6 lg:px-6 ${mini ? 'lg:grid-cols-[60px_1fr]' : 'lg:grid-cols-[250px_1fr]'}`}>
        {/* desktop sidebar: its own scroll, stays in view */}
        <aside className="hidden lg:block">
          <div className="sticky top-20 flex max-h-[calc(100vh-6rem)] flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className={`flex items-center border-b border-slate-100 p-3 ${mini ? 'justify-center' : 'justify-between'}`}>
              {!mini && <div><p className="font-bold text-slate-900">Admin panel</p><p className="text-[11px] text-slate-400">{profile?.role === 'super_admin' ? 'Super admin' : 'Admin'}{todo > 0 ? ` · ${todo} waiting` : ' · all clear'}</p></div>}
              <button onClick={toggleMini} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title={mini ? 'Show menu' : 'Hide labels'} aria-label={mini ? 'Expand menu' : 'Collapse menu'}>{mini ? <ChevronsRight size={17} /> : <ChevronsLeft size={17} />}</button>
            </div>
            {!mini && <div className="p-3 pb-1">{searchBox}</div>}
            <div className={`min-h-0 flex-1 overflow-y-auto ${mini ? 'flex flex-col items-center p-2' : 'p-3'}`}>{nav(mini)}</div>
            <Link href="/" className={`flex items-center gap-2 border-t border-slate-100 p-3 text-xs text-slate-500 hover:text-brand-700 ${mini ? 'justify-center' : ''}`} title="View website"><ExternalLink size={14} />{!mini && 'View website'}</Link>
          </div>
        </aside>

        <section className="min-w-0">
          <div className="mb-4 hidden items-center justify-between gap-3 lg:flex">
            <p className="text-sm text-slate-500"><Link href="/admin" className="hover:text-slate-800">Admin</Link>{current && current.i.href !== '/admin' && <> <span className="text-slate-300">›</span> {current.g.label} <span className="text-slate-300">›</span> <b className="text-slate-800">{current.i.label}</b></>}</p>
            {todo > 0 && (
              <div className="flex flex-wrap justify-end gap-1.5 text-xs">
                {GROUPS.flatMap((g) => g.items).filter((i) => i.badge && counts[i.badge]).map((i) => (
                  <Link key={i.href} href={i.href} className="rounded-full bg-rose-50 px-2.5 py-1 font-semibold text-rose-700 hover:bg-rose-100">{counts[i.badge!]} {i.label.toLowerCase()}</Link>))}
              </div>)}
          </div>
          {children}
        </section>
      </div>
    </div>
  );
}
