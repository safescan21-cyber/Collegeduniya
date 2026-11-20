'use client';
import OnlineNow from '@/components/admin/OnlineNow';

export default function AdminOnline() {
  return <div className="space-y-4"><h1 className="text-xl font-extrabold text-slate-900">Who is online</h1><OnlineNow full /></div>;
}
