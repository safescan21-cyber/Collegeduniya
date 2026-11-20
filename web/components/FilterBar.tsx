import Link from 'next/link';
import { SlidersHorizontal } from 'lucide-react';
import CityInput from './CityInput';

export type Field =
  | { name: string; label: string; type: 'text'; placeholder?: string }
  | { name: string; label: string; type: 'city'; placeholder?: string }
  | { name: string; label: string; type: 'select'; options: (string | { value: string; label: string })[] };

// Plain GET form — works without JavaScript and keeps filters in the URL (good for SEO & sharing).
export default function FilterBar({ action, fields, values }: { action: string; fields: Field[]; values: Record<string, string | undefined> }) {
  return (
    <form action={action} className="card sticky top-20 space-y-4 p-5">
      <p className="flex items-center gap-2 font-semibold text-slate-900"><SlidersHorizontal size={16} />Filters</p>
      {fields.map((f) => (
        <div key={f.name}>
          <label className="label" htmlFor={f.name}>{f.label}</label>
          {f.type === 'city' ? (
            <CityInput name={f.name} defaultValue={values[f.name] || ''} placeholder={f.placeholder} />
          ) : f.type === 'text' ? (
            <input id={f.name} name={f.name} defaultValue={values[f.name] || ''} placeholder={f.placeholder} className="input" />
          ) : (
            <select id={f.name} name={f.name} defaultValue={values[f.name] || ''} className="input">
              <option value="">Any</option>
              {f.options.map((o) => {
                const opt = typeof o === 'string' ? { value: o, label: o } : o;
                return <option key={opt.value} value={opt.value}>{opt.label}</option>;
              })}
            </select>
          )}
        </div>
      ))}
      <div className="flex gap-2 pt-1">
        <button className="btn-primary flex-1">Apply</button>
        <Link href={action} className="btn-ghost">Reset</Link>
      </div>
    </form>
  );
}
