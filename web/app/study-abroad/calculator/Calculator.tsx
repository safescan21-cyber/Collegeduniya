'use client';
import { useMemo, useState } from 'react';
import { Calculator as Calc, Info } from 'lucide-react';
import EnquiryForm from '@/components/EnquiryForm';

// All numbers are entered by the student. Presets only fill the currency code;
// they are not price data.
const CURRENCIES = ['USD', 'GBP', 'EUR', 'CAD', 'AUD', 'NZD', 'SGD', 'AED', 'INR'];

const fmt = (v: number, cur: string) => {
  if (!isFinite(v)) return '—';
  try { return new Intl.NumberFormat(cur === 'INR' ? 'en-IN' : 'en', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(v); }
  catch { return `${cur} ${Math.round(v).toLocaleString()}`; }
};

function Num({ label, value, onChange, suffix, help }: { label: string; value: string; onChange: (v: string) => void; suffix?: string; help?: string }) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="relative">
        <input className="input pr-14" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ''))} />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">{suffix}</span>}
      </div>
      {help && <p className="mt-1 text-xs text-slate-400">{help}</p>}
    </div>
  );
}

export default function Calculator() {
  const [cur, setCur] = useState('GBP');
  const [home, setHome] = useState('INR');
  const [v, setV] = useState({
    tuition: '', living: '', years: '1', oneTime: '', scholarship: '0', rate: '',
    loan: '', interest: '10', tenure: '7', grace: '6', salary: '', savingsPct: '30',
  });
  const set = (k: keyof typeof v) => (x: string) => setV({ ...v, [k]: x });
  const n = (s: string) => parseFloat(s) || 0;

  const r = useMemo(() => {
    const years = Math.max(n(v.years), 0.5);
    const foreign = n(v.tuition) * years + n(v.living) * years + n(v.oneTime) - n(v.scholarship);
    const fx = n(v.rate) || (cur === home ? 1 : 0);
    const homeTotal = foreign * fx;
    // Loan: simple interest accrues during study + grace months, then EMI on the grown principal
    const principal = n(v.loan);
    const annual = n(v.interest) / 100;
    const moratoriumYears = years + n(v.grace) / 12;
    const accrued = principal * annual * moratoriumYears;
    const p2 = principal + accrued;
    const months = Math.max(n(v.tenure) * 12, 1);
    const mr = annual / 12;
    const emi = principal ? (mr ? (p2 * mr * Math.pow(1 + mr, months)) / (Math.pow(1 + mr, months) - 1) : p2 / months) : 0;
    const totalRepay = emi * months;
    const annualSave = n(v.salary) * fx * (n(v.savingsPct) / 100);
    const ownMoney = Math.max(homeTotal - principal, 0);
    const payback = annualSave > 0 ? (ownMoney + totalRepay) / annualSave : Infinity;
    const parts = [
      { label: 'Tuition', value: n(v.tuition) * years * fx, color: 'bg-brand-600' },
      { label: 'Living', value: n(v.living) * years * fx, color: 'bg-accent-500' },
      { label: 'One-time', value: n(v.oneTime) * fx, color: 'bg-emerald-500' },
      { label: 'Loan interest', value: Math.max(totalRepay - principal, 0), color: 'bg-rose-500' },
    ];
    return { foreign, homeTotal, fx, accrued, emi, totalRepay, payback, parts, ownMoney };
  }, [v, cur, home]);

  const max = Math.max(1, ...r.parts.map((p) => p.value));
  const ready = n(v.tuition) > 0 && (r.fx > 0);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <div className="min-w-0">
        <h1 className="flex items-center gap-2 text-3xl font-extrabold text-slate-900"><Calc className="text-brand-600" />Study abroad cost & ROI calculator</h1>
        <p className="mt-1 text-slate-500">Enter figures from your offer letter and the university website. Nothing is stored.</p>

        <div className="card mt-6 grid gap-4 p-6 sm:grid-cols-3">
          <p className="font-semibold text-slate-900 sm:col-span-3">1. Course cost</p>
          <div><label className="label">University currency</label><select className="input" value={cur} onChange={(e) => setCur(e.target.value)}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></div>
          <div><label className="label">Your home currency</label><select className="input" value={home} onChange={(e) => setHome(e.target.value)}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></div>
          <Num label={`1 ${cur} = ? ${home}`} value={cur === home ? '1' : v.rate} onChange={set('rate')} help="Today’s exchange rate" />
          {cur !== home && <button type="button" className="text-xs font-semibold text-brand-700 underline" onClick={async () => {
            try { const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/fx?base=${cur}`).then((x) => x.json()); const rate = r?.data?.rates?.[home]; if (rate) setV((p) => ({ ...p, rate: String(Math.round(rate * 100) / 100) })); } catch { /* offline */ }
          }}>Use today’s rate</button>}
          <Num label="Tuition per year" value={v.tuition} onChange={set('tuition')} suffix={cur} />
          <Num label="Living cost per year" value={v.living} onChange={set('living')} suffix={cur} help="Rent, food, transport, insurance" />
          <Num label="Course length" value={v.years} onChange={set('years')} suffix="years" />
          <Num label="One-time costs" value={v.oneTime} onChange={set('oneTime')} suffix={cur} help="Visa, flights, deposit, test fees" />
          <Num label="Scholarship (total)" value={v.scholarship} onChange={set('scholarship')} suffix={cur} />

          <p className="pt-2 font-semibold text-slate-900 sm:col-span-3">2. Education loan (optional)</p>
          <Num label="Loan amount" value={v.loan} onChange={set('loan')} suffix={home} />
          <Num label="Interest rate" value={v.interest} onChange={set('interest')} suffix="% / yr" />
          <Num label="Repayment period" value={v.tenure} onChange={set('tenure')} suffix="years" />
          <Num label="Grace after course" value={v.grace} onChange={set('grace')} suffix="months" help="Interest keeps adding during study + grace" />

          <p className="pt-2 font-semibold text-slate-900 sm:col-span-3">3. After graduation</p>
          <Num label="Expected salary per year" value={v.salary} onChange={set('salary')} suffix={cur} />
          <Num label="Share you can save" value={v.savingsPct} onChange={set('savingsPct')} suffix="%" help="Used for payback time" />
        </div>
      </div>

      <aside className="space-y-5">
        <div className="card p-6 lg:sticky lg:top-24">
          <p className="text-xs uppercase text-slate-500">Total cost</p>
          <p className="text-3xl font-extrabold text-slate-900">{ready ? fmt(r.homeTotal, home) : '—'}</p>
          <p className="text-sm text-slate-500">{ready && cur !== home ? `${fmt(r.foreign, cur)} at 1 ${cur} = ${r.fx} ${home}` : 'Enter tuition and exchange rate'}</p>
          {ready && (
            <div className="mt-5 space-y-2">
              {r.parts.filter((p) => p.value > 0).map((p) => (
                <div key={p.label}>
                  <div className="flex justify-between text-xs text-slate-600"><span>{p.label}</span><span>{fmt(p.value, home)}</span></div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${p.color}`} style={{ width: `${(p.value / max) * 100}%` }} /></div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-100 pt-5 text-sm">
            <div><p className="text-xs text-slate-500">Loan EMI</p><p className="font-bold text-slate-900">{n(v.loan) ? fmt(r.emi, home) : '—'}<span className="text-xs font-normal text-slate-500">{n(v.loan) ? ' / month' : ''}</span></p></div>
            <div><p className="text-xs text-slate-500">Interest before EMI starts</p><p className="font-bold text-slate-900">{n(v.loan) ? fmt(r.accrued, home) : '—'}</p></div>
            <div><p className="text-xs text-slate-500">Total loan repayment</p><p className="font-bold text-slate-900">{n(v.loan) ? fmt(r.totalRepay, home) : '—'}</p></div>
            <div><p className="text-xs text-slate-500">Payback time</p><p className="font-bold text-emerald-700">{isFinite(r.payback) && ready ? `${r.payback.toFixed(1)} years` : '—'}</p></div>
          </div>
          <p className="mt-4 flex items-start gap-1.5 text-xs text-slate-400"><Info size={13} className="mt-0.5 shrink-0" />Estimate only. Loan terms, taxes and exchange rates vary — check with your bank and university.</p>
        </div>
        <EnquiryForm compact title="Planning to study abroad?" subtitle="Get free help with universities, loans and visas." />
      </aside>
    </div>
  );
}
