import type { Metadata } from 'next';
import BadgeMaker from './BadgeMaker';

export const metadata: Metadata = {
  title: 'Link to Collegeolo — free badges for colleges, coaching centres and blogs',
  description: 'Free "Listed on Collegeolo" badges and ready-to-paste link code for colleges, coaching institutes, student clubs and education bloggers.',
  alternates: { canonical: '/link-to-us' },
};

export default function LinkToUs() {
  return (
    <div className="container-x max-w-3xl space-y-6 py-10">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">Link to Collegeolo</h1>
        <p className="mt-2 text-slate-600">Is your college, coaching institute, school or blog on Collegeolo — or do your students use it? Add a free badge to your website. It shows students where to find fees, courses, cutoffs, reviews, scholarships and free study material.</p>
      </header>
      <BadgeMaker />
      <section className="card space-y-2 p-6 text-sm text-slate-600">
        <h2 className="text-lg font-bold text-slate-900">Good pages to link to</h2>
        <ul className="list-disc space-y-1 ps-5">
          <li><b>Colleges:</b> your own college page on Collegeolo (fees, courses, reviews, admission steps).</li>
          <li><b>Coaching institutes:</b> free study material — <a className="text-brand-700 underline" href="/study-material">/study-material</a> — and exam pages such as <a className="text-brand-700 underline" href="/exams/cat">/exams/cat</a>.</li>
          <li><b>Schools & counsellors:</b> the college predictor <a className="text-brand-700 underline" href="/predictor">/predictor</a> and scholarships <a className="text-brand-700 underline" href="/scholarships">/scholarships</a>.</li>
          <li><b>Study-abroad advisers:</b> country guides such as <a className="text-brand-700 underline" href="/study-abroad/germany">/study-abroad/germany</a>.</li>
        </ul>
        <p className="pt-2">Questions or want us to feature your institution? Write to us from the <a className="text-brand-700 underline" href="/contact">contact page</a>.</p>
      </section>
    </div>
  );
}
