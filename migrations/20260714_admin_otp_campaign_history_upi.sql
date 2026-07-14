alter table public.courses add column if not exists upi_id text;

alter table public.email_campaigns add column if not exists attachment_path text;
alter table public.email_campaigns add column if not exists attachment_name text;
alter table public.email_campaigns add column if not exists attachment_type text;

update public.courses
set upi_id = 'harishsankar023@okaxis'
where upi_id is null or btrim(upi_id) = '';

alter table public.courses alter column upi_id set not null;

