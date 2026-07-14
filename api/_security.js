import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const buckets = new Map();
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
const COUPON_PATTERN = /^[A-Z0-9_-]{3,40}$/;

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const setApiHeaders = (res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
};

export const json = (res, status, body) => {
  res.statusCode = status;
  setApiHeaders(res);
  res.end(JSON.stringify(body));
};

export const requirePost = (req, res) => {
  if (req.method === 'POST') return true;
  res.setHeader('Allow', 'POST');
  json(res, 405, { error: 'Method not allowed.' });
  return false;
};

export const readJsonBody = async (req, maxBytes = 180 * 1024) => {
  const declaredLength = Number(req.headers?.['content-length'] || 0);
  if (declaredLength > maxBytes) throw new HttpError(413, 'Request is too large.');
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) throw new HttpError(413, 'Request is too large.');
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    throw new HttpError(400, 'Invalid JSON request.');
  }
};

export const getClientIp = (req) => String(req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();

export const rateLimit = (req, res, { scope, limit, windowMs }) => {
  const now = Date.now();
  if (buckets.size > 5_000) {
    for (const [bucketKey, value] of buckets) {
      if (value.resetAt <= now) buckets.delete(bucketKey);
      if (buckets.size <= 4_000) break;
    }
    while (buckets.size > 5_000) buckets.delete(buckets.keys().next().value);
  }
  const key = `${scope}:${getClientIp(req)}`;
  const current = buckets.get(key);
  const entry = !current || current.resetAt <= now ? { count: 1, resetAt: now + windowMs } : { count: current.count + 1, resetAt: current.resetAt };
  buckets.set(key, entry);
  res.setHeader('RateLimit-Limit', String(limit));
  res.setHeader('RateLimit-Remaining', String(Math.max(0, limit - entry.count)));
  res.setHeader('RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));
  if (entry.count <= limit) return true;
  res.setHeader('Retry-After', String(Math.max(1, Math.ceil((entry.resetAt - now) / 1000))));
  json(res, 429, { error: 'Too many requests. Please try again later.' });
  return false;
};

export const requireTrustedOrigin = (req, res) => {
  const origin = String(req.headers?.origin || '');
  if (!origin) return true;
  const allowed = new Set(['https://tradingboy.in', 'https://www.tradingboy.in']);
  if (process.env.NODE_ENV !== 'production') {
    allowed.add('http://localhost:5173');
    allowed.add('http://127.0.0.1:5173');
  }
  if (allowed.has(origin)) return true;
  json(res, 403, { error: 'Request origin is not allowed.' });
  return false;
};

export const safeEqual = (left, right) => {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length === b.length && timingSafeEqual(a, b);
};

const cookieValue = (req, name) => String(req.headers?.cookie || '').split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1) || '';

export const createAdminSession = (secret, ttlSeconds = 8 * 60 * 60) => {
  const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
  const signature = createHmac('sha256', secret).update(String(expires)).digest('base64url');
  return { token: `${expires}.${signature}`, ttlSeconds };
};

export const hasValidAdminSession = (req, secret) => {
  const [expiresText, signature = ''] = cookieValue(req, 'tb_admin').split('.');
  const expires = Number(expiresText);
  if (!Number.isSafeInteger(expires) || expires <= Math.floor(Date.now() / 1000)) return false;
  const expected = createHmac('sha256', secret).update(expiresText).digest('base64url');
  return safeEqual(signature, expected);
};

export const adminSessionCookie = (token, maxAge) => `tb_admin=${token}; Path=/api; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`;
export const clearAdminSessionCookie = () => 'tb_admin=; Path=/api; Max-Age=0; HttpOnly; Secure; SameSite=Strict';

const signOtpParts = (secret, parts) => createHmac('sha256', secret).update(parts.join('.')).digest('base64url');

export const createAdminOtpChallenge = (secret, otp, ttlSeconds = 10 * 60, attempts = 5) => {
  const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
  const nonce = randomBytes(18).toString('base64url');
  const otpHash = createHmac('sha256', secret).update(`${nonce}:${otp}`).digest('base64url');
  const parts = [String(expires), String(attempts), nonce, otpHash];
  return { token: `${parts.join('.')}.${signOtpParts(secret, parts)}`, ttlSeconds };
};

const readOtpChallenge = (req, secret) => {
  const parts = cookieValue(req, 'tb_admin_otp').split('.');
  if (parts.length !== 5) return null;
  const [expiresText, attemptsText, nonce, otpHash, signature] = parts;
  const expected = signOtpParts(secret, [expiresText, attemptsText, nonce, otpHash]);
  const expires = Number(expiresText);
  const attempts = Number(attemptsText);
  if (!safeEqual(signature, expected) || !Number.isSafeInteger(expires) || expires <= Math.floor(Date.now() / 1000) || !Number.isSafeInteger(attempts) || attempts < 1) return null;
  return { expires, attempts, nonce, otpHash };
};

export const verifyAdminOtpChallenge = (req, secret, submittedOtp) => {
  const challenge = readOtpChallenge(req, secret);
  if (!challenge || !/^\d{6}$/.test(String(submittedOtp || ''))) return { valid: false, token: null, ttlSeconds: 0 };
  const submittedHash = createHmac('sha256', secret).update(`${challenge.nonce}:${submittedOtp}`).digest('base64url');
  if (safeEqual(submittedHash, challenge.otpHash)) return { valid: true, token: null, ttlSeconds: 0 };
  const attempts = challenge.attempts - 1;
  if (attempts < 1) return { valid: false, token: null, ttlSeconds: 0 };
  const parts = [String(challenge.expires), String(attempts), challenge.nonce, challenge.otpHash];
  return { valid: false, token: `${parts.join('.')}.${signOtpParts(secret, parts)}`, ttlSeconds: Math.max(1, challenge.expires - Math.floor(Date.now() / 1000)) };
};

export const adminOtpCookie = (token, maxAge) => `tb_admin_otp=${token}; Path=/api; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`;
export const clearAdminOtpCookie = () => 'tb_admin_otp=; Path=/api; Max-Age=0; HttpOnly; Secure; SameSite=Strict';

export const cleanText = (value, maxLength) => String(value || '').trim().slice(0, maxLength);
export const isEmail = (value) => EMAIL_PATTERN.test(value) && value.length <= 254;
export const isUuid = (value) => UUID_PATTERN.test(String(value || ''));
export const isCouponCode = (value) => COUPON_PATTERN.test(String(value || ''));
export const isHttpsUrl = (value) => {
  if (!value) return true;
  try { return new URL(String(value)).protocol === 'https:'; } catch { return false; }
};

export const decodeJpegDataUrl = (dataUrl, maxBytes = 100 * 1024) => {
  const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!match) throw new HttpError(400, 'Upload must be a JPEG image.');
  const buffer = Buffer.from(match[1], 'base64');
  if (!buffer.length || buffer.byteLength > maxBytes) throw new HttpError(400, 'Image must be below 100KB.');
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8 || buffer.at(-2) !== 0xff || buffer.at(-1) !== 0xd9) throw new HttpError(400, 'Invalid JPEG image.');
  return buffer;
};

export const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);

export const logServerError = (context, error) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(JSON.stringify({ level: 'error', context, message: message.slice(0, 300) }));
};

export const handleApiError = (res, error, context) => {
  if (error instanceof HttpError) return json(res, error.status, { error: error.message });
  logServerError(context, error);
  return json(res, 500, { error: 'The request could not be completed.' });
};
