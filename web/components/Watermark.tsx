'use client';
import { useAuth } from '@/components/AuthProvider';

// Faint repeated "@viewer · collegeolo.com" over photos and videos. It doesn't stop a phone screenshot (no website can),
// but every screenshot carries the name of the person who took it — which stops most people from re-posting.
export default function Watermark({ dense = false }: { dense?: boolean }) {
  const { profile } = useAuth();
  const who = (profile as any)?.username ? `@${(profile as any).username}` : 'guest';
  const label = `${who} · collegeolo.com`;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-[1] select-none overflow-hidden">
      <div className="absolute -inset-1/2 flex rotate-[-24deg] flex-wrap content-center gap-x-16 gap-y-14 opacity-[0.16]">
        {Array.from({ length: dense ? 60 : 30 }).map((_, i) => (
          <span key={i} className="whitespace-nowrap text-xs font-semibold text-white [text-shadow:0_0_2px_rgba(0,0,0,.9)]">{label}</span>))}
      </div>
    </div>
  );
}
