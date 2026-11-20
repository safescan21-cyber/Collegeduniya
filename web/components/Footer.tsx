import Link from 'next/link';
import { Logo } from './Header';

export default function Footer() {
  return (
    <footer className="mt-20 bg-brand-950 text-brand-200">
      <div className="container-x grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Logo light />
          <p className="mt-4 text-sm leading-relaxed text-brand-200/80">
            Find colleges worldwide, a PG or hostel next to campus, and part-time jobs to support your studies — all in one place.
          </p>
        </div>
        <div>
          <h4 className="mb-3 font-semibold text-white">Explore</h4>
          <ul className="space-y-2 text-sm">
            <li><Link href="/colleges" className="hover:text-white">All colleges</Link></li>
            <li><Link href="/colleges?country=India" className="hover:text-white">Colleges in India</Link></li>
            <li><Link href="/colleges?level=PG" className="hover:text-white">Study abroad (PG)</Link></li>
            <li><Link href="/near-me" className="hover:text-white">Colleges near me</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 font-semibold text-white">Students</h4>
          <ul className="space-y-2 text-sm">
            <li><Link href="/hostels" className="hover:text-white">PG & Hostels</Link></li>
            <li><Link href="/jobs" className="hover:text-white">Part-time jobs</Link></li>
            <li><Link href="/jobs?type=Internship" className="hover:text-white">Internships</Link></li>
            <li><Link href="/dashboard" className="hover:text-white">My applications</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 font-semibold text-white">StudyEarnstay</h4>
          <ul className="space-y-2 text-sm">
            <li><Link href="/login?mode=register" className="hover:text-white">Create account</Link></li>
            <li><a href="mailto:hello@studyearnstay.com" className="hover:text-white">hello@studyearnstay.com</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-5 text-center text-xs text-brand-200/60">
        © {new Date().getFullYear()} StudyEarnstay.com — Study • Earn • Stay
      </div>
    </footer>
  );
}
