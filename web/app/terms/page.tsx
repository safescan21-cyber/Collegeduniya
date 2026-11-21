import type { Metadata } from 'next';
import Link from 'next/link';
import LegalPage from '@/components/legal/Page';
import { ORG } from '@/lib/org';

export const metadata: Metadata = {
  title: 'Terms of use',
  description: 'The rules for using StudyEarnstay — accounts, what you post, listings, mock tests, payments and our responsibility.',
  alternates: { canonical: '/terms' },
};

export default function Terms() {
  return (
    <LegalPage title="Terms of use" updated={ORG.policyDate}>
      <p>By using StudyEarnstay you agree to these terms, our <Link href="/privacy">privacy policy</Link> and our <Link href="/community-guidelines">community guidelines</Link>. The site is run by {ORG.legalName || 'StudyEarnstay'}{ORG.address ? `, ${ORG.address}` : ''}.</p>

      <h2>1. Your account</h2>
      <ul>
        <li>Use your real name and your own email or phone number. One account per person.</li>
        <li>You are responsible for what happens on your account. Tell us at once if you think someone else is using it.</li>
        <li>If you are under 18, use the site with a parent’s or guardian’s permission.</li>
      </ul>

      <h2>2. What you post</h2>
      <ul>
        <li>You keep ownership of your reviews, posts, photos and answers. You give us permission to show them on StudyEarnstay and in our search results and social media previews, for as long as they are on the site.</li>
        <li>Post only what is true to your experience and what you have the right to share. Don’t post other people’s photos or personal details without their permission.</li>
        <li>We may remove anything that breaks these terms or the <Link href="/community-guidelines">community guidelines</Link>, and suspend or block accounts that do so.</li>
      </ul>

      <h2>3. College, exam and listing information</h2>
      <ul>
        <li>We collect information from official and public sources (see <Link href="/editorial-policy">how we work</Link>), but colleges and exam bodies change fees, seats, dates and rules. <strong>Always confirm on the official website before you pay or apply.</strong></li>
        <li>Cutoffs, ranks and the college predictor show past results; they are not a promise of admission.</li>
        <li>PGs, hostels and jobs are posted by their owners and employers. We check listings, but we are not a party to your agreement with them. Never pay a deposit before visiting a PG, and never pay anyone to get a job.</li>
      </ul>

      <h2>4. Mock tests</h2>
      <p>Mock tests are for practice. The questions are original practice questions, not official papers, and your score, rank and percentile on StudyEarnstay do not predict your result in the real exam.</p>

      <h2>5. Messages and calls</h2>
      <p>Chat and calls are for students of the same college. Requests to message a girl must be accepted before a chat starts. Harassment, threats, asking for money or sharing someone’s messages or photos without permission will get your account blocked. Messages are deleted after 6 months.</p>

      <h2>6. Payments</h2>
      <p>Owners and employers can pay for sponsored listings. Prices are shown before you pay, payments are processed by Razorpay, and a sponsored period that has started is not refundable unless we remove your listing by mistake.</p>

      <h2>7. Things you must not do</h2>
      <ul>
        <li>Scrape, copy or resell the site’s data in bulk, or use bots to post, apply or message.</li>
        <li>Try to get around the chat request rule, verification or blocks, or create fake accounts.</li>
        <li>Upload viruses, attack the site, or try to access other people’s data.</li>
      </ul>

      <h2>8. Our responsibility</h2>
      <p>We work hard to keep the site accurate and running, but we provide it “as is”. As far as the law allows, we are not responsible for decisions you make from information on the site, or for anything that happens between you and a college, PG owner, employer or another student. Nothing in these terms limits rights you have under Indian consumer law.</p>

      <h2>9. Complaints and the law</h2>
      <p>Write to our <Link href="/contact#grievance">grievance officer</Link> first; most problems get fixed quickly. These terms are governed by the laws of India{ORG.city ? `, and the courts at ${ORG.city} have jurisdiction` : ''}.</p>

      <h2>10. Changes</h2>
      <p>We may update these terms. If a change matters, we will tell logged-in users on the site and update the date at the top. Using the site after that means you accept the new terms.</p>
    </LegalPage>
  );
}
