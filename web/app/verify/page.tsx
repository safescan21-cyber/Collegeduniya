import type { Metadata } from 'next';
import VerifyFlow from './VerifyFlow';
export const metadata: Metadata = { title: 'Get verified', robots: { index: false } };
export default function VerifyPage() { return <div className="container-x max-w-xl py-10"><VerifyFlow /></div>; }
