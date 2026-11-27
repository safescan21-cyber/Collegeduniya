import type { Metadata } from 'next';
import Link from 'next/link';
import LegalPage from '@/components/legal/Page';
import { ORG } from '@/lib/org';

export const metadata: Metadata = {
  title: 'About us',
  description: 'Who runs Collegeolo, how the site makes money, and where our college, PG and job information comes from.',
  alternates: { canonical: '/about' },
};

export default function About() {
  return (
    <LegalPage title="About Collegeolo">
      <p>
        Choosing a college is only half the problem. You also need somewhere to live near campus, and many of us need a part-time
        job to pay for it. Collegeolo puts those three things in one place: <strong>study</strong> (colleges, courses, fees,
        cutoffs, mock tests), <strong>earn</strong> (part-time jobs and internships near your college) and <strong>stay</strong> (PGs and hostels near campus).
      </p>

      <h2>Who runs it</h2>
      {ORG.founder ? (
        <p>
          Collegeolo is built and run by <Link href="/founder"><strong>{ORG.founder}</strong></Link>{ORG.founderRole ? ` (${ORG.founderRole})` : ''}
          {ORG.legalName ? <>, operated by <strong>{ORG.legalName}</strong></> : null}
          {ORG.city ? <>, from {ORG.city}</> : null}{ORG.started ? <>, since {ORG.started}</> : null}.
        </p>
      ) : (
        <p>Collegeolo is an independent website{ORG.legalName ? <> operated by <strong>{ORG.legalName}</strong></> : null}{ORG.city ? <>, run from {ORG.city}</> : null}. It is not owned by any college, coaching institute or exam body.</p>
      )}
      {ORG.founderLinkedin && <p><Link href="/founder">Meet the founder</Link> · <a href={ORG.founderLinkedin} target="_blank" rel="noopener noreferrer">{ORG.founder} on LinkedIn</a></p>}
      {ORG.founderNote && <blockquote className="border-s-4 border-brand-200 ps-4 italic text-slate-600">{ORG.founderNote}</blockquote>}
      <p>We are not linked to any government body, university or exam conducting authority. Always confirm dates, fees and seat details on the official website before you pay or apply.</p>

      <h2>What is free</h2>
      <p>Everything a student uses is free: searching colleges, the college predictor, mock tests, reviews, Q&amp;A, messages, applying to jobs and listing a room you want to share. We never charge students to apply through the site.</p>

      <h2>How we make money</h2>
      <ul>
        <li><strong>Sponsored listings.</strong> PG owners and employers can pay to show a listing at the top of search results for a while. These always carry a “Sponsored” label.</li>
        <li><strong>Partner colleges.</strong> Some colleges work with us on admissions. If you ask for counselling or apply to a partner college, your details go to that college <em>only if you tick the box</em> to share them. A college we feature on the home page is marked “Featured”, and that can include partner colleges.</li>
      </ul>
      <p>We do not sell your personal data. Money never changes a college’s rank, its rating or its reviews — ranks come from published rankings such as NIRF, and ratings only from student reviews. Read the <Link href="/privacy">privacy policy</Link> for the details.</p>

      <h2>Where our information comes from</h2>
      <p>
        College details come from official college websites and government sources (NIRF, AISHE), open datasets (Hipolabs, Wikidata, the U.S.
        College Scorecard for American colleges) and from the colleges themselves. Reviews and Q&amp;A are written by students. Each college page
        shows its sources and when it was last updated. Our <Link href="/editorial-policy">editorial policy</Link> explains how we check information,
        handle reviews, and where we use AI (for example, to help write practice questions) and where we never do.
      </p>

      <h2>Found a mistake?</h2>
      <p>Tell us on the <Link href="/contact?topic=correction">contact page</Link> or email <a href={`mailto:${ORG.email}`}>{ORG.email}</a>. We correct the page and change its “Last updated” date.</p>

      <h2>Contact</h2>
      <ul>
        <li>Email: <a href={`mailto:${ORG.email}`}>{ORG.email}</a></li>
        {ORG.phone && <li>Phone: <a href={`tel:${ORG.phone.replace(/\s/g, '')}`}>{ORG.phone}</a></li>}
        {ORG.address && <li>Address: {ORG.address}</li>}
        <li>Complaints and grievances: see the <Link href="/contact?topic=grievance">grievance officer</Link> details.</li>
      </ul>
    </LegalPage>
  );
}
