-- 058 · First verified scholarships (researched 27 Nov 2026 from official / government pages).
--   Deadlines change every year, so none are stored — each listing sends students to the official page for the current date.
--   Admins edit or add more in Admin → Scholarships. Existing rows (same slug) are left untouched.

insert into public.scholarships (slug, name, provider, host_country, for_nationalities, levels, field, amount, currency, amount_note, deadline, eligibility, how_to_apply, official_url, is_published)
values
('central-sector-scholarship-pm-usp', 'PM-USP Central Sector Scheme of Scholarship for College and University Students',
 'Department of Higher Education, Ministry of Education, Govt. of India', 'IN', '{IN}', '{UG,PG}', 'Any', 12000, 'INR',
 '₹12,000 a year at graduation level (first three years); paid by DBT to your Aadhaar-seeded bank account', null,
 'Meritorious Class 12 pass students from low-income families studying in a regular college / university course in India. Check the latest income and merit cut-off in the official guidelines.',
 E'1. Register on the National Scholarship Portal (scholarships.gov.in) with your own mobile and email.\n2. Choose “PM-USP Central Sector Scheme of Scholarship for College and University Students”.\n3. Fill personal, academic and bank details, upload documents and submit.\n4. Your college verifies the application online. Renew every year on NSP.',
 'https://scholarships.gov.in/', true),

('aicte-pragati-scholarship-girls', 'AICTE Pragati Scholarship for Girl Students (Technical Degree / Diploma)',
 'All India Council for Technical Education (AICTE)', 'IN', '{IN}', '{UG,Diploma}', 'Engineering & technical', 50000, 'INR',
 '₹50,000 a year for every year of study (up to 4 years for degree) — for college fees, computer, books, equipment', null,
 'Girl students admitted to the first year (or second year through lateral entry) of a degree / diploma course in an AICTE-approved institution, within the family-income limit in the notice. Up to two girls per family.',
 E'1. Apply on the National Scholarship Portal (scholarships.gov.in) when AICTE opens the window (usually after admissions).\n2. Upload Class 10/12 marks, admission letter, income certificate and bank details.\n3. Your institute verifies the application. Renew every year.',
 'https://scholarships.gov.in/', true),

('aicte-saksham-scholarship', 'AICTE Saksham Scholarship for Specially-abled Students',
 'All India Council for Technical Education (AICTE)', 'IN', '{IN}', '{UG,Diploma}', 'Engineering & technical', 50000, 'INR',
 '₹50,000 a year for every year of study — for college fees, computer, books, equipment', null,
 'Students with a disability of not less than 40% admitted to the first year (or second year through lateral entry) of a degree / diploma course in an AICTE-approved institution, within the income limit in the notice.',
 E'1. Apply on the National Scholarship Portal (scholarships.gov.in).\n2. Upload your disability certificate (40% or more), marks, admission proof, income certificate and bank details.\n3. Your institute verifies the application.',
 'https://www.myscheme.gov.in/schemes/sak-deg', true),

('inspire-she-scholarship', 'INSPIRE Scholarship for Higher Education (SHE)',
 'Department of Science & Technology (DST), Govt. of India', 'IN', '{IN}', '{UG,PG}', 'Natural & basic sciences', 80000, 'INR',
 '₹80,000 a year: ₹60,000 scholarship (₹5,000 a month) + ₹20,000 summer mentorship grant', null,
 'Students aged 17–22 studying for a bachelor’s / integrated master’s in natural and basic sciences who meet the merit criteria in DST’s call (based on Class 12 results). Engineering, medicine and other professional courses are not covered.',
 E'1. Apply on the INSPIRE portal (online-inspire.gov.in) when DST announces the call.\n2. Upload Class 12 marks, eligibility certificate from your board, and the endorsement from your college principal.\n3. Keep the scholarship by passing every year with the required marks.',
 'https://online-inspire.gov.in/', true),

('reliance-foundation-ug-scholarship', 'Reliance Foundation Undergraduate Scholarships',
 'Reliance Foundation', 'IN', '{IN}', '{UG}', 'Any stream', 200000, 'INR',
 'Up to ₹2 lakh over the whole degree, plus mentoring and alumni network', null,
 'First-year undergraduate students in a regular full-time course in India, family income up to ₹15 lakh a year (preference below ₹2.5 lakh), minimum 60% in Class 12. Selection is merit-cum-means with a mandatory online aptitude test.',
 E'1. Apply on the Reliance Foundation scholarship website when applications open (usually after first-year admissions).\n2. Fill the form, upload Class 10/12 mark sheets, bonafide / ID card and family income proof.\n3. Take the online aptitude test.',
 'https://www.scholarships.reliancefoundation.org/', true),

