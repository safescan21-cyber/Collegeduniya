import type { Metadata } from 'next';
// Signed-in tool page — keep it out of search results.
export const metadata: Metadata = { title: 'Post a listing', robots: { index: false, follow: false } };
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
