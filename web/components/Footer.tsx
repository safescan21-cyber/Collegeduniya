import Link from 'next/link';
import { ORG } from '@/lib/org';
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
          {ORG.founder && (
            <Link href="/founder" className="group mt-6 flex max-w-sm items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 transition hover:bg-white/10">
              {ORG.founderPhoto
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={ORG.founderPhoto} alt={ORG.founder} width={48} height={48} loading="lazy" className="h-12 w-12 shrink-0 rounded-full border-2 border-white/30 object-cover" />
                : <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand-600 font-bold text-white">{ORG.founder[0]}</span>}
              <span className="min-w-0">
                <span className="block text-xs text-brand-200/70">Founded by</span>
                <b className="block text-white group-hover:underline">{ORG.founder}</b>
                <span className="block text-xs italic text-brand-200/90">“No student should give up studying because of money.”</span>
              </span>
            </Link>)}
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
            <li><Link href="/study-abroad/usa" className="hover:text-white">Study in USA</Link></li>
            <li><Link href="/study-abroad/germany" className="hover:text-white">Study in Germany</Link></li>
            <li><Link href="/study-abroad/japan" className="hover:text-white">Study in Japan</Link></li>
            <li><Link href="/study-material" className="hover:text-white">Free study material</Link></li>
            <li><Link href="/link-to-us" className="hover:text-white">Link to us</Link></li>
            <li><Link href="/study-abroad/uk" className="hover:text-white">Study in UK</Link></li>
            <li><Link href="/near-me" className="hover:text-white">{t('nav.nearMe')}</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-5 text-center text-xs text-brand-200/60">
        <nav className="mb-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm text-brand-100/80">
          <Link href="/about" className="hover:text-white">About us</Link>
          <Link href="/founder" className="hover:text-white">Founder</Link>
          <Link href="/editorial-policy" className="hover:text-white">How we work</Link>
          <Link href="/trust" className="hover:text-white">Why trust us</Link>
          <Link href="/community-guidelines" className="hover:text-white">Community guidelines</Link>
          <Link href="/privacy" className="hover:text-white">Privacy</Link>
          <Link href="/terms" className="hover:text-white">Terms</Link>
          <Link href="/contact" className="hover:text-white">Contact</Link>
          <Link href="/contact#grievance" className="hover:text-white">Grievance officer</Link>
        </nav>
        © {new Date().getFullYear()} {ORG.legalName || 'Collegeolo.com'} — Study • Earn • Stay · <a href={`mailto:${ORG.email}`} className="hover:text-white">{ORG.email}</a>
        <p className="mt-2">Cities: <a href="https://www.geonames.org" className="underline" target="_blank" rel="noopener noreferrer">GeoNames</a> · Maps & places: <a href="https://www.openstreetmap.org/copyright" className="underline" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a> · University data: Hipolabs, Wikidata · <a href="https://db-ip.com" className="underline" target="_blank" rel="noopener noreferrer">IP Geolocation by DB-IP</a></p>
      </div>
    </footer>
  );
}
