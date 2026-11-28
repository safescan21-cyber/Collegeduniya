// Streams used for hub pages (/streams/<slug>), the Streams menu and the home page.
// `name` must match colleges.streams, exams.stream and course_catalog.stream values.
export type Stream = { slug: string; name: string; label: string; blurb: string };

export const STREAMS: Stream[] = [
  { slug: 'engineering', name: 'Engineering', label: 'Engineering', blurb: 'B.Tech, M.Tech and diploma colleges, JEE and state CETs, branch-wise cutoffs and placements.' },
  { slug: 'management', name: 'Management', label: 'MBA & Management', blurb: 'MBA, PGDM and BBA colleges, CAT, XAT, CMAT and MAT, fees against placement packages.' },
  { slug: 'medical', name: 'Medical', label: 'Medical', blurb: 'MBBS, BDS, nursing and allied health colleges, NEET counselling and seat matrices.' },
  { slug: 'law', name: 'Law', label: 'Law', blurb: 'BA LLB, BBA LLB and LLM colleges, CLAT, AILET and state law entrance tests.' },
  { slug: 'design', name: 'Design', label: 'Design', blurb: 'B.Des and M.Des colleges, NID, NIFT and UCEED, portfolio and studio-test tips.' },
  { slug: 'commerce', name: 'Commerce', label: 'Commerce', blurb: 'B.Com and M.Com colleges, CUET admissions and professional courses like CA and CS.' },
  { slug: 'science', name: 'Science', label: 'Science', blurb: 'B.Sc and M.Sc colleges, CUET and IISER/NISER aptitude tests, research careers.' },
  { slug: 'arts', name: 'Arts', label: 'Arts & Humanities', blurb: 'BA and MA colleges, CUET admissions, languages, social sciences and liberal arts.' },
  { slug: 'computer-applications', name: 'Computer Applications', label: 'Computer Applications', blurb: 'BCA and MCA colleges, NIMCET and university tests, IT careers.' },
  { slug: 'pharmacy', name: 'Pharmacy', label: 'Pharmacy', blurb: 'B.Pharm, D.Pharm and M.Pharm colleges, GPAT and state pharmacy admissions.' },
  { slug: 'architecture', name: 'Architecture', label: 'Architecture', blurb: 'B.Arch colleges, NATA and JEE Main Paper 2, studio and licensing basics.' },
  { slug: 'hotel-management', name: 'Hotel Management', label: 'Hotel Management', blurb: 'BHM and hospitality colleges, NCHM JEE, internships and hotel placements.' },
  { slug: 'education', name: 'Education', label: 'Education', blurb: 'B.Ed and M.Ed colleges, state B.Ed entrance tests and teaching careers.' },
];

export const streamBySlug = (s: string) => STREAMS.find((x) => x.slug === s) || null;
export const streamSlug = (name: string) => STREAMS.find((x) => x.name === name)?.slug || null;
