import type { Metadata } from 'next';
import Quiz from './Quiz';

export const metadata: Metadata = {
  title: 'Free career interest quiz — which course suits me after 12th?',
  description: 'A 3-minute interest quiz (based on the well-known RIASEC interest model). See which streams and courses match what you enjoy, then find colleges for them.',
};
export default function CareerQuizPage() { return <div className="container-x max-w-3xl py-10"><Quiz /></div>; }
