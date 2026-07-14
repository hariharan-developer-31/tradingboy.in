alter table public.course_orders
  add column if not exists receipt_email_sent_at timestamptz,
  add column if not exists admin_email_sent_at timestamptz;

create or replace function public.record_razorpay_payment(
  p_id uuid, p_order_number text, p_razorpay_order_id text, p_razorpay_payment_id text,
  p_course_name text, p_full_name text, p_email text, p_phone text,
  p_trading_experience text, p_coupon_code text, p_paid_amount integer
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
  -- Serialize retries from the browser and Razorpay webhook for this payment.
  perform pg_advisory_xact_lock(hashtextextended(p_razorpay_payment_id, 0));

  select * into v_order from public.course_orders
  where razorpay_payment_id = p_razorpay_payment_id;
  if found then return v_order; end if;

  select * into v_course from public.courses
  where title = p_course_name and active = true;
  if not found then raise exception 'course_unavailable'; end if;

  v_price := coalesce(v_course.offer_price, v_course.price);
  if nullif(trim(p_coupon_code), '') is not null then
    select * into v_coupon from public.coupons
    where code = upper(trim(p_coupon_code)) and active = true for update;
    if not found then raise exception 'coupon_invalid'; end if;
    if v_coupon.expires_at is not null and v_coupon.expires_at <= now() then raise exception 'coupon_expired'; end if;
    if v_coupon.max_uses is not null and v_coupon.current_uses >= v_coupon.max_uses then raise exception 'coupon_limit'; end if;
    if v_coupon.course_name is not null and v_coupon.course_name <> v_course.title then raise exception 'coupon_course'; end if;
    v_discount := case when v_coupon.discount_type = 'percent'
      then least(round(v_price * v_coupon.discount_value / 100.0), v_price)
      else least(v_coupon.discount_value, v_price) end;
  end if;

  if v_price - v_discount <> p_paid_amount then raise exception 'payment_amount_mismatch'; end if;

  insert into public.course_orders (
    id, order_number, razorpay_order_id, razorpay_payment_id, course_name,
    full_name, email, phone, trading_experience, terms_accepted,
    terms_accepted_at, plan, coupon_code, original_amount, discount_amount,
    final_amount, payment_status, drive_access_status, source
  ) values (
    p_id, p_order_number, p_razorpay_order_id, p_razorpay_payment_id, v_course.title,
    p_full_name, lower(p_email), p_phone, p_trading_experience, true,
    now(), v_course.title, nullif(upper(trim(p_coupon_code)), ''), v_price, v_discount,
    p_paid_amount, 'paid', 'pending', 'razorpay'
  ) returning * into v_order;

  if v_coupon.id is not null then
    update public.coupons set current_uses = current_uses + 1 where id = v_coupon.id;
  end if;
  return v_order;
end;
$$;

revoke all on function public.record_razorpay_payment(uuid,text,text,text,text,text,text,text,text,text,integer) from public, anon, authenticated;
grant execute on function public.record_razorpay_payment(uuid,text,text,text,text,text,text,text,text,text,integer) to service_role;
