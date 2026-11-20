import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/components/AuthProvider';
import { LangProvider } from '@/components/LangProvider';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import VisitTracker from '@/components/VisitTracker';
import ChatWidget from '@/components/ChatWidget';
import PwaRegister from '@/components/PwaRegister';
import { ListTray } from '@/components/ActionButtons';
import { SITE_URL } from '@/lib/format';
import { getT } from '@/lib/i18n-server';
import { RTL } from '@/lib/i18n';
import HrefLang from '@/components/HrefLang';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'StudyEarnstay — Colleges, PG & Hostels, Part-time Jobs for Students', template: '%s | StudyEarnstay' },
  description:
    'Search colleges worldwide with courses, fees, placements and real student reviews. Predict colleges from your rank, find PG and hostels near campus and apply for part-time jobs — StudyEarnstay.com',
  keywords: ['colleges', 'universities', 'college fees', 'college predictor', 'compare colleges', 'PG near college', 'student hostel', 'part-time jobs for students', 'study abroad'],
  openGraph: { siteName: 'StudyEarnstay', type: 'website', url: SITE_URL },
  appleWebApp: { capable: true, title: 'StudyEarnstay', statusBarStyle: 'default' },
};

export const viewport: Viewport = { themeColor: '#4338ca' };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { lang, dict } = await getT();
  return (
    <html lang={lang} dir={RTL.has(lang) ? 'rtl' : 'ltr'}>
      <body className="flex min-h-screen flex-col">
        <HrefLang />
        <LangProvider lang={lang} dict={dict}>
          <AuthProvider>
            <Header />
            <VisitTracker />
            <PwaRegister />
            <main className="flex-1">{children}</main>
            <Footer />
            <ListTray />
            <ChatWidget />
          </AuthProvider>
        </LangProvider>
      </body>
    </html>
  );
}
