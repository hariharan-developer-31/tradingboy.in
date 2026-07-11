import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminPasscode = process.env.ADMIN_PASSCODE;
const driveCourseUrl = process.env.DRIVE_COURSE_URL;

const json = (res, status, body) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
};

const decodeDataUrl = (dataUrl) => {
  const [, base64 = ''] = String(dataUrl).split(',');
  return Buffer.from(base64, 'base64');
};

const readBody = async (req) => {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
};

const formatAmount = (amount) => `Rs. ${Number(amount).toLocaleString('en-IN')}`;

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

const paidAccessHtml = (order) => `
  <div style="font-family:Arial,sans-serif;background:#0f1113;color:#ffffff;padding:28px">
    <div style="max-width:620px;margin:0 auto;border:1px solid #1f2933;padding:28px">
      <h1 style="margin:0 0 12px;color:#25aef4">Trading Boy Academy</h1>
      <h2 style="margin:0 0 20px">Course Access Approved</h2>
      <p>Hi ${order.full_name},</p>
      <p>Your payment is verified. Your course access is now approved.</p>
      <p><strong>Important:</strong> open the course using this same email address: <strong>${order.email}</strong>.</p>
      ${
        order.course_drive_url || driveCourseUrl
          ? `<p style="margin:28px 0"><a href="${order.course_drive_url || driveCourseUrl}" style="background:#25aef4;color:#000000;text-decoration:none;font-weight:bold;padding:14px 20px;display:inline-block">Open Course Drive Folder</a></p>`
          : '<p>The team will share your course access by email within 12 hours.</p>'
      }
      <table style="width:100%;border-collapse:collapse;margin-top:20px">
        <tr><td style="padding:8px 0;color:#9ca3af">Order ID</td><td style="padding:8px 0;text-align:right">${order.id}</td></tr>
        <tr><td style="padding:8px 0;color:#9ca3af">Amount</td><td style="padding:8px 0;text-align:right">${formatAmount(order.final_amount)}</td></tr>
        <tr><td style="padding:8px 0;color:#9ca3af">Status</td><td style="padding:8px 0;text-align:right">${order.payment_status}</td></tr>
      </table>
      <p style="margin-top:24px;color:#9ca3af">If Google Drive says access denied, contact admin after confirming your email was shared.</p>
      <p style="margin-top:8px;color:#9ca3af">From: admin@tradingboy.in</p>
    </div>
  </div>
`;

