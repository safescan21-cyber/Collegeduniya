import { ImageResponse } from 'next/og';

// Default share image for every page that has no picture of its own (WhatsApp, LinkedIn, X, Google Discover).
export const alt = 'Collegeolo — colleges, courses, fees, exams, PG & hostels and student jobs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 72,
        background: 'linear-gradient(135deg, #312e81 0%, #4338ca 55%, #6366f1 100%)', color: 'white' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ width: 84, height: 84, borderRadius: 22, background: 'white', color: '#4338ca', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 56, fontWeight: 800 }}>C</div>
          <div style={{ fontSize: 56, fontWeight: 800 }}>Collegeolo</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ fontSize: 66, fontWeight: 800, lineHeight: 1.1 }}>Find your college. Study, earn & stay.</div>
          <div style={{ fontSize: 32, opacity: 0.9 }}>Colleges in India & abroad · fees & courses · cutoffs & predictor · exams & free mock tests · PG & hostels · student jobs</div>
        </div>
        <div style={{ fontSize: 28, opacity: 0.85 }}>www.collegeolo.com</div>
      </div>
    ),
    size,
  );
}
