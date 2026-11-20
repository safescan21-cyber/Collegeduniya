import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/components/AuthProvider';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import VisitTracker from '@/components/VisitTracker';
import { SITE_URL } from '@/lib/format';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'StudyEarnstay — Colleges, PG & Hostels, Part-time Jobs for Students', template: '%s | StudyEarnstay' },
  description:
    'Search colleges worldwide with courses, fees and real student reviews. Find PG and hostels near campus and apply for part-time jobs — StudyEarnstay.com',
  keywords: ['colleges', 'universities', 'college fees', 'PG near college', 'student hostel', 'part-time jobs for students', 'study abroad'],
  openGraph: { siteName: 'StudyEarnstay', type: 'website', url: SITE_URL },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        <AuthProvider>
          <Header />
          <VisitTracker />
          <main className="flex-1">{children}</main>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}
