import { createClient } from '@supabase/supabase-js';
import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const localAdminApi = (env: Record<string, string>): Plugin => ({
  name: 'local-admin-api',
  configureServer(server) {
    server.middlewares.use('/api/checkout', async (req, res) => {
      if ((req as any).method !== 'POST') {
        sendJson(res, 405, { error: 'Method not allowed' });
        return;
      }

      const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
      const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !serviceRoleKey) {
        sendJson(res, 500, { error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.' });
        return;
      }

      try {
        const body = await readJsonBody(req);
        const fullName = String(body.name || '').trim();
        const email = String(body.email || '').trim();
        const phone = String(body.phone || '').trim();
        const couponCode = String(body.couponCode || '').trim().toUpperCase();
        const paymentScreenshot = body.paymentScreenshot;

        if (!fullName || !email || !phone) {
          sendJson(res, 400, { error: 'Name, email, and phone are required.' });
          return;
        }

        const admin = createClient(supabaseUrl, serviceRoleKey);
        const coursePrice = 7199;
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
                ? Math.min(Math.round((coursePrice * data.discount_value) / 100), coursePrice)
                : Math.min(data.discount_value, coursePrice);
          }
        }

        const orderId = randomUUID();
        let paymentScreenshotPath = null;

        if (paymentScreenshot?.dataUrl) {
          const buffer = decodeDataUrl(paymentScreenshot.dataUrl);

          if (buffer.byteLength > 100 * 1024) {
            sendJson(res, 400, { error: 'Payment screenshot must be below 100KB after compression.' });
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
            sendJson(res, 500, { error: uploadError.message });
            return;
          }
        }

        const order = {
          id: orderId,
          course_name: 'Complete Forex Mastery',
          full_name: fullName,
          email,
          phone,
          plan: 'Complete Forex Mastery',
          coupon_code: appliedCoupon,
          original_amount: coursePrice,
          discount_amount: discountAmount,
          final_amount: coursePrice - discountAmount,
          payment_status: 'pending',
          payment_screenshot_path: paymentScreenshotPath,
          source: 'website',
        };
        const { error } = await admin.from('course_orders').insert(order);

        if (error) {
          sendJson(res, 500, { error: error.message });
          return;
        }

        const emailSent = await sendMail(env, {
          to: email,
          subject: 'Trading Boy receipt - Complete Forex Mastery',
          html: receiptHtml(order),
        });

        sendJson(res, 200, { orderId: order.id, payableAmount: order.final_amount, emailSent });
      } catch (error) {
        sendJson(res, 500, { error: error instanceof Error ? error.message : 'Checkout API failed.' });
      }
    });

    server.middlewares.use('/api/admin', async (req, res) => {
      if ((req as any).method !== 'POST') {
        sendJson(res, 405, { error: 'Method not allowed' });
        return;
      }

      const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
      const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
      const adminPasscode = env.ADMIN_PASSCODE;

      if (!supabaseUrl || !serviceRoleKey || !adminPasscode) {
        sendJson(res, 500, {
          error: 'Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or ADMIN_PASSCODE in .env.',
        });
        return;
      }

      try {
        const body = await readJsonBody(req);

        if (body.passcode !== adminPasscode) {
          sendJson(res, 401, { error: 'Invalid admin passcode.' });
          return;
        }

        const admin = createClient(supabaseUrl, serviceRoleKey);

        if (body.action === 'orders') {
          const { data, error } = await admin
            .from('course_orders')
            .select(
              'id, course_name, full_name, email, phone, coupon_code, original_amount, discount_amount, final_amount, payment_status, created_at',
            )
            .order('created_at', { ascending: false });

          sendJson(res, error ? 500 : 200, error ? { error: error.message } : { data });
          return;
        }

        if (body.action === 'updateOrder') {
          if (body.paymentStatus === 'paid' && !env.DRIVE_COURSE_URL) {
            sendJson(res, 500, {
              error: 'DRIVE_COURSE_URL is missing. Add the private Google Drive folder link first.',
            });
            return;
          }

          const { data, error } = await admin
            .from('course_orders')
            .update({ payment_status: body.paymentStatus })
            .eq('id', body.orderId)
            .select('id, course_name, full_name, email, final_amount, payment_status')
            .single();

          if (error) {
            sendJson(res, 500, { error: error.message });
            return;
          }

          const emailSent = await sendMail(env, {
            to: data.email,
            subject:
              data.payment_status === 'paid'
                ? 'Trading Boy course access approved'
                : `Trading Boy payment status: ${data.payment_status}`,
            html: data.payment_status === 'paid' ? paidAccessHtml(env, data) : statusHtml(data),
          });

          sendJson(res, 200, { ok: true, emailSent });
          return;
        }

        if (body.action === 'coupons') {
          const { data, error } = await admin
            .from('coupons')
            .select('id, code, discount_type, discount_value, active')
            .order('created_at', { ascending: false });

          sendJson(res, error ? 500 : 200, error ? { error: error.message } : { data });
          return;
        }

        if (body.action === 'courses') {
          const { data, error } = await admin
            .from('courses')
            .select('id, title, description, price, drive_url, active, created_at')
            .order('created_at', { ascending: false });

          sendJson(res, error ? 500 : 200, error ? { error: error.message } : { data });
          return;
        }

        if (body.action === 'saveCourse') {
          const title = String(body.title || '').trim();
          const price = Number(body.price);

          if (!title || Number.isNaN(price) || price <= 0) {
            sendJson(res, 400, { error: 'Valid title and price are required.' });
            return;
          }

          const payload = {
            title,
            description: String(body.description || '').trim() || null,
            price,
            drive_url: String(body.driveUrl || '').trim() || null,
          };
          const query = body.id
            ? admin.from('courses').update(payload).eq('id', body.id)
            : admin.from('courses').insert(payload);
          const { error } = await query;

          sendJson(res, error ? 500 : 200, error ? { error: error.message } : { ok: true });
          return;
        }

        if (body.action === 'toggleCourse') {
          const { error } = await admin.from('courses').update({ active: body.active }).eq('id', body.courseId);

          sendJson(res, error ? 500 : 200, error ? { error: error.message } : { ok: true });
          return;
        }

        if (body.action === 'deleteCourse') {
          const { error } = await admin.from('courses').delete().eq('id', body.courseId);

          sendJson(res, error ? 500 : 200, error ? { error: error.message } : { ok: true });
          return;
        }

        if (body.action === 'saveCoupon') {
          const { error } = await admin.from('coupons').upsert(
            {
              code: String(body.code || '').trim().toUpperCase(),
              discount_type: body.discountType,
              discount_value: Number(body.discountValue),
              active: true,
            },
            { onConflict: 'code' },
          );

          sendJson(res, error ? 500 : 200, error ? { error: error.message } : { ok: true });
          return;
        }

        if (body.action === 'toggleCoupon') {
          const { error } = await admin
            .from('coupons')
            .update({ active: body.active })
            .eq('id', body.couponId);

          sendJson(res, error ? 500 : 200, error ? { error: error.message } : { ok: true });
          return;
        }

        sendJson(res, 400, { error: 'Unknown action.' });
      } catch (error) {
        sendJson(res, 500, { error: error instanceof Error ? error.message : 'Admin API failed.' });
      }
    });
  },
});

