import type { Metadata } from 'next';
import ResumeBuilder from './ResumeBuilder';

export const metadata: Metadata = {
  title: 'Free resume builder for students — download PDF',
  description: 'Build a clean one-page student resume in minutes: education, projects, internships and skills. Download as PDF and attach it to job applications in one click.',
  alternates: { canonical: '/resume' },
};

export default function ResumePage() {
  return <ResumeBuilder />;
}
