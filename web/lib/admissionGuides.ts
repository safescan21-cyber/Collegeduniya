// Admission guides for Indian students — USA and Germany.
// Every number links to the official page it came from; checked on CHECKED below. Rules change: the pages say so.

export const CHECKED = '28 November 2026';

export type Step = { title: string; text: string; link?: { label: string; href: string } };
export type Cost = { item: string; amount: string; note?: string; source: { label: string; href: string } };
export type Guide = {
  code: 'US' | 'DE'; slug: string; country: string; flag: string;
  intro: string; ugSteps: Step[]; pgSteps: Step[]; costs: Cost[]; intakes: string; tips: string[];
  official: { label: string; href: string }[]; scholarships: { label: string; href: string }[];
};

export const GUIDES: Record<'US' | 'DE', Guide> = {
  US: {
    code: 'US', slug: 'usa', country: 'United States', flag: '🇺🇸',
    intro: 'U.S. colleges decide admission themselves, using a “holistic” review: school marks, essays, recommendation letters, activities and (at some colleges) SAT/ACT scores. There is no single entrance exam, and each college sets its own deadline.',
    ugSteps: [
      { title: 'Choose 6–12 colleges (a mix of reach, match and safe)', text: 'Compare cost, admission rate, courses and graduates’ earnings on each college page here. Start in Class 11.', link: { label: 'EducationUSA — 5 steps to U.S. study', href: 'https://educationusa.state.gov/your-5-steps-us-study' } },
      { title: 'Take the tests the college asks for', text: 'Many colleges are test-optional for SAT/ACT, but some selective ones require scores again — check each college’s admission page. Non-native English speakers usually need TOEFL, IELTS or Duolingo (if your school was English-medium, some colleges waive it).', link: { label: 'EducationUSA — standardized tests', href: 'https://educationusa.state.gov/your-5-steps-us-study/research-your-options/undergraduate/prepare-us-standardized-tests' } },
      { title: 'Apply — usually on the Common App', text: 'One form for 1,000+ colleges: personal essay, college-specific essays, school transcripts (Class 9–12), counsellor and teacher recommendations, activities. Each college charges its own application fee (fee waivers exist for financial need).', link: { label: 'Common App', href: 'https://www.commonapp.org/' } },
      { title: 'Apply for financial aid at the same time', text: 'Some colleges give need-based aid to international students; many give merit scholarships. Ask each college’s financial aid office — aid applications have their own deadlines.' },
      { title: 'Get the I-20 after admission', text: 'Once admitted, you show proof of funds (bank statements / loan sanction) and the college issues Form I-20, which you need for the visa.' },
      { title: 'Student visa (F-1)', text: 'Pay the SEVIS I-901 fee, fill the DS-160 form, pay the visa fee, attend the interview at the U.S. Embassy/Consulate with your I-20, admission letter and funds proof.', link: { label: 'U.S. Embassy in India — student visa', href: 'https://in.usembassy.gov/' } },
    ],
    pgSteps: [
      { title: 'Shortlist programmes and check each department’s rules', text: 'Master’s and PhD admission is decided by the department: GPA, statement of purpose, recommendations, often GRE/GMAT (many programmes have made it optional), TOEFL/IELTS/Duolingo.' },
      { title: 'Apply on the university’s own portal', text: 'Graduate applications usually go through each university’s portal, not the Common App. PhD offers often include tuition waiver and a stipend (assistantship).' },
      { title: 'I-20 and F-1 visa', text: 'Same as undergraduates: I-20 after showing funds, then SEVIS fee, DS-160 and interview.', link: { label: 'U.S. Department of State — student visa', href: 'https://travel.state.gov/content/travel/en/us-visas/study/student-visa.html' } },
    ],
    costs: [
      { item: 'Tuition', amount: 'Different for every college', note: 'See “Fees / year” on each college page (official U.S. College Scorecard data).', source: { label: 'College Scorecard', href: 'https://collegescorecard.ed.gov/' } },
      { item: 'SEVIS I-901 fee', amount: 'US$350', note: 'Paid online before the visa interview.', source: { label: 'fmjfee.com (U.S. government)', href: 'https://www.fmjfee.com/' } },
      { item: 'Visa application fee (MRV)', amount: 'US$185', note: 'Paid before booking the interview; not refundable.', source: { label: 'travel.state.gov — fees', href: 'https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/fees/fees-visa-services.html' } },
      { item: 'Visa Integrity Fee', amount: 'US$250 (where charged)', note: 'Introduced by a 2025 law; check whether your consulate collects it.', source: { label: 'travel.state.gov — fees', href: 'https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/fees/fees-visa-services.html' } },
    ],
    intakes: 'Main intake: August/September (Fall). Undergraduate deadlines: Early Decision/Early Action around 1 November, Regular Decision around 1–15 January. Graduate deadlines: usually December–February. Always check the college’s own dates.',
    tips: [
      'Start 12–18 months before you want to join.',
      'Admission rate, cost and graduates’ earnings for each U.S. college are on its page here (official College Scorecard data).',
      'Never pay an agent for an “admission guarantee” — U.S. colleges don’t sell seats.',
    ],
    official: [
      { label: 'EducationUSA (U.S. Department of State)', href: 'https://educationusa.state.gov/' },
      { label: 'U.S. Embassy & Consulates in India — student visas', href: 'https://in.usembassy.gov/' },
      { label: 'Study in the States (DHS)', href: 'https://studyinthestates.dhs.gov/' },
    ],
    scholarships: [{ label: 'Fulbright-Nehru Master’s Fellowships', href: '/scholarships/fulbright-nehru-masters' }],
  },

  DE: {
    code: 'DE', slug: 'germany', country: 'Germany', flag: '🇩🇪',
    intro: 'Most public universities in Germany charge no tuition fee — students pay only a semester contribution. The exceptions for non-EU students are universities in Baden-Württemberg (€1,500 per semester) and TU Munich. Indian students need an APS certificate for the student visa.',
    ugSteps: [
      { title: 'Check whether you can enter a bachelor’s directly', text: 'From Winter Semester 2026/27 you need at least 70% overall in Class XII (any board). With Class XII alone you go through a one-year Studienkolleg (foundation course) and its exam; with Class XII + one successfully completed year of a bachelor’s in India you may get direct admission in the same or a related subject. A valid JEE Advanced result is the DAAD-recognised exception for direct entry.', link: { label: 'APS India — admission criteria', href: 'https://aps-india.de/news/' } },
      { title: 'Choose the language of study', text: 'German-taught courses need German at about C1 (TestDaF or DSH); English-taught courses need IELTS/TOEFL. Studienkolleg is taught in German.', link: { label: 'DAAD India — bachelor studies', href: 'https://www.daad.in/en/study-research-in-germany/studying-in-germany/bachelor-studies/' } },
      { title: 'Get the APS certificate', text: 'APS India checks your Indian documents. The certificate is generally required for the German student visa — apply early, it takes weeks.', link: { label: 'aps-india.de', href: 'https://aps-india.de/' } },
      { title: 'Apply to the university (often via uni-assist)', text: 'Many universities take international applications through uni-assist; others on their own portal. Winter semester deadlines are usually around 15 July, summer semester around 15 January — check each course.', link: { label: 'uni-assist', href: 'https://www.uni-assist.de/en/' } },
      { title: 'Open a blocked account and get health insurance', text: 'For the visa you show €11,904 for one year (€992 a month) in a blocked account, plus health insurance.', link: { label: 'German Missions in India — student visa', href: 'https://india.diplo.de/in-en' } },
      { title: 'Apply for the national (student) visa', text: 'With admission letter, APS certificate, blocked account confirmation, insurance and language proof, book the appointment through the German Missions in India.' },
    ],
    pgSteps: [
      { title: 'Check your bachelor’s fits the master’s', text: 'German master’s programmes want a closely related bachelor’s; many state a minimum grade. Check recognition of your university in anabin.', link: { label: 'anabin (KMK)', href: 'https://anabin.kmk.org/' } },
      { title: 'Language and tests', text: 'English-taught master’s: IELTS/TOEFL; some ask for GRE/GMAT. German-taught: TestDaF/DSH.' },
      { title: 'APS certificate, application, blocked account, visa', text: 'Same steps as above — apply to the university (uni-assist or its portal), then blocked account (€11,904) and student visa.', link: { label: 'aps-india.de', href: 'https://aps-india.de/' } },
    ],
    costs: [
      { item: 'Tuition at most public universities', amount: 'None', note: 'You pay a semester contribution instead (student services, union, often a transport ticket) — the amount differs by university.', source: { label: 'DAAD — costs of education and living', href: 'https://www.daad.de/en/studying-in-germany/living-in-germany/finances/' } },
      { item: 'Universities in Baden-Württemberg (non-EU students)', amount: '€1,500 per semester', note: 'Bachelor’s and consecutive master’s; some exemptions.', source: { label: 'Baden-Württemberg Ministry of Science', href: 'https://mwk.baden-wuerttemberg.de/de/hochschulen-studium/studieren-in-bw/studienfinanzierung/gebuehren-fuer-internationale-studierende-und-zweitstudium/tuition-fees-for-international-students' } },
      { item: 'TU Munich (non-EU students)', amount: 'Per semester, by programme', note: 'From winter 2027/28: bachelor’s €2,300 or €3,400, master’s €4,600 or €6,800.', source: { label: 'TUM — tuition fees', href: 'https://www.tum.de/en/studies/tuition-fees' } },
      { item: 'Blocked account (living costs proof)', amount: '€11,904 a year (€992/month)', note: 'Needed for the student visa.', source: { label: 'German Missions in India', href: 'https://india.diplo.de/in-en' } },
      { item: 'APS verification', amount: 'See official site', note: 'Paid to APS India.', source: { label: 'aps-india.de', href: 'https://aps-india.de/' } },
    ],
    intakes: 'Two intakes: Winter semester (starts October; deadlines usually around 15 July) and Summer semester (starts April; deadlines usually around 15 January). Many master’s programmes have earlier deadlines.',
    tips: [
      'Start the APS certificate first — without it there is no visa.',
      'Private universities in Germany charge tuition; the “no fee” rule is for public universities.',
      'Learning German (even A2–B1) helps hugely with part-time jobs and life outside campus.',
    ],
    official: [
      { label: 'DAAD India', href: 'https://www.daad.in/' },
      { label: 'APS India', href: 'https://aps-india.de/' },
      { label: 'German Missions in India — visa', href: 'https://india.diplo.de/in-en' },
      { label: 'Study in Germany (DAAD)', href: 'https://www.study-in-germany.de/en/' },
    ],
    scholarships: [{ label: 'DAAD scholarships', href: '/scholarships/daad-scholarships-germany' }],
  },
};