('national-overseas-scholarship-sc', 'National Overseas Scholarship for SC etc. Candidates',
 'Ministry of Social Justice & Empowerment, Govt. of India', null, '{IN}', '{PG,PhD}', 'Any', null, null,
 'Full support for a Master’s or PhD abroad (tuition, maintenance, travel) — 125 awards a year', null,
 'Low-income students from Scheduled Castes, Denotified Nomadic and Semi-Nomadic Tribes, Landless Agricultural Labourers and Traditional Artisans families, with an admission to a top-ranked foreign university. See marks, age and income limits in the guidelines.',
 E'1. Get an admission offer from an eligible foreign university.\n2. Apply on the NOS portal (nosmsje.gov.in) during the selection round.\n3. Upload Class 10 certificate, caste certificate, income proof, marks and admission letter.',
 'https://nosmsje.gov.in/', true),

('fulbright-nehru-masters', 'Fulbright-Nehru Master’s Fellowships (USA)',
 'United States-India Educational Foundation (USIEF)', 'US', '{IN}', '{PG}', 'Economics, Environment, International Affairs, Public Health and more', null, null,
 'Funding for a master’s degree at a U.S. university for up to two years (tuition and living costs as per the award; no support for dependants)', null,
 'Indian citizens living in India with the equivalent of a U.S. bachelor’s degree, at least three years of professional work experience and leadership qualities, in the listed fields.',
 E'1. Read the current call on usief.org.in (applications usually close in May for study the year after next).\n2. Apply online with essays, references and transcripts.\n3. Shortlisted candidates are interviewed; USIEF helps with university placement.',
 'https://www.usief.org.in/Fulbright-Nehru-Fellowships.aspx', true),

('chevening-scholarship-uk', 'Chevening Scholarships (UK)',
 'UK Government (FCDO)', 'GB', '{IN}', '{PG}', 'Any (one-year master’s)', null, null,
 'Fully funded one-year master’s in the UK: tuition, monthly living allowance and travel (see the official site for exact terms)', null,
 'Indian citizens with an undergraduate degree and at least two years’ (2,800 hours) work experience after graduation, who apply to three eligible UK master’s courses and return to India for at least two years afterwards.',
 E'1. Apply on chevening.org when the window opens (usually August – early October).\n2. Write four essays (leadership, networking, why the UK, career plan) and choose three UK courses.\n3. Shortlisted candidates are interviewed at the British High Commission.',
 'https://www.chevening.org/', true),

('commonwealth-masters-scholarship-uk', 'Commonwealth Master’s Scholarships (UK)',
 'Commonwealth Scholarship Commission UK, through the Ministry of Education (India)', 'GB', '{IN}', '{PG}', 'Development-related subjects (no MBA)', null, null,
 'Fully funded one-year taught master’s in the UK: fees, airfare and living allowance', null,
 'Indian citizens who could not afford to study in the UK without this scholarship, with a good first degree, applying for a one-year taught master’s (MBA not funded). India nominates candidates to the CSC.',
 E'1. Watch for the Ministry of Education (External Scholarship Division) notice on education.gov.in.\n2. Apply online to the Ministry for nomination and on the CSC system.\n3. Nominated candidates are selected by the CSC in the UK.',
 'https://cscuk.fcdo.gov.uk/scholarships/commonwealth-masters-scholarships/', true),

('erasmus-mundus-joint-masters', 'Erasmus Mundus Joint Masters Scholarships (Europe)',
 'European Union (Erasmus+)', null, '{}', '{PG}', 'Many subjects', null, null,
 'Covers tuition and participation costs, insurance, travel and a monthly allowance for the whole programme', null,
 'Students with a bachelor’s degree (or final-year students) of any nationality applying to an Erasmus Mundus Joint Master programme; each programme sets its own entry rules.',
 E'1. Pick a programme in the Erasmus Mundus catalogue.\n2. Apply directly to that programme’s consortium before its deadline (most close between October and January).\n3. Apply for the scholarship in the same application.',
 'https://www.eacea.ec.europa.eu/scholarships/erasmus-mundus-catalogue_en', true),

('daad-scholarships-germany', 'DAAD Scholarships for Master’s and PhD in Germany',
 'German Academic Exchange Service (DAAD)', 'DE', '{}', '{PG,PhD}', 'Many subjects', null, null,
 'Monthly stipend, health insurance and travel support (amount depends on the programme)', null,
 'Graduates and researchers from India applying for a master’s, PhD or research stay in Germany; each DAAD programme has its own eligibility and deadline.',
 E'1. Find the right programme on daad.in (Scholarships for Study & Research in Germany).\n2. Check the programme’s eligibility and deadline.\n3. Apply on the DAAD portal with your documents.',
 'https://www.daad.in/en/study-research-in-germany/scholarships/', true),

('mext-japan-research-students', 'Japanese Government (MEXT) Scholarship — Research Students',
 'Government of Japan, through the Embassy of Japan in India', 'JP', '{IN}', '{PG,PhD}', 'Many subjects', null, null,
 'Monthly allowance, free tuition and a return air ticket', null,
 'Indian graduates (age limit in the guidelines) who want to do research, a master’s or a PhD at a Japanese university.',
 E'1. Read the guidelines on the Embassy of Japan in India website (applications usually open in April – May).\n2. Email the preliminary application form with your research plan.\n3. Shortlisted candidates take a written test and an interview.',
 'https://www.in.emb-japan.go.jp/Education/Research_Student.html', true)
on conflict (slug) do nothing;
