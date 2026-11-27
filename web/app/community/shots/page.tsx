import type { Metadata } from 'next';
import { Suspense } from 'react';
import Shots from './Shots';

export const metadata: Metadata = {
  title: 'Shots — short campus videos by students',
  description: 'Short videos and photos from college students: campus tours, fests, hostels and placements. Like, comment, share and follow.',
  alternates: { canonical: '/community/shots' },
};

export default function ShotsPage() {
  return <Suspense fallback={<div className="h-[calc(100dvh-4rem)] bg-black" />}><Shots /></Suspense>;
}
