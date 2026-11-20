'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, GraduationCap, Home, Briefcase, Star, FileText, Users, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: BarChart3 },
  { href: '/admin/colleges', label: 'Colleges', icon: GraduationCap },
  { href: '/admin/hostels', label: 'PG & Hostels', icon: Home },
  { href: '/admin/jobs', label: 'Jobs', icon: Briefcase },
  { href: '/admin/applications', label: 'Applications', icon: FileText },
  { href: '/admin/reviews', label: 'Reviews', icon: Star },
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
