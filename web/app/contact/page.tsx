import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from 'next/link';
import LegalPage from '@/components/legal/Page';
import ContactForm from './ContactForm';
import { ORG } from '@/lib/org';

export const metadata: Metadata = {
  title: 'Contact us',
  description: 'Write to StudyEarnstay — questions, corrections to college information, privacy requests and complaints (grievance officer).',
  alternates: { canonical: '/contact' },
};

export default function Contact() {
  return (
    <LegalPage title="Contact us">
      <p>We read every message. For admissions help, the quickest route is <Link href="/counselling">free counselling</Link>. For anything else, write below or email <a href={`mailto:${ORG.email}`}>{ORG.email}</a>{ORG.phone ? <> or call <a href={`tel:${ORG.phone.replace(/\s/g, '')}`}>{ORG.phone}</a></> : null}.</p>
      <Suspense fallback={<div className="card h-96 animate-pulse" />}><ContactForm /></Suspense>

      <h2 id="grievance">Grievance officer</h2>
      <p>Under the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021 and the Digital Personal Data Protection Act, 2023, you can raise a complaint about content on this site or about how we handle your personal data with our grievance officer:</p>
      <ul>
        <li>Name: {ORG.grievanceOfficer || <span className="text-amber-700">to be announced</span>}</li>
        <li>Email: <a href={`mailto:${ORG.grievanceEmail}`}>{ORG.grievanceEmail}</a> (or choose “Complaint / grievance” in the form above)</li>
        {ORG.address && <li>Address: {ORG.address}</li>}
      </ul>
      <p>We acknowledge complaints within 24 hours and resolve them within 15 days. Complaints about content showing someone’s private areas, nudity or sexual acts, or impersonating someone in such content, are acted on within 24 hours. Please include a link to the page or post and, if it is about your personal data, the email or phone number on your account.</p>

      <h2>Privacy requests</h2>
      <p>To see, correct or delete the personal data we hold about you, or to withdraw a consent you gave, choose “Privacy request” above. You can delete most things yourself from your <Link href="/dashboard?tab=profile">dashboard</Link>. Details are in our <Link href="/privacy">privacy policy</Link>.</p>
    </LegalPage>
  );
}
