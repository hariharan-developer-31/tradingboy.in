import { createClient } from '@supabase/supabase-js';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { cleanText, escapeHtml, handleApiError, HttpError, isCouponCode, isEmail, isHttpsUrl, json, rateLimit, readJsonBody, requirePost, requireTrustedOrigin } from './_security.js';

const COURSE_NAME = 'Complete Forex Mastery';
const COURSE_PRICE = 7199;
const ADMIN_EMAIL = 'hari.entrepreneur1@gmail.com';
const ADMIN_PAYMENTS_URL = 'https://tradingboy.in/#admin/payments';
const COURSES = [
  { name: COURSE_NAME, price: COURSE_PRICE },
  { name: 'Blueprint to Become a Funded Trader', price: 5399 },
];

const courseKind = (name) => {
  const normalized = String(name || '').toLowerCase();
  if (normalized.includes('funded')) return 'funded';
  if (normalized.includes('forex')) return 'forex';
  return normalized;
};

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const formatAmount = (amount) => `Rs. ${Number(amount).toLocaleString('en-IN')}`;

export const sendEmail = async ({ to, subject, html }) => {
  if (!process.env.RESEND_API_KEY) {
    return false;
  }

  try {
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
      signal: AbortSignal.timeout(10_000),
    });

    return response.ok;
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', context: 'checkout.receipt', message: error instanceof Error ? error.message.slice(0, 300) : 'Email delivery failed' }));
    return false;
  }
};

const darkEmail = (content) => `<!doctype html><html><head><meta name="color-scheme" content="dark only"><meta name="supported-color-schemes" content="dark only"><style>:root{color-scheme:dark only;supported-color-schemes:dark only}html,body{margin:0!important;padding:0!important;background:#000000!important;color:#ffffff!important}a{color:#25aef4}</style></head><body bgcolor="#000000" style="margin:0;padding:0;background:#000000;color:#ffffff;">${content}</body></html>`;

export const receiptHtml = (order) => darkEmail(`
  <div style="font-family:Arial,sans-serif;background:#0f1113;color:#ffffff;padding:28px">
    <div style="max-width:620px;margin:0 auto;border:1px solid #1f2933;padding:28px">
      <img src="https://tradingboy.in/logo.png" alt="Trading Boy Academy" style="height:48px;width:auto;margin:0 0 16px;display:block;" />
      <h2 style="margin:0 0 20px">Payment Receipt</h2>
      <p>Hi ${order.full_name},</p>
      <p>Your course purchase request has been created.</p>
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
`);

export const adminPaymentHtml = (order) => darkEmail(`
  <div style="font-family:Arial,sans-serif;background:#000000;color:#ffffff;padding:32px 16px">
    <div style="max-width:620px;margin:0 auto;background:#0f1115;border:1px solid #1f2933;padding:32px">
      <img src="https://tradingboy.in/logo.png" alt="Trading Boy Academy" style="height:52px;width:auto;margin:0 0 24px;display:block" />
      <div style="color:#25aef4;font-size:12px;font-weight:bold;letter-spacing:3px;text-transform:uppercase">New Payment Submitted</div>
      <h2 style="margin:12px 0 18px;color:#ffffff">A new student completed the payment</h2>
      <p style="color:#cbd5e1;line-height:1.7">Razorpay verified this payment successfully. Review the order and manage course access from the secure admin panel.</p>
      <table style="width:100%;border-collapse:collapse;margin:24px 0;color:#ffffff">
        <tr><td style="padding:10px 0;color:#9ca3af;border-bottom:1px solid #1f2933">Student</td><td style="padding:10px 0;text-align:right;border-bottom:1px solid #1f2933">${order.full_name}</td></tr>
        <tr><td style="padding:10px 0;color:#9ca3af;border-bottom:1px solid #1f2933">Email</td><td style="padding:10px 0;text-align:right;border-bottom:1px solid #1f2933">${order.email}</td></tr>
        <tr><td style="padding:10px 0;color:#9ca3af;border-bottom:1px solid #1f2933">Course</td><td style="padding:10px 0;text-align:right;border-bottom:1px solid #1f2933">${order.course_name}</td></tr>
        <tr><td style="padding:10px 0;color:#9ca3af">Amount submitted</td><td style="padding:10px 0;text-align:right;color:#25aef4;font-weight:bold">${formatAmount(order.final_amount)}</td></tr>
      </table>
      <a href="${ADMIN_PAYMENTS_URL}" style="display:inline-block;background:#25aef4;color:#000000;text-decoration:none;font-size:13px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;padding:15px 22px">View &amp; Verify Payment</a>
      <p style="margin:22px 0 0;color:#64748b;font-size:12px">Admin passcode and email OTP verification are required before payment details are shown.</p>
    </div>
  </div>
`);

