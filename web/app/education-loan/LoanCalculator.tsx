'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const lakh = (n: number) => (n >= 1e7 ? `₹${(n / 1e7).toFixed(2)} Cr` : n >= 1e5 ? `₹${(n / 1e5).toFixed(2)} L` : inr(n));

function Field({ label, value, set, min, max, step, show }: { label: string; value: number; set: (v: number) => void; min: number; max: number; step: number; show: string }) {
  return (
    <label className="block">
      <span className="flex justify-between text-sm font-medium text-slate-700">{label}<b className="text-brand-700">{show}</b></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => set(Number(e.target.value))} className="mt-1 w-full accent-brand-600" />
      <input type="number" min={min} max={max} step={step} value={value} onChange={(e) => set(Math.min(max, Math.max(min, Number(e.target.value) || 0)))} className="input mt-1 py-1.5 text-sm" />
    </label>
  );
}

export default function LoanCalculator() {
  const [amount, setAmount] = useState(1000000);
  const [rate, setRate] = useState(10);
  const [years, setYears] = useState(7);
  const [study, setStudy] = useState(24);     // months of course + grace
  const [payInterest, setPayInterest] = useState(false);

  const r = useMemo(() => {
    const m = rate / 1200;
    const studyInterest = amount * m * study;                          // simple interest while studying (how most Indian banks charge)
    const principal = payInterest ? amount : amount + studyInterest;   // unpaid interest is added to the loan when repayment starts
    const n = years * 12;
    const emi = m === 0 ? principal / n : (principal * m * Math.pow(1 + m, n)) / (Math.pow(1 + m, n) - 1);
    const rows: { year: number; interest: number; principal: number; balance: number }[] = [];
    let bal = principal;
    for (let y = 1; y <= years; y++) {
      let i = 0, p = 0;
      for (let k = 0; k < 12; k++) { const int = bal * m; const pr = Math.min(emi - int, bal); i += int; p += pr; bal -= pr; }
      rows.push({ year: y, interest: i, principal: p, balance: Math.max(bal, 0) });
    }
    const repayInterest = emi * n - principal;
    const totalInterest = repayInterest + studyInterest;
    return { emi, studyInterest, monthlyStudyInterest: amount * m, principal, totalInterest, total: amount + totalInterest, rows };
  }, [amount, rate, years, study, payInterest]);

  const share = r.total > 0 ? (amount / r.total) * 100 : 100;
  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.1fr]">
      <div className="card space-y-5 p-6">
        <Field label="Loan amount" value={amount} set={setAmount} min={50000} max={15000000} step={50000} show={lakh(amount)} />
        <Field label="Interest rate (per year)" value={rate} set={setRate} min={5} max={18} step={0.05} show={`${rate}%`} />
        <Field label="Repayment period" value={years} set={setYears} min={1} max={15} step={1} show={`${years} years`} />
        <Field label="Study + grace period (no EMI)" value={study} set={setStudy} min={0} max={72} step={1} show={`${study} months`} />
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand-600" checked={payInterest} onChange={(e) => setPayInterest(e.target.checked)} />
          <span>I’ll pay the interest every month while studying <span className="block text-xs text-slate-500">({inr(r.monthlyStudyInterest)}/month) — this keeps the loan from growing</span></span></label>
      </div>

      <div className="space-y-4">
        <div className="card bg-gradient-to-br from-brand-700 to-brand-500 p-6 text-white">
          <p className="text-sm text-brand-100">Monthly EMI after your studies</p>
          <p className="text-4xl font-extrabold">{inr(r.emi)}</p>
          <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
            <div><p className="text-brand-100">Interest while studying</p><b>{lakh(r.studyInterest)}</b>{payInterest && <span className="block text-[11px] text-brand-100">paid monthly</span>}</div>
            <div><p className="text-brand-100">Total interest</p><b>{lakh(r.totalInterest)}</b></div>
            <div><p className="text-brand-100">Total you pay</p><b>{lakh(r.total)}</b></div>
          </div>
          <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/20"><div className="h-full bg-white" style={{ width: `${share}%` }} /></div>
          <p className="mt-1 text-[11px] text-brand-100">White = the amount you borrowed ({share.toFixed(0)}%) · rest = interest</p>
        </div>
        {!payInterest && r.studyInterest > 0 && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">💡 If you pay just {inr(r.monthlyStudyInterest)} a month while studying, your EMI drops and you save interest on interest. Toggle the box to compare.</p>}
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="p-2 text-start">Year</th><th className="p-2 text-end">Principal paid</th><th className="p-2 text-end">Interest paid</th><th className="p-2 text-end">Left to pay</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{r.rows.map((x) => (
              <tr key={x.year}><td className="p-2">Year {x.year}</td><td className="p-2 text-end">{inr(x.principal)}</td><td className="p-2 text-end">{inr(x.interest)}</td><td className="p-2 text-end font-medium">{inr(x.balance)}</td></tr>))}</tbody>
          </table>
        </div>
      </div>

      <div className="space-y-2 text-sm text-slate-600 lg:col-span-2">
        <p><b>How it’s worked out:</b> while you study, interest is counted as simple interest on the amount borrowed (the common practice for Indian education loans); unpaid interest is added to the loan when EMIs start. Your bank’s numbers may differ slightly — e.g. if the loan is paid out in instalments, interest during study is lower than shown.</p>
        <p><b>Tax:</b> in India, the interest you pay on an education loan can be deducted under Section 80E for up to 8 years if you file under the old tax regime. Check with a tax advisor or <a href="https://www.incometax.gov.in" target="_blank" rel="noopener noreferrer" className="text-brand-700 underline">incometax.gov.in</a>.</p>
        <p>Planning to study abroad? Work out living and tuition costs with the <Link href="/study-abroad/calculator" className="text-brand-700 underline">study-abroad cost calculator</Link>, and look for <Link href="/scholarships" className="text-brand-700 underline">scholarships</Link> before borrowing.</p>
      </div>
    </div>
  );
}
