'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Printer } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import ResumePreview from '@/components/ResumePreview';

// Resume attached to a job application — visible to the applicant, the job's employer and admins (RLS on job_applications)
function View() {
  const id = useSearchParams().get('app') || '';
  const { user, loading } = useAuth();
  const [row, setRow] = useState<any | null | 'none'>(null);
  useEffect(() => {
    if (loading) return;
    if (!user || !/^[0-9a-f-]{36}$/.test(id)) { setRow('none'); return; }
    supabaseBrowser().from('job_applications').select('full_name, resume_snapshot, jobs(title, company)').eq('id', id).maybeSingle()
      .then(({ data }: { data: any }) => setRow(data?.resume_snapshot ? data : 'none'));
  }, [id, user, loading]);
  if (row === null) return <div className="container-x py-10"><div className="card h-96 animate-pulse" /></div>;
  if (row === 'none') return <div className="container-x py-20 text-center text-slate-500">Resume not found, or you don’t have access to it.</div>;
  return (
    <div className="container-x max-w-3xl py-10">
      <div className="no-print mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500">Application for <b>{row.jobs?.title}</b> · {row.jobs?.company} · resume as submitted</p>
        <button onClick={() => window.print()} className="btn-ghost"><Printer size={16} />Print / PDF</button>
      </div>
      <ResumePreview r={row.resume_snapshot} />
    </div>
  );
}
export default function ResumeView() { return <Suspense><View /></Suspense>; }
