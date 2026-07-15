import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('Razorpay checkout creates an order and verifies signature and gateway payment server-side', () => {
  const api = read('api/checkout.js');
  assert.match(api, /action === 'createOrder'/);
  assert.match(api, /createHmac\('sha256', process\.env\.RAZORPAY_KEY_SECRET\)/);
  assert.match(api, /timingSafeEqual/);
  assert.match(api, /razorpayRequest\(`\/payments\/\$\{razorpayPaymentId\}`\)/);
  assert.match(api, /gatewayOrder\.amount !== checkout\.finalAmount \* 100/);
  assert.match(api, /razorpay_payment_id.*maybeSingle/);
  assert.doesNotMatch(api, /decodeJpegDataUrl|payment-proofs|A payment screenshot is required/);
  assert.match(api, /new HttpError\(503, 'Razorpay is not configured on the server/);
});

test('production CSP permits Razorpay Checkout and its risk-detection CDN', () => {
  const vercel = read('vercel.json');
  assert.match(vercel, /script-src[^\n]*https:\/\/checkout\.razorpay\.com[^\n]*https:\/\/cdn\.razorpay\.com/);
  assert.match(vercel, /frame-src https:\/\/api\.razorpay\.com https:\/\/checkout\.razorpay\.com/);
  assert.match(vercel, /payment=\(self \\"https:\/\/checkout\.razorpay\.com\\" \\"https:\/\/api\.razorpay\.com\\"\)/);
  assert.doesNotMatch(vercel, /payment=\(\)/);
});

test('checkout validates a minimum integer paise amount and the returned gateway order', () => {
  const api = read('api/checkout.js');
  assert.match(api, /const amountInPaise = checkout\.finalAmount \* 100/);
  assert.match(api, /Number\.isSafeInteger\(amountInPaise\)/);
  assert.match(api, /amountInPaise < 100/);
  assert.match(api, /gatewayOrder\.amount !== amountInPaise/);
});

test('browser opens Razorpay only after details and consent and verifies before success', () => {
  const app = read('src/App.tsx');
  assert.match(app, /checkout\.razorpay\.com\/v1\/checkout\.js/);
  assert.match(app, /image: `\$\{window\.location\.origin\}\/razorpay-logo\.png`/);
  assert.match(app, /new \(window as any\)\.Razorpay/);
  assert.match(app, /action: 'verifyPayment'/);
  assert.match(app, /termsAccepted: true, privacyAccepted: true/);
  assert.match(app, /Terms &amp; Conditions/);
  assert.match(app, /Privacy Policy/);
  assert.match(app, />\s*Pay Now\s*</);
});

test('Razorpay migration records gateway IDs and removes manual payment storage', () => {
  const migration = read('migrations/20260714_razorpay_checkout.sql');
  assert.match(migration, /order_number text/);
  assert.match(migration, /razorpay_order_id text/);
  assert.match(migration, /razorpay_payment_id text/);
  assert.match(migration, /drive_access_status text/);
  assert.match(migration, /drop column if exists payment_screenshot_path/);
  assert.match(migration, /drop column if exists qr_code_url/);
  assert.match(migration, /drop column if exists upi_id/);
  assert.doesNotMatch(migration, /delete from storage\.(objects|buckets)/);
  assert.match(migration, /drop policy if exists "Service role can manage payment proofs"/);
});

test('admin grants Drive access separately and sends the existing course-access email', () => {
  const admin = read('api/admin.js');
  const app = read('src/App.tsx');
  assert.match(admin, /action === 'updateDriveAccess'/);
  assert.match(admin, /drive_access_status: driveAccessStatus/);
  assert.match(admin, /html: paidAccessHtml/);
  assert.match(admin, /Access remains pending/);
  assert.match(app, />Drive Access<\/th>/);
  assert.match(app, /updateDriveAccess\(order\.id, event\.target\.value\)/);
  assert.match(app, /Drive access granted and course email sent\./);
});

test('Razorpay webhook records captured payments, emails both parties, and leaves Drive approval pending', () => {
  const webhook = read('api/razorpay-webhook.js');
  const checkout = read('api/checkout.js');
  const migration = read('migrations/20260714_razorpay_webhook.sql');
  const env = read('.env.example');
  assert.match(webhook, /x-razorpay-signature/);
  assert.match(webhook, /event\.event !== 'payment\.captured'/);
  assert.match(webhook, /razorpayRequest\(`\/payments\/\$\{razorpayPaymentId\}`\)/);
  assert.match(webhook, /recordVerifiedPayment/);
  assert.match(webhook, /sendPaymentEmails/);
  assert.match(checkout, /full_name: checkout\.fullName/);
  assert.match(migration, /payment_status, drive_access_status/);
  assert.match(migration, /'paid', 'pending', 'razorpay'/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(env, /RAZORPAY_WEBHOOK_SECRET=/);
});
