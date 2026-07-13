import { createClient } from '@supabase/supabase-js';
import { handleApiError, json, rateLimit } from './_security.js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return json(res, 405, { error: 'Method not allowed.' });
  }
  if (!rateLimit(req, res, { scope: 'testimonials', limit: 120, windowMs: 10 * 60_000 })) return;
  if (!supabaseUrl || !serviceRoleKey) return json(res, 503, { error: 'Testimonials are temporarily unavailable.' });

  try {
    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await admin
      .from('testimonials')
      .select('id, quote, name, role, photo_url, active, created_at')
      .eq('active', true)
      .order('created_at', { ascending: true })
      .limit(100);
    if (error) throw error;
    return json(res, 200, { data: data || [] });
  } catch (error) {
    return handleApiError(res, error, 'testimonials.list');
  }
}
