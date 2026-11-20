import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'StudyEarnstay — Colleges, PG & Part-time Jobs',
    short_name: 'StudyEarnstay',
    description: 'Find colleges worldwide, PG & hostels near campus and part-time jobs for students.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#4338ca',
    categories: ['education'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Colleges', url: '/colleges' },
      { name: 'PG & Hostels', url: '/hostels' },
      { name: 'Part-time jobs', url: '/jobs' },
      { name: 'College predictor', url: '/predictor' },
    ],
  };
}