const sendJson = (res: any, status: number, body: unknown) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
};

const formatAmount = (amount: number) => `Rs. ${Number(amount).toLocaleString('en-IN')}`;

const decodeDataUrl = (dataUrl: string) => {
  const [, base64 = ''] = String(dataUrl).split(',');

  return Buffer.from(base64, 'base64');
};

const sendMail = async (
  env: Record<string, string>,
  message: { to: string; subject: string; html: string },
) => {
  if (!env.RESEND_API_KEY) {
    return false;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.MAIL_FROM || 'Trading Boy <admin@tradingboy.in>',
      ...message,
    }),
  });

  return response.ok;
};

const receiptHtml = (order: any) => `
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

const statusHtml = (order: any) => `
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

const paidAccessHtml = (env: Record<string, string>, order: any) => `
  <div style="font-family:Arial,sans-serif;background:#0f1113;color:#ffffff;padding:28px">
    <div style="max-width:620px;margin:0 auto;border:1px solid #1f2933;padding:28px">
      <h1 style="margin:0 0 12px;color:#25aef4">Trading Boy Academy</h1>
      <h2 style="margin:0 0 20px">Course Access Approved</h2>
      <p>Hi ${order.full_name},</p>
      <p>Your payment is verified. Your course access is now approved.</p>
      <p><strong>Important:</strong> open the course using this same email address: <strong>${order.email}</strong>. The private Google Drive folder must be manually shared with that email by the admin.</p>
      <p style="margin:28px 0">
        <a href="${env.DRIVE_COURSE_URL}" style="background:#25aef4;color:#000000;text-decoration:none;font-weight:bold;padding:14px 20px;display:inline-block">Open Course Drive Folder</a>
      </p>
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

const readJsonBody = async (req: any) =>
  new Promise<any>((resolve, reject) => {
    let body = '';

    req.on('data', (chunk: Buffer) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react(), localAdminApi(env)],
  };
});
