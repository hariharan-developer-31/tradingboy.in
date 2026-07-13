import { createClient } from '@supabase/supabase-js';
import { randomUUID, scryptSync } from 'node:crypto';
import { adminSessionCookie, cleanText, clearAdminSessionCookie, createAdminSession, decodeJpegDataUrl, hasValidAdminSession, isCouponCode, isEmail, isHttpsUrl, isUuid, json, logServerError, rateLimit, readJsonBody, requirePost, requireTrustedOrigin, safeEqual } from './_security.js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminPasscode = process.env.ADMIN_PASSCODE;
const driveCourseUrl = process.env.DRIVE_COURSE_URL;
const fallbackAdminPasscodeSalt = '2RXfth2eWJYOrCwQcWSjhw';
const fallbackAdminPasscodeDigest = 'jEcP8ozQj-3XfVtbPd3QNmTxv7as6DomgQEwqM99axc';

const hasAdminPasscode = Boolean(adminPasscode || fallbackAdminPasscodeDigest);
const isValidAdminPasscode = (submittedPasscode) => {
  if (adminPasscode && safeEqual(submittedPasscode, adminPasscode)) return true;
  const submittedDigest = scryptSync(String(submittedPasscode || ''), fallbackAdminPasscodeSalt, 32).toString('base64url');
  return safeEqual(submittedDigest, fallbackAdminPasscodeDigest);
};

const formatAmount = (amount) => `Rs. ${Number(amount).toLocaleString('en-IN')}`;

const sendEmail = async ({ to, subject, html }) => {
  if (!process.env.RESEND_API_KEY) {
    return { ok: false, error: 'RESEND_API_KEY is missing in environment variables' };
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

    if (!response.ok) {
      logServerError('email.resend', new Error(`Provider returned ${response.status}`));
      return { ok: false, error: 'Email delivery failed.' };
    }

    return { ok: true };
  } catch (err) {
    logServerError('email.send', err);
    return { ok: false, error: 'Email delivery failed.' };
  }
};

