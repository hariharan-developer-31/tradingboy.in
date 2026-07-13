alter table public.courses
add column if not exists discord_url text;

-- Keep course access links private while retaining the public catalog fields.
revoke select on table public.courses from anon;

grant select (
  id,
  title,
  description,
  thumbnail_url,
  normal_price,
  offer_price,
  price,
  active,
  created_at
) on table public.courses to anon;
