import type { Metadata } from 'next';
import Feed from './Feed';
export const metadata: Metadata = {
  title: 'Campus community — posts, blogs & mock test results',
  description: 'Photos, news, blogs and mock test results shared by college students across India. Like, comment and share.',
  alternates: { canonical: '/community' },
};
export default function CommunityPage() { return <div className="container-x max-w-2xl py-8"><Feed /></div>; }
