import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('Vite scripts use runner config loader to avoid node_modules temp writes', () => {
  const packageJson = JSON.parse(read('package.json'));

  assert.match(packageJson.scripts.dev, /--configLoader runner/);
  assert.match(packageJson.scripts.build, /--configLoader runner/);
  assert.match(packageJson.scripts.preview, /--configLoader runner/);
});

test('TypeScript build info is written outside node_modules', () => {
  const appTsconfig = JSON.parse(read('tsconfig.app.json'));
  const nodeTsconfig = JSON.parse(read('tsconfig.node.json'));

  assert.equal(appTsconfig.compilerOptions.tsBuildInfoFile, './.tmp/tsconfig.app.tsbuildinfo');
  assert.equal(nodeTsconfig.compilerOptions.tsBuildInfoFile, './.tmp/tsconfig.node.tsbuildinfo');
});

test('local dev API exposes the same coupon route and limits as production', () => {
  const viteConfig = read('vite.config.ts');

  assert.match(viteConfig, /server\.middlewares\.use\('\/api\/checkCoupon'/);
  assert.match(viteConfig, /course_name/);
  assert.match(viteConfig, /This coupon is only valid for/);
  assert.match(viteConfig, /expires_at, max_uses, current_uses/);
  assert.match(viteConfig, /This coupon has reached its usage limit\./);
  assert.match(viteConfig, /current_uses: appliedCoupon\.current_uses \+ 1/);
});

test('checkout loads live public courses and resolves legacy course names', () => {
  const app = read('src/App.tsx');
  const checkout = read('api/checkout.js');
  const courses = read('api/courses.js');
  const viteConfig = read('vite.config.ts');

  assert.match(app, /fetch\('\/api\/courses'\)/);
  assert.match(app, /setSubmitError\(result\.error/);
  assert.match(checkout, /courseKind\(course\.title\) === requestedKind/);
  assert.match(checkout, /context: 'checkout\.receipt'/);
  assert.match(courses, /\.eq\('active', true\)/);
  assert.doesNotMatch(courses, /drive_url|discord_url/);
  assert.match(viteConfig, /server\.middlewares\.use\('\/api\/courses'/);
});

test('local dev admin API returns payment proof and coupon metadata', () => {
  const viteConfig = read('vite.config.ts');

  assert.match(viteConfig, /payment_screenshot_path, remarks, created_at/);
  assert.match(viteConfig, /course_name, discount_type, discount_value, active, expires_at, max_uses, current_uses, created_at/);
  assert.match(viteConfig, /body\.action === 'deleteCoupon'/);
});

test('admin tables keep empty-state cells aligned with visible columns', () => {
  const app = read('src/App.tsx');

  assert.match(app, /<td colSpan=\{6\}[^>]*>\s*No coupons found\./);
  assert.match(app, /colSpan=\{9\}>No payments found\./);
  assert.match(app, /order\.payment_screenshot_path && supabase/);
});

test('payment admin supports safe bulk deletion, date filters, and confirmed status changes', () => {
  const app = read('src/App.tsx');
  const adminApi = read('api/admin.js');
  const viteConfig = read('vite.config.ts');

  assert.match(app, /Today only/);
  assert.match(app, /Delete selected/);
  assert.match(app, /Delete all/);
  assert.match(app, /window\.confirm\(`Change/);
  assert.match(app, /updatingOrderId === order\.id/);
  assert.match(adminApi, /action === 'deleteOrders'/);
  assert.match(adminApi, /storage\.from\('payment-proofs'\)\.remove/);
  assert.match(viteConfig, /body\.action === 'deleteOrders'/);
});

test('email templates force dark mode and avoid viewport-height whitespace', () => {
  for (const file of ['api/admin.js', 'api/checkout.js', 'vite.config.ts']) {
    const source = read(file);
    assert.match(source, /color-scheme/);
    assert.match(source, /background:#000000/);
    assert.doesNotMatch(source, /min-height:100vh/);
  }
});

test('admin can send deduplicated course email campaigns through production and local APIs', () => {
  const app = read('src/App.tsx');
  const adminApi = read('api/admin.js');
  const viteConfig = read('vite.config.ts');

  assert.match(app, /Email Course Joiners/);
  assert.match(app, /Paid students only/);
  assert.match(app, /Manual emails only/);
  assert.match(app, /campaignManualEmails/);
  assert.match(app, /campaignRecipientCount/);
  assert.match(app, /window\.confirm\(`Send this email/);
  assert.match(adminApi, /action === 'sendCampaign'/);
  assert.match(adminApi, /new Map\(/);
  assert.match(adminApi, /index \+= 5/);
  assert.match(adminApi, /manualEmails/);
  assert.match(viteConfig, /body\.action === 'sendCampaign'/);
  assert.match(viteConfig, /campaignHtml/);
});

test('coupon management supports editing and course scoping', () => {
  const app = read('src/App.tsx');
  const schema = read('supabase.sql');

  assert.match(app, /const editCoupon = \(coupon: Coupon\)/);
  assert.match(app, /Course Scope/);
  assert.match(app, /courseName: coupon\.course_name \|\| ''/);
  assert.match(schema, /alter table public\.coupons add column if not exists course_name text;/);
});

test('course Discord access is private, editable, and included in paid emails', () => {
  const app = read('src/App.tsx');
  const adminApi = read('api/admin.js');
  const checkoutApi = read('api/checkout.js');
  const viteConfig = read('vite.config.ts');
  const schema = read('supabase.sql');

  assert.match(app, /placeholder="Private Discord invite URL"/);
  assert.match(app, /discordUrl: course\.discord_url \|\| ''/);
  assert.match(adminApi, /select\('drive_url, discord_url'\)/);
  assert.match(adminApi, /Join the Course Discord/);
  assert.match(checkoutApi, /Join the Course Discord/);
  assert.match(viteConfig, /course_discord_url/);
  assert.match(schema, /alter table public\.courses add column if not exists discord_url text;/);
  assert.match(schema, /revoke select on table public\.courses from anon;/);
});

test('all image uploads share the compressor and testimonials stay below 100KB', () => {
  const app = read('src/App.tsx');
  const adminApi = read('api/admin.js');

  assert.match(app, /const compressImageToDataUrl =/);
  assert.equal((app.match(/await compressImageToDataUrl\(file\)/g) || []).length, 3);
  assert.match(app, /Images are automatically converted to JPEG and compressed below 100 KB\./);
  assert.match(adminApi, /body\.photoDataUrl[\s\S]*buffer\.byteLength > 100 \* 1024/);
  assert.match(adminApi, /Testimonial image must be below 100KB after compression\./);
});

test('footer exposes accessible social media links', () => {
  const app = read('src/App.tsx');

  assert.match(app, /https:\/\/www\.instagram\.com\/trading_boy_tamil\/\?hl=en/);
  assert.match(app, /https:\/\/www\.threads\.com\/@trading_boy_tamil/);
  assert.match(app, /https:\/\/www\.youtube\.com\/@trading_boy/);
  assert.equal((app.match(/target="_blank" rel="noreferrer" aria-label=/g) || []).length >= 3, true);
});

test('course details have shareable entry files, member reviews, and Instagram support CTA', () => {
  const app = read('src/App.tsx');
  const forexEntry = read('public/courses/forex-mastery.html');
  const fundedEntry = read('public/courses/funded-trader-blueprint.html');

  assert.match(app, /window\.location\.hash = `course\/\$\{courseSlug\(course\.title\)\}`/);
  assert.match(app, /Members Review/);
  assert.match(app, /testimonials\.slice\(0, 6\)/);
  assert.match(app, /Message on Instagram/);
  assert.doesNotMatch(app, /message trading_boy_tamil on Instagram/);
  assert.match(forexEntry, /#course\/forex-mastery/);
  assert.match(fundedEntry, /#course\/funded-trader-blueprint/);
});

test('production APIs share request hardening and use an HttpOnly admin session', () => {
  const app = read('src/App.tsx');
  const security = read('api/_security.js');
  const adminApi = read('api/admin.js');
  const checkoutApi = read('api/checkout.js');
  const couponApi = read('api/checkCoupon.js');

  assert.match(security, /HttpOnly; Secure; SameSite=Strict/);
  assert.match(security, /timingSafeEqual/);
  assert.match(security, /Request is too large\./);
  assert.match(security, /Request origin is not allowed\./);
  assert.match(security, /Too many requests\./);
  assert.match(security, /buffer\[0\] !== 0xff/);
  assert.match(adminApi, /hasValidAdminSession/);
  assert.match(adminApi, /createAdminSession/);
  assert.match(adminApi, /scryptSync\(String\(submittedPasscode/);
  assert.match(adminApi, /adminPasscode && safeEqual\(submittedPasscode, adminPasscode\)/);
  assert.match(adminApi, /isValidAdminPasscode/);
  assert.match(app, /aria-label=\{showAdminPasscode \? 'Hide admin passcode' : 'Show admin passcode'\}/);
  assert.match(app, /showAdminPasscode \? <EyeOff/);
  assert.match(checkoutApi, /requireTrustedOrigin/);
  assert.match(checkoutApi, /decodeJpegDataUrl/);
  assert.match(couponApi, /rateLimit/);
});

test('database migration removes anonymous commerce access and adds atomic coupon redemption', () => {
  const migration = read('migrations/20260713_production_hardening.sql');
  assert.match(migration, /revoke all on table public\.course_orders from anon/);
  assert.match(migration, /revoke all on table public\.coupons from anon/);
  assert.match(migration, /for update/);
  assert.match(migration, /create or replace function public\.create_course_order/);
  assert.match(migration, /course_orders_status_created_idx/);
  assert.match(migration, /allowed_mime_types = array\['image\/jpeg'\]/);
});
