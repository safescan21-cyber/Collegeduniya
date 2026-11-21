// One-page resume layout — used by the builder (/resume), and by admins/employers viewing an application's attached resume.
export type Edu = { degree: string; institute: string; year: string; score: string };
export type Exp = { role: string; org: string; from: string; to: string; details: string };
export type Proj = { title: string; link: string; details: string };
export type Resume = {
  full_name: string; headline: string; email: string; phone: string; city: string; summary: string;
  education: Edu[]; experience: Exp[]; projects: Proj[]; skills: string[]; languages: string[];
  links: { linkedin?: string; github?: string; portfolio?: string };
};

const H = ({ children }: { children: React.ReactNode }) => <h3 className="mb-1 mt-4 border-b border-slate-200 pb-0.5 text-xs font-bold uppercase tracking-wider text-brand-700">{children}</h3>;
const Bullets = ({ text }: { text: string }) => {
  const lines = (text || '').split('\n').map((l) => l.replace(/^[-•*]\s*/, '').trim()).filter(Boolean);
  return lines.length ? <ul className="ms-4 list-disc">{lines.map((l, i) => <li key={i}>{l}</li>)}</ul> : null;
};

export default function ResumePreview({ r }: { r: Partial<Resume> }) {
  const f = { education: [], experience: [], projects: [], skills: [], languages: [], links: {}, ...r } as Resume;
  return (
    <article className="h-fit rounded-xl border border-slate-200 bg-white p-8 text-[13px] leading-relaxed text-slate-800 shadow-sm print:border-0 print:p-0 print:shadow-none lg:sticky lg:top-20">
      <h2 className="text-2xl font-bold text-slate-900">{f.full_name || 'Your name'}</h2>
      {f.headline && <p className="text-slate-600">{f.headline}</p>}
      <p className="mt-1 text-xs text-slate-500">{[f.email, f.phone, f.city, f.links?.linkedin].filter(Boolean).join('  ·  ')}</p>
      {f.summary && <><H>Summary</H><p>{f.summary}</p></>}
      {f.education.some((e) => e.degree || e.institute) && <><H>Education</H>{f.education.filter((e) => e.degree || e.institute).map((e, i) => (
        <div key={i} className="mb-1.5 flex justify-between gap-3"><p><b>{e.degree}</b>{e.institute ? ` — ${e.institute}` : ''}</p><p className="shrink-0 text-slate-500">{[e.score, e.year].filter(Boolean).join(' · ')}</p></div>))}</>}
      {f.experience.some((e) => e.role || e.org) && <><H>Experience</H>{f.experience.filter((e) => e.role || e.org).map((e, i) => (
        <div key={i} className="mb-2"><div className="flex justify-between gap-3"><p><b>{e.role}</b>{e.org ? ` — ${e.org}` : ''}</p><p className="shrink-0 text-slate-500">{[e.from, e.to].filter(Boolean).join(' – ')}</p></div><Bullets text={e.details} /></div>))}</>}
      {f.projects.some((p) => p.title) && <><H>Projects</H>{f.projects.filter((p) => p.title).map((p, i) => (
        <div key={i} className="mb-2"><p><b>{p.title}</b>{p.link ? <span className="text-slate-500"> · {p.link}</span> : ''}</p><Bullets text={p.details} /></div>))}</>}
      {f.skills.length > 0 && <><H>Skills</H><p>{f.skills.join(' · ')}</p></>}
      {f.languages.length > 0 && <><H>Languages</H><p>{f.languages.join(' · ')}</p></>}
    </article>
  );
}
