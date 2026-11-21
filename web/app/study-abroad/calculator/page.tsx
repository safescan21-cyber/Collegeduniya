import type { Metadata } from 'next';
import Calculator from './Calculator';

export const metadata: Metadata = {
  title: 'Study abroad cost & ROI calculator — total cost, loan EMI, payback',
  description: 'Work out the total cost of studying abroad in your own currency, the education-loan EMI and how many years it takes to pay back.',
};

export default function Page() {
  return <div className="container-x py-10"><Calculator /></div>;
}
