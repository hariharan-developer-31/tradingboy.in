import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { cleanText, decodeJpegDataUrl, escapeHtml, handleApiError, isCouponCode, isEmail, isHttpsUrl, json, rateLimit, readJsonBody, requirePost, requireTrustedOrigin } from './_security.js';

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

const sendEmail = async ({ to, subject, html }) => {
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

const receiptHtml = (order) => darkEmail(`
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

const adminPaymentHtml = (order) => darkEmail(`
  <div style="font-family:Arial,sans-serif;background:#000000;color:#ffffff;padding:32px 16px">
    <div style="max-width:620px;margin:0 auto;background:#0f1115;border:1px solid #1f2933;padding:32px">
      <img src="https://tradingboy.in/logo.png" alt="Trading Boy Academy" style="height:52px;width:auto;margin:0 0 24px;display:block" />
      <div style="color:#25aef4;font-size:12px;font-weight:bold;letter-spacing:3px;text-transform:uppercase">New Payment Submitted</div>
      <h2 style="margin:12px 0 18px;color:#ffffff">A new student completed the payment</h2>
      <p style="color:#cbd5e1;line-height:1.7">The student uploaded payment proof. Review the screenshot and verify the payment from the secure admin panel.</p>
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

export default async function handler(req, res) {
  if (!requirePost(req, res) || !requireTrustedOrigin(req, res)) return;
  if (!rateLimit(req, res, { scope: 'checkout', limit: 8, windowMs: 10 * 60_000 })) return;

  if (!supabaseUrl || !serviceRoleKey) {
    json(res, 503, { error: 'Checkout is temporarily unavailable.' });
    return;
  }

  try {
  const body = await readJsonBody(req, 180 * 1024);
  const fullName = cleanText(body.name, 100);
  const email = cleanText(body.email, 254).toLowerCase();
  const phone = cleanText(body.phone, 25);
  const tradingExperience = cleanText(body.tradingExperience, 80);
  const requestedCourseName = cleanText(body.courseName || COURSE_NAME, 160);
  const couponCode = cleanText(body.couponCode, 40).toUpperCase();
  const paymentScreenshot = body.paymentScreenshot;
  const termsAccepted = body.termsAccepted === true;

  const remarks = cleanText(body.remarks, 500);

  if (fullName.length < 2 || !isEmail(email) || !/^[+0-9 ()-]{7,25}$/.test(phone) || !tradingExperience || !termsAccepted) {
    json(res, 400, { error: 'Name, email, phone, trading experience, and terms acceptance are required.' });
    return;
  }
  if (couponCode && !isCouponCode(couponCode)) return json(res, 400, { error: 'Coupon code format is invalid.' });

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: activeCourses, error: coursesError } = await admin
    .from('courses')
    .select('title, price, offer_price, drive_url, discord_url, active')
    .eq('active', true);
  if (coursesError) throw coursesError;
  const requestedKind = courseKind(requestedCourseName);
  const courseData = (activeCourses || []).find((course) => course.title === requestedCourseName)
    || (activeCourses || []).find((course) => courseKind(course.title) === requestedKind);
  const fallbackCourse = COURSES.find((course) => courseKind(course.name) === requestedKind);
  if (!courseData && !fallbackCourse) return json(res, 404, { error: 'The selected course is unavailable.' });
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

  if (finalAmount > 0 && !paymentScreenshot?.dataUrl) return json(res, 400, { error: 'A payment screenshot is required.' });
  if (paymentScreenshot?.dataUrl) {
    const buffer = decodeJpegDataUrl(paymentScreenshot.dataUrl);

    paymentScreenshotPath = `${orderId}.jpg`;
    const { error: uploadError } = await admin.storage
      .from('payment-proofs')
      .upload(paymentScreenshotPath, buffer, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (uploadError) {
      throw uploadError;
    }
  }

  const pendingOrder = {
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

  const { data: atomicOrder, error: atomicError } = await admin.rpc('create_course_order', {
    p_id: orderId,
    p_course_name: selectedCourse.name,
    p_full_name: fullName,
    p_email: email,
    p_phone: phone,
    p_trading_experience: tradingExperience,
    p_coupon_code: appliedCoupon?.code || null,
    p_payment_screenshot_path: paymentScreenshotPath,
    p_remarks: remarks,
    p_source: 'website',
  });
  const atomicRow = Array.isArray(atomicOrder) ? atomicOrder[0] : atomicOrder;
  let order = atomicRow || pendingOrder;
  if (atomicError) {
    // Backward-compatible deployment path while the production migration is applied.
    if (!['PGRST202', '42883'].includes(atomicError.code)) {
      if (paymentScreenshotPath) await admin.storage.from('payment-proofs').remove([paymentScreenshotPath]);
      throw atomicError;
    }
    const { error: insertError } = await admin.from('course_orders').insert(pendingOrder);
    if (insertError) {
      if (paymentScreenshotPath) await admin.storage.from('payment-proofs').remove([paymentScreenshotPath]);
      throw insertError;
    }
    if (appliedCoupon) await admin.from('coupons').update({ current_uses: appliedCoupon.current_uses + 1 }).eq('id', appliedCoupon.id);
  }

  const payableAmount = Number(order.final_amount);

  const safeOrder = Object.fromEntries(Object.entries(order).map(([key, value]) => [key, typeof value === 'string' ? escapeHtml(value) : value]));
  const [emailSent, adminEmailSent] = await Promise.all([
    sendEmail({
      to: email,
      subject: payableAmount === 0 ? 'Trading Boy course access approved' : `Trading Boy receipt - ${selectedCourse.name}`,
      html: payableAmount === 0 ? paidAccessHtml({ ...safeOrder, drive_url: isHttpsUrl(selectedCourse.drive_url) ? escapeHtml(selectedCourse.drive_url) : null, discord_url: isHttpsUrl(selectedCourse.discord_url) ? escapeHtml(selectedCourse.discord_url) : null }) : receiptHtml(safeOrder),
    }),
    payableAmount > 0
      ? sendEmail({ to: ADMIN_EMAIL, subject: `New payment submitted - ${selectedCourse.name}`, html: adminPaymentHtml(safeOrder) })
      : Promise.resolve(false),
  ]);

  return json(res, 200, { orderId: order.id, payableAmount, emailSent: Boolean(emailSent), adminEmailSent: Boolean(adminEmailSent) });
  } catch (error) {
    return handleApiError(res, error, 'checkout.create');
  }
}
