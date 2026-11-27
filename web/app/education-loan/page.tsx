import type { Metadata } from 'next';
import LoanCalculator from './LoanCalculator';

export const metadata: Metadata = {
  title: 'Education loan EMI calculator — with study (moratorium) period',
  description: 'Work out your education loan EMI, total interest and year-by-year repayment, including interest that builds up while you study.',
  alternates: { canonical: '/education-loan' },
};

export default function EducationLoanPage() {
  return (
    <div className="container-x max-w-5xl py-10">
      <h1 className="text-3xl font-extrabold text-slate-900">Education loan EMI calculator</h1>
      <p className="mt-2 max-w-3xl text-slate-600">Most education loans give you a <b>moratorium</b> — you don’t repay while you study (plus a few months after), but interest keeps adding up. This calculator shows what that does to your EMI.</p>
      <LoanCalculator />
    </div>
  );
}
