-- =====================================================================
-- Collegeolo.com — DEMO data for migration 002 (optional)
-- Exams below describe each test in general terms only. Dates, cutoffs,
-- placement figures and the article are SAMPLE values for testing —
-- replace them with figures from official sources before launch.
-- =====================================================================

insert into public.exams (slug, short_name, full_name, stream, level, country, conducting_body, mode, frequency, exam_date, website, eligibility, pattern, description)
values
('jee-main','JEE Main','Joint Entrance Examination (Main)','Engineering','UG','India','National Testing Agency (NTA)','Computer-based test','Twice a year','Check official website','https://jeemain.nta.nic.in',
 'Class 12 with Physics, Chemistry and Mathematics.','Physics, Chemistry and Mathematics; multiple-choice and numerical questions.',
 'National entrance exam for B.Tech/B.E. admission to NITs, IIITs and other institutes, and the qualifier for JEE Advanced.'),
('jee-advanced','JEE Advanced','Joint Entrance Examination (Advanced)','Engineering','UG','India','IITs (rotating)','Computer-based test','Once a year','Check official website','https://jeeadv.ac.in',
 'Top JEE Main qualifiers.','Two papers covering Physics, Chemistry and Mathematics.','Entrance exam for admission to the IITs.'),
('neet-ug','NEET UG','National Eligibility cum Entrance Test (UG)','Medical','UG','India','National Testing Agency (NTA)','Pen and paper','Once a year','Check official website','https://neet.nta.nic.in',
 'Class 12 with Physics, Chemistry, Biology/Biotechnology and English.','Physics, Chemistry, Botany and Zoology; multiple choice.','Entrance exam for MBBS, BDS and other medical courses in India.'),
('cuet-ug','CUET UG','Common University Entrance Test (UG)','General','UG','India','National Testing Agency (NTA)','Computer-based test','Once a year','Check official website','https://cuet.nta.nic.in',
 'Class 12 pass or appearing.','Languages, domain subjects and a general test.','Entrance test for UG admission to central and many other universities, including Delhi University.'),
('cat','CAT','Common Admission Test','Management','PG','India','IIMs (rotating)','Computer-based test','Once a year','Check official website','https://iimcat.ac.in',
 'Bachelor''s degree with the minimum marks set by the IIMs.','Verbal ability, data interpretation & logical reasoning, quantitative ability.','Entrance exam for MBA/PGP programmes at IIMs and many other B-schools.'),
('gate','GATE','Graduate Aptitude Test in Engineering','Engineering','PG','India','IISc / IITs (rotating)','Computer-based test','Once a year','Check official website','https://gate.iitk.ac.in',
 'Bachelor''s in engineering/technology/science or in final year.','General aptitude plus the chosen subject paper.','Used for M.Tech admissions and PSU recruitment.'),
('ielts','IELTS','International English Language Testing System','Language','Abroad','Global','British Council / IDP / Cambridge','Paper or computer','Many dates a year','Book on official website','https://ielts.org',
 'No formal eligibility.','Listening, Reading, Writing, Speaking.','English test accepted by universities in the UK, Canada, Australia and many other countries.')
on conflict (slug) do nothing;

-- Sample placement rows (DEMO figures)
insert into public.college_placements (college_id, year, course, avg_package, median_package, highest_package, currency, placement_rate, companies_visited, top_recruiters, source)
select c.id, 2026, 'All', v.avg, v.med, v.hi, 'INR', v.rate, v.comp, v.rec::text[], 'Demo data — replace with official report'
from public.colleges c
join (values
  ('iit-delhi',2000000,1800000,10000000,92,350,'{Google,Microsoft,Goldman Sachs,Qualcomm}'),
  ('christ-university-bangalore',600000,500000,2000000,80,200,'{Deloitte,EY,KPMG,Amazon}'),
  ('symbiosis-pune',1200000,1100000,3000000,95,150,'{Accenture,HUL,ICICI Bank,Infosys}')
) as v(slug,avg,med,hi,rate,comp,rec) on v.slug = c.slug
on conflict (college_id, year, course) do nothing;

-- Sample cutoffs (DEMO closing ranks) so the predictor can be tested
insert into public.cutoffs (college_id, exam_slug, year, course, category, quota, round, opening_rank, closing_rank, source)
select c.id, v.exam, v.yr, v.course, v.cat, 'All India', 'Final', v.op, v.cl, 'Demo data'
from public.colleges c
join (values
  ('iit-delhi','jee-advanced',2026,'B.Tech Computer Science','General',1,120),
  ('iit-delhi','jee-advanced',2026,'B.Tech Electrical','General',300,900),
  ('iit-delhi','jee-advanced',2026,'B.Tech Computer Science','OBC-NCL',1,60),
  ('du-north-campus','cuet-ug',2026,'B.Com (Hons)','General',1,4000),
  ('du-north-campus','cuet-ug',2026,'BA English (Hons)','General',1,6000),
  ('christ-university-bangalore','cuet-ug',2026,'BBA','General',1,25000)
) as v(slug,exam,yr,course,cat,op,cl) on v.slug = c.slug
where not exists (select 1 from public.cutoffs x where x.college_id = c.id and x.exam_slug = v.exam and x.course = v.course and x.category = v.cat and x.year = v.yr);

-- Mark two colleges as accepting the common application (demo)
update public.colleges set accepts_applications = true, application_note = 'Demo partner — no application fee'
where slug in ('christ-university-bangalore','symbiosis-pune');

insert into public.articles (slug, title, excerpt, body, category, author_name, tags)
values ('how-to-choose-a-pg-near-college','How to choose a safe PG near your college',
 'A simple checklist for students moving to a new city.',
 E'## Before you visit\n\n- Check the distance and travel time to campus.\n- Ask what the rent includes: food, Wi-Fi, electricity, laundry.\n\n## On the visit\n\n- Look at the room, washroom and kitchen.\n- Ask about rules, curfew and security.\n- Talk to a student who already lives there.\n\n## Before you pay\n\n- Get the rent and deposit in writing.\n- Never pay the full deposit before seeing the room.',
 'hostel','Collegeolo Team','{PG,hostel,checklist}')
on conflict (slug) do nothing;