const darkEmail = (content) => `<!doctype html><html><head><meta name="color-scheme" content="dark only"><meta name="supported-color-schemes" content="dark only"><style>:root{color-scheme:dark only;supported-color-schemes:dark only}html,body{margin:0!important;padding:0!important;background:#000000!important;color:#ffffff!important}a{color:#25aef4}</style></head><body bgcolor="#000000" style="margin:0;padding:0;background:#000000;color:#ffffff;">${content}</body></html>`;
const escapeHtml = (value) => String(value || '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
const campaignHtml = ({ name, message }) => darkEmail(`
  <div style="font-family:Arial,sans-serif;background:#000000;color:#ffffff;padding:32px 16px;">
    <div style="max-width:620px;margin:0 auto;background:#0f1115;border:1px solid #1f2933;padding:32px;">
      <img src="https://tradingboy.in/logo.png" alt="Trading Boy Academy" style="height:52px;width:auto;margin:0 0 24px;display:block;" />
      <p style="margin:0 0 18px;color:#ffffff;font-size:16px;line-height:1.6;">Hi ${escapeHtml(name || 'Trader')},</p>
      <div style="color:#cbd5e1;font-size:15px;line-height:1.75;white-space:pre-wrap;">${escapeHtml(message)}</div>
      <div style="margin-top:32px;padding-top:20px;border-top:1px solid #1f2933;color:#64748b;font-size:12px;line-height:1.6;">You received this message because you joined a Trading Boy Academy course.<br>From: admin@tradingboy.in</div>
    </div>
  </div>
`);

const paidAccessHtml = (order) => darkEmail(`
  <div style="font-family:'Inter',Arial,sans-serif;background:#000000;color:#ffffff;padding:40px 20px;">
    <div style="max-width:600px;margin:0 auto;background:#0f1115;border:1px solid #1f2933;border-radius:16px;padding:40px;box-shadow:0 10px 40px rgba(0,0,0,0.5)">
      <div style="text-align:center;margin-bottom:32px;">
        <img src="https://tradingboy.in/logo.png" alt="Trading Boy" style="height:60px;width:auto;margin:0 auto;display:block;" />
        <p style="margin:8px 0 0;color:#9ca3af;font-size:12px;letter-spacing:2px;text-transform:uppercase;">Premium Academy</p>
      </div>
      
      <div style="background:rgba(37, 174, 244, 0.1);border:1px solid rgba(37, 174, 244, 0.2);border-radius:12px;padding:24px;text-align:center;margin-bottom:32px;">
        <h2 style="margin:0 0 12px;color:#ffffff;font-size:22px;font-weight:600;">Course Access Approved! 🎉</h2>
        <p style="margin:0;color:#cbd5e1;font-size:15px;line-height:1.6;">Hi <strong>${order.full_name}</strong>, your payment has been successfully verified.</p>
      </div>

      <p style="color:#cbd5e1;font-size:15px;line-height:1.6;margin-bottom:24px;">You now have full lifetime access to <strong>${order.course_name || 'your course'}</strong>. Please use this exact email address (<strong>${order.email}</strong>) to access the materials.</p>
      
      <div style="text-align:center;margin:40px 0;">
        ${
          order.course_drive_url || driveCourseUrl
            ? `<a href="${order.course_drive_url || driveCourseUrl}" style="background:#25aef4;color:#000000;text-decoration:none;font-weight:700;font-size:14px;padding:16px 32px;border-radius:8px;display:inline-block;text-transform:uppercase;letter-spacing:1px;">Access Your Course Now</a>`
            : '<p style="color:#25aef4;font-weight:600;font-size:15px;padding:16px;border:1px dashed #25aef4;border-radius:8px;">The admin team will share your course access via email within 12 hours.</p>'
        }
        ${
          order.course_discord_url
            ? `<a href="${order.course_discord_url}" style="margin-top:14px;background:#5865F2;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:16px 32px;border-radius:8px;display:inline-block;text-transform:uppercase;letter-spacing:1px;">Join the Course Discord</a>`
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

const statusHtml = (order) => darkEmail(`
  <div style="font-family:'Inter',Arial,sans-serif;background:#000000;color:#ffffff;padding:40px 20px;">
    <div style="max-width:600px;margin:0 auto;background:#0f1115;border:1px solid #1f2933;border-radius:16px;padding:40px;box-shadow:0 10px 40px rgba(0,0,0,0.5)">
      <div style="text-align:center;margin-bottom:32px;">
        <img src="https://tradingboy.in/logo.png" alt="Trading Boy" style="height:60px;width:auto;margin:0 auto;display:block;" />
      </div>
      
      <h2 style="margin:0 0 20px;color:#ffffff;font-size:20px;text-align:center;">Payment Status Update</h2>
      <p style="color:#cbd5e1;font-size:15px;line-height:1.6;">Hi <strong>${order.full_name}</strong>,</p>
      <p style="color:#cbd5e1;font-size:15px;line-height:1.6;margin-bottom:32px;">Your payment status for <strong>${order.course_name || 'Complete Forex Mastery'}</strong> has been updated to: <strong style="color:#25aef4;text-transform:uppercase;letter-spacing:1px;background:rgba(37,174,244,0.1);padding:4px 12px;border-radius:4px;margin-left:8px;">${order.payment_status.replace('_', ' ')}</strong></p>
      
      ${order.payment_status === 'under_review' ? '<div style="background:#1e293b;border-left:4px solid #25aef4;padding:16px;margin-bottom:32px;"><p style="margin:0;color:#cbd5e1;font-size:14px;line-height:1.5;">Our admin team is currently reviewing your payment proof. We will send you another email with your course access link as soon as it is approved.</p></div>' : ''}
      
      <h3 style="color:#ffffff;font-size:14px;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #1f2933;padding-bottom:12px;margin-bottom:20px;">Order Details</h3>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr><td style="padding:12px 0;color:#9ca3af;border-bottom:1px solid #1f2933;">Order ID</td><td style="padding:12px 0;text-align:right;color:#ffffff;border-bottom:1px solid #1f2933;font-family:monospace;">${order.id}</td></tr>
        <tr><td style="padding:12px 0;color:#9ca3af;border-bottom:1px solid #1f2933;">Amount</td><td style="padding:12px 0;text-align:right;color:#ffffff;border-bottom:1px solid #1f2933;font-weight:600;">${formatAmount(order.final_amount)}</td></tr>
        <tr><td style="padding:12px 0;color:#9ca3af;">Status</td><td style="padding:12px 0;text-align:right;color:#25aef4;font-weight:700;text-transform:uppercase;">${order.payment_status.replace('_', ' ')}</td></tr>
      </table>
      
      <div style="margin-top:40px;padding-top:24px;border-top:1px solid #1f2933;text-align:center;">
        <p style="margin:0;color:#475569;font-size:12px;">© ${new Date().getFullYear()} Trading Boy Academy</p>
      </div>
    </div>
  </div>
`);

export default async function handler(req, res) {
  if (!requirePost(req, res) || !requireTrustedOrigin(req, res)) return;
  if (!rateLimit(req, res, { scope: 'admin', limit: 120, windowMs: 60_000 })) return;

  if (!supabaseUrl || !serviceRoleKey || !hasAdminPasscode) {
    json(res, 503, { error: 'Admin service is temporarily unavailable.' });
    return;
  }

  let body;
  try {
    body = await readJsonBody(req, 180 * 1024);
  } catch (error) {
    return json(res, error.status || 400, { error: error.message || 'Invalid request.' });
  }

  const action = body.action;
  const sessionSecret = process.env.ADMIN_SESSION_SECRET || serviceRoleKey;
  if (action === 'login') {
    if (!rateLimit(req, res, { scope: 'admin-login', limit: 8, windowMs: 15 * 60_000 })) return;
    if (!isValidAdminPasscode(body.passcode)) return json(res, 401, { error: 'Invalid admin passcode.' });
    const session = createAdminSession(sessionSecret);
    res.setHeader('Set-Cookie', adminSessionCookie(session.token, session.ttlSeconds));
    return json(res, 200, { ok: true });
  }
  if (action === 'logout') {
    res.setHeader('Set-Cookie', clearAdminSessionCookie());
    return json(res, 200, { ok: true });
  }
  if (!hasValidAdminSession(req, sessionSecret)) return json(res, 401, { error: 'Admin session expired. Sign in again.' });

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

  if (action === 'orders') {
    const { data, error } = await admin
      .from('course_orders')
      .select(
        'id, course_name, full_name, email, phone, trading_experience, terms_accepted, coupon_code, original_amount, discount_amount, final_amount, payment_status, payment_screenshot_path, remarks, created_at',
      )
      .order('created_at', { ascending: false })
      .limit(1000);

    if (error) {
      json(res, 500, { error: error.message });
      return;
    }

    json(res, 200, { data });
    return;
  }

  if (action === 'updateOrder') {
    if (!isUuid(body.orderId) || !['pending', 'under_review', 'paid', 'rejected'].includes(body.paymentStatus)) {
      return json(res, 400, { error: 'A valid order and payment status are required.' });
    }
    const { data, error } = await admin
      .from('course_orders')
      .update({ payment_status: body.paymentStatus })
      .eq('id', body.orderId)
      .select('id, course_name, full_name, email, final_amount, payment_status')
      .single();

    if (error) {
      json(res, 500, { error: error.message });
      return;
    }

    let courseDriveUrl = null;
    let courseDiscordUrl = null;
    if (data.course_name) {
      const { data: course } = await admin.from('courses').select('drive_url, discord_url').eq('title', data.course_name).maybeSingle();
      courseDriveUrl = course?.drive_url || null;
      courseDiscordUrl = course?.discord_url || null;
    }
    const safeData = Object.fromEntries(Object.entries(data).map(([key, value]) => [key, typeof value === 'string' ? escapeHtml(value) : value]));
    const emailOrder = {
      ...safeData,
      course_drive_url: isHttpsUrl(courseDriveUrl) ? escapeHtml(courseDriveUrl) : null,
      course_discord_url: isHttpsUrl(courseDiscordUrl) ? escapeHtml(courseDiscordUrl) : null,
    };
    const emailResult = await sendEmail({
      to: data.email,
      subject:
        data.payment_status === 'paid'
          ? 'Trading Boy course access approved'
          : `Trading Boy payment status: ${data.payment_status}`,
      html: data.payment_status === 'paid' ? paidAccessHtml(emailOrder) : statusHtml(safeData),
    });

    json(res, 200, { ok: true, emailSent: emailResult.ok, emailError: emailResult.error });
    return;
  }

  if (action === 'deleteOrders') {
    const deleteAll = body.deleteAll === true;
    const orderIds = Array.isArray(body.orderIds) ? body.orderIds.map(String).filter(isUuid).slice(0, 500) : [];
    if (!deleteAll && orderIds.length === 0) {
      json(res, 400, { error: 'Select at least one payment record.' });
      return;
    }

    let proofQuery = admin.from('course_orders').select('id, payment_screenshot_path');
    if (!deleteAll) proofQuery = proofQuery.in('id', orderIds);
    const { data: records, error: recordsError } = await proofQuery;
    if (recordsError) {
      json(res, 500, { error: recordsError.message });
      return;
    }

    let deleteQuery = admin.from('course_orders').delete();
    deleteQuery = deleteAll ? deleteQuery.not('id', 'is', null) : deleteQuery.in('id', orderIds);
    const { error: deleteError } = await deleteQuery;
    if (deleteError) {
      json(res, 500, { error: deleteError.message });
      return;
    }

    const proofPaths = (records || []).map((record) => record.payment_screenshot_path).filter(Boolean);
    if (proofPaths.length > 0) await admin.storage.from('payment-proofs').remove(proofPaths);
    json(res, 200, { ok: true, deleted: records?.length || 0 });
    return;
  }

  if (action === 'sendCampaign') {
    const audience = ['all', 'manual'].includes(body.audience) ? body.audience : 'paid';
    const courseName = String(body.courseName || 'all').trim();
    const manualEmails = String(body.manualEmails || '').split(/[\s,;]+/).map((email) => email.trim().toLowerCase()).filter(isEmail).slice(0, 500);
    const subject = String(body.subject || '').trim().slice(0, 150);
    const message = String(body.message || '').trim().slice(0, 5000);
    if (!subject || !message) {
      json(res, 400, { error: 'Email subject and message are required.' });
      return;
    }

    let rows = [];
    if (audience !== 'manual') {
      let recipientQuery = admin.from('course_orders').select('email, full_name, course_name, payment_status').not('email', 'is', null);
      if (audience === 'paid') recipientQuery = recipientQuery.eq('payment_status', 'paid');
      if (courseName && courseName !== 'all') recipientQuery = recipientQuery.eq('course_name', courseName);
      recipientQuery = recipientQuery.limit(500);
      const { data, error: recipientError } = await recipientQuery;
      if (recipientError) {
        json(res, 500, { error: recipientError.message });
        return;
      }
      rows = data || [];
    }

    const recipientMap = new Map(rows.filter((row) => row.email).map((row) => [row.email.trim().toLowerCase(), row]));
    manualEmails.forEach((email) => {
      if (!recipientMap.has(email)) recipientMap.set(email, { email, full_name: 'Trader' });
    });
    const recipients = Array.from(recipientMap.values()).slice(0, 500);
    if (recipients.length === 0) {
      json(res, 400, { error: 'No recipients match this audience.' });
      return;
    }

    let sent = 0;
    let failed = 0;
    for (let index = 0; index < recipients.length; index += 5) {
      const results = await Promise.all(recipients.slice(index, index + 5).map((recipient) => sendEmail({
        to: recipient.email,
        subject,
        html: campaignHtml({ name: recipient.full_name, message }),
      })));
      sent += results.filter((result) => result.ok).length;
      failed += results.filter((result) => !result.ok).length;
    }
    json(res, 200, { ok: true, sent, failed, recipients: recipients.length });
    return;
  }

  if (action === 'coupons') {
    const { data, error } = await admin
      .from('coupons')
      .select('id, code, course_name, discount_type, discount_value, active, expires_at, max_uses, current_uses, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      json(res, 500, { error: error.message });
      return;
    }

    json(res, 200, { data });
    return;
  }

  if (action === 'courses') {
    const { data, error } = await admin
      .from('courses')
      .select('id, title, description, thumbnail_url, normal_price, offer_price, price, drive_url, discord_url, active, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      json(res, 500, { error: error.message });
      return;
    }

    json(res, 200, { data });
    return;
  }

  if (action === 'saveCourse') {
    const title = cleanText(body.title, 160);
    const normalPrice = Number(body.normalPrice);
    const offerPrice = Number(body.offerPrice);

    if (!title || Number.isNaN(normalPrice) || normalPrice <= 0 || Number.isNaN(offerPrice) || offerPrice <= 0) {
      json(res, 400, { error: 'Valid title, normal price, and offer price are required.' });
      return;
    }

    const payload = {
      title,
      description: cleanText(body.description, 1000) || null,
      normal_price: normalPrice,
      offer_price: offerPrice,
      price: offerPrice,
      drive_url: cleanText(body.driveUrl, 1000) || null,
      discord_url: cleanText(body.discordUrl, 1000) || null,
    };
    if (!isHttpsUrl(payload.drive_url) || !isHttpsUrl(payload.discord_url)) return json(res, 400, { error: 'Course and Discord links must use HTTPS.' });
    if (body.id && !isUuid(body.id)) return json(res, 400, { error: 'Invalid course ID.' });

    if (body.thumbnailDataUrl) {
      const buffer = decodeJpegDataUrl(body.thumbnailDataUrl);
      const imageId = randomUUID();
      const imagePath = `${imageId}.jpg`;
      const { error: uploadError } = await admin.storage
        .from('course-thumbnails')
        .upload(imagePath, buffer, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) {
        json(res, 500, { error: uploadError.message });
        return;
      }
      const { data: publicUrlData } = admin.storage.from('course-thumbnails').getPublicUrl(imagePath);
      payload.thumbnail_url = publicUrlData.publicUrl;
    } else if (body.thumbnailUrl !== undefined) {
      payload.thumbnail_url = cleanText(body.thumbnailUrl, 1000) || null;
      if (!isHttpsUrl(payload.thumbnail_url)) return json(res, 400, { error: 'Thumbnail link must use HTTPS.' });
    }
    const query = body.id
      ? admin.from('courses').update(payload).eq('id', body.id)
      : admin.from('courses').insert(payload);
    const { error } = await query;

    if (error) {
      json(res, 500, { error: error.message });
      return;
    }

    json(res, 200, { ok: true });
    return;
  }

  if (action === 'toggleCourse') {
    if (!isUuid(body.courseId) || typeof body.active !== 'boolean') return json(res, 400, { error: 'Invalid course update.' });
    const { error } = await admin.from('courses').update({ active: body.active }).eq('id', body.courseId);

    if (error) {
      json(res, 500, { error: error.message });
      return;
    }

    json(res, 200, { ok: true });
    return;
  }

  if (action === 'deleteCourse') {
    if (!isUuid(body.courseId)) return json(res, 400, { error: 'Invalid course ID.' });
    const { error } = await admin.from('courses').delete().eq('id', body.courseId);

    if (error) {
      json(res, 500, { error: error.message });
      return;
    }

    json(res, 200, { ok: true });
    return;
  }

  if (action === 'saveCoupon') {
    const code = cleanText(body.code, 40).toUpperCase();
    const discountType = body.discountType;
    const discountValue = Number(body.discountValue);
    const maxUses = body.maxUses ? Number(body.maxUses) : null;

    if (!isCouponCode(code) || !['fixed', 'percent'].includes(discountType) || !Number.isInteger(discountValue) || discountValue <= 0) {
      json(res, 400, { error: 'Valid coupon code, discount type, and discount value are required.' });
      return;
    }
    if (discountType === 'percent' && discountValue > 100) {
      json(res, 400, { error: 'Percentage discount cannot be above 100.' });
      return;
    }
    if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses <= 0)) {
      json(res, 400, { error: 'Maximum uses must be a positive number.' });
      return;
    }

    if (body.id && !isUuid(body.id)) return json(res, 400, { error: 'Invalid coupon ID.' });
    const expiry = body.expiresAt ? new Date(body.expiresAt) : null;
    if (expiry && Number.isNaN(expiry.getTime())) return json(res, 400, { error: 'Invalid coupon expiry date.' });
    const payload = {
      code,
      course_name: cleanText(body.courseName, 160) || null,
      discount_type: discountType,
      discount_value: discountValue,
      expires_at: expiry?.toISOString() || null,
      max_uses: maxUses,
      active: true,
    };
    const query = body.id
      ? admin.from('coupons').update(payload).eq('id', body.id)
      : admin.from('coupons').upsert(payload, { onConflict: 'code' });
    const { error } = await query;

    if (error) {
      json(res, 500, { error: error.message });
      return;
    }

    json(res, 200, { ok: true });
    return;
  }

  if (action === 'toggleCoupon') {
    if (!isUuid(body.couponId) || typeof body.active !== 'boolean') return json(res, 400, { error: 'Invalid coupon update.' });
    const { error } = await admin.from('coupons').update({ active: body.active }).eq('id', body.couponId);

    if (error) {
      json(res, 500, { error: error.message });
      return;
    }

    json(res, 200, { ok: true });
    return;
  }

  if (action === 'deleteCoupon') {
    if (!isUuid(body.couponId)) return json(res, 400, { error: 'Invalid coupon ID.' });
    const { error } = await admin.from('coupons').delete().eq('id', body.couponId);

    if (error) {
      json(res, 500, { error: error.message });
      return;
    }

    json(res, 200, { ok: true });
    return;
  }

  if (action === 'testimonials') {
    const { data, error } = await admin.from('testimonials').select('*').order('created_at', { ascending: true });
    if (error) {
      json(res, 500, { error: error.message });
      return;
    }
    json(res, 200, { data });
    return;
  }

  if (action === 'saveTestimonial') {
    const quote = cleanText(body.quote, 1200);
    const name = cleanText(body.name, 100);
    const role = cleanText(body.role, 120);
    if (!quote || !name || !role) {
      json(res, 400, { error: 'Quote, name, and role are required.' });
      return;
    }

    const payload = { quote, name, role, active: body.active !== false };

    if (body.photoDataUrl) {
      const buffer = decodeJpegDataUrl(body.photoDataUrl);
      if (buffer.byteLength > 100 * 1024) return json(res, 400, { error: 'Testimonial image must be below 100KB after compression.' });
      const imageId = randomUUID();
      const imagePath = `${imageId}.jpg`;
      const { error: uploadError } = await admin.storage
        .from('testimonial-photos')
        .upload(imagePath, buffer, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) {
        json(res, 500, { error: uploadError.message });
        return;
      }
      const { data: publicUrlData } = admin.storage.from('testimonial-photos').getPublicUrl(imagePath);
      payload.photo_url = publicUrlData.publicUrl;
    } else if (body.photoUrl !== undefined) {
      payload.photo_url = cleanText(body.photoUrl, 1000) || null;
      if (!isHttpsUrl(payload.photo_url)) return json(res, 400, { error: 'Testimonial image link must use HTTPS.' });
    }
    if (body.id && !isUuid(body.id)) return json(res, 400, { error: 'Invalid testimonial ID.' });

    const query = body.id
      ? admin.from('testimonials').update(payload).eq('id', body.id)
      : admin.from('testimonials').insert(payload);
    
    const { error } = await query;
    if (error) {
      json(res, 500, { error: error.message });
      return;
    }
    json(res, 200, { ok: true });
    return;
  }

  if (action === 'deleteTestimonial') {
    if (!isUuid(body.id)) return json(res, 400, { error: 'Invalid testimonial ID.' });
    const { error } = await admin.from('testimonials').delete().eq('id', body.id);
    if (error) {
      json(res, 500, { error: error.message });
      return;
    }
    json(res, 200, { ok: true });
    return;
  }

  json(res, 400, { error: 'Unknown action.' });
}
