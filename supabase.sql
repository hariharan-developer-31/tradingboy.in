create table if not exists public.course_orders (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone text not null,
  plan text not null,
  source text default 'website',
  created_at timestamptz not null default now()
);

alter table public.course_orders enable row level security;

create policy "Allow public course order inserts"
on public.course_orders
for insert
to anon
with check (true);