export const guideFor = (code?: string | null) => (code === 'US' || code === 'DE' ? GUIDES[code] : null);

// Fee line for one German university, from the official rules (public vs private, state, TUM)
export function germanFeeRule(c: { name?: string | null; state?: string | null; type?: string | null }) {
  const name = (c.name || '').toLowerCase();
  if (/technical university of munich|technische universit(ä|ae)t m(ü|ue)nchen|\btum\b/.test(name))
    return { amount: 'Tuition for non-EU students (by programme)', note: 'TU Munich charges non-EU students per semester — from winter 2027/28: bachelor’s €2,300 or €3,400, master’s €4,600 or €6,800.', href: 'https://www.tum.de/en/studies/tuition-fees' };
  if (/private/i.test(c.type || '')) return { amount: 'Private university — tuition charged', note: 'See the official website for this university’s fees.', href: null };
  if (/baden|württemberg|wuerttemberg/i.test(c.state || ''))
    return { amount: '€1,500 per semester (non-EU students)', note: 'State law in Baden-Württemberg, plus the semester contribution. Some students are exempt.', href: 'https://mwk.baden-wuerttemberg.de/de/hochschulen-studium/studieren-in-bw/studienfinanzierung/gebuehren-fuer-internationale-studierende-und-zweitstudium/tuition-fees-for-international-students' };
  if (/public|state/i.test(c.type || ''))
    return { amount: 'No tuition fee — semester contribution only', note: 'Public universities in this state charge no tuition; you pay a semester contribution (amount on the university’s website).', href: 'https://www.daad.de/en/studying-in-germany/living-in-germany/finances/' };
  return { amount: 'Check the official website', note: 'Public universities in Germany usually charge no tuition (except Baden-Württemberg and TU Munich); private ones do.', href: 'https://www.daad.de/en/studying-in-germany/living-in-germany/finances/' };
}
