import type { Metadata } from 'next';
import Link from 'next/link';
import LegalPage from '@/components/legal/Page';
import { ORG } from '@/lib/org';

export const metadata: Metadata = {
  title: 'Community guidelines',
  description: 'How to post, review, comment and chat on Collegeolo — what is allowed, what gets removed, and how reporting works.',
  alternates: { canonical: '/community-guidelines' },
};

export default function Guidelines() {
  return (
    <LegalPage title="Community guidelines" updated={ORG.policyDate}>
      <p>Collegeolo works because students tell each other the truth about colleges, PGs and jobs. Keep it useful and safe:</p>
      <h2>Do</h2>
      <ul>
        <li>Write from your own experience — what the hostel food is actually like, how placements really went, which professor shares notes.</li>
        <li>Be specific. “Wi-Fi drops every evening in Block C” helps; “worst college ever” doesn’t.</li>
        <li>Criticise colleges, PGs and companies freely — but stick to facts and your own experience.</li>
        <li>Add the official link when you share exam dates, fees or rules.</li>
      </ul>
      <h2>Don’t</h2>
      <ul>
        <li>Harass, threaten, bully or stalk anyone, or keep messaging someone who hasn’t replied or has declined your request.</li>
        <li>Post someone else’s phone number, address, photos or private chats.</li>
        <li>Post nudity, sexual content, hate against any religion, caste, gender, region or community, or violence.</li>
        <li>Write fake reviews — for your own college, a rival, or because someone paid you.</li>
        <li>Advertise coaching, sell “guaranteed admission” or seats, ask for money, or post referral and pyramid schemes.</li>
        <li>Pretend to be someone else, or make an account in a different gender to get around the chat request rule.</li>
        <li>Post copied articles, other people’s photos or exam papers you don’t have the right to share.</li>
      </ul>
      <h2>Reporting and what happens next</h2>
      <ul>
        <li>Every post, comment, review and chat has a <strong>Report</strong> button. Reports are private.</li>
        <li>A post or comment reported by three different students is hidden until our team looks at it.</li>
        <li>Our team reviews reports, can remove content, remove a verified tick, and block accounts. Serious harassment is blocked first and reviewed after.</li>
        <li>You can block anyone from a chat; they can no longer message or call you.</li>
        <li>If you think we got it wrong, write to the <Link href="/contact#grievance">grievance officer</Link>.</li>
      </ul>
      <p>If you are in danger, call 112. For harassment of women, the women helpline is 181; cyber crime can be reported at <a href="https://cybercrime.gov.in" target="_blank" rel="noopener noreferrer">cybercrime.gov.in</a> or 1930.</p>
    </LegalPage>
  );
}
