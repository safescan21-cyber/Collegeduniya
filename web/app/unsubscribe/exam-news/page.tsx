import type { Metadata } from 'next';
import { Suspense } from 'react';
import Unsubscribe from './Unsubscribe';

export const metadata: Metadata = { title: 'Stop exam news emails', robots: { index: false, follow: false } };

export default function Page() {
  return <div className="container-x max-w-lg py-16"><Suspense><Unsubscribe /></Suspense></div>;
}
