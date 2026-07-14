import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { clearAdminOtpCookie, clearAdminSessionCookie, clearLegacyAdminOtpCookie, clearLegacyAdminSessionCookie } from '../api/_security.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('Vite scripts use runner config loader to avoid node_modules temp writes', () => {
  const packageJson = JSON.parse(read('package.json'));

  assert.match(packageJson.scripts.dev, /--configLoader runner/);
  assert.match(packageJson.scripts.build, /--configLoader runner/);
  assert.match(packageJson.scripts.preview, /--configLoader runner/);
});

test('mobile pages disable pinch and form-focus zoom, including checkout', () => {
  const viewport = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no';
  for (const file of ['index.html', 'public/courses/forex-mastery.html', 'public/courses/funded-trader-blueprint.html']) {
    assert.match(read(file), new RegExp(viewport.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  const css = read('src/index.css');
  assert.match(css, /@media \(max-width: 767px\)[\s\S]*input,[\s\S]*select,[\s\S]*textarea[\s\S]*font-size: 16px !important/);
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
  assert.match(viteConfig, /createSignedUrl\(order\.payment_screenshot_path, 10 \* 60\)/);
});

test('admin tables keep empty-state cells aligned with visible columns', () => {
  const app = read('src/App.tsx');

  assert.match(app, /<td colSpan=\{6\}[^>]*>\s*No coupons found\./);
  assert.match(app, /colSpan=\{11\}>No payments found\./);
  assert.match(app, /order\.payment_screenshot_url \?/);
  assert.match(app, />Coupon Code<\/th>/);
  assert.match(app, />Discount<\/th>/);
  assert.match(app, /order\.coupon_code/);
  assert.match(app, /order\.discount_amount > 0 \? `-\$\{money\(order\.discount_amount\)\}`/);
});

test('checkout resets to the top between steps and exposes stored proofs securely', () => {
  const app = read('src/App.tsx');
  const adminApi = read('api/admin.js');
  const checkoutApi = read('api/checkout.js');

  assert.match(app, /checkoutScrollRef\.current\?\.scrollTo\(\{ top: 0, behavior: 'auto' \}\)/);
  assert.match(app, /\[checkoutOpen, joinStep\]/);
  assert.match(app, /validatingCoupon \? <><Loader2[^>]*animate-spin/);
  assert.match(app, /h-44 w-44 sm:h-52 sm:w-52/);
  assert.match(app, /className="flex h-12 w-full/);
  assert.match(app, /href=\{order\.payment_screenshot_url\}/);
  assert.doesNotMatch(app, /getPublicUrl\(order\.payment_screenshot_path\)/);
  assert.match(adminApi, /createSignedUrl\(order\.payment_screenshot_path, 10 \* 60\)/);
  assert.match(checkoutApi, /p_payment_screenshot_path: paymentScreenshotPath/);
});

test('checkout and payment confirmation render as dedicated pages, not popup windows', () => {
  const app = read('src/App.tsx');
  const checkoutStart = app.indexOf('{checkoutOpen && (');
  const checkoutEnd = app.indexOf('{selectedTestimonial && (', checkoutStart);
  const checkout = app.slice(checkoutStart, checkoutEnd);

  assert.match(checkout, /fixed inset-0 z-50 flex flex-col overflow-y-auto bg-ink/);
  assert.match(checkout, /sticky top-0[\s\S]*Join Course/);
  assert.match(checkout, /<main className="mx-auto w-full max-w-4xl/);
  assert.match(checkout, /paymentPromptOpen \? \(/);
  assert.match(checkout, /Did you complete the payment\?/);
  assert.doesNotMatch(checkout, /items-start justify-center bg-black\/80/);
  assert.doesNotMatch(app, /paymentPromptOpen && \(\s*<div className="fixed inset-0/);
});

test('checkout back actions confirm cancellation and success has a centered website exit', () => {
  const app = read('src/App.tsx');
  assert.match(app, /if \(checkoutOpenRef\.current && !wantsCheckout/);
  assert.match(app, /onClick=\{requestCheckoutExit\}/);
  assert.match(app, /Are you sure you want to cancel\?/);
  assert.match(app, /Your payment is paid successfully\./);
  assert.match(app, /It is pending for admin verification\./);
  assert.match(app, /min-h-\[calc\(100vh-9rem\)\] items-center justify-center/);
  assert.match(app, />\s*Back to Website\s*</);
});

test('payment page uses a six-minute timer, centered QR, and no duplicate final-step headings', () => {
  const app = read('src/App.tsx');

  assert.match(app, /const PAYMENT_TIME_SECONDS = 6 \* 60/);
  assert.match(app, /useState\(PAYMENT_TIME_SECONDS\)/);
  assert.match(app, /PAYMENT_TIME_SECONDS - paymentSeconds/);
  assert.match(app, /promptTimes = \[60, 120, 180, 240, 300, 360\]/);
  assert.match(app, /mx-auto w-fit border border-white\/10 bg-white p-5 sm:p-6/);
  assert.match(app, /block h-44 w-44 sm:h-52 sm:w-52/);
  assert.match(app, /joinStep !== 'proof' && joinStep !== 'thanks'/);
  assert.doesNotMatch(app, /joinStep === 'proof' \? 'Upload Payment Proof'/);
  assert.doesNotMatch(app, /joinStep === 'thanks' \? 'Payment Submitted'/);
});

test('checkout warns students to verify their email before enrollment', () => {
  const app = read('src/App.tsx');

  assert.match(app, /ref=\{enrollmentEmailRef\}[^>]*type="email"/);
  assert.match(app, /if \(!emailNoticeShown\) \{ setEmailNoticeShown\(true\); setEmailNoticeOpen\(true\); \}/);
  assert.match(app, /emailNoticeOpen && checkoutOpen && joinStep === 'details'/);
  assert.match(app, /role="dialog" aria-modal="true" aria-labelledby="email-notice-title"/);
  assert.match(app, /Your course access and payment updates will be sent only to this email address\./);
  assert.match(app, />I Understand<\/button>/);
  assert.match(app, /requestAnimationFrame\(\(\) => enrollmentEmailRef\.current\?\.focus\(\)\)/);
  assert.match(app, /onClick=\{dismissEmailNotice\}/);
});

test('support tickets can be raised publicly and answered securely by admin', () => {
  const app = read('src/App.tsx');
  const supportApi = read('api/support.js');
  const adminApi = read('api/admin.js');
  const migration = read('migrations/20260714_support_tickets.sql');
  const viteConfig = read('vite.config.ts');
  const packageJson = read('package.json');

  assert.match(app, />Support<\/button>/);
  assert.match(app, /headerNavLinks\.map[\s\S]*font-inter text-xs uppercase tracking-widest text-white\/80[^>]*>Support<\/button>/);
  assert.match(app, /aria-label="Footer navigation"[\s\S]*hover:text-electric sm:text-\[10px\]">Support<\/button>/);
  assert.match(app, /fetch\('\/api\/support'/);
  assert.match(app, /supportSubmitting \? 'Creating ticket\.\.\.' : 'Raise Ticket'/);
  assert.match(app, /Contact on Instagram/);
  assert.match(app, /setAdminSection\('support'\)/);
  assert.match(app, /Support Tickets/);
  assert.match(app, /Reply to Ticket/);
  assert.match(app, /Reply attachment \(optional, max 10 MB\)/);
  assert.match(app, /supportSubmitted \? \(/);
  assert.match(app, /Your ticket has been sent/);
  assert.match(app, /Our support team will get back to you soon\./);
  assert.match(app, /Sending Ticket/);
  assert.doesNotMatch(app, /Ticket \$\{result\.ticketId\}/);
  assert.match(app, /supportStatusFilter/);
  assert.match(app, /supportDateFilter/);
  assert.match(app, /supportCustomDate/);
  assert.match(app, /filteredSupportTickets\.map/);
  assert.match(supportApi, /scope: 'support-ticket', limit: 5, windowMs: 60 \* 60_000/);
  assert.match(supportApi, /from\('support_tickets'\)\.insert/);
  assert.match(adminApi, /action === 'supportTickets'/);
  assert.match(adminApi, /action === 'replySupportTicket'/);
  assert.match(adminApi, /status: 'replied'/);
  assert.match(adminApi, /attachments/);
  assert.match(viteConfig, /server\.middlewares\.use\('\/api\/support'/);
  assert.match(packageJson, /node --check api\/support\.js/);
  assert.match(migration, /create table if not exists public\.support_tickets/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /revoke all on table public\.support_tickets from public, anon, authenticated/);
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

test('admin session restores on refresh and email tools expose compose, attachments, and mailbox history', () => {
  const app = read('src/App.tsx');
  const adminApi = read('api/admin.js');
  const security = read('api/_security.js');
  const migration = read('migrations/20260714_add_mail_attachments.sql');

  assert.match(app, /adminRequest\('session'\)/);
  assert.match(app, /adminSessionChecking/);
  assert.match(app, /Loading Admin/);
  assert.match(app, /Send Mail/);
  assert.match(app, /Mail History/);
  assert.match(app, /showCampaignRecipients/);
  assert.match(app, /Unique Recipients \(\{campaignRecipientCount\}\)/);
  assert.match(app, /Click to view recipients\./);
  assert.match(app, /Add recipient/);
  assert.match(app, /campaignExcludedEmails/);
  assert.match(app, /Remove \$\{recipient\.email\} from this campaign/);
  assert.match(app, /maximum 10 MB/);
  assert.match(app, /fetch\(upload\.signedUrl/);
  assert.doesNotMatch(app, /Attachment storage is not configured\./);
  assert.match(adminApi, /action === 'session'/);
  assert.match(adminApi, /action === 'prepareCampaignAttachment'/);
  assert.match(adminApi, /signedUrl: data\.signedUrl/);
  assert.match(adminApi, /size > 10 \* 1024 \* 1024/);
  assert.match(adminApi, /attachments/);
  assert.match(app, /openCampaignHistory/);
  assert.match(app, /selectedCampaign\.message/);
  assert.match(app, /campaignAttachmentUrl/);
  assert.match(adminApi, /action === 'campaignAttachmentUrl'/);
  assert.match(adminApi, /createSignedUrl\(campaign\.attachment_path, 10 \* 60\)/);
  assert.match(adminApi, /attachment_path: attachmentPath \|\| null/);
  assert.match(adminApi, /excludedEmails\.forEach\(\(email\) => recipientMap\.delete\(email\)\)/);
  assert.match(security, /Path=\/api;/);
  assert.match(migration, /mail-attachments/);
  assert.match(migration, /10485760/);
});

test('admin login requires a rate-limited email OTP before creating a session', () => {
  const app = read('src/App.tsx');
  const adminApi = read('api/admin.js');
  const security = read('api/_security.js');

  assert.match(adminApi, /hari\.entrepreneur1@gmail\.com/);
  assert.match(adminApi, /randomInt\(0, 1_000_000\)/);
  assert.match(adminApi, /createAdminOtpChallenge/);
  assert.match(adminApi, /action === 'verifyOtp'/);
  assert.match(adminApi, /scope: 'admin-login', limit: 5/);
  assert.match(adminApi, /scope: 'admin-otp', limit: 8/);
  assert.match(security, /tb_admin_otp/);
  assert.match(security, /createAdminSession = \(secret, ttlSeconds = 60 \* 60\)/);
  assert.match(security, /HttpOnly; Secure; SameSite=Strict/);
  assert.match(security, /attempts - 1/);
  assert.match(app, /Two-step verification/);
  assert.match(app, /autoComplete="one-time-code"/);
  assert.match(app, /adminRequest\('verifyOtp'/);
  assert.match(app, /await adminRequest\('logout'\)/);
  assert.doesNotMatch(app, /void adminRequest\('logout'\)/);
});

test('admin logout expires current and legacy session cookies before showing login', () => {
  const app = read('src/App.tsx');
  const adminApi = read('api/admin.js');
  const currentSession = clearAdminSessionCookie();
  const legacySession = clearLegacyAdminSessionCookie();
  const currentOtp = clearAdminOtpCookie();
  const legacyOtp = clearLegacyAdminOtpCookie();

  for (const cookie of [currentSession, legacySession, currentOtp, legacyOtp]) {
    assert.match(cookie, /Max-Age=0/);
    assert.match(cookie, /Expires=Thu, 01 Jan 1970 00:00:00 GMT/);
    assert.match(cookie, /HttpOnly; Secure; SameSite=Strict/);
  }
  assert.match(currentSession, /Path=\/api;/);
  assert.match(legacySession, /Path=\/api\/admin;/);
  assert.match(adminApi, /clearAdminSessionCookie\(\), clearLegacyAdminSessionCookie\(\), clearAdminOtpCookie\(\), clearLegacyAdminOtpCookie\(\)/);
  const otpInputIndex = app.indexOf('autoComplete="one-time-code"');
  const otpStatusIndex = app.indexOf('{adminStatus && <p', otpInputIndex);
  const verifyButtonIndex = app.indexOf("adminLoading ? 'Verifying...'", otpInputIndex);
  assert.ok(otpInputIndex >= 0);
  assert.ok(otpStatusIndex > otpInputIndex);
  assert.ok(verifyButtonIndex > otpStatusIndex);
});

test('courses have dedicated UPI IDs for QR codes and payment app links', () => {
  const app = read('src/App.tsx');
  const adminApi = read('api/admin.js');
  const coursesApi = read('api/courses.js');
  const migration = read('migrations/20260714_admin_otp_campaign_history_upi.sql');

  assert.match(app, /selectedCourse\.upi_id \|\| UPI_ID/);
  assert.match(app, /pa: courseUpiId/);
  assert.match(app, /Course payment UPI ID/);
  assert.match(adminApi, /upi_id: upiId/);
  assert.match(coursesApi, /price, upi_id, active/);
  assert.match(migration, /courses add column if not exists upi_id/);
  assert.match(migration, /email_campaigns add column if not exists attachment_path/);
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

test('public reviews come only from active admin-managed testimonials', () => {
  const app = read('src/App.tsx');
  const testimonialsApi = read('api/testimonials.js');
  const viteConfig = read('vite.config.ts');

  assert.match(app, /fetch\('\/api\/testimonials'\)/);
  assert.match(app, /useState<Testimonial\[]>\(\[\]\)/);
  assert.doesNotMatch(app, /Arjun M\.|Priya S\.|Daniel R\./);
  assert.match(testimonialsApi, /\.from\('testimonials'\)/);
  assert.match(testimonialsApi, /\.eq\('active', true\)/);
  assert.match(testimonialsApi, /photo_url/);
  assert.match(viteConfig, /server\.middlewares\.use\('\/api\/testimonials'/);
});

test('footer exposes accessible social media links', () => {
  const app = read('src/App.tsx');

  assert.match(app, /https:\/\/www\.instagram\.com\/trading_boy_tamil\/\?hl=en/);
  assert.match(app, /https:\/\/www\.threads\.com\/@trading_boy_tamil/);
  assert.match(app, /https:\/\/www\.youtube\.com\/@trading_boy/);
  assert.equal((app.match(/target="_blank" rel="noreferrer" aria-label=/g) || []).length >= 3, true);
});

test('Google Analytics tracks public routes and excludes the admin panel', () => {
  const index = read('index.html');

  assert.match(index, /G-W88F9KGDQM/);
  assert.match(index, /ga-disable-G-W88F9KGDQM/);
  assert.match(index, /window\.location\.hash === '#admin'/);
  assert.match(index, /send_page_view: false/);
  assert.match(index, /gtag\('event', 'page_view'/);
  assert.match(index, /addEventListener\('hashchange', trackPublicPage\)/);
});

test('course details have shareable entry files, member reviews, and Instagram support CTA', () => {
  const app = read('src/App.tsx');
  const forexEntry = read('public/courses/forex-mastery.html');
  const fundedEntry = read('public/courses/funded-trader-blueprint.html');

  assert.match(app, /window\.location\.hash = `course\/\$\{courseSlug\(course\.title\)\}`/);
  assert.match(app, /Members Review/);
  assert.match(app, /testimonials\.map\(\(testimonial\) =>/);
  assert.match(app, /testimonial\.photo_url/);
  assert.match(app, /Follow Trading Boy on Instagram/);
  assert.match(app, /Swipe to see more reviews/);
  assert.match(app, /snap-x snap-mandatory/);
  assert.match(app, /w-\[82vw\][^\"]*snap-center/);
  assert.doesNotMatch(app, /message trading_boy_tamil on Instagram/);
  assert.match(forexEntry, /#course\/forex-mastery/);
  assert.match(fundedEntry, /#course\/funded-trader-blueprint/);
});

test('course offer leads to course selection and Blueprint shows its shorter duration', () => {
  const app = read('src/App.tsx');

  assert.match(app, /const PROMO_COUPON_CODE = 'TB1500'/);
  assert.match(app, /Save <span className="text-electric">₹1,500<\/span>/);
  assert.match(app, /text-\[2\.2rem\]/);
  assert.doesNotMatch(app, /promoSeconds|Offer ends in|Offer Ended/);
  assert.match(app, />\s*Claim Now\s*</);
  assert.doesNotMatch(app, /Enter the code at checkout/);
  assert.match(app, /placeholder="Coupon code \(optional\)"/);
  assert.match(app, /Remove coupon/);
  assert.match(app, /setAppliedCoupon\(null\); setCouponInput\(''\); setCouponError\(''\)/);
  assert.doesNotMatch(app, /SAVE1000|₹1,000|Promo code \(optional\)/);
  assert.match(app, /Use this coupon on either of our two courses\./);
  assert.match(app, /window\.location\.hash = 'course'/);
  assert.doesNotMatch(app, /setCouponError\(''\); openCheckout\(\)/);
  assert.match(app, /isFundedCourse \? 'Approximately 3 hours of structured recorded video lessons\.'/);
  assert.match(app, /: '8 hours of structured recorded video lessons\.'/);
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
  assert.match(adminApi, /emailConfigured: Boolean\(process\.env\.RESEND_API_KEY\)/);
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
