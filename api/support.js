import { createClient } from '@supabase/supabase-js';
import { cleanText, handleApiError, isEmail, json, rateLimit, readJsonBody, requirePost, requireTrustedOrigin } from './_security.js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  if (!requirePost(req, res) || !requireTrustedOrigin(req, res)) return;
  if (!rateLimit(req, res, { scope: 'support-ticket', limit: 5, windowMs: 60 * 60_000 })) return;
  if (!supabaseUrl || !serviceRoleKey) return json(res, 503, { error: 'Support is temporarily unavailable.' });
  try {
    const body = await readJsonBody(req, 16 * 1024);
    const name = cleanText(body.name, 100);
    const email = cleanText(body.email, 254).toLowerCase();
    const subject = cleanText(body.subject, 150);
    const message = cleanText(body.message, 5000);
    if (name.length < 2 || !isEmail(email) || subject.length < 3 || message.length < 10) return json(res, 400, { error: 'Enter a valid name, email, subject, and detailed message.' });
    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await admin.from('support_tickets').insert({ name, email, subject, message, status: 'open' }).select('id').single();
    if (error) throw error;
    return json(res, 201, { ok: true, ticketId: data.id });
  } catch (error) {
    return handleApiError(res, error, 'support.create');
  }
}
