import Link from 'next/link';
import { WifiOff } from 'lucide-react';

export const metadata = { title: 'You are offline', robots: { index: false } };

export default function Offline() {
  return (
    <div className="container-x py-24 text-center">
      <WifiOff className="mx-auto text-slate-400" size={48} />
      <h1 className="mt-4 text-2xl font-bold text-slate-900">You are offline</h1>
      <p className="mt-2 text-slate-500">Check your internet connection. Pages you opened before are still available.</p>
      <Link href="/" className="btn-primary mt-6">Try again</Link>
    </div>
  );
}
