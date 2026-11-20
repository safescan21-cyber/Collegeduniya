'use client';
import ModerationList from '@/components/admin/ModerationList';

export default function AdminNewsletter() {
  return (
    <div className="space-y-4">
      <p className="rounded-xl bg-brand-50 p-3 text-sm text-brand-800">Export the CSV and import it into your email tool (Brevo, Mailchimp, Zoho Campaigns…) to send newsletters. Include an unsubscribe link in every email.</p>
      <ModerationList resource="newsletter_subscribers" title="Newsletter subscribers" exportName="newsletter_subscribers"
        tabs={[{ label: 'Subscribed', params: { unsubscribed: 'false' } }, { label: 'Unsubscribed', params: { unsubscribed: 'true' } }]}
        extraActions={(r, patch) => <button onClick={() => patch({ unsubscribed: !r.unsubscribed })} className="btn-ghost px-2 py-1.5 text-xs">{r.unsubscribed ? 'Resubscribe' : 'Unsubscribe'}</button>}
        columns={[
          { key: 'email', label: 'Email', render: (r) => <span className="font-medium">{r.email}</span> },
          { key: 'source', label: 'Source' },
          { key: 'created_at', label: 'Joined', render: (r) => new Date(r.created_at).toLocaleDateString() },
        ]} />
    </div>
  );
}
