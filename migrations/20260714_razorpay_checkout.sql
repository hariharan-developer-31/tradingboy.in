alter table public.course_orders
  add column if not exists order_number text,
  add column if not exists razorpay_order_id text,
  add column if not exists razorpay_payment_id text,
  add column if not exists drive_access_status text not null default 'pending';

create unique index if not exists course_orders_order_number_key on public.course_orders (order_number) where order_number is not null;
create unique index if not exists course_orders_razorpay_order_key on public.course_orders (razorpay_order_id) where razorpay_order_id is not null;
create unique index if not exists course_orders_razorpay_payment_key on public.course_orders (razorpay_payment_id) where razorpay_payment_id is not null;

alter table public.course_orders drop constraint if exists course_orders_drive_access_status_check;
alter table public.course_orders add constraint course_orders_drive_access_status_check check (drive_access_status in ('pending', 'granted'));

alter table public.course_orders drop column if exists payment_screenshot_path;
alter table public.courses drop column if exists qr_code_url;
alter table public.courses drop column if exists upi_id;

-- Supabase protects storage.objects from direct SQL deletion. The legacy
-- payment-proofs bucket can be emptied/deleted later through Storage UI/API.
drop policy if exists "Service role can manage payment proofs" on storage.objects;

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
    v_discount := case when v_coupon.discount_type = 'percent' then least(round(v_price * v_coupon.discount_value / 100.0), v_price) else least(v_coupon.discount_value, v_price) end;
    update public.coupons set current_uses = current_uses + 1 where id = v_coupon.id;
  end if;
  insert into public.course_orders (
    id, course_name, full_name, email, phone, trading_experience, terms_accepted,
    terms_accepted_at, plan, coupon_code, original_amount, discount_amount,
    final_amount, payment_status, remarks, source
  ) values (
    p_id, v_course.title, p_full_name, p_email, p_phone, p_trading_experience,
    true, now(), v_course.title, nullif(upper(trim(p_coupon_code)), ''), v_price,
    v_discount, v_price - v_discount, 'pending', p_remarks, p_source
  ) returning * into v_order;
  return v_order;
end;
$$;

revoke all on function public.create_course_order(uuid,text,text,text,text,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.create_course_order(uuid,text,text,text,text,text,text,text,text,text) to service_role;
