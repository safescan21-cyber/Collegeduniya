import type { Metadata } from 'next';
import { Suspense } from 'react';
import Messages from './Messages';

export const metadata: Metadata = { title: 'Messages', robots: { index: false } };
export default function MessagesPage() {
  return <div className="container-x py-8"><Suspense fallback={<div className="card h-96 animate-pulse" />}><Messages /></Suspense></div>;
}
