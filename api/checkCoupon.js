import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const json = (res, status, body) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
};

const readBody = async (req) => {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    json(res, 405, { error: 'Method not allowed' });
    return;
  }

  if (!supabaseUrl || !serviceRoleKey) {
    json(res, 500, { error: 'Environment variables are missing.' });
    return;
  }

  const body = await readBody(req);
  const couponCode = String(body.couponCode || '').trim().toUpperCase();

  if (!couponCode) {
    json(res, 400, { error: 'Coupon code is required.' });
    return;
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data, error } = await admin
    .from('coupons')
    .select('code, discount_type, discount_value, active')
    .eq('code', couponCode)
    .maybeSingle();

  if (error || !data) {
    json(res, 404, { error: 'Invalid coupon code.' });
    return;
  }

  if (!data.active) {
    json(res, 400, { error: 'This coupon is no longer active.' });
    return;
  }

  json(res, 200, { coupon: data });
}
