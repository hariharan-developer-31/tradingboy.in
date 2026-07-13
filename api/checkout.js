import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const COURSE_NAME = 'Complete Forex Mastery';
const COURSE_PRICE = 7199;
const COURSES = [
  { name: COURSE_NAME, price: COURSE_PRICE },
  { name: 'Blueprint to Become a Funded Trader', price: 5399 },
];

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
      <img src="https://tradingboy.in/logo.png" alt="Trading Boy Academy" style="height:48px;width:auto;margin:0 0 16px;display:block;" />
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

const paidAccessHtml = (order) => `
  <div style="font-family:'Inter',Arial,sans-serif;background:#000000;color:#ffffff;padding:40px 20px;min-height:100vh;">
    <div style="max-width:600px;margin:0 auto;background:#0f1115;border:1px solid #1f2933;border-radius:16px;padding:40px;box-shadow:0 10px 40px rgba(0,0,0,0.5)">
      <div style="text-align:center;margin-bottom:32px;">
        <img src="https://tradingboy.in/logo.png" alt="Trading Boy" style="height:60px;width:auto;margin:0 auto;display:block;" />
      </div>
      
      <h2 style="margin:0 0 20px;color:#ffffff;font-size:20px;text-align:center;">Course Access Granted</h2>
      <p style="color:#cbd5e1;font-size:15px;line-height:1.6;">Hi <strong>${order.full_name}</strong>,</p>
      <p style="color:#cbd5e1;font-size:15px;line-height:1.6;margin-bottom:32px;">Your payment for <strong>${order.course_name || 'Complete Forex Mastery'}</strong> is complete. You can now access your course materials!</p>
      
      <div style="text-align:center;margin-bottom:40px;">
        ${
          order.course_drive_url || order.drive_url
            ? `<a href="${order.course_drive_url || order.drive_url}" style="background:#25aef4;color:#000000;text-decoration:none;font-weight:700;font-size:14px;padding:16px 32px;border-radius:8px;display:inline-block;text-transform:uppercase;letter-spacing:1px;">Access Your Course Now</a>`
            : '<p style="color:#25aef4;font-weight:600;font-size:15px;padding:16px;border:1px dashed #25aef4;border-radius:8px;">The admin team will share your course access via email within 12 hours.</p>'
        }
        ${
          order.course_discord_url || order.discord_url
            ? `<a href="${order.course_discord_url || order.discord_url}" style="margin-top:14px;background:#5865F2;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:16px 32px;border-radius:8px;display:inline-block;text-transform:uppercase;letter-spacing:1px;">Join the Course Discord</a>`
            : ''
        }
      </div>
      
      <h3 style="color:#ffffff;font-size:14px;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #1f2933;padding-bottom:12px;margin-bottom:20px;">Order Details</h3>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr><td style="padding:12px 0;color:#9ca3af;border-bottom:1px solid #1f2933;">Order ID</td><td style="padding:12px 0;text-align:right;color:#ffffff;border-bottom:1px solid #1f2933;font-family:monospace;">${order.id}</td></tr>
        <tr><td style="padding:12px 0;color:#9ca3af;border-bottom:1px solid #1f2933;">Course</td><td style="padding:12px 0;text-align:right;color:#ffffff;border-bottom:1px solid #1f2933;font-weight:600;">${order.course_name || 'Trading Boy Course'}</td></tr>
        <tr><td style="padding:12px 0;color:#9ca3af;border-bottom:1px solid #1f2933;">Amount Paid</td><td style="padding:12px 0;text-align:right;color:#25aef4;border-bottom:1px solid #1f2933;font-weight:700;">${formatAmount(order.final_amount)}</td></tr>
        <tr><td style="padding:12px 0;color:#9ca3af;">Status</td><td style="padding:12px 0;text-align:right;color:#10b981;font-weight:700;text-transform:uppercase;">PAID</td></tr>
      </table>
      
      <div style="margin-top:40px;padding-top:24px;border-top:1px solid #1f2933;text-align:center;">
        <p style="margin:0;color:#64748b;font-size:13px;line-height:1.5;">If Google Drive says access denied, please contact the admin. Make sure you are logged into Google with <strong>${order.email}</strong>.</p>
        <p style="margin:12px 0 0;color:#475569;font-size:12px;">© ${new Date().getFullYear()} Trading Boy Academy</p>
      </div>
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
  const tradingExperience = String(body.tradingExperience || '').trim();
  const requestedCourseName = String(body.courseName || COURSE_NAME).trim();
  const couponCode = String(body.couponCode || '').trim().toUpperCase();
  const paymentScreenshot = body.paymentScreenshot;
  const termsAccepted = body.termsAccepted === true;

  const remarks = String(body.remarks || '').trim();

  if (!fullName || !email || !phone || !tradingExperience || !termsAccepted) {
    json(res, 400, { error: 'Name, email, phone, trading experience, and terms acceptance are required.' });
    return;
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data: courseData } = await admin
    .from('courses')
    .select('title, price, offer_price, drive_url, discord_url, active')
    .eq('title', requestedCourseName)
    .eq('active', true)
    .maybeSingle();
  const fallbackCourse = COURSES.find((course) => course.name === requestedCourseName) || COURSES[0];
  const selectedCourse = courseData
    ? { name: courseData.title, price: Number(courseData.offer_price || courseData.price), drive_url: courseData.drive_url, discord_url: courseData.discord_url }
    : fallbackCourse;
  let discountAmount = 0;
  let appliedCoupon = null;

  if (couponCode) {
    const { data } = await admin
      .from('coupons')
      .select('id, code, course_name, discount_type, discount_value, active, expires_at, max_uses, current_uses')
      .eq('code', couponCode)
      .eq('active', true)
      .maybeSingle();

    if (data) {
      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        json(res, 400, { error: 'Coupon has expired.' });
        return;
      }
      if (data.max_uses !== null && data.current_uses >= data.max_uses) {
        json(res, 400, { error: 'Coupon usage limit reached.' });
        return;
      }
      if (data.course_name && data.course_name !== selectedCourse.name) {
        json(res, 400, { error: `Coupon is only valid for ${data.course_name}.` });
        return;
      }

      appliedCoupon = data;
      discountAmount =
        data.discount_type === 'percent'
          ? Math.min(Math.round((selectedCourse.price * data.discount_value) / 100), selectedCourse.price)
          : Math.min(data.discount_value, selectedCourse.price);
    }
  }

  const finalAmount = selectedCourse.price - discountAmount;
  const orderId = randomUUID();
  let paymentScreenshotPath = null;

  if (paymentScreenshot?.dataUrl) {
    const buffer = decodeDataUrl(paymentScreenshot.dataUrl);

    if (buffer.byteLength > 100 * 1024) {
      json(res, 400, { error: 'Payment screenshot must be below 100KB after compression.' });
      return;
    }

    paymentScreenshotPath = `${orderId}.jpg`;
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
    course_name: selectedCourse.name,
    full_name: fullName,
    email,
    phone,
    trading_experience: tradingExperience,
    terms_accepted: true,
    terms_accepted_at: new Date().toISOString(),
    plan: selectedCourse.name,
    coupon_code: appliedCoupon ? appliedCoupon.code : null,
    original_amount: selectedCourse.price,
    discount_amount: discountAmount,
    final_amount: finalAmount,
    payment_status: finalAmount === 0 ? 'paid' : 'pending',
    payment_screenshot_path: paymentScreenshotPath,
    remarks,
    source: 'website',
  };

  const { error } = await admin.from('course_orders').insert(order);

  if (error) {
    json(res, 500, { error: error.message });
    return;
  }

  if (appliedCoupon) {
    await admin.from('coupons').update({ current_uses: appliedCoupon.current_uses + 1 }).eq('id', appliedCoupon.id);
  }

  const emailSent = await sendEmail({
    to: email,
    subject: finalAmount === 0 ? 'Trading Boy course access approved' : `Trading Boy receipt - ${selectedCourse.name}`,
    html: finalAmount === 0 ? paidAccessHtml({ ...order, drive_url: selectedCourse.drive_url, discord_url: selectedCourse.discord_url }) : receiptHtml(order),
  });

  json(res, 200, { orderId: order.id, payableAmount: finalAmount, emailSent });
}
