import type { Metadata } from 'next';
import ApplyClient from './ApplyClient';

export const metadata: Metadata = {
  title: 'Apply to many colleges with one form',
  description: 'Fill one application and send it to multiple partner colleges on Collegeolo. Track every application in your dashboard.',
};

export default function ApplyPage() {
  return <div className="container-x py-10"><ApplyClient /></div>;
}
