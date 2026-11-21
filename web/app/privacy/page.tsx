import type { Metadata } from 'next';
import Link from 'next/link';
import LegalPage from '@/components/legal/Page';
import { ORG } from '@/lib/org';

export const metadata: Metadata = {
  title: 'Privacy policy',
  description: 'What personal data StudyEarnstay collects, why, who we share it with, how long we keep it, and how to see, correct or delete it.',
  alternates: { canonical: '/privacy' },
};

export default function Privacy() {
  return (
    <LegalPage title="Privacy policy" updated={ORG.policyDate}>
      <p>
        This policy explains what we collect when you use StudyEarnstay ({ORG.url.replace(/^https?:\/\//, '')}), why, and what you can do about it.
        “We” means {ORG.legalName || 'StudyEarnstay'}{ORG.address ? `, ${ORG.address}` : ''}. We wrote it in plain language; if something is unclear, <Link href="/contact?topic=privacy">ask us</Link>.
      </p>

      <h2>The short version</h2>
      <ul>
        <li>We collect what we need to run your account and the features you use — not more.</li>
        <li>We don’t sell your data. A college sees your enquiry only if you tick the box to share it.</li>
        <li>Your gender is never shown to anyone. Verification selfies are deleted once the check is done. Chats are deleted after 6 months.</li>
        <li>You can see, correct, download or delete your data, and withdraw a consent, at any time.</li>
      </ul>

      <h2>What we collect and why</h2>
      <h3>When you create an account</h3>
      <ul>
        <li>Email address or mobile number, to send you a one-time login code. No password is stored.</li>
        <li>Your name, and anything you choose to add to your profile: photo, username, city, course interest, education, the college you study in, passing-out year, a short bio, and your WhatsApp number if you want updates there.</li>
        <li><strong>Gender</strong> (optional). Used only for the chat safety rule (students must send a request before messaging a girl) and for verification. It is never shown on your profile, posts or anywhere else.</li>
      </ul>
      <h3>When you use the site</h3>
      <ul>
        <li><strong>Mock tests:</strong> your answers, time spent on each question, scores and ranks, so we can show results, analysis and leaderboards. Leaderboards show your first name and initial only if your profile is public, otherwise “Aspirant”.</li>
        <li><strong>Reviews, questions, answers, posts, comments, likes:</strong> what you write is public with your display name. Proof you upload for a verified review (college ID or fee receipt) is seen only by our team.</li>
        <li><strong>Applications and enquiries:</strong> the details and resume you send to an employer, PG owner or college.</li>
        <li><strong>Messages and calls:</strong> chat messages are stored so both people can read them, and deleted automatically after 6 months. For calls we keep only who called whom, when and for how long — the call itself goes directly between the two phones and is never recorded.</li>
        <li><strong>Verification selfies:</strong> two photos from your camera, checked by AI against your profile photo (and by our team if the AI is unsure). They are deleted as soon as a decision is made; we keep only the result.</li>
        <li><strong>Location:</strong> only when you ask for it (for example “near me”, or adding a place to a post). A location on a post is rounded to about 100 metres.</li>
        <li><strong>Login and visit records:</strong> when you log in, the type of device and approximate city (from your internet address, not GPS), so you can spot logins that weren’t you. Pages visited, to count visitors and fix problems. “Last seen” is shown to other students only if you allow it.</li>
        <li><strong>Payments</strong> (owners and employers only): handled by Razorpay. We never see or store your card or bank details.</li>
      </ul>
      <h3>Cookies</h3>
      <p>We use a login cookie (to keep you signed in) and a language cookie (to remember your language). We do not use advertising or cross-site tracking cookies.</p>

      <h2>Who we share it with</h2>
      <ul>
        <li><strong>Other users</strong> see only what is public: your display name, username, verified tick, college, posts, reviews and comments. Girls’ profiles show only name, tick and college.</li>
        <li><strong>Colleges, PG owners and employers</strong> receive your enquiry or application when you send it to them, and partner colleges receive your counselling request only if you ticked the box to share it.</li>
        <li><strong>Service providers</strong> who run parts of the site for us, under contract and only for that purpose: Supabase (database, file storage and login), our hosting provider, AI providers that check questions, write explanations and check selfies (such as Google Gemini or Anthropic Claude — we send them only the content needed, never your contact details), email and WhatsApp/SMS providers for codes and notifications, Razorpay for payments, and a relay service for calls on some networks.</li>
        <li><strong>Authorities</strong>, when Indian law requires it.</li>
      </ul>
      <p>Some of these providers store data outside India. We use them only where Indian law allows it.</p>

      <h2>How long we keep it</h2>
      <ul>
        <li>Account and profile: until you delete your account (Dashboard → Profile → Delete my account). Deleting it also deletes your posts, reviews, comments, chats, applications and test history.</li>
        <li>Chat messages and call records: 6 months.</li>
        <li>Verification selfies: until the check is decided (usually seconds, at most a few days if our team has to look).</li>
        <li>Posts, reviews and answers: until you delete them, remove your account, or we remove them for breaking the rules.</li>
        <li>Some records may be kept longer when the law requires it — for example, information about removed content and accounts is kept for 180 days under the IT Rules, 2021.</li>
      </ul>

      <h2>Your rights</h2>
      <p>Under the Digital Personal Data Protection Act, 2023 you can:</p>
      <ul>
        <li>get a summary of the personal data we hold about you and who we shared it with;</li>
        <li>correct, complete or update it — most of it directly in your <Link href="/dashboard?tab=profile">dashboard</Link>;</li>
        <li>ask us to delete it, or withdraw any consent you gave (for example, sharing with colleges or WhatsApp updates) — withdrawing doesn’t affect what was done before;</li>
        <li>name someone to exercise these rights if you die or cannot do so yourself;</li>
        <li>complain to our grievance officer, and then to the Data Protection Board of India if you are not satisfied.</li>
      </ul>
      <p>Use the <Link href="/contact?topic=privacy">privacy request form</Link> or email <a href={`mailto:${ORG.grievanceEmail}`}>{ORG.grievanceEmail}</a>. We reply as soon as we can and always within 90 days.</p>

      <h2>Children</h2>
      <p>StudyEarnstay is for students. If you are under 18, please use it with your parent’s or guardian’s permission. Chat and calls are meant for college students; if we learn that an account belongs to a child using them without a parent’s consent, we will restrict it.</p>

      <h2>Security</h2>
      <p>Data is sent over encrypted connections, access to personal data inside our team is limited to people who need it, and every database table has rules about who can read it. If a breach affects your personal data, we will tell you and the Data Protection Board as the law requires.</p>

      <h2>Grievance officer</h2>
      <p>{ORG.grievanceOfficer ? <>{ORG.grievanceOfficer}, </> : null}<a href={`mailto:${ORG.grievanceEmail}`}>{ORG.grievanceEmail}</a>{ORG.address ? `, ${ORG.address}` : ''}. More on the <Link href="/contact#grievance">contact page</Link>.</p>

      <h2>Changes</h2>
      <p>If we change this policy in a way that matters, we will tell logged-in users on the site and update the date at the top.</p>
    </LegalPage>
  );
}
