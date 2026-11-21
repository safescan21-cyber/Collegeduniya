-- Official exams (stable facts only: name, conducting body, stream, level, official website).
-- Dates, fees and syllabus change every year — add them in Admin → Exams from the official notice.
insert into public.exams (slug, short_name, full_name, stream, level, country, conducting_body, mode, website) values
 ('jee-main','JEE Main','Joint Entrance Examination (Main)','Engineering','UG','India','National Testing Agency (NTA)','Computer-based','https://jeemain.nta.nic.in'),
 ('jee-advanced','JEE Advanced','Joint Entrance Examination (Advanced)','Engineering','UG','India','IITs (organising IIT changes yearly)','Computer-based','https://jeeadv.ac.in'),
 ('neet-ug','NEET UG','National Eligibility cum Entrance Test (UG)','Medical','UG','India','National Testing Agency (NTA)','Pen and paper','https://neet.nta.nic.in'),
 ('neet-pg','NEET PG','National Eligibility cum Entrance Test (PG)','Medical','PG','India','National Board of Examinations in Medical Sciences (NBEMS)','Computer-based','https://natboard.edu.in'),
 ('cuet-ug','CUET UG','Common University Entrance Test (UG)','All streams','UG','India','National Testing Agency (NTA)','Computer-based','https://cuet.nta.nic.in'),
 ('cuet-pg','CUET PG','Common University Entrance Test (PG)','All streams','PG','India','National Testing Agency (NTA)','Computer-based',null),
 ('cat','CAT','Common Admission Test','Management','PG','India','Indian Institutes of Management (IIMs)','Computer-based','https://iimcat.ac.in'),
 ('xat','XAT','Xavier Aptitude Test','Management','PG','India','XLRI Jamshedpur','Computer-based','https://xatonline.in'),
 ('gate','GATE','Graduate Aptitude Test in Engineering','Engineering','PG','India','IISc Bengaluru and IITs (organising institute changes yearly)','Computer-based',null),
 ('clat','CLAT','Common Law Admission Test','Law','UG','India','Consortium of National Law Universities','Pen and paper','https://consortiumofnlus.ac.in'),
 ('bitsat','BITSAT','BITS Admission Test','Engineering','UG','India','BITS Pilani','Computer-based','https://www.bitsadmission.com'),
 ('mht-cet','MHT CET','Maharashtra Common Entrance Test','Engineering / Pharmacy','UG','India','State Common Entrance Test Cell, Maharashtra','Computer-based','https://cetcell.mahacet.org'),
 ('kcet','KCET','Karnataka Common Entrance Test','Engineering / Professional','UG','India','Karnataka Examinations Authority (KEA)','Pen and paper','https://cetonline.karnataka.gov.in/kea/'),
 ('wbjee','WBJEE','West Bengal Joint Entrance Examination','Engineering / Pharmacy','UG','India','West Bengal Joint Entrance Examinations Board','Pen and paper','https://wbjeeb.nic.in'),
 ('ap-eapcet','AP EAPCET','Andhra Pradesh Engineering, Agriculture and Pharmacy CET','Engineering / Agriculture / Pharmacy','UG','India','APSCHE (conducted by a state university)','Computer-based','https://cets.apsche.ap.gov.in'),
 ('ts-eapcet','TS EAPCET','Telangana Engineering, Agriculture and Pharmacy CET','Engineering / Agriculture / Pharmacy','UG','India','Telangana Council of Higher Education (conducted by JNTU Hyderabad)','Computer-based','https://eapcet.tgche.ac.in'),
 ('sat','SAT','SAT','All streams','Abroad','United States','College Board','Digital','https://satsuite.collegeboard.org/sat'),
 ('gre','GRE','GRE General Test','All streams','Abroad','Worldwide','ETS','Computer-based','https://www.ets.org/gre.html'),
 ('gmat','GMAT','GMAT Focus Edition','Management','Abroad','Worldwide','GMAC','Computer-based','https://www.mba.com'),
 ('ielts','IELTS','International English Language Testing System','English test','Abroad','Worldwide','British Council, IDP, Cambridge','Paper or computer','https://ielts.org'),
 ('toefl','TOEFL iBT','Test of English as a Foreign Language','English test','Abroad','Worldwide','ETS','Computer-based','https://www.ets.org/toefl.html'),
 ('pte','PTE Academic','Pearson Test of English Academic','English test','Abroad','Worldwide','Pearson','Computer-based','https://www.pearsonpte.com')
on conflict (slug) do nothing;
