import type { Metadata } from 'next';
import { Suspense } from 'react';
import LoginForm from './LoginForm';

export const metadata: Metadata = { title: 'Login or Register', robots: { index: false } };

export default function LoginPage() {
  return (
    <div className="container-x flex min-h-[70vh] items-center justify-center py-12">
      <Suspense fallback={<div className="card h-96 w-full max-w-md animate-pulse" />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
