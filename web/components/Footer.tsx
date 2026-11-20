import Link from 'next/link';
import { Logo } from './Header';
import NewsletterForm from './NewsletterForm';
import { getT } from '@/lib/i18n-server';

export default async function Footer() {
  const { t } = await getT();
  return (
    <footer className="mt-20 bg-brand-950 text-brand-200">
      <div className="border-b border-white/10">
        <div className="container-x grid items-center gap-6 py-10 lg:grid-cols-2">
          <div>
            <h3 className="text-xl font-bold text-white">{t('footer.newsletter')}</h3>
            <p className="mt-1 text-sm text-brand-200/80">{t('footer.newsletter.sub')}</p>
          </div>
          <NewsletterForm />
        </div>
      </div>
      <div className="container-x grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <Logo light />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-brand-200/80">{t('footer.about')}</p>
          <Link href="/counselling" className="btn-accent mt-5">{t('nav.counselling')}</Link>
        </div>
        <div>
          <h4 className="mb-3 font-semibold text-white">{t('footer.explore')}</h4>
          <ul className="space-y-2 text-sm">
            <li><Link href="/colleges" className="hover:text-white">{t('nav.colleges')}</Link></li>
            <li><Link href="/colleges?country=India" className="hover:text-white">Colleges in India</Link></li>
            <li><Link href="/exams" className="hover:text-white">{t('nav.exams')}</Link></li>
            <li><Link href="/news" className="hover:text-white">{t('nav.news')}</Link></li>
            <li><Link href="/questions" className="hover:text-white">{t('nav.qa')}</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 font-semibold text-white">{t('footer.students')}</h4>
          <ul className="space-y-2 text-sm">
            <li><Link href="/hostels" className="hover:text-white">{t('nav.hostels')}</Link></li>
            <li><Link href="/jobs" className="hover:text-white">{t('nav.jobs')}</Link></li>
            <li><Link href="/jobs?type=Internship" className="hover:text-white">Internships</Link></li>
            <li><Link href="/post" className="hover:text-white">{t('nav.post')}</Link></li>
            <li><Link href="/dashboard" className="hover:text-white">{t('auth.dashboard')}</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 font-semibold text-white">{t('footer.tools')}</h4>
          <ul className="space-y-2 text-sm">
            <li><Link href="/predictor" className="hover:text-white">{t('nav.predictor')}</Link></li>
            <li><Link href="/compare" className="hover:text-white">{t('nav.compare')}</Link></li>
            <li><Link href="/apply" className="hover:text-white">{t('nav.apply')}</Link></li>
            <li><Link href="/study-abroad/calculator" className="hover:text-white">{t('nav.calculator')}</Link></li>
            <li><Link href="/near-me" className="hover:text-white">{t('nav.nearMe')}</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-5 text-center text-xs text-brand-200/60">
        © {new Date().getFullYear()} StudyEarnstay.com — Study • Earn • Stay · <a href="mailto:hello@studyearnstay.com" className="hover:text-white">hello@studyearnstay.com</a>
      </div>
    </footer>
  );
}
