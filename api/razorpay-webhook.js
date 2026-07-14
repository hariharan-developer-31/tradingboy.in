import { createClient } from '@supabase/supabase-js';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { handleApiError, HttpError, json, requirePost } from './_security.js';
import { getCheckout, razorpayRequest, recordVerifiedPayment, sendPaymentEmails } from './checkout.js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const readRawBody = async (req, maxBytes = 256 * 1024) => {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) throw new HttpError(413, 'Webhook payload is too large.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
};

const signaturesMatch = (actual, expected) => {
  const left = Buffer.from(String(actual || ''), 'utf8');
  const right = Buffer.from(expected, 'utf8');
  return left.length === right.length && timingSafeEqual(left, right);
};

export default async function handler(req, res) {
  if (!requirePost(req, res)) return;
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret || !supabaseUrl || !serviceRoleKey) throw new HttpError(503, 'Webhook is not configured.');

    const rawBody = await readRawBody(req);
    const expectedSignature = createHmac('sha256', secret).update(rawBody).digest('hex');
    if (!signaturesMatch(req.headers?.['x-razorpay-signature'], expectedSignature)) throw new HttpError(401, 'Invalid webhook signature.');

    let event;
    try { event = JSON.parse(rawBody.toString('utf8')); }
    catch { throw new HttpError(400, 'Invalid webhook payload.'); }
    if (event.event !== 'payment.captured') return json(res, 200, { ok: true, ignored: true });

    const eventPayment = event.payload?.payment?.entity;
    const razorpayPaymentId = String(eventPayment?.id || '');
    const razorpayOrderId = String(eventPayment?.order_id || '');
    if (!/^pay_[A-Za-z0-9]+$/.test(razorpayPaymentId) || !/^order_[A-Za-z0-9]+$/.test(razorpayOrderId)) throw new HttpError(400, 'Webhook payment identifiers are invalid.');

    // Do not trust event fields alone: retrieve both entities directly from Razorpay.
    const [gatewayOrder, gatewayPayment] = await Promise.all([
      razorpayRequest(`/orders/${razorpayOrderId}`),
      razorpayRequest(`/payments/${razorpayPaymentId}`),
    ]);
    if (gatewayPayment.order_id !== razorpayOrderId || gatewayPayment.status !== 'captured' || gatewayPayment.amount !== gatewayOrder.amount || gatewayOrder.currency !== 'INR') throw new HttpError(400, 'Razorpay payment verification failed.');

    const notes = gatewayOrder.notes || {};
    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const checkout = await getCheckout(admin, {
      name: notes.full_name, email: notes.email, phone: notes.phone,
      tradingExperience: notes.trading_experience, courseName: notes.course,
      couponCode: notes.coupon, termsAccepted: true, privacyAccepted: true,
    });
    if (gatewayOrder.amount !== checkout.finalAmount * 100) throw new HttpError(400, 'Razorpay payment amount does not match the order.');

    const { order, duplicate } = await recordVerifiedPayment(admin, checkout, razorpayOrderId, razorpayPaymentId);
    const delivery = await sendPaymentEmails(admin, order);
    if (!delivery.emailSent || !delivery.adminEmailSent) throw new HttpError(503, 'Payment was recorded, but email delivery will be retried.');
    return json(res, 200, { ok: true, duplicate });
  } catch (error) {
    return handleApiError(res, error, 'razorpay.webhook');
  }
}
