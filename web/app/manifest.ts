import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Collegeolo — Study, Earn & Stay',
    short_name: 'Collegeolo',
    description: 'Study, earn and stay: find colleges worldwide, part-time jobs and PG & hostels near campus.',
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
