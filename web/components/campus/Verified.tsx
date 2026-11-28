import { BadgeCheck } from 'lucide-react';
export default function Verified({ on, size = 15 }: { on?: boolean | null; size?: number }) {
  if (!on) return null;
  return <BadgeCheck size={size} className="inline shrink-0 fill-sky-500 text-white" aria-label="Verified student"><title>Verified student</title></BadgeCheck>;
}