const statusHtml = (order) => `
  <div style="font-family:Arial,sans-serif;background:#0f1113;color:#ffffff;padding:28px">
    <div style="max-width:620px;margin:0 auto;border:1px solid #1f2933;padding:28px">
      <h1 style="margin:0 0 12px;color:#25aef4">Trading Boy Academy</h1>
      <h2 style="margin:0 0 20px">Payment Status Updated</h2>
      <p>Hi ${order.full_name},</p>
      <p>Your payment status for ${order.course_name || 'Complete Forex Mastery'} is now <strong>${order.payment_status}</strong>.</p>
      <p>If your payment is under review, the admin will verify it and send course access after approval.</p>
      <table style="width:100%;border-collapse:collapse;margin-top:20px">
        <tr><td style="padding:8px 0;color:#9ca3af">Order ID</td><td style="padding:8px 0;text-align:right">${order.id}</td></tr>
        <tr><td style="padding:8px 0;color:#9ca3af">Amount</td><td style="padding:8px 0;text-align:right">${formatAmount(order.final_amount)}</td></tr>
        <tr><td style="padding:8px 0;color:#9ca3af">Status</td><td style="padding:8px 0;text-align:right">${order.payment_status}</td></tr>
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

  if (!supabaseUrl || !serviceRoleKey || !adminPasscode) {
    json(res, 500, { error: 'Admin API environment variables are missing.' });
    return;
  }

  const body = await readBody(req);

  if (body.passcode !== adminPasscode) {
    json(res, 401, { error: 'Invalid admin passcode.' });
    return;
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const action = body.action;

  if (action === 'orders') {
    const { data, error } = await admin
      .from('course_orders')
      .select(
        'id, course_name, full_name, email, phone, trading_experience, terms_accepted, coupon_code, original_amount, discount_amount, final_amount, payment_status, payment_screenshot_path, remarks, created_at',
      )
      .order('created_at', { ascending: false });

    if (error) {
      json(res, 500, { error: error.message });
      return;
    }

    json(res, 200, { data });
    return;
  }

  if (action === 'updateOrder') {
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
    if (data.course_name) {
      const { data: course } = await admin.from('courses').select('drive_url').eq('title', data.course_name).maybeSingle();
      courseDriveUrl = course?.drive_url || null;
    }
    const emailOrder = { ...data, course_drive_url: courseDriveUrl };
    const emailSent = await sendEmail({
      to: data.email,
      subject:
        data.payment_status === 'paid'
          ? 'Trading Boy course access approved'
          : `Trading Boy payment status: ${data.payment_status}`,
      html: data.payment_status === 'paid' ? paidAccessHtml(emailOrder) : statusHtml(data),
    });

    json(res, 200, { ok: true, emailSent });
    return;
  }

  if (action === 'coupons') {
    const { data, error } = await admin
      .from('coupons')
      .select('id, code, discount_type, discount_value, active')
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
      .select('id, title, description, thumbnail_url, normal_price, offer_price, price, drive_url, active, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      json(res, 500, { error: error.message });
      return;
    }

    json(res, 200, { data });
    return;
  }

  if (action === 'saveCourse') {
    const title = String(body.title || '').trim();
    const normalPrice = Number(body.normalPrice);
    const offerPrice = Number(body.offerPrice);

    if (!title || Number.isNaN(normalPrice) || normalPrice <= 0 || Number.isNaN(offerPrice) || offerPrice <= 0) {
      json(res, 400, { error: 'Valid title, normal price, and offer price are required.' });
      return;
    }

    const payload = {
      title,
      description: String(body.description || '').trim() || null,
      normal_price: normalPrice,
      offer_price: offerPrice,
      price: offerPrice,
      drive_url: String(body.driveUrl || '').trim() || null,
    };

    if (body.thumbnailDataUrl) {
      const buffer = decodeDataUrl(body.thumbnailDataUrl);
      if (buffer.byteLength > 5 * 1024 * 1024) {
        json(res, 400, { error: 'Image must be below 5MB.' });
        return;
      }
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
      payload.thumbnail_url = String(body.thumbnailUrl || '').trim() || null;
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
    const { error } = await admin.from('courses').update({ active: body.active }).eq('id', body.courseId);

    if (error) {
      json(res, 500, { error: error.message });
      return;
    }

    json(res, 200, { ok: true });
    return;
  }

  if (action === 'deleteCourse') {
    const { error } = await admin.from('courses').delete().eq('id', body.courseId);

    if (error) {
      json(res, 500, { error: error.message });
      return;
    }

    json(res, 200, { ok: true });
    return;
  }

  if (action === 'saveCoupon') {
    const { error } = await admin.from('coupons').upsert(
      {
        code: String(body.code || '').trim().toUpperCase(),
        discount_type: body.discountType,
        discount_value: Number(body.discountValue),
        expires_at: body.expiresAt ? new Date(body.expiresAt).toISOString() : null,
        max_uses: body.maxUses ? Number(body.maxUses) : null,
        active: true,
      },
      { onConflict: 'code' },
    );

    if (error) {
      json(res, 500, { error: error.message });
      return;
    }

    json(res, 200, { ok: true });
    return;
  }

  if (action === 'toggleCoupon') {
    const { error } = await admin.from('coupons').update({ active: body.active }).eq('id', body.couponId);

    if (error) {
      json(res, 500, { error: error.message });
      return;
    }

    json(res, 200, { ok: true });
    return;
  }

  if (action === 'deleteCoupon') {
    const { error } = await admin.from('coupons').delete().eq('id', body.couponId);

    if (error) {
      json(res, 500, { error: error.message });
      return;
    }

    json(res, 200, { ok: true });
    return;
  }

  json(res, 400, { error: 'Unknown action.' });
}
