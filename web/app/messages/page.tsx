import type { Metadata } from 'next';
import { Suspense } from 'react';
import PushPrompt from '@/components/chat/PushPrompt';
import Messages from './Messages';

export const metadata: Metadata = { title: 'Messages', robots: { index: false } };
export default function MessagesPage() {
  return <div className="container-x py-8"><PushPrompt className="mb-4" /><Suspense fallback={<div className="card h-96 animate-pulse" />}><Messages /></Suspense></div>;
}
