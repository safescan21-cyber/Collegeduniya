'use client';
import { Download, ExternalLink } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/client';

export const KIND_LABEL: Record<string, string> = {
  question_paper: 'Question paper', answer_key: 'Answer key', solution: 'Solutions', syllabus: 'Syllabus',
  date_sheet: 'Date sheet', notice: 'Official notice', sample_paper: 'Sample paper', analysis: 'Paper analysis',
};

export type ExamDoc = { id: string; exam_slug: string; kind: string; title: string; year: number | null; session: string | null; file_url: string | null; source_url: string; downloads: number };

// One row in the library: opens the PDF (or the official page) and counts the download
export function DocRow({ d, showExam }: { d: ExamDoc; showExam?: string }) {
  const open = () => { supabaseBrowser().rpc('count_download', { rid: d.id }).then(() => undefined, () => undefined); };
  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 px-4 py-3 first:border-t-0">
      <div className="min-w-0 flex-1">
        <p className="font-medium text-slate-900">{d.title}</p>
        <p className="text-xs text-slate-500">{[showExam, KIND_LABEL[d.kind], d.year, d.session].filter(Boolean).join(' · ')}{d.downloads ? ` · ${d.downloads.toLocaleString()} downloads` : ''}</p>
      </div>
      {d.file_url && <a href={d.file_url} target="_blank" rel="noopener" onClick={open} className="btn-primary px-3 py-1.5 text-sm"><Download size={14} />PDF</a>}
      <a href={d.source_url} target="_blank" rel="noopener nofollow" onClick={d.file_url ? undefined : open} className="btn-ghost px-3 py-1.5 text-sm"><ExternalLink size={14} />Official</a>
    </div>
  );
}
