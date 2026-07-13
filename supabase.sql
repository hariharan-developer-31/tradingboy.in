create table if not exists public.course_orders (
  id uuid primary key default gen_random_uuid(),
  course_name text default 'Complete Forex Mastery',
  full_name text not null,
  email text not null,
  phone text not null,
  trading_experience text,
  terms_accepted boolean not null default false,
  terms_accepted_at timestamptz,
  plan text not null,
  coupon_code text,
  original_amount integer not null default 7199,
  discount_amount integer not null default 0,
  final_amount integer not null default 7199,
  payment_status text not null default 'pending',
  payment_screenshot_path text,
  source text default 'website',
  created_at timestamptz not null default now()
);

alter table public.course_orders add column if not exists course_name text default 'Complete Forex Mastery';
alter table public.course_orders add column if not exists coupon_code text;
alter table public.course_orders add column if not exists original_amount integer not null default 7199;
alter table public.course_orders add column if not exists discount_amount integer not null default 0;
alter table public.course_orders add column if not exists final_amount integer not null default 7199;
alter table public.course_orders add column if not exists payment_status text not null default 'pending';
alter table public.course_orders add column if not exists payment_screenshot_path text;
alter table public.course_orders add column if not exists trading_experience text;
alter table public.course_orders add column if not exists remarks text;
alter table public.course_orders add column if not exists terms_accepted boolean not null default false;
alter table public.course_orders add column if not exists terms_accepted_at timestamptz;

alter table public.course_orders enable row level security;

drop policy if exists "Allow public course order inserts" on public.course_orders;
drop policy if exists "Allow frontend course order reads" on public.course_orders;
drop policy if exists "Allow frontend payment status updates" on public.course_orders;

revoke all on table public.course_orders from anon;

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  course_name text,
  discount_type text not null check (discount_type in ('fixed', 'percent')),
  discount_value integer not null check (discount_value > 0),
  active boolean not null default true,
  expires_at timestamptz,
  max_uses integer,
  current_uses integer not null default 0,
  created_at timestamptz not null default now()
);

-- Migration for existing table
alter table public.coupons add column if not exists expires_at timestamptz;
alter table public.coupons add column if not exists max_uses integer;
alter table public.coupons add column if not exists current_uses integer not null default 0;
alter table public.coupons add column if not exists course_name text;

alter table public.coupons enable row level security;

drop policy if exists "Allow public coupon reads" on public.coupons;
drop policy if exists "Allow frontend coupon management" on public.coupons;

revoke all on table public.coupons from anon;

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  thumbnail_url text,
  normal_price integer,
  offer_price integer,
  price integer not null default 7199 check (price > 0),
  drive_url text,
  discord_url text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.courses enable row level security;
alter table public.courses add column if not exists thumbnail_url text;
alter table public.courses add column if not exists normal_price integer;
alter table public.courses add column if not exists offer_price integer;
alter table public.courses add column if not exists discord_url text;

drop policy if exists "Allow public active course reads" on public.courses;

create policy "Allow public active course reads"
on public.courses
for select
to anon
using (active = true);

revoke select on table public.courses from anon;
grant select (id, title, description, thumbnail_url, normal_price, offer_price, price, active, created_at)
on table public.courses to anon;

insert into public.courses (title, description, price, drive_url, active)
select
  'Complete Forex Mastery',
  'A structured forex trading course covering market structure, liquidity, risk management, and live execution.',
  7199,
  null,
  true
where not exists (
  select 1 from public.courses where title = 'Complete Forex Mastery'
);

update public.courses
set
  normal_price = coalesce(normal_price, 7199),
  offer_price = coalesce(offer_price, 7199)
where title = 'Complete Forex Mastery';

insert into public.courses (title, description, price, drive_url, active)
select
  'Blueprint to Become a Funded Trader',
  'Gold trading and gold futures training with funded account rules, evaluation strategy, drawdown control, and risk-first execution.',
  5399,
  null,
  true
where not exists (
  select 1 from public.courses where title = 'Blueprint to Become a Funded Trader'
);

update public.courses
set
  normal_price = coalesce(normal_price, 26999),
  offer_price = coalesce(offer_price, 5399)
where title = 'Blueprint to Become a Funded Trader';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-proofs', 'payment-proofs', false, 102400, array['image/jpeg'])
on conflict (id) do update
set
  public = false,
  file_size_limit = 102400,
  allowed_mime_types = array['image/jpeg'];

drop policy if exists "Service role can manage payment proofs" on storage.objects;

create policy "Service role can manage payment proofs"
on storage.objects
for all
to service_role
using (bucket_id = 'payment-proofs')
with check (bucket_id = 'payment-proofs');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('course-thumbnails', 'course-thumbnails', true, 102400, array['image/jpeg'])
on conflict (id) do update
set
  public = true,
  file_size_limit = 102400,
  allowed_mime_types = array['image/jpeg'];

drop policy if exists "Allow public course thumbnail reads" on storage.objects;
create policy "Allow public course thumbnail reads"
on storage.objects
for select
to anon
using (bucket_id = 'course-thumbnails');

drop policy if exists "Service role can manage course thumbnails" on storage.objects;
create policy "Service role can manage course thumbnails"
on storage.objects
for all
to service_role
using (bucket_id = 'course-thumbnails')
with check (bucket_id = 'course-thumbnails');

create table if not exists public.testimonials (
  id uuid primary key default gen_random_uuid(),
  quote text not null,
  name text not null,
  role text not null,
  photo_url text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Note for user: Run this alter table if you already created the table previously:
-- alter table public.testimonials add column if not exists photo_url text;

alter table public.testimonials enable row level security;

drop policy if exists "Allow public active testimonial reads" on public.testimonials;
create policy "Allow public active testimonial reads"
on public.testimonials
for select
to anon
using (active = true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('testimonial-photos', 'testimonial-photos', true, 102400, array['image/jpeg'])
on conflict (id) do update
set
  public = true,
  file_size_limit = 102400,
  allowed_mime_types = array['image/jpeg'];

drop policy if exists "Allow public testimonial photo reads" on storage.objects;
create policy "Allow public testimonial photo reads"
on storage.objects
for select
to anon
using (bucket_id = 'testimonial-photos');

drop policy if exists "Service role can manage testimonial photos" on storage.objects;
create policy "Service role can manage testimonial photos"
on storage.objects
for all
to service_role
using (bucket_id = 'testimonial-photos')
with check (bucket_id = 'testimonial-photos');
