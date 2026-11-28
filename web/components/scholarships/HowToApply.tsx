import { ShieldAlert } from 'lucide-react';

// A plain guide to applying for scholarships in India (and abroad), shown on /scholarships and each scholarship page
export default function HowToApply({ compact = false }: { compact?: boolean }) {
  return (
    <section className="card p-5">
      <h2 className="text-lg font-bold text-slate-900">How to apply for a scholarship</h2>
      <ol className="mt-3 list-decimal space-y-2 ps-5 text-sm text-slate-700">
        <li><b>Check you are eligible</b> — course and year, marks, family income limit, category, state. Read the official notice fully.</li>
        <li><b>Keep these documents ready</b> (scanned, clear): Aadhaar, mark sheets of the last exam, income certificate, caste / category certificate if needed, bonafide certificate from your college, fee receipt, bank passbook (account in your name, linked to Aadhaar), passport-size photo.</li>
        <li><b>Apply on the official website only</b> — Central and most state scholarships are on the <a href="https://scholarships.gov.in" target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-700 underline">National Scholarship Portal</a>; others on the provider’s own site. Register with your own mobile number and email.</li>
        <li><b>Fill the form carefully</b> — name exactly as on your mark sheet and bank account; upload documents; submit before the last date and save the application number / PDF.</li>
        <li><b>Get it verified</b> — many scholarships need your college (institute nodal officer) to verify the application online. Tell your college office after you apply.</li>
        <li><b>Track it</b> — check the status on the portal; the money comes to your bank account (DBT). Press “Track” here to get reminders before deadlines.</li>
      </ol>
      {!compact && <p className="mt-3 text-sm text-slate-700"><b>Studying abroad?</b> Apply 8–12 months before the course starts; most need a statement of purpose, recommendation letters and an English test score (IELTS / TOEFL / PTE).</p>}
      <p className="mt-3 flex items-start gap-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-800"><ShieldAlert size={16} className="mt-0.5 shrink-0" />Real scholarships never ask you to pay a fee to an agent or to “release” the money. Never share your OTP or bank PIN.</p>
    </section>
  );
}
