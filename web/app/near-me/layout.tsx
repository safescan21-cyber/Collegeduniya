import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'Colleges, PG & hostels and student jobs near me',
  description: 'Find colleges, PG and hostels and part-time jobs near your location — distance, fees and reviews on one map.',
  alternates: { canonical: '/near-me' },
};
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
