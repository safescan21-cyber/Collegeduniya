// Admission guides for Indian students — USA, Germany, Japan, UK, Canada, Australia.
// Every number links to the official page it came from; checked on CHECKED below. Rules change: the pages say so.

export const CHECKED = '28 November 2026';

export type Step = { title: string; text: string; link?: { label: string; href: string } };
export type Cost = { item: string; amount: string; note?: string; source: { label: string; href: string } };
export type Code = 'US' | 'DE' | 'JP' | 'GB' | 'CA' | 'AU';
export type Guide = {
  code: Code; slug: string; country: string; flag: string;
  intro: string; ugSteps: Step[]; pgSteps: Step[]; costs: Cost[]; intakes: string; tips: string[];
  official: { label: string; href: string }[]; scholarships: { label: string; href: string }[];
};

export const GUIDES: Record<Code, Guide> = {
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
  JP: {
    code: 'JP', slug: 'japan', country: 'Japan', flag: '🇯🇵',
    intro: 'Japanese universities admit international students through their own entrance process. For Japanese-taught bachelor’s degrees most use the EJU (Examination for Japanese University Admission) plus Japanese-language ability; a growing number of programmes are taught fully in English and take applications directly. National universities charge a standard tuition of ¥535,800 a year, but since 2024 they may set higher fees for international students — check each university.',
    ugSteps: [
      { title: 'Pick the route: English-taught or Japanese-taught', text: 'English-taught degree programmes take Class 12 marks, an English test (IELTS/TOEFL) and essays — no Japanese needed to apply. Japanese-taught programmes usually ask for the EJU and Japanese at about JLPT N2–N1 level. Many students first study Japanese for 1–2 years at a language school.', link: { label: 'Study in Japan (JASSO) — search schools by language', href: 'https://www.studyinjapan.go.jp/en/' } },
      { title: 'Take the EJU if the university asks for it', text: 'The EJU is held twice a year, in June and November; in India it is held in New Delhi. Applications from outside Japan open roughly February–March (June test) and July–August (November test). Each university says which subjects (Japanese, Science or Japan and the World, Mathematics) it needs.', link: { label: 'JASSO — EJU', href: 'https://www.jasso.go.jp/en/ryugaku/eju/' } },
      { title: 'Apply to the university', text: 'Each university runs its own application and often a document screening, interview or written exam. Deadlines vary — many April-start programmes close between autumn and winter of the previous year.' },
      { title: 'Try for the MEXT (Japanese Government) scholarship', text: 'The Embassy of Japan in India selects Indian students for MEXT scholarships (undergraduate, research students and others) — it covers tuition plus a monthly allowance and airfare.', link: { label: 'Embassy of Japan in India', href: 'https://www.in.emb-japan.go.jp/' } },
      { title: 'Certificate of Eligibility (COE), then the student visa', text: 'After admission, the university (as your proxy in Japan) applies for your Certificate of Eligibility at a Regional Immigration Services Bureau. With the original COE you apply for the student visa at the Japanese Embassy/Consulate in India covering your state.', link: { label: 'MOFA — long-term visas', href: 'https://www.mofa.go.jp/j_info/visit/visa/long/index.html' } },
    ],
    pgSteps: [
      { title: 'Find a supervisor or an English-taught master’s', text: 'Many Japanese graduate schools want you to contact a professor first. Some students join as a “research student” (non-degree) for 6–12 months, then sit the master’s entrance exam. English-taught master’s programmes take direct applications.' },
      { title: 'Apply for MEXT research student scholarship', text: 'Embassy-recommended MEXT research student scholarships are the main fully funded route for Indian graduates; selection includes a written test and interview at the Embassy.', link: { label: 'Embassy of Japan in India', href: 'https://www.in.emb-japan.go.jp/' } },
      { title: 'COE and student visa', text: 'Same as bachelor’s: the university applies for the COE, then you apply for the visa in India.' },
    ],
    costs: [
      { item: 'Tuition at national universities (standard)', amount: '¥535,800 a year', note: 'The standard rate most national universities publish. Since 2024 they may charge international students more — e.g. Tohoku ¥900,000 and Tsukuba ¥608,800 for international students enrolling from April 2027.', source: { label: 'University of Tsukuba — fees', href: 'https://www.tsukuba.ac.jp/en/admissions/fees-tuition/' } },
      { item: 'Admission (enrolment) fee at national universities', amount: '¥282,000 (one time)', note: 'Paid after you get the offer; examination fee ¥17,000 (bachelor’s) / ¥30,000 (graduate).', source: { label: 'Hiroshima University — fees', href: 'https://www.hiroshima-u.ac.jp/node/73725' } },
      { item: 'Private universities', amount: 'Set by each university', note: 'Usually higher than national universities — see the university’s own website.', source: { label: 'Study in Japan — academic fees', href: 'https://www.studyinjapan.go.jp/en/' } },
      { item: 'Student visa', amount: 'Small fee in rupees', note: 'Paid at the Embassy/Consulate (or its visa centre) when applying with your COE.', source: { label: 'Embassy of Japan in India — long-term visa', href: 'https://www.in.emb-japan.go.jp/long_term%20visas.html' } },
    ],
    intakes: 'Main intake: April. Many English-taught programmes also start in September/October. EJU: June and November (New Delhi centre in India). Start 12–18 months ahead — longer if you need Japanese first.',
    tips: [
      'Check whether your course is English-taught before planning a year of Japanese study.',
      'Tuition for international students is starting to differ by university from 2027 — always read the university’s own fee page.',
      'Many universities give tuition reductions to privately financed international students with good grades; ask the international office.',
    ],
    official: [
      { label: 'Study in Japan (JASSO)', href: 'https://www.studyinjapan.go.jp/en/' },
      { label: 'EJU (JASSO)', href: 'https://www.jasso.go.jp/en/ryugaku/eju/' },
      { label: 'JLPT — Japanese-Language Proficiency Test', href: 'https://www.jlpt.jp/e/' },
      { label: 'Embassy of Japan in India', href: 'https://www.in.emb-japan.go.jp/' },
    ],
    scholarships: [{ label: 'MEXT (Japanese Government) scholarship', href: '/scholarships/mext-japan-research-students' }],
  },

  GB: {
    code: 'GB', slug: 'uk', country: 'United Kingdom', flag: '🇬🇧',
    intro: 'Bachelor’s degrees in the UK take three years (four in Scotland) and are applied for through UCAS; master’s degrees are often just one year and applied for directly. Universities set their own entry marks for Indian Class 12 students. After an offer, the university gives you a CAS number for the Student visa.',
    ugSteps: [
      { title: 'Shortlist courses on UCAS', text: 'Each course page lists the entry requirement for Indian students (often a percentage in Class 12, sometimes subject marks). Many universities accept high Class 12 English marks instead of IELTS — check the course.', link: { label: 'UCAS — international students', href: 'https://www.ucas.com/international' } },
      { title: 'Apply through UCAS (up to 5 choices)', text: 'One application with a personal statement and a teacher reference. Deadline: 15 October for Oxford, Cambridge, medicine, dentistry and veterinary courses; late January for most other courses.', link: { label: 'UCAS', href: 'https://www.ucas.com/' } },
      { title: 'Meet the offer conditions', text: 'Most offers are “conditional” on your final Class 12 marks and an English test. When you meet them the offer becomes unconditional.' },
      { title: 'Get your CAS and show money', text: 'The university issues a Confirmation of Acceptance for Studies (CAS). For the visa you show your first year’s unpaid fees plus living costs for up to 9 months, held in your account for 28 days.', link: { label: 'GOV.UK — Student visa: money you need', href: 'https://www.gov.uk/student-visa/money' } },
      { title: 'Apply for the Student visa', text: 'Apply online up to 6 months before the course starts, pay the visa fee and the immigration health surcharge, and give biometrics at a visa centre.', link: { label: 'GOV.UK — Student visa', href: 'https://www.gov.uk/student-visa' } },
    ],
    pgSteps: [
      { title: 'Apply directly to each university', text: 'Most master’s programmes take applications on the university’s own portal: bachelor’s marks, statement of purpose, references, IELTS/TOEFL. Popular courses fill early — many have rolling admission.' },
      { title: 'Look at Chevening and Commonwealth scholarships', text: 'UK government scholarships fund full master’s degrees for Indian students; they close many months before the course starts.' },
      { title: 'CAS and Student visa', text: 'Same as bachelor’s: CAS from the university, funds proof, then the visa application.', link: { label: 'GOV.UK — Student visa', href: 'https://www.gov.uk/student-visa' } },
    ],
    costs: [
      { item: 'Tuition', amount: 'Set by each university', note: 'International fees differ by course and university — see the course page.', source: { label: 'UCAS', href: 'https://www.ucas.com/' } },
      { item: 'Student visa fee', amount: '£558', note: 'Applying from outside the UK (from 8 April 2026).', source: { label: 'GOV.UK — Student visa', href: 'https://www.gov.uk/student-visa' } },
      { item: 'Immigration health surcharge', amount: '£776 a year', note: 'Paid upfront for the whole visa length; gives NHS access.', source: { label: 'GOV.UK — Student visa', href: 'https://www.gov.uk/student-visa' } },
      { item: 'Living costs to show for the visa', amount: '£1,529/month (London) · £1,171/month (elsewhere)', note: 'For up to 9 months, held for 28 days in a row.', source: { label: 'GOV.UK — money you need', href: 'https://www.gov.uk/student-visa/money' } },
    ],
    intakes: 'Main intake: September/October. Some master’s courses also start in January. UCAS deadlines: 15 October (Oxford, Cambridge, medicine) and late January for most courses.',
    tips: [
      'A UK master’s is usually one year — compare total cost, not yearly fee, with other countries.',
      'Check if your Class 12 English marks are accepted instead of IELTS.',
      'Only universities with a Student sponsor licence can give a CAS.',
    ],
    official: [
      { label: 'GOV.UK — Student visa', href: 'https://www.gov.uk/student-visa' },
      { label: 'UCAS', href: 'https://www.ucas.com/' },
      { label: 'UKCISA (UK Council for International Student Affairs)', href: 'https://www.ukcisa.org.uk/' },
    ],
    scholarships: [
      { label: 'Chevening Scholarship', href: '/scholarships/chevening-scholarship-uk' },
      { label: 'Commonwealth Master’s Scholarship', href: '/scholarships/commonwealth-masters-scholarship-uk' },
    ],
  },

  CA: {
    code: 'CA', slug: 'canada', country: 'Canada', flag: '🇨🇦',
    intro: 'Canadian universities and colleges admit students on Class 12 or bachelor’s marks plus an English test. To get a study permit you need a letter of acceptance from a Designated Learning Institution (DLI) and, for most students, a Provincial Attestation Letter (PAL), because Canada caps study permits each year.',
    ugSteps: [
      { title: 'Check the institution is a DLI', text: 'Only Designated Learning Institutions can admit international students for a study permit.', link: { label: 'IRCC — DLI list', href: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada/study-permit/prepare/designated-learning-institutions-list.html' } },
      { title: 'Apply to the university or college', text: 'Each institution sets its own Class 12 percentage and subject requirements and its own deadlines. Ontario universities use the OUAC portal; most others use their own.' },
      { title: 'Get the letter of acceptance and PAL', text: 'Your institution requests the Provincial Attestation Letter (PAL) from the province for you. Without a PAL (when required) IRCC returns the application.', link: { label: 'IRCC — study permit', href: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada/study-permit.html' } },
      { title: 'Show proof of funds', text: 'First-year tuition, plus living costs (CAN$23,448 for one person outside Quebec from 1 September 2026), plus travel. Officers check where the money came from.', link: { label: 'IRCC — proof of financial support', href: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada/study-permit/get-documents/financial-support.html' } },
      { title: 'Apply for the study permit', text: 'Apply online, pay the fees, then give biometrics at a visa application centre.' },
    ],
    pgSteps: [
      { title: 'Apply to the graduate programme', text: 'Master’s and PhD admission is decided by the department: bachelor’s marks, statement, references, IELTS/TOEFL, sometimes GRE/GMAT. Research degrees often need a supervisor.' },
      { title: 'Check whether you need a PAL', text: 'Rules on PAL exemptions for master’s and doctoral students change — check the IRCC page when you apply.', link: { label: 'IRCC — study permit', href: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada/study-permit.html' } },
      { title: 'Proof of funds and study permit', text: 'Same funds rule and application as above.' },
    ],
    costs: [
      { item: 'Tuition', amount: 'Set by each institution', note: 'See the university’s international fee page.', source: { label: 'IRCC — study in Canada', href: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada.html' } },
      { item: 'Study permit fee', amount: 'CAN$150', note: 'Not refunded if refused.', source: { label: 'IRCC — fees', href: 'https://ircc.canada.ca/english/information/fees/fees.asp' } },
      { item: 'Biometrics', amount: 'CAN$85', note: 'Valid for 10 years.', source: { label: 'IRCC — fees', href: 'https://ircc.canada.ca/english/information/fees/fees.asp' } },
      { item: 'Living costs to show', amount: 'CAN$23,448 a year (1 person)', note: 'Outside Quebec, applications from 1 September 2026; on top of tuition and travel.', source: { label: 'IRCC — proof of financial support', href: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada/study-permit/get-documents/financial-support.html' } },
    ],
    intakes: 'Main intake: September. Many colleges and some universities also take students in January and May. Deadlines are usually 6–9 months before the start.',
    tips: [
      'Study permits are capped — apply early once you have the letter of acceptance and PAL.',
      'Quebec has its own extra document (CAQ) and a different funds amount.',
      'Check if the programme makes you eligible for a post-graduation work permit before you choose it.',
    ],
    official: [
      { label: 'IRCC — Study in Canada', href: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada.html' },
      { label: 'IRCC — DLI list', href: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada/study-permit/prepare/designated-learning-institutions-list.html' },
      { label: 'EduCanada', href: 'https://www.educanada.ca/' },
    ],
    scholarships: [],
  },

  AU: {
    code: 'AU', slug: 'australia', country: 'Australia', flag: '🇦🇺',
    intro: 'Australian universities admit Indian students on Class 12 or bachelor’s marks plus an English test. Every course for international students must be registered on CRICOS. After you accept an offer, the university issues a Confirmation of Enrolment (CoE), which you need for the Student visa (subclass 500).',
    ugSteps: [
      { title: 'Choose a CRICOS-registered course', text: 'CRICOS lists every course open to international students, with its length and the official tuition estimate. Course pages here show those CRICOS fees.', link: { label: 'CRICOS', href: 'https://cricos.education.gov.au/' } },
      { title: 'Apply to the university', text: 'Apply directly (or through the university’s listed representatives). Each university sets its own Class 12 requirement; many offer a foundation year if you don’t meet it.' },
      { title: 'Accept the offer and get your CoE', text: 'Pay the deposit and buy Overseas Student Health Cover (OSHC); the university then issues the electronic Confirmation of Enrolment.' },
      { title: 'Apply for the Student visa (subclass 500)', text: 'Apply online in ImmiAccount with the CoE, English test, OSHC and proof of funds. You must meet the Genuine Student requirement — explain why this course and why Australia.', link: { label: 'Home Affairs — Student visa', href: 'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/student-500' } },
    ],
    pgSteps: [
      { title: 'Apply to the master’s course', text: 'Coursework master’s: apply directly with bachelor’s marks and IELTS/TOEFL/PTE. Research master’s and PhD: find a supervisor first; Research Training Program scholarships can cover tuition.' },
      { title: 'CoE and Student visa', text: 'Same as bachelor’s: CoE after accepting, then the subclass 500 visa with funds proof.', link: { label: 'Home Affairs — Student visa', href: 'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/student-500' } },
    ],
    costs: [
      { item: 'Tuition', amount: 'Per course (CRICOS)', note: 'See the course list on each university page here (CRICOS data).', source: { label: 'CRICOS', href: 'https://cricos.education.gov.au/' } },
      { item: 'Student visa (subclass 500)', amount: 'AUD 2,500', note: 'Main applicant, applications from 1 July 2026; not refunded if refused.', source: { label: 'Home Affairs — Student visa', href: 'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/student-500' } },
      { item: 'Living costs to show', amount: 'AUD 29,710 a year (1 person)', note: 'Plus first-year tuition and travel, for the financial capacity check.', source: { label: 'Home Affairs — Student visa', href: 'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/student-500' } },
      { item: 'Overseas Student Health Cover', amount: 'Required', note: 'Bought before the CoE, for the whole visa.', source: { label: 'Home Affairs — Student visa', href: 'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/student-500' } },
    ],
    intakes: 'Two main intakes: February/March (Semester 1) and July (Semester 2). Some universities also have a November or trimester intake.',
    tips: [
      'Course fees on the university pages here come from CRICOS — the government register.',
      'Visa refusals often come from a weak Genuine Student statement — make it specific to your course and career.',
      'Use only education agents listed by the university; never pay for a “guaranteed visa”.',
    ],
    official: [
      { label: 'Study Australia (Australian Government)', href: 'https://www.studyaustralia.gov.au/' },
      { label: 'Home Affairs — Student visa', href: 'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/student-500' },
      { label: 'CRICOS', href: 'https://cricos.education.gov.au/' },
    ],
    scholarships: [],
  },

};

export const guideFor = (code?: string | null) => (code && code in GUIDES ? GUIDES[code as Code] : null);

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

// Fee line for one Japanese university: national standard rate, the known 2027 increases, private = own fees
export function japanFeeRule(c: { name?: string | null; type?: string | null }) {
  const name = (c.name || '').toLowerCase();
  if (/tohoku university/.test(name)) return { amount: '¥900,000 a year for international students (from April 2027)', note: 'New international bachelor’s and master’s students; ¥535,800 for those who enrolled earlier. Admission fee ¥282,000.', href: 'https://www.tohoku.ac.jp/en/' };
  if (/university of tsukuba/.test(name)) return { amount: '¥608,800 a year for international students (from April 2027)', note: '¥535,800 for students enrolling in 2026. Admission fee ¥282,000.', href: 'https://www.tsukuba.ac.jp/en/admissions/fees-tuition/' };
  if (/private/i.test(c.type || '')) return { amount: 'Private university — its own fees', note: 'See the official website for this university’s tuition.', href: null };
  return { amount: 'National universities: ¥535,800 a year (standard)', note: 'Plus ¥282,000 admission fee. Since 2024 national universities may charge international students more — check this university’s fee page.', href: 'https://www.studyinjapan.go.jp/en/' };
}
