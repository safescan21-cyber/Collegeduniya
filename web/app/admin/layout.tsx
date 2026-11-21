'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, GraduationCap, Home, Briefcase, Star, FileText, Users, ShieldAlert, PhoneCall, FilePlus2, MessagesSquare, Newspaper, BookOpen, Mail, MessageSquareHeart, Building2, DatabaseZap, Armchair, ClipboardList, ChartColumn, Trophy, Award, Plane, Handshake, Rocket, CreditCard, Flag, UsersRound, CalendarCheck, FileStack, Gift, Megaphone, ClipboardCheck, Radio, BadgeCheck, Rss } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: BarChart3 },
  { href: '/admin/online', label: 'Online now', icon: Radio },
  { href: '/admin/leads', label: 'Leads', icon: PhoneCall },
  { href: '/admin/college-applications', label: 'College apps', icon: FilePlus2 },
  { href: '/admin/quota-applications', label: 'Quota applications', icon: ClipboardList },
  { href: '/admin/colleges', label: 'Colleges', icon: GraduationCap },
  { href: '/admin/management-quota', label: 'Management quota', icon: Armchair },
  { href: '/admin/hostels', label: 'PG & Hostels', icon: Home },
  { href: '/admin/jobs', label: 'Jobs', icon: Briefcase },
  { href: '/admin/applications', label: 'Job applications', icon: FileText },
  { href: '/admin/reviews', label: 'College reviews', icon: Star },
  { href: '/admin/hostel-reviews', label: 'PG reviews', icon: MessageSquareHeart },
  { href: '/admin/qa', label: 'Q&A', icon: MessagesSquare },
  { href: '/admin/articles', label: 'News & guides', icon: Newspaper },
  { href: '/admin/exams', label: 'Exams', icon: BookOpen },
  { href: '/admin/exam-library', label: 'Exam library', icon: FileStack },
  { href: '/admin/mock-tests', label: 'Mock tests', icon: ClipboardCheck, Radio },
  { href: '/admin/newsletter', label: 'Newsletter', icon: Mail },
  { href: '/admin/companies', label: 'Companies', icon: Building2 },
  { href: '/admin/pg-visits', label: 'PG visits', icon: CalendarCheck },
  { href: '/admin/community', label: 'Community', icon: UsersRound },
  { href: '/admin/feed', label: 'Posts & reports', icon: Rss },
  { href: '/admin/verifications', label: 'Verifications', icon: BadgeCheck },
  { href: '/admin/reports', label: 'Reports (old)', icon: Flag },
  { href: '/admin/rankings', label: 'Rankings (NIRF)', icon: Trophy },
  { href: '/admin/rank-bands', label: 'Marks → rank', icon: ChartColumn },
  { href: '/admin/scholarships', label: 'Scholarships', icon: Award },
  { href: '/admin/visa-guides', label: 'Visa guides', icon: Plane },
  { href: '/admin/partners', label: 'Lead partners', icon: Handshake },
  { href: '/admin/promotions', label: 'Sponsored', icon: Rocket },
  { href: '/admin/payments', label: 'Payments', icon: CreditCard },
  { href: '/admin/rewards', label: 'Rewards', icon: Gift },
  { href: '/admin/ambassadors', label: 'Ambassadors', icon: Megaphone },
  { href: '/admin/import', label: 'Import & APIs', icon: DatabaseZap },
  { href: '/admin/users', label: 'Users & Admins', icon: Users },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { loading, isAdmin, profile } = useAuth();
  const pathname = usePathname();

  if (loading) return <div className="container-x py-10"><div className="card h-96 animate-pulse" /></div>;
  if (!isAdmin) {
    return (
      <div className="container-x py-20">
        <div className="card mx-auto max-w-md p-8 text-center">
          <ShieldAlert className="mx-auto text-rose-500" size={40} />
          <h1 className="mt-3 text-xl font-bold">Admins only</h1>
          <p className="mt-2 text-sm text-slate-500">Your account does not have admin access. A super admin can grant it from Users & Admins.</p>
          <Link href="/" className="btn-primary mt-5">Back to home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container-x grid gap-6 py-8 lg:grid-cols-[220px_1fr]">
      <aside>
        <div className="card sticky top-20 p-3">
          <p className="px-3 pb-2 pt-1 text-xs font-semibold uppercase text-slate-400">{profile?.role === 'super_admin' ? 'Super admin' : 'Admin'}</p>
          <nav className="flex gap-1 overflow-x-auto lg:flex-col">
            {NAV.map((n) => {
              const active = n.href === '/admin' ? pathname === '/admin' : pathname.startsWith(n.href);
              return (
                <Link key={n.href} href={n.href}
                  className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium ${active ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                  <n.icon size={16} />{n.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>
      <section className="min-w-0">{children}</section>
    </div>
  );
}