const paidAccessHtml = (order) => darkEmail(`
  <div style="font-family:'Inter',Arial,sans-serif;background:#000000;color:#ffffff;padding:40px 20px;">
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
`);

export const razorpayRequest = async (path, options = {}) => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) throw new HttpError(503, 'Razorpay is not configured on the server. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in Vercel.');
  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    ...options,
    headers: { Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`, 'Content-Type': 'application/json', ...(options.headers || {}) },
    signal: AbortSignal.timeout(12_000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new HttpError(502, data.error?.description || 'Payment gateway request failed.');
  return data;
};

export const getCheckout = async (admin, body) => {
  const fullName = cleanText(body.name, 100);
  const email = cleanText(body.email, 254).toLowerCase();
  const phone = cleanText(body.phone, 25);
  const tradingExperience = cleanText(body.tradingExperience, 80);
  const requestedCourseName = cleanText(body.courseName || COURSE_NAME, 160);
  const couponCode = cleanText(body.couponCode, 40).toUpperCase();
  if (fullName.length < 2 || !isEmail(email) || !/^[+0-9 ()-]{7,25}$/.test(phone) || !tradingExperience || body.termsAccepted !== true || body.privacyAccepted !== true) {
    throw Object.assign(new Error('Name, email, phone, trading experience, terms and privacy acceptance are required.'), { status: 400 });
  }
  if (couponCode && !isCouponCode(couponCode)) throw Object.assign(new Error('Coupon code format is invalid.'), { status: 400 });
  const { data: activeCourses, error } = await admin.from('courses').select('title, price, offer_price, drive_url, discord_url, active').eq('active', true);
  if (error) throw error;
  const requestedKind = courseKind(requestedCourseName);
  const courseData = (activeCourses || []).find((course) => course.title === requestedCourseName) || (activeCourses || []).find((course) => courseKind(course.title) === requestedKind);
  const fallbackCourse = COURSES.find((course) => courseKind(course.name) === requestedKind);
  if (!courseData && !fallbackCourse) throw Object.assign(new Error('The selected course is unavailable.'), { status: 404 });
  const course = courseData ? { name: courseData.title, price: Number(courseData.offer_price || courseData.price), drive_url: courseData.drive_url, discord_url: courseData.discord_url } : fallbackCourse;
  let coupon = null;
  let discount = 0;
  if (couponCode) {
    const { data } = await admin.from('coupons').select('id, code, course_name, discount_type, discount_value, active, expires_at, max_uses, current_uses').eq('code', couponCode).eq('active', true).maybeSingle();
    if (!data) throw Object.assign(new Error('Coupon is invalid or inactive.'), { status: 400 });
    if (data.expires_at && new Date(data.expires_at) < new Date()) throw Object.assign(new Error('Coupon has expired.'), { status: 400 });
    if (data.max_uses !== null && data.current_uses >= data.max_uses) throw Object.assign(new Error('Coupon usage limit reached.'), { status: 400 });
    if (data.course_name && data.course_name !== course.name) throw Object.assign(new Error(`Coupon is only valid for ${data.course_name}.`), { status: 400 });
    coupon = data;
    discount = data.discount_type === 'percent' ? Math.min(Math.round(course.price * data.discount_value / 100), course.price) : Math.min(Number(data.discount_value), course.price);
  }
  return { fullName, email, phone, tradingExperience, course, coupon, discount, finalAmount: course.price - discount };
};

const safeEqual = (left, right) => {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && timingSafeEqual(a, b);
};

const businessOrderNumber = () => `TB${new Date().toISOString().slice(0, 10).replaceAll('-', '')}${String(Date.now()).slice(-6)}`;

export const recordVerifiedPayment = async (admin, checkout, razorpayOrderId, razorpayPaymentId) => {
  const { data: existingOrder, error: existingError } = await admin.from('course_orders').select('*').eq('razorpay_payment_id', razorpayPaymentId).maybeSingle();
  if (existingError) throw existingError;
  if (existingOrder) return { order: existingOrder, duplicate: true };
  const { data, error } = await admin.rpc('record_razorpay_payment', {
    p_id: randomUUID(), p_order_number: businessOrderNumber(),
    p_razorpay_order_id: razorpayOrderId, p_razorpay_payment_id: razorpayPaymentId,
    p_course_name: checkout.course.name, p_full_name: checkout.fullName,
    p_email: checkout.email, p_phone: checkout.phone,
    p_trading_experience: checkout.tradingExperience,
    p_coupon_code: checkout.coupon?.code || null, p_paid_amount: checkout.finalAmount,
  });
  if (error) throw error;
  return { order: Array.isArray(data) ? data[0] : data, duplicate: false };
};

export const sendPaymentEmails = async (admin, order) => {
  const safeOrder = Object.fromEntries(Object.entries({ ...order, id: order.order_number || order.id }).map(([key, value]) => [key, typeof value === 'string' ? escapeHtml(value) : value]));
  const [emailSent, adminEmailSent] = await Promise.all([
    order.receipt_email_sent_at ? false : sendEmail({ to: order.email, subject: `Trading Boy receipt - ${order.course_name}`, html: receiptHtml(safeOrder) }),
    order.admin_email_sent_at ? false : sendEmail({ to: ADMIN_EMAIL, subject: `New payment submitted - ${order.course_name}`, html: adminPaymentHtml(safeOrder) }),
  ]);
  const updates = {};
  if (emailSent) updates.receipt_email_sent_at = new Date().toISOString();
  if (adminEmailSent) updates.admin_email_sent_at = new Date().toISOString();
  if (Object.keys(updates).length) {
    const { error } = await admin.from('course_orders').update(updates).eq('id', order.id);
    if (error) console.error(JSON.stringify({ level: 'error', context: 'checkout.email-status', message: error.message.slice(0, 300) }));
  }
  return { emailSent: Boolean(emailSent || order.receipt_email_sent_at), adminEmailSent: Boolean(adminEmailSent || order.admin_email_sent_at) };
};

export default async function handler(req, res) {
  if (!requirePost(req, res) || !requireTrustedOrigin(req, res)) return;
  if (!rateLimit(req, res, { scope: 'checkout', limit: 8, windowMs: 10 * 60_000 })) return;

  if (!supabaseUrl || !serviceRoleKey) {
    json(res, 503, { error: 'Checkout is temporarily unavailable.' });
    return;
  }

  try {
  const body = await readJsonBody(req, 32 * 1024);
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const checkout = await getCheckout(admin, body);
  if (body.action === 'createOrder') {
    const amountInPaise = checkout.finalAmount * 100;
    if (!Number.isSafeInteger(amountInPaise) || amountInPaise < 100) return json(res, 400, { error: 'The final payment amount must be at least Rs. 1 and use whole paise.' });
    const gatewayOrder = await razorpayRequest('/orders', { method: 'POST', body: JSON.stringify({ amount: amountInPaise, currency: 'INR', receipt: businessOrderNumber(), payment_capture: 1, notes: { course: checkout.course.name, full_name: checkout.fullName, email: checkout.email, phone: checkout.phone, trading_experience: checkout.tradingExperience, coupon: checkout.coupon?.code || '' } }) });
    if (!/^order_[A-Za-z0-9]+$/.test(String(gatewayOrder.id || '')) || gatewayOrder.amount !== amountInPaise || gatewayOrder.currency !== 'INR') throw new HttpError(502, 'Razorpay returned an invalid order. Please try again.');
    return json(res, 200, { keyId: process.env.RAZORPAY_KEY_ID, razorpayOrderId: gatewayOrder.id, amount: gatewayOrder.amount, currency: gatewayOrder.currency, courseName: checkout.course.name });
  }
  if (body.action !== 'verifyPayment') return json(res, 400, { error: 'Invalid checkout action.' });
  const razorpayOrderId = cleanText(body.razorpay_order_id, 100);
  const razorpayPaymentId = cleanText(body.razorpay_payment_id, 100);
  const signature = cleanText(body.razorpay_signature, 256);
  if (!/^order_[A-Za-z0-9]+$/.test(razorpayOrderId) || !/^pay_[A-Za-z0-9]+$/.test(razorpayPaymentId) || !/^[a-f0-9]{64}$/i.test(signature)) return json(res, 400, { error: 'Invalid payment confirmation.' });
  if (!process.env.RAZORPAY_KEY_SECRET) return json(res, 503, { error: 'Razorpay is not configured.' });
  const expected = createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(`${razorpayOrderId}|${razorpayPaymentId}`).digest('hex');
  if (!safeEqual(expected, signature)) return json(res, 400, { error: 'Payment signature verification failed.' });
  const [gatewayOrder, gatewayPayment] = await Promise.all([razorpayRequest(`/orders/${razorpayOrderId}`), razorpayRequest(`/payments/${razorpayPaymentId}`)]);
  if (gatewayOrder.amount !== checkout.finalAmount * 100 || gatewayOrder.currency !== 'INR' || gatewayOrder.notes?.course !== checkout.course.name || gatewayOrder.notes?.email !== checkout.email || gatewayPayment.order_id !== razorpayOrderId || gatewayPayment.amount !== gatewayOrder.amount || gatewayPayment.status !== 'captured') return json(res, 400, { error: 'Payment amount or status verification failed.' });
  const { order, duplicate } = await recordVerifiedPayment(admin, checkout, razorpayOrderId, razorpayPaymentId);
  const delivery = await sendPaymentEmails(admin, order);
  return json(res, 200, { orderId: order.order_number || order.id, paymentStatus: 'paid', duplicate, ...delivery });
  } catch (error) {
    return handleApiError(res, error, 'checkout.create');
  }
}
