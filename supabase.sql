create table if not exists public.course_orders (
  id uuid primary key default gen_random_uuid(),
  course_name text default 'Complete Forex Mastery',
  full_name text not null,
  email text not null,
  phone text not null,
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

alter table public.course_orders enable row level security;

drop policy if exists "Allow public course order inserts" on public.course_orders;
drop policy if exists "Allow frontend course order reads" on public.course_orders;
drop policy if exists "Allow frontend payment status updates" on public.course_orders;

create policy "Allow public course order inserts"
on public.course_orders
for insert
to anon
with check (true);

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  discount_type text not null check (discount_type in ('fixed', 'percent')),
  discount_value integer not null check (discount_value > 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.coupons enable row level security;

drop policy if exists "Allow public coupon reads" on public.coupons;
drop policy if exists "Allow frontend coupon management" on public.coupons;

create policy "Allow public coupon reads"
on public.coupons
for select
to anon
using (active = true);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  price integer not null default 7199 check (price > 0),
  drive_url text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.courses enable row level security;

drop policy if exists "Allow public active course reads" on public.courses;

create policy "Allow public active course reads"
on public.courses
for select
to anon
using (active = true);

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
