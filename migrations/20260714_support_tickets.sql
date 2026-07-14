create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  subject text not null,
  message text not null,
  status text not null default 'open' check (status in ('open', 'replied', 'closed')),
  admin_reply text,
  reply_attachment_path text,
  reply_attachment_name text,
  reply_attachment_type text,
  created_at timestamptz not null default now(),
  replied_at timestamptz
);

create index if not exists support_tickets_status_created_idx on public.support_tickets (status, created_at desc);
alter table public.support_tickets enable row level security;
revoke all on table public.support_tickets from public, anon, authenticated;
grant all on table public.support_tickets to service_role;
