import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/format';
import { sitemapPlan } from '@/lib/sitemapPlan';

export const revalidate = 86400;

export default async function robots(): Promise<MetadataRoute.Robots> {
  const p = await sitemapPlan().catch(() => ({ collegeShards: 0, cityShards: 0 }));
  const count = 1 + p.collegeShards + p.cityShards;
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/resume/view', '/mock-tests/attempt', '/mock-tests/result', '/admin', '/dashboard', '/login'] }],
    sitemap: Array.from({ length: count }, (_, i) => `${SITE_URL}/sitemap/${i}.xml`),
  };
}
