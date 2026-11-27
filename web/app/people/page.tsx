import type { Metadata } from 'next';
import { Suspense } from 'react';
import People from './People';

export const metadata: Metadata = {
  title: 'Find students to chat with — your college, your course, near you',
  description: 'Meet students from your college and others: seniors, batchmates, same course, same city. Follow them and chat on Collegeolo.',
  alternates: { canonical: '/people' },
  robots: { index: false, follow: true },   // personal lists — never in search results
};

export default function PeoplePage() {
  return <Suspense fallback={<div className="container-x py-10" />}><People /></Suspense>;
}
