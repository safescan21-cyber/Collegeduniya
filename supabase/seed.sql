-- =====================================================================
-- Collegeolo.com — DEMO seed data (run after schema.sql)
-- All fees, rents, jobs, hostels and contacts below are SAMPLE values
-- to make the site look alive while you build. Replace or delete them
-- from the Admin panel before going live.
-- =====================================================================

insert into public.colleges
  (slug, name, short_name, type, country, state, city, address, latitude, longitude, established, ranking,
   accreditation, website, description, fees_min, fees_max, currency, streams, facilities, cover_url, logo_url, is_featured)
values
('iit-delhi','Indian Institute of Technology Delhi','IIT Delhi','Public','India','Delhi','New Delhi','Hauz Khas, New Delhi',28.5450,77.1926,1961,2,
 'NAAC A++','https://home.iitd.ac.in','One of India''s premier engineering and technology institutes offering UG, PG and doctoral programmes.',
 220000,250000,'INR','{Engineering,Science,Management}','{Library,Hostel,Wi-Fi,Sports,Labs,Medical}',
 'https://images.unsplash.com/photo-1562774053-701939374585?w=1200','',true),
('du-north-campus','University of Delhi','DU','Public','India','Delhi','New Delhi','North Campus, Delhi',28.6889,77.2100,1922,11,
 'NAAC A++','https://www.du.ac.in','Large central university with dozens of affiliated colleges across arts, commerce and science.',
 15000,60000,'INR','{Arts,Commerce,Science,Law}','{Library,Hostel,Wi-Fi,Sports,Cafeteria}',
 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=1200','',true),
('christ-university-bangalore','Christ University','Christ','Deemed','India','Karnataka','Bengaluru','Hosur Road, Bengaluru',12.9343,77.6060,1969,60,
 'NAAC A+','https://christuniversity.in','Multi-disciplinary deemed university known for commerce, management and humanities.',
 150000,400000,'INR','{Commerce,Management,Arts,Law}','{Library,Hostel,Wi-Fi,Sports,Auditorium}',
 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=1200','',true),
('symbiosis-pune','Symbiosis International University','SIU','Deemed','India','Maharashtra','Pune','Lavale, Pune',18.5370,73.7290,1971,30,
 'NAAC A++','https://www.siu.edu.in','Private deemed university with institutes for management, law, design and media.',
 300000,900000,'INR','{Management,Law,Design,Media}','{Library,Hostel,Wi-Fi,Gym,Cafeteria}',
 'https://images.unsplash.com/photo-1607237138185-eedd9c632b0b?w=1200','',false),
('university-of-toronto','University of Toronto','U of T','Public','Canada','Ontario','Toronto','27 King''s College Cir, Toronto',43.6629,-79.3957,1827,21,
 '', 'https://www.utoronto.ca','Canada''s largest research university with three campuses in the Greater Toronto Area.',
 45000,65000,'CAD','{Engineering,Science,Arts,Medicine}','{Library,Residence,Wi-Fi,Sports,Health Centre}',
 'https://images.unsplash.com/photo-1569447891824-7a1758aa73a2?w=1200','',true),
('university-of-melbourne','The University of Melbourne','UniMelb','Public','Australia','Victoria','Melbourne','Parkville VIC',-37.7964,144.9612,1853,14,
 '', 'https://www.unimelb.edu.au','Leading Australian research university popular with international students.',
 38000,50000,'AUD','{Science,Arts,Commerce,Engineering}','{Library,Residence,Wi-Fi,Sports}',
 'https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=1200','',true),
('university-of-manchester','The University of Manchester','UoM','Public','United Kingdom','England','Manchester','Oxford Rd, Manchester',53.4668,-2.2339,1824,34,
 '', 'https://www.manchester.ac.uk','Large UK research university with a strong international student community.',
 24000,32000,'GBP','{Engineering,Business,Science,Arts}','{Library,Residence,Wi-Fi,Gym}',
 'https://images.unsplash.com/photo-1498243691581-b145c3f54a5a?w=1200','',false),
('tu-munich','Technical University of Munich','TUM','Public','Germany','Bavaria','Munich','Arcisstraße 21, München',48.1497,11.5679,1868,28,
 '', 'https://www.tum.de','Top German technical university; most programmes carry only a small semester fee.',
 300,6000,'EUR','{Engineering,Science,Management}','{Library,Wi-Fi,Labs,Sports}',
 'https://images.unsplash.com/photo-1590012314607-cda9d9b699ae?w=1200','',false)
on conflict (slug) do nothing;

-- Courses
insert into public.courses (college_id, name, level, duration, fees, currency, seats, eligibility)
select c.id, v.name, v.level, v.duration, v.fees, c.currency, v.seats, v.elig
from public.colleges c
join (values
  ('iit-delhi','B.Tech Computer Science','UG','4 years',230000,120,'JEE Advanced'),
  ('iit-delhi','M.Tech Electrical','PG','2 years',100000,60,'GATE'),
  ('iit-delhi','MBA','PG','2 years',500000,120,'CAT'),
  ('du-north-campus','B.Com (Hons)','UG','3 years',25000,500,'CUET-UG'),
  ('du-north-campus','BA English (Hons)','UG','3 years',20000,300,'CUET-UG'),
  ('du-north-campus','LLB','UG','3 years',15000,200,'DU LLB Entrance'),
  ('christ-university-bangalore','BBA','UG','3 years',250000,400,'Christ Entrance + Interview'),
  ('christ-university-bangalore','MBA','PG','2 years',400000,300,'CAT/MAT + Interview'),
  ('symbiosis-pune','BBA LLB','UG','5 years',450000,180,'SLAT'),
  ('symbiosis-pune','MBA','PG','2 years',900000,240,'SNAP'),
  ('university-of-toronto','BSc Computer Science','UG','4 years',61000,0,'High school + English test'),
  ('university-of-melbourne','Master of Information Technology','PG','2 years',48000,0,'Bachelor degree + IELTS 6.5'),
  ('university-of-manchester','MSc Data Science','PG','1 year',31000,0,'Bachelor degree + IELTS 6.5'),
  ('tu-munich','MSc Informatics','PG','2 years',300,0,'Bachelor in CS + aptitude assessment')
) as v(slug,name,level,duration,fees,seats,elig) on v.slug = c.slug
where not exists (select 1 from public.courses x where x.college_id = c.id and x.name = v.name);

-- Nearby companies / hospitals
insert into public.places (college_id, kind, name, address, distance_km)
select c.id, v.kind, v.name, v.addr, v.km
from public.colleges c
join (values
  ('iit-delhi','hospital','AIIMS New Delhi','Ansari Nagar',3.5),
  ('iit-delhi','hospital','Safdarjung Hospital','Ansari Nagar West',3.8),
  ('iit-delhi','company','Tech Park Saket (sample)','Saket District Centre',4.0),
  ('du-north-campus','hospital','Hindu Rao Hospital','Malka Ganj',2.0),
  ('du-north-campus','company','Netaji Subhash Place offices (sample)','Pitampura',6.5),
  ('christ-university-bangalore','company','Koramangala start-up hub (sample)','Koramangala',2.0),
  ('christ-university-bangalore','hospital','St. John''s Medical College Hospital','Koramangala',2.5),
  ('symbiosis-pune','company','Hinjewadi IT Park','Hinjewadi',9.0),
  ('university-of-toronto','hospital','Toronto General Hospital','200 Elizabeth St',1.2),
  ('university-of-melbourne','hospital','Royal Melbourne Hospital','Parkville',0.8)
) as v(slug,kind,name,addr,km) on v.slug = c.slug
where not exists (select 1 from public.places x where x.college_id = c.id and x.name = v.name);

-- PG / Hostels (sample)
insert into public.hostels (name, type, gender, college_id, country, city, address, latitude, longitude,
  rent_min, rent_max, currency, amenities, description, photos, contact_name, contact_phone, is_verified)
select v.name, v.type, v.gender, c.id, c.country, c.city, v.addr, v.lat, v.lng, v.rmin, v.rmax, c.currency,
       v.amen::text[], v.descr, array[v.photo], 'Owner', '+91 90000 00000', true
from public.colleges c
join (values
  ('iit-delhi','Hauz Khas Scholars PG','PG','Boys','Hauz Khas Village',28.5535,77.1940,9000,14000,'{Food,Wi-Fi,AC,Laundry}','Walking distance to campus, 3 meals a day.','https://images.unsplash.com/photo-1555854877-bab0e564b8d5?w=900'),
  ('iit-delhi','Green Park Girls Residency','PG','Girls','Green Park',28.5590,77.2060,11000,16000,'{Food,Wi-Fi,CCTV,Housekeeping}','Secure girls PG with warden and biometric entry.','https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=900'),
  ('du-north-campus','Kamla Nagar Student Hostel','Hostel','Co-ed','Kamla Nagar',28.6810,77.2050,7000,12000,'{Food,Wi-Fi,Library,Laundry}','Budget hostel near Arts Faculty.','https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=900'),
  ('christ-university-bangalore','Koramangala Comfort Stay','PG','Co-ed','Koramangala 4th Block',12.9352,77.6245,10000,18000,'{Food,Wi-Fi,AC,Gym}','Modern PG with study room.','https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=900'),
  ('symbiosis-pune','Lavale Hills PG','PG','Boys','Lavale',18.5400,73.7300,8000,13000,'{Food,Wi-Fi,Transport}','Free shuttle to campus.','https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=900'),
  ('university-of-toronto','Annex Student House','Homestay','Co-ed','Annex, Toronto',43.6680,-79.4040,900,1300,'{Wi-Fi,Kitchen,Laundry}','Shared rooms 10 min walk from St. George campus.','https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=900')
) as v(slug,name,type,gender,addr,lat,lng,rmin,rmax,amen,descr,photo) on v.slug = c.slug
where not exists (select 1 from public.hostels h where h.name = v.name);

-- Part-time jobs (sample)
insert into public.jobs (title, company, job_type, college_id, country, city, address, latitude, longitude,
  is_remote, pay_min, pay_max, currency, pay_unit, hours_per_week, description, requirements, skills, deadline)
select v.title, v.company, v.jtype, c.id, c.country, c.city, v.addr, v.lat, v.lng, v.remote, v.pmin, v.pmax,
       c.currency, v.unit, v.hrs, v.descr, v.req, v.skills::text[], (current_date + 30)
from public.colleges c
join (values
  ('iit-delhi','Maths Tutor (Class 9–12)','BrightPath Tutors','Part-time','Malviya Nagar',28.5330,77.2100,false,400,600,'hour',10,'Teach JEE-level maths to school students in the evenings.','Strong maths; good communication.','{Teaching,Maths}'),
  ('iit-delhi','Content Writer Intern','EduWrite Media','Internship','Remote',28.5450,77.1926,true,8000,12000,'month',20,'Write blog posts about colleges and exams.','Good written English.','{Writing,SEO}'),
  ('du-north-campus','Café Barista (Weekends)','Campus Brew','Weekend','Kamla Nagar',28.6820,77.2060,false,150,200,'hour',12,'Weekend shifts at a busy student café.','Friendly, punctual.','{Customer Service}'),
  ('christ-university-bangalore','Social Media Assistant','Koramangala Startups','Part-time','Koramangala',12.9350,77.6200,false,10000,15000,'month',15,'Manage Instagram and LinkedIn for a growing start-up.','Canva, basic copywriting.','{Social Media,Canva}'),
  ('symbiosis-pune','Junior Web Developer (Part-time)','Hinjewadi Softworks','Part-time','Hinjewadi Phase 1',18.5910,73.7380,false,15000,25000,'month',20,'Build React pages for client projects.','HTML, CSS, JavaScript, React basics.','{React,JavaScript}'),
  ('university-of-toronto','Library Assistant','Campus Library Services','Part-time','St. George Campus',43.6629,-79.3957,false,17,19,'hour',12,'Shelving, front-desk help and study-room bookings.','Enrolled student; 12 hrs/week.','{Organisation}'),
  ('university-of-melbourne','Retail Team Member','Lygon St Store','Part-time','Carlton',-37.8000,144.9670,false,25,29,'hour',15,'Flexible evening and weekend shifts.','Valid student work rights.','{Retail}')
) as v(slug,title,company,jtype,addr,lat,lng,remote,pmin,pmax,unit,hrs,descr,req,skills) on v.slug = c.slug
where not exists (select 1 from public.jobs j where j.title = v.title and j.company = v.company);
