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
});

test('browser opens Razorpay only after details and consent and verifies before success', () => {
  const app = read('src/App.tsx');
  assert.match(app, /checkout\.razorpay\.com\/v1\/checkout\.js/);
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
});
