-- Removes browser access to private commerce data. All writes and coupon checks
-- are performed by the server-side service role API.
drop policy if exists "Allow public course order inserts" on public.course_orders;
drop policy if exists "Allow frontend course order reads" on public.course_orders;
drop policy if exists "Allow frontend payment status updates" on public.course_orders;
revoke all on table public.course_orders from anon;

drop policy if exists "Allow public coupon reads" on public.coupons;
drop policy if exists "Allow frontend coupon management" on public.coupons;
revoke all on table public.coupons from anon;

-- NOT VALID preserves compatibility with historical rows while enforcing each
-- rule for new and changed data. Validate after historical data is cleaned.
alter table public.course_orders drop constraint if exists course_orders_payment_status_check;
alter table public.course_orders add constraint course_orders_payment_status_check
  check (payment_status in ('pending', 'under_review', 'paid', 'rejected')) not valid;
alter table public.course_orders drop constraint if exists course_orders_amounts_check;
alter table public.course_orders add constraint course_orders_amounts_check
  check (original_amount >= 0 and discount_amount >= 0 and final_amount >= 0 and final_amount = original_amount - discount_amount) not valid;
alter table public.course_orders drop constraint if exists course_orders_terms_check;
alter table public.course_orders add constraint course_orders_terms_check
  check (terms_accepted = true and terms_accepted_at is not null) not valid;

alter table public.coupons drop constraint if exists coupons_usage_check;
alter table public.coupons add constraint coupons_usage_check
  check (current_uses >= 0 and (max_uses is null or (max_uses > 0 and current_uses <= max_uses))) not valid;

create index if not exists course_orders_created_at_idx on public.course_orders (created_at desc);
create index if not exists course_orders_status_created_idx on public.course_orders (payment_status, created_at desc);
create index if not exists course_orders_course_created_idx on public.course_orders (course_name, created_at desc);
create index if not exists course_orders_email_idx on public.course_orders (lower(email));
create index if not exists coupons_active_expiry_idx on public.coupons (active, expires_at);
create index if not exists courses_active_created_idx on public.courses (active, created_at desc);
create index if not exists testimonials_active_created_idx on public.testimonials (active, created_at);

update storage.buckets
set public = false, file_size_limit = 102400, allowed_mime_types = array['image/jpeg']
where id = 'payment-proofs';

update storage.buckets
set file_size_limit = 102400, allowed_mime_types = array['image/jpeg']
where id in ('course-thumbnails', 'testimonial-photos');

-- Atomically validates/redempts a coupon and creates its order, preventing two
-- concurrent checkouts from exceeding a coupon usage limit.
create or replace function public.create_course_order(
  p_id uuid, p_course_name text, p_full_name text, p_email text, p_phone text,
  p_trading_experience text, p_coupon_code text, p_payment_screenshot_path text,
  p_remarks text, p_source text default 'website'
) returns public.course_orders
language plpgsql security definer set search_path = public
as $$
declare
  v_course public.courses%rowtype;
  v_coupon public.coupons%rowtype;
  v_price integer;
  v_discount integer := 0;
  v_order public.course_orders%rowtype;
begin
  select * into v_course from public.courses where title = p_course_name and active = true;
  if not found then raise exception 'course_unavailable'; end if;
  v_price := coalesce(v_course.offer_price, v_course.price);

  if nullif(trim(p_coupon_code), '') is not null then
    select * into v_coupon from public.coupons where code = upper(trim(p_coupon_code)) and active = true for update;
    if not found then raise exception 'coupon_invalid'; end if;
    if v_coupon.expires_at is not null and v_coupon.expires_at <= now() then raise exception 'coupon_expired'; end if;
    if v_coupon.max_uses is not null and v_coupon.current_uses >= v_coupon.max_uses then raise exception 'coupon_limit'; end if;
    if v_coupon.course_name is not null and v_coupon.course_name <> v_course.title then raise exception 'coupon_course'; end if;
    v_discount := case when v_coupon.discount_type = 'percent'
      then least(round(v_price * v_coupon.discount_value / 100.0), v_price)
      else least(v_coupon.discount_value, v_price) end;
    update public.coupons set current_uses = current_uses + 1 where id = v_coupon.id;
  end if;

  insert into public.course_orders (
    id, course_name, full_name, email, phone, trading_experience,
    terms_accepted, terms_accepted_at, plan, coupon_code, original_amount,
    discount_amount, final_amount, payment_status, payment_screenshot_path,
    remarks, source
  ) values (
    p_id, v_course.title, p_full_name, p_email, p_phone, p_trading_experience,
    true, now(), v_course.title, nullif(upper(trim(p_coupon_code)), ''), v_price,
    v_discount, v_price - v_discount,
    case when v_price - v_discount = 0 then 'paid' else 'pending' end,
    p_payment_screenshot_path, p_remarks, p_source
  ) returning * into v_order;
  return v_order;
end;
$$;

revoke all on function public.create_course_order(uuid,text,text,text,text,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.create_course_order(uuid,text,text,text,text,text,text,text,text,text) to service_role;
