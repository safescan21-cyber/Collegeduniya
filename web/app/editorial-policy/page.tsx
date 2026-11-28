import type { Metadata } from 'next';
import Link from 'next/link';
import LegalPage from '@/components/legal/Page';
import { ORG } from '@/lib/org';

export const metadata: Metadata = {
  title: 'How we work — sources, reviews and AI',
  description: 'Where Collegeolo gets college data, how reviews and listings are checked, where we use AI and where we never do, and how to report a mistake.',
  alternates: { canonical: '/editorial-policy' },
};

export default function EditorialPolicy() {
  return (
    <LegalPage title="How we work" updated={ORG.policyDate}>
      <p>This page explains where the information on Collegeolo comes from, who checks it, and what to do when something is wrong. If anything here doesn’t match what you see on the site, please <Link href="/contact?topic=correction">tell us</Link>.</p>

      <h2>College information</h2>
      <ul>
        <li><strong>Basic details</strong> (name, city, type, website, year founded) come from open lists — the <a href="https://aishe.gov.in" target="_blank" rel="noopener noreferrer">AISHE</a> directory of the Government of India, Hipolabs’ world university list and <a href="https://www.wikidata.org" target="_blank" rel="noopener noreferrer">Wikidata</a> — and from colleges that send us their own details.</li>
        <li><strong>Ranks</strong> are copied from the published ranking (for India, <a href="https://www.nirfindia.org" target="_blank" rel="noopener noreferrer">NIRF</a>) with its year. We do not make our own ranks.</li>
        <li><strong>Cutoffs</strong> come from the official counselling results (for example JoSAA or state counselling), with the year and round shown.</li>
        <li><strong>Fees and placements</strong> come from the college’s own website, prospectus or placement report. The source is shown under the table.</li>
        <li><strong>Descriptions</strong> are either written by our team or the college, or taken from Wikipedia under its CC BY-SA licence — in that case the page says so and links to the article.</li>
      </ul>
      <p>Every college page shows a “Last updated” date. A page with very little information stays out of search engines until it has more; we would rather show you nothing than a page that only looks complete.</p>

      <h2>Reviews</h2>
      <ul>
        <li>Reviews are written by logged-in students. We do not write, buy or edit reviews to change what they say. We only remove phone numbers, abuse and other personal details, and the review is marked “edited by admin” when we do.</li>
        <li>A review gets the <strong>Verified</strong> badge when the student uploads proof that they studied there, such as a college ID or fee receipt. Only our team looks at the proof; it is never shown publicly.</li>
        <li>Students can earn a small reward for a genuine, detailed review. The reward is the same for a good or a bad review — it never depends on the rating.</li>
        <li>Colleges cannot remove a review they don’t like. If a review breaks our <Link href="/community-guidelines">community guidelines</Link>, anyone can report it and our team decides.</li>
      </ul>

      <h2>PGs, hostels and jobs</h2>
      <p>Owners and employers post their own listings. Our team checks each one before it goes live and removes listings that ask for money up front, are fake, or are reported by students. A listing that is paid to appear at the top is marked “Sponsored”.</p>

      <h2>Where we use AI — and where we don’t</h2>
      <p>We use AI to save time on work that a person then checks, never to make up facts.</p>
      <h3>We use AI for</h3>
      <ul>
        <li><strong>Practice questions in mock tests.</strong> An AI writes questions in the style of each exam. Every question is then solved again separately (by a different AI model when one is available); if the two answers disagree, the question is fixed or thrown away. Our team spot-checks questions, and any question reported by two students is taken down until it is reviewed. These are practice questions, not previous-year papers.</li>
        <li><strong>Explanations, hints and the study plan</strong> after a mock test. These are marked as AI and you can report a wrong one.</li>
        <li><strong>The “Ask Collegeolo” chat helper.</strong> It answers using information from this site and links to the pages it used.</li>
        <li><strong>Selfie verification</strong> for the verified tick. Unsure cases go to a person.</li>
        <li><strong>Translating menus and college descriptions</strong> into other Indian languages. The original English is always available.</li>
      </ul>
      <h3>We never use AI for</h3>
      <ul>
        <li>Ranks, cutoffs, fees, seat numbers, exam dates or placement figures.</li>
        <li>Student reviews, ratings, Q&amp;A answers or community posts.</li>
        <li>News and guides — these are written by a named person on our team.</li>
      </ul>

      <h2>News and guides</h2>
      <p>Every article shows who wrote it and when it was published or last updated. Our writers check exam dates and rules against the official notice and link to it. When the official body changes something, we update the article and its date.</p>

      <h2>Mistakes and corrections</h2>
      <p>Use the “Report a correction” link on any college page, the <Link href="/contact?topic=correction">contact form</Link>, or email <a href={`mailto:${ORG.email}`}>{ORG.email}</a>. Send a link to the official source if you have one. We fix the page and update its “Last updated” date. Colleges can also ask us to correct their own details.</p>

      <h2>Money and independence</h2>
      <p>How we earn money is explained on the <Link href="/about">About page</Link>. Payments never change a college’s rank, rating or reviews, and sponsored or featured items are always labelled.</p>
    </LegalPage>
  );
}
