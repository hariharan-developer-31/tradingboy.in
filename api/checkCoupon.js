import { createClient } from '@supabase/supabase-js';
import { cleanText, handleApiError, isCouponCode, json, rateLimit, readJsonBody, requirePost, requireTrustedOrigin } from './_security.js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  if (!requirePost(req, res) || !requireTrustedOrigin(req, res)) return;
  if (!rateLimit(req, res, { scope: 'coupon', limit: 20, windowMs: 60_000 })) return;
  if (!supabaseUrl || !serviceRoleKey) return json(res, 503, { error: 'Coupon service is temporarily unavailable.' });
  try {
    const body = await readJsonBody(req, 8 * 1024);
    const couponCode = cleanText(body.couponCode, 40).toUpperCase();
    const courseName = cleanText(body.courseName, 160);
    if (!isCouponCode(couponCode) || !courseName) return json(res, 400, { error: 'A valid coupon code and course are required.' });
    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await admin.from('coupons').select('code, course_name, discount_type, discount_value, active, expires_at, max_uses, current_uses').eq('code', couponCode).maybeSingle();
    if (error) throw error;
    if (!data) return json(res, 404, { error: 'Invalid coupon code.' });
    if (!data.active) return json(res, 400, { error: 'This coupon is no longer active.' });
    if (data.expires_at && new Date(data.expires_at).getTime() <= Date.now()) return json(res, 400, { error: 'This coupon has expired.' });
    if (data.max_uses !== null && data.current_uses >= data.max_uses) return json(res, 400, { error: 'This coupon has reached its usage limit.' });
    if (data.course_name && data.course_name !== courseName) return json(res, 400, { error: 'This coupon is not valid for the selected course.' });
    return json(res, 200, { coupon: data });
  } catch (error) {
    return handleApiError(res, error, 'coupon.check');
  }
}
