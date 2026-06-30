import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const COURSE_NAME = 'Complete Forex Mastery';
const COURSE_PRICE = 7199;

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

const formatAmount = (amount) => `Rs. ${Number(amount).toLocaleString('en-IN')}`;

const decodeDataUrl = (dataUrl) => {
  const [, base64 = ''] = String(dataUrl).split(',');

  return Buffer.from(base64, 'base64');
};

const sendEmail = async ({ to, subject, html }) => {
  if (!process.env.RESEND_API_KEY) {
    return false;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.MAIL_FROM || 'Trading Boy <admin@tradingboy.in>',
      to,
      subject,
      html,
    }),
  });

  return response.ok;
};

const receiptHtml = (order) => `
  <div style="font-family:Arial,sans-serif;background:#0f1113;color:#ffffff;padding:28px">
    <div style="max-width:620px;margin:0 auto;border:1px solid #1f2933;padding:28px">
      <h1 style="margin:0 0 12px;color:#25aef4">Trading Boy Academy</h1>
      <h2 style="margin:0 0 20px">Payment Receipt</h2>
      <p>Hi ${order.full_name},</p>
      <p>Your course purchase request has been created. Complete the UPI payment if you have not already done it.</p>
      <p>After payment verification, the admin will share the private Google Drive course folder with this email address: <strong>${order.email}</strong>.</p>
      <table style="width:100%;border-collapse:collapse;margin-top:20px">
        <tr><td style="padding:8px 0;color:#9ca3af">Order ID</td><td style="padding:8px 0;text-align:right">${order.id}</td></tr>
        <tr><td style="padding:8px 0;color:#9ca3af">Course</td><td style="padding:8px 0;text-align:right">${order.course_name}</td></tr>
        <tr><td style="padding:8px 0;color:#9ca3af">Course price</td><td style="padding:8px 0;text-align:right">${formatAmount(order.original_amount)}</td></tr>
        <tr><td style="padding:8px 0;color:#9ca3af">Discount</td><td style="padding:8px 0;text-align:right">${formatAmount(order.discount_amount)}</td></tr>
        <tr><td style="padding:12px 0;border-top:1px solid #26313b;font-weight:bold">Total</td><td style="padding:12px 0;border-top:1px solid #26313b;text-align:right;font-weight:bold">${formatAmount(order.final_amount)}</td></tr>
        <tr><td style="padding:8px 0;color:#9ca3af">Payment status</td><td style="padding:8px 0;text-align:right">${order.payment_status}</td></tr>
      </table>
      <p style="margin-top:24px;color:#9ca3af">From: admin@tradingboy.in</p>
    </div>
  </div>
`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    json(res, 405, { error: 'Method not allowed' });
    return;
  }

  if (!supabaseUrl || !serviceRoleKey) {
    json(res, 500, { error: 'Checkout API environment variables are missing.' });
    return;
  }

  const body = await readBody(req);
  const fullName = String(body.name || '').trim();
  const email = String(body.email || '').trim();
  const phone = String(body.phone || '').trim();
  const couponCode = String(body.couponCode || '').trim().toUpperCase();
  const paymentScreenshot = body.paymentScreenshot;

  if (!fullName || !email || !phone) {
    json(res, 400, { error: 'Name, email, and phone are required.' });
    return;
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  let discountAmount = 0;
  let appliedCoupon = null;

  if (couponCode) {
    const { data } = await admin
      .from('coupons')
      .select('code, discount_type, discount_value, active')
      .eq('code', couponCode)
      .eq('active', true)
      .maybeSingle();

    if (data) {
      appliedCoupon = data.code;
      discountAmount =
        data.discount_type === 'percent'
          ? Math.min(Math.round((COURSE_PRICE * data.discount_value) / 100), COURSE_PRICE)
          : Math.min(data.discount_value, COURSE_PRICE);
    }
  }

  const finalAmount = COURSE_PRICE - discountAmount;
  const orderId = randomUUID();
  let paymentScreenshotPath = null;

  if (paymentScreenshot?.dataUrl) {
    const buffer = decodeDataUrl(paymentScreenshot.dataUrl);

    if (buffer.byteLength > 100 * 1024) {
      json(res, 400, { error: 'Payment screenshot must be below 100KB after compression.' });
      return;
    }

    paymentScreenshotPath = `payment-proofs/${orderId}.jpg`;
    const { error: uploadError } = await admin.storage
      .from('payment-proofs')
      .upload(paymentScreenshotPath, buffer, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (uploadError) {
      json(res, 500, { error: uploadError.message });
      return;
    }
  }

  const order = {
    id: orderId,
    course_name: COURSE_NAME,
    full_name: fullName,
    email,
    phone,
    plan: COURSE_NAME,
    coupon_code: appliedCoupon,
    original_amount: COURSE_PRICE,
    discount_amount: discountAmount,
    final_amount: finalAmount,
    payment_status: 'pending',
    payment_screenshot_path: paymentScreenshotPath,
    source: 'website',
  };

  const { error } = await admin.from('course_orders').insert(order);

  if (error) {
    json(res, 500, { error: error.message });
    return;
  }

  const emailSent = await sendEmail({
    to: email,
    subject: `Trading Boy receipt - ${COURSE_NAME}`,
    html: receiptHtml(order),
  });

  json(res, 200, { orderId: order.id, payableAmount: finalAmount, emailSent });
}
