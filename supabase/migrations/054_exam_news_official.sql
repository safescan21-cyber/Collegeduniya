-- 054 · Exam news from each exam's own website (official notices), not only news headlines
--   date_known = false: the notice shows no date, so published_at is the day Collegeolo first saw it ("Seen on …")

alter table public.exam_news add column if not exists date_known boolean not null default true;
