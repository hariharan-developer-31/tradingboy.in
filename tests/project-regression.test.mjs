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

test('local dev admin API returns payment proof and coupon metadata', () => {
  const viteConfig = read('vite.config.ts');

  assert.match(viteConfig, /payment_screenshot_path, remarks, created_at/);
  assert.match(viteConfig, /course_name, discount_type, discount_value, active, expires_at, max_uses, current_uses, created_at/);
  assert.match(viteConfig, /body\.action === 'deleteCoupon'/);
});

test('admin tables keep empty-state cells aligned with visible columns', () => {
  const app = read('src/App.tsx');

  assert.match(app, /<td colSpan=\{6\}[^>]*>\s*No coupons found\./);
  assert.match(app, /colSpan=\{8\}>No payments found\./);
  assert.match(app, /order\.payment_screenshot_path && supabase/);
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
