'use client';
import { ExternalLink } from 'lucide-react';
import ResourceManager from '@/components/admin/ResourceManager';

export default function AdminArticles() {
  return (
    <div className="space-y-3">
      <p className="rounded-xl bg-brand-50 p-3 text-sm text-brand-800">Write the body in Markdown: <code>## Heading</code>, <code>- list item</code>, <code>**bold**</code>, <code>[link](https://…)</code>, tables. Set “Publish date” in the future to schedule.</p>
      <ResourceManager resource="articles" title="Articles & news"
        defaults={{ category: 'news', is_published: true }}
        quickFilters={[{ label: 'All', params: {} }, { label: 'Drafts', params: { is_published: 'false' } }]}
        fields={[
          { name: 'title', label: 'Title', type: 'text', required: true, full: true },
          { name: 'slug', label: 'URL slug', type: 'text', help: 'Leave empty to generate from title' },
          { name: 'category', label: 'Category', type: 'select', options: ['news', 'admission', 'exam', 'guide', 'abroad', 'hostel', 'jobs'], required: true },
          { name: 'excerpt', label: 'Short summary (for cards & Google)', type: 'textarea' },
          { name: 'body', label: 'Body (Markdown)', type: 'textarea', placeholder: '## Key dates\n\n- …' },
          { name: 'cover_url', label: 'Cover image', type: 'image' },
          { name: 'tags', label: 'Tags', type: 'tags' },
          { name: 'college_id', label: 'Related college', type: 'college' },
          { name: 'author_name', label: 'Author name', type: 'text' },
          { name: 'published_at', label: 'Publish date', type: 'date' },
          { name: 'is_published', label: 'Published', type: 'bool' },
        ]}
        columns={[
          { key: 'title', label: 'Title', render: (r) => <div><p className="font-semibold text-slate-900">{r.title}</p><p className="text-xs text-slate-500">/{r.slug}</p></div> },
          { key: 'category', label: 'Category', render: (r) => <span className="chip capitalize">{r.category}</span> },
          { key: 'published_at', label: 'Date', render: (r) => new Date(r.published_at).toLocaleDateString() },
          { key: 'is_published', label: 'Status', render: (r) => (r.is_published ? <span className="chip-green">Live</span> : <span className="chip">Draft</span>) },
        ]}
        rowActions={(r) => <a href={`/news/${r.slug}`} target="_blank" className="btn-ghost px-2 py-1.5"><ExternalLink size={14} /></a>}
      />
    </div>
  );
}
