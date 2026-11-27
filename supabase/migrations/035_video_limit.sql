-- Collegeolo.com — migration 035: smaller videos to save server disk and bandwidth.
-- The storage server itself now refuses any file over 20 MB in the "community" bucket (photos are shrunk in the browser
-- to well under 1 MB, so this only affects videos). The website also checks: 20 MB, and shots up to 60 seconds.
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema = 'storage' and table_name = 'buckets' and column_name = 'file_size_limit') then
    update storage.buckets set file_size_limit = 20971520 where id = 'community';
  end if;
end $$;
