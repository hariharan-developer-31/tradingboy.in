// @ts-nocheck -- Development middleware delegates checkout to the production JS handler.
import { createClient } from '@supabase/supabase-js';
import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const localAdminApi = (env: Record<string, string>): Plugin => ({
  name: 'local-admin-api',
  configureServer(server) {
    server.middlewares.use('/api/courses', async (req, res) => {
      if ((req as any).method !== 'GET') {
        sendJson(res, 405, { error: 'Method not allowed' });
        return;
      }

      const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
      const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
      if (!supabaseUrl || !serviceRoleKey) {
        sendJson(res, 500, { error: 'Environment variables are missing.' });
        return;
      }

      try {
        const admin = createClient(supabaseUrl, serviceRoleKey);
        const { data, error } = await admin
          .from('courses')
          .select('id, title, description, thumbnail_url, normal_price, offer_price, price, active, created_at')
          .eq('active', true)
          .order('created_at', { ascending: true });
        sendJson(res, error ? 500 : 200, error ? { error: error.message } : { data: data || [] });
      } catch (error) {
        sendJson(res, 500, { error: error instanceof Error ? error.message : 'Courses API failed.' });
      }
    });

    server.middlewares.use('/api/testimonials', async (req, res) => {
      if ((req as any).method !== 'GET') {
        sendJson(res, 405, { error: 'Method not allowed' });
        return;
      }

      const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
      const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
      if (!supabaseUrl || !serviceRoleKey) {
        sendJson(res, 500, { error: 'Environment variables are missing.' });
        return;
      }

      try {
        const admin = createClient(supabaseUrl, serviceRoleKey);
        const { data, error } = await admin
          .from('testimonials')
          .select('id, quote, name, role, photo_url, active, created_at')
          .eq('active', true)
          .order('created_at', { ascending: true })
          .limit(100);
        sendJson(res, error ? 500 : 200, error ? { error: error.message } : { data: data || [] });
      } catch (error) {
        sendJson(res, 500, { error: error instanceof Error ? error.message : 'Testimonials API failed.' });
      }
    });

    server.middlewares.use('/api/checkout', async (req, res) => {
      Object.assign(process.env, env);
      const { default: checkoutHandler } = await import('./api/checkout.js');
      await checkoutHandler(req, res);
      return;
      /* Legacy local handler retained below only for migration history. */
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
        const tradingExperience = String(body.tradingExperience || '').trim();
        const requestedCourseName = String(body.courseName || 'Complete Forex Mastery').trim();
        const couponCode = String(body.couponCode || '').trim().toUpperCase();
        const paymentScreenshot = body.paymentScreenshot;
        const termsAccepted = body.termsAccepted === true;
        const remarks = String(body.remarks || '').trim();

        if (!fullName || !email || !phone || !tradingExperience || !termsAccepted) {
          sendJson(res, 400, { error: 'Name, email, phone, trading experience, and terms acceptance are required.' });
          return;
        }

        const admin = createClient(supabaseUrl, serviceRoleKey);
        const courses = [
          { name: 'Complete Forex Mastery', price: 7199 },
          { name: 'Blueprint to Become a Funded Trader', price: 5399 },
        ];
        const { data: courseData } = await admin
          .from('courses')
          .select('title, price, offer_price, active')
          .eq('title', requestedCourseName)
          .eq('active', true)
          .maybeSingle();
        const fallbackCourse = courses.find((course) => course.name === requestedCourseName) || courses[0];
        const selectedCourse = courseData
          ? { name: courseData.title, price: Number(courseData.offer_price || courseData.price) }
          : fallbackCourse;
        let discountAmount = 0;
        let appliedCoupon = null;

        if (couponCode) {
          const { data } = await admin
            .from('coupons')
            .select('id, code, course_name, discount_type, discount_value, active, expires_at, max_uses, current_uses')
            .eq('code', couponCode)
            .eq('active', true)
            .maybeSingle();

          if (data) {
            if (data.expires_at && new Date(data.expires_at) < new Date()) {
              sendJson(res, 400, { error: 'Coupon has expired.' });
              return;
            }
            if (data.max_uses !== null && data.current_uses >= data.max_uses) {
              sendJson(res, 400, { error: 'Coupon usage limit reached.' });
              return;
            }
            if (data.course_name && data.course_name !== selectedCourse.name) {
              sendJson(res, 400, { error: `Coupon is only valid for ${data.course_name}.` });
              return;
            }

            appliedCoupon = data;
            discountAmount =
              data.discount_type === 'percent'
                ? Math.min(Math.round((selectedCourse.price * data.discount_value) / 100), selectedCourse.price)
                : Math.min(data.discount_value, selectedCourse.price);
          }
        }

        const finalAmount = selectedCourse.price - discountAmount;
        const orderId = randomUUID();
        let paymentScreenshotPath = null;

        if (paymentScreenshot?.dataUrl) {
          const buffer = decodeDataUrl(paymentScreenshot.dataUrl);

          if (buffer.byteLength > 100 * 1024) {
            sendJson(res, 400, { error: 'Payment screenshot must be below 100KB after compression.' });
            return;
          }

          paymentScreenshotPath = `${orderId}.jpg`;
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
          course_name: selectedCourse.name,
          full_name: fullName,
          email,
          phone,
          trading_experience: tradingExperience,
          terms_accepted: true,
          terms_accepted_at: new Date().toISOString(),
          plan: selectedCourse.name,
          coupon_code: appliedCoupon ? appliedCoupon.code : null,
          original_amount: selectedCourse.price,
          discount_amount: discountAmount,
          final_amount: finalAmount,
          payment_status: 'pending',
          payment_screenshot_path: paymentScreenshotPath,
          remarks,
          source: 'website',
        };
        const { error } = await admin.from('course_orders').insert(order);

        if (error) {
          sendJson(res, 500, { error: error.message });
          return;
        }

        if (appliedCoupon) {
          await admin.from('coupons').update({ current_uses: appliedCoupon.current_uses + 1 }).eq('id', appliedCoupon.id);
        }

        const [emailSent, adminEmailSent] = await Promise.all([
          sendMail(env, {
            to: email,
            subject: `Trading Boy receipt - ${selectedCourse.name}`,
            html: receiptHtml(order),
          }),
          sendMail(env, {
            to: 'hari.entrepreneur1@gmail.com',
            subject: `New payment submitted - ${selectedCourse.name}`,
            html: adminPaymentHtml(order),
          }),
        ]);

        sendJson(res, 200, { orderId: order.id, payableAmount: finalAmount, emailSent, adminEmailSent });
      } catch (error) {
        sendJson(res, 500, { error: error instanceof Error ? error.message : 'Checkout API failed.' });
      }
    });

    server.middlewares.use('/api/checkCoupon', async (req, res) => {
      if ((req as any).method !== 'POST') {
        sendJson(res, 405, { error: 'Method not allowed' });
        return;
      }

      const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
      const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !serviceRoleKey) {
        sendJson(res, 500, { error: 'Environment variables are missing.' });
        return;
      }

      try {
        const body = await readJsonBody(req);
        const couponCode = String(body.couponCode || '').trim().toUpperCase();
        const courseName = String(body.courseName || '').trim();

        if (!couponCode) {
          sendJson(res, 400, { error: 'Coupon code is required.' });
          return;
        }

        const admin = createClient(supabaseUrl, serviceRoleKey);
        const { data, error } = await admin
          .from('coupons')
          .select('code, course_name, discount_type, discount_value, active, expires_at, max_uses, current_uses')
          .eq('code', couponCode)
          .maybeSingle();

        if (error || !data) {
          sendJson(res, 404, { error: 'Invalid coupon code.' });
          return;
        }
        if (!data.active) {
          sendJson(res, 400, { error: 'This coupon is no longer active.' });
          return;
        }
        if (data.expires_at && new Date(data.expires_at) < new Date()) {
          sendJson(res, 400, { error: 'This coupon has expired.' });
          return;
        }
        if (data.max_uses !== null && data.current_uses >= data.max_uses) {
          sendJson(res, 400, { error: 'This coupon has reached its usage limit.' });
          return;
        }
        if (data.course_name && data.course_name !== courseName) {
          sendJson(res, 400, { error: `This coupon is only valid for ${data.course_name}.` });
          return;
        }

        sendJson(res, 200, { coupon: data });
      } catch (error) {
        sendJson(res, 500, { error: error instanceof Error ? error.message : 'Coupon API failed.' });
      }
    });

    server.middlewares.use('/api/support', async (req, res) => {
      if ((req as any).method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });
      const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
      const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
      if (!supabaseUrl || !serviceRoleKey) return sendJson(res, 500, { error: 'Environment variables are missing.' });
      try {
        const body = await readJsonBody(req);
        const name = String(body.name || '').trim().slice(0, 100);
        const email = String(body.email || '').trim().toLowerCase().slice(0, 254);
        const subject = String(body.subject || '').trim().slice(0, 150);
        const message = String(body.message || '').trim().slice(0, 5000);
        if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || subject.length < 3 || message.length < 10) return sendJson(res, 400, { error: 'Enter a valid name, email, subject, and detailed message.' });
        const admin = createClient(supabaseUrl, serviceRoleKey);
        const { data, error } = await admin.from('support_tickets').insert({ name, email, subject, message, status: 'open' }).select('id').single();
        sendJson(res, error ? 500 : 201, error ? { error: error.message } : { ok: true, ticketId: data.id });
      } catch (error) {
        sendJson(res, 500, { error: error instanceof Error ? error.message : 'Support API failed.' });
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

        if (body.action === 'prepareCampaignAttachment') {
          const size = Number(body.size);
          const name = String(body.name || '').trim().replace(/[^a-zA-Z0-9._ -]/g, '_').slice(0, 180);
          if (!name || !Number.isSafeInteger(size) || size < 1 || size > 10 * 1024 * 1024) return sendJson(res, 400, { error: 'Attachment must be 10 MB or smaller.' });
          const path = `${randomUUID()}-${name}`;
          const { data, error } = await admin.storage.from('mail-attachments').createSignedUploadUrl(path);
          sendJson(res, error ? 500 : 200, error ? { error: error.message } : { path, signedUrl: data.signedUrl });
          return;
        }

        if (body.action === 'supportTickets') {
          const { data, error } = await admin.from('support_tickets').select('id, name, email, subject, message, status, admin_reply, reply_attachment_name, created_at, replied_at').order('created_at', { ascending: false }).limit(500);
          sendJson(res, error ? 500 : 200, error ? { error: error.message } : { data });
          return;
        }

        if (body.action === 'replySupportTicket') {
          const reply = String(body.reply || '').trim().slice(0, 5000);
          const { data: ticket, error: ticketError } = await admin.from('support_tickets').select('id, name, email, subject').eq('id', body.ticketId).maybeSingle();
          if (ticketError || !ticket || !reply) return sendJson(res, 400, { error: ticketError?.message || 'A valid ticket and reply are required.' });
          let attachments: Array<{ filename: string; content: string }> = [];
          if (body.attachmentPath && body.attachmentName) {
            const { data: attachment, error } = await admin.storage.from('mail-attachments').download(String(body.attachmentPath));
            if (error || !attachment || attachment.size > 10 * 1024 * 1024) return sendJson(res, 400, { error: 'Could not read the attachment, or it exceeds 10 MB.' });
            attachments = [{ filename: String(body.attachmentName).slice(0, 180), content: Buffer.from(await attachment.arrayBuffer()).toString('base64') }];
          }
          const sent = await sendMail(env, { to: ticket.email, subject: `Re: ${ticket.subject}`, html: darkEmail(`<div style="font-family:Arial,sans-serif;background:#000;color:#fff;padding:32px"><div style="max-width:620px;margin:auto;border:1px solid #1f2933;padding:28px"><h2>${escapeHtml(ticket.subject)}</h2><p>Hi ${escapeHtml(ticket.name)},</p><div style="white-space:pre-wrap">${escapeHtml(reply)}</div></div></div>`), attachments });
          if (!sent) return sendJson(res, 502, { error: 'The reply email could not be delivered.' });
          const { error } = await admin.from('support_tickets').update({ status: 'replied', admin_reply: reply, reply_attachment_path: body.attachmentPath || null, reply_attachment_name: body.attachmentName || null, reply_attachment_type: body.attachmentType || null, replied_at: new Date().toISOString() }).eq('id', ticket.id);
          sendJson(res, error ? 500 : 200, error ? { error: error.message } : { ok: true });
          return;
        }

        if (body.action === 'orders') {
          const { data, error } = await admin
            .from('course_orders')
            .select(
              'id, order_number, razorpay_order_id, razorpay_payment_id, course_name, full_name, email, phone, trading_experience, terms_accepted, coupon_code, original_amount, discount_amount, final_amount, payment_status, drive_access_status, created_at',
            )
            .order('created_at', { ascending: false });

          if (error) {
            sendJson(res, 500, { error: error.message });
            return;
          }
          sendJson(res, 200, { data: data || [] });
          return;
        }

        if (body.action === 'updateOrder') {
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

          let courseDriveUrl = null;
          let courseDiscordUrl = null;
          if (data.course_name) {
            const { data: course } = await admin.from('courses').select('drive_url, discord_url').eq('title', data.course_name).maybeSingle();
            courseDriveUrl = course?.drive_url || null;
            courseDiscordUrl = course?.discord_url || null;
          }
          const emailOrder = { ...data, course_drive_url: courseDriveUrl, course_discord_url: courseDiscordUrl };
          const emailSent = await sendMail(env, {
            to: data.email,
            subject:
              data.payment_status === 'paid'
                ? 'Trading Boy course access approved'
                : `Trading Boy payment status: ${data.payment_status}`,
            html: data.payment_status === 'paid' ? paidAccessHtml(env, emailOrder) : statusHtml(data),
          });

          sendJson(res, 200, { ok: true, emailSent });
          return;
        }

        if (body.action === 'deleteOrders') {
          const deleteAll = body.deleteAll === true;
          const orderIds = Array.isArray(body.orderIds) ? body.orderIds.map(String).filter(Boolean) : [];
          if (!deleteAll && orderIds.length === 0) {
            sendJson(res, 400, { error: 'Select at least one payment record.' });
            return;
          }

          let proofQuery = admin.from('course_orders').select('id, payment_screenshot_path');
          if (!deleteAll) proofQuery = proofQuery.in('id', orderIds);
          const { data: records, error: recordsError } = await proofQuery;
          if (recordsError) {
            sendJson(res, 500, { error: recordsError.message });
            return;
          }

          let deleteQuery = admin.from('course_orders').delete();
          deleteQuery = deleteAll ? deleteQuery.not('id', 'is', null) : deleteQuery.in('id', orderIds);
          const { error: deleteError } = await deleteQuery;
          if (deleteError) {
            sendJson(res, 500, { error: deleteError.message });
            return;
          }

          const proofPaths = (records || []).map((record: any) => record.payment_screenshot_path).filter(Boolean);
          if (proofPaths.length > 0) await admin.storage.from('payment-proofs').remove(proofPaths);
          sendJson(res, 200, { ok: true, deleted: records?.length || 0 });
          return;
        }

        if (body.action === 'sendCampaign') {
          const audience = ['all', 'manual'].includes(body.audience) ? body.audience : 'paid';
          const courseName = String(body.courseName || 'all').trim();
          const manualEmails = String(body.manualEmails || body.additionalEmails || '').split(/[\s,;]+/).map((email) => email.trim().toLowerCase()).filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)).slice(0, 500);
          const excludedEmails = new Set((Array.isArray(body.excludedEmails) ? body.excludedEmails : []).map((email: unknown) => String(email).trim().toLowerCase()).filter((email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)).slice(0, 500));
          const subject = String(body.subject || '').trim().slice(0, 150);
          const message = String(body.message || '').trim().slice(0, 5000);
          if (!subject || !message) {
            sendJson(res, 400, { error: 'Email subject and message are required.' });
            return;
          }

          let rows: any[] = [];
          if (audience !== 'manual') {
            let recipientQuery = admin.from('course_orders').select('email, full_name, course_name, payment_status').not('email', 'is', null);
            if (audience === 'paid') recipientQuery = recipientQuery.eq('payment_status', 'paid');
            if (courseName && courseName !== 'all') recipientQuery = recipientQuery.eq('course_name', courseName);
            const { data, error: recipientError } = await recipientQuery;
            if (recipientError) {
              sendJson(res, 500, { error: recipientError.message });
              return;
            }
            rows = data || [];
          }

          const recipientMap = new Map(rows.filter((row: any) => row.email).map((row: any) => [row.email.trim().toLowerCase(), row]));
          manualEmails.forEach((email) => {
            if (!recipientMap.has(email)) recipientMap.set(email, { email, full_name: 'Trader' });
          });
          excludedEmails.forEach((email) => recipientMap.delete(email));
          const recipients = Array.from(recipientMap.values()) as any[];
          if (recipients.length === 0) {
            sendJson(res, 400, { error: 'No recipients match this audience.' });
            return;
          }

          let sent = 0;
          let failed = 0;
          for (let index = 0; index < recipients.length; index += 5) {
            const results = await Promise.all(recipients.slice(index, index + 5).map((recipient) => sendMail(env, {
              to: recipient.email,
              subject,
              html: campaignHtml({ name: recipient.full_name, message }),
            })));
            sent += results.filter(Boolean).length;
            failed += results.filter((result) => !result).length;
          }
          sendJson(res, 200, { ok: true, sent, failed, recipients: recipients.length });
          return;
        }

        if (body.action === 'coupons') {
          const { data, error } = await admin
            .from('coupons')
            .select('id, code, course_name, discount_type, discount_value, active, expires_at, max_uses, current_uses, created_at')
            .order('created_at', { ascending: false });

          sendJson(res, error ? 500 : 200, error ? { error: error.message } : { data });
          return;
        }

        if (body.action === 'courses') {
          const { data, error } = await admin
            .from('courses')
            .select('id, title, description, thumbnail_url, normal_price, offer_price, price, drive_url, discord_url, active, created_at')
            .order('created_at', { ascending: false });

          sendJson(res, error ? 500 : 200, error ? { error: error.message } : { data });
          return;
        }

        if (body.action === 'saveCourse') {
          const title = String(body.title || '').trim();
          const normalPrice = Number(body.normalPrice);
          const offerPrice = Number(body.offerPrice);

          if (!title || Number.isNaN(normalPrice) || normalPrice <= 0 || Number.isNaN(offerPrice) || offerPrice <= 0) {
            sendJson(res, 400, { error: 'Valid title, normal price, and offer price are required.' });
            return;
          }

          const payload = {
            title,
            description: String(body.description || '').trim() || null,
            normal_price: normalPrice,
            offer_price: offerPrice,
            price: offerPrice,
            drive_url: String(body.driveUrl || '').trim() || null,
            discord_url: String(body.discordUrl || '').trim() || null,
            thumbnail_url: String(body.thumbnailUrl || '').trim() || null,
          };

          if (body.thumbnailDataUrl) {
            const buffer = decodeDataUrl(body.thumbnailDataUrl);
            if (buffer.byteLength > 5 * 1024 * 1024) {
              sendJson(res, 400, { error: 'Image must be below 5MB.' });
              return;
            }

            const imagePath = `${randomUUID()}.jpg`;
            const { error: uploadError } = await admin.storage
              .from('course-thumbnails')
              .upload(imagePath, buffer, {
                contentType: 'image/jpeg',
                upsert: true,
              });

            if (uploadError) {
              sendJson(res, 500, { error: uploadError.message });
              return;
            }

            const { data: publicUrlData } = admin.storage.from('course-thumbnails').getPublicUrl(imagePath);
            payload.thumbnail_url = publicUrlData.publicUrl;
          }

          if (body.qrCodeDataUrl) {
            const buffer = decodeDataUrl(body.qrCodeDataUrl);
            if (buffer.byteLength > 100 * 1024) {
              sendJson(res, 400, { error: 'Payment QR image must be below 100KB after compression.' });
              return;
            }
            const imagePath = `qr-${randomUUID()}.jpg`;
            const { error: uploadError } = await admin.storage.from('course-thumbnails').upload(imagePath, buffer, { contentType: 'image/jpeg', upsert: true });
            if (uploadError) {
              sendJson(res, 500, { error: uploadError.message });
              return;
            }
            const { data: publicUrlData } = admin.storage.from('course-thumbnails').getPublicUrl(imagePath);
            payload.qr_code_url = publicUrlData.publicUrl;
          }

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
          const code = String(body.code || '').trim().toUpperCase();
          const discountType = body.discountType;
          const discountValue = Number(body.discountValue);
          const maxUses = body.maxUses ? Number(body.maxUses) : null;

          if (!code || !['fixed', 'percent'].includes(discountType) || Number.isNaN(discountValue) || discountValue <= 0) {
            sendJson(res, 400, { error: 'Valid coupon code, discount type, and discount value are required.' });
            return;
          }
          if (discountType === 'percent' && discountValue > 100) {
            sendJson(res, 400, { error: 'Percentage discount cannot be above 100.' });
            return;
          }
          if (maxUses !== null && (Number.isNaN(maxUses) || maxUses <= 0)) {
            sendJson(res, 400, { error: 'Maximum uses must be a positive number.' });
            return;
          }

          const payload = {
            code,
            course_name: String(body.courseName || '').trim() || null,
            discount_type: discountType,
            discount_value: discountValue,
            expires_at: body.expiresAt ? new Date(body.expiresAt).toISOString() : null,
            max_uses: maxUses,
            active: true,
          };
          const query = body.id
            ? admin.from('coupons').update(payload).eq('id', body.id)
            : admin.from('coupons').upsert(payload, { onConflict: 'code' });
          const { error } = await query;

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

        if (body.action === 'deleteCoupon') {
          const { error } = await admin.from('coupons').delete().eq('id', body.couponId);

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
  message: { to: string; subject: string; html: string; attachments?: Array<{ filename: string; content: string }> },
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

const darkEmail = (content: string) => `<!doctype html><html><head><meta name="color-scheme" content="dark only"><meta name="supported-color-schemes" content="dark only"><style>:root{color-scheme:dark only;supported-color-schemes:dark only}html,body{margin:0!important;padding:0!important;background:#000000!important;color:#ffffff!important}a{color:#25aef4}</style></head><body bgcolor="#000000" style="margin:0;padding:0;background:#000000;color:#ffffff;">${content}</body></html>`;
const escapeHtml = (value: unknown) => String(value || '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] || character);
const campaignHtml = ({ name, message }: { name: string; message: string }) => darkEmail(`
  <div style="font-family:Arial,sans-serif;background:#000000;color:#ffffff;padding:32px 16px;">
    <div style="max-width:620px;margin:0 auto;background:#0f1115;border:1px solid #1f2933;padding:32px;">
      <img src="https://tradingboy.in/logo.png" alt="Trading Boy Academy" style="height:52px;width:auto;margin:0 0 24px;display:block;" />
      <p style="margin:0 0 18px;color:#ffffff;font-size:16px;line-height:1.6;">Hi ${escapeHtml(name || 'Trader')},</p>
      <div style="color:#cbd5e1;font-size:15px;line-height:1.75;white-space:pre-wrap;">${escapeHtml(message)}</div>
      <div style="margin-top:32px;padding-top:20px;border-top:1px solid #1f2933;color:#64748b;font-size:12px;line-height:1.6;">You received this message because you joined a Trading Boy Academy course.<br>From: admin@tradingboy.in</div>
    </div>
  </div>
`);

const receiptHtml = (order: any) => darkEmail(`
  <div style="font-family:Arial,sans-serif;background:#0f1113;color:#ffffff;padding:28px">
    <div style="max-width:620px;margin:0 auto;border:1px solid #1f2933;padding:28px">
      <h1 style="margin:0 0 12px;color:#25aef4">Trading Boy Academy</h1>
      <h2 style="margin:0 0 20px">Payment Receipt</h2>
      <p>Hi ${order.full_name},</p>
      <p>Your course purchase request has been created.</p>
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
`);

const adminPaymentHtml = (order: any) => darkEmail(`
  <div style="font-family:Arial,sans-serif;background:#000000;color:#ffffff;padding:32px 16px">
    <div style="max-width:620px;margin:0 auto;background:#0f1115;border:1px solid #1f2933;padding:32px">
      <img src="https://tradingboy.in/logo.png" alt="Trading Boy Academy" style="height:52px;width:auto;margin:0 0 24px;display:block" />
      <div style="color:#25aef4;font-size:12px;font-weight:bold;letter-spacing:3px;text-transform:uppercase">New Payment Submitted</div>
      <h2 style="margin:12px 0 18px;color:#ffffff">A new student completed the payment</h2>
      <p style="color:#cbd5e1;line-height:1.7">The student uploaded payment proof. Review the screenshot and verify the payment from the secure admin panel.</p>
      <table style="width:100%;border-collapse:collapse;margin:24px 0;color:#ffffff">
        <tr><td style="padding:10px 0;color:#9ca3af">Student</td><td style="padding:10px 0;text-align:right">${escapeHtml(order.full_name)}</td></tr>
        <tr><td style="padding:10px 0;color:#9ca3af">Email</td><td style="padding:10px 0;text-align:right">${escapeHtml(order.email)}</td></tr>
        <tr><td style="padding:10px 0;color:#9ca3af">Course</td><td style="padding:10px 0;text-align:right">${escapeHtml(order.course_name)}</td></tr>
        <tr><td style="padding:10px 0;color:#9ca3af">Amount submitted</td><td style="padding:10px 0;text-align:right;color:#25aef4;font-weight:bold">${formatAmount(order.final_amount)}</td></tr>
      </table>
      <a href="https://tradingboy.in/#admin/payments" style="display:inline-block;background:#25aef4;color:#000000;text-decoration:none;font-size:13px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;padding:15px 22px">View &amp; Verify Payment</a>
      <p style="margin:22px 0 0;color:#64748b;font-size:12px">Admin passcode and email OTP verification are required before payment details are shown.</p>
    </div>
  </div>
`);

const statusHtml = (order: any) => darkEmail(`
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
`);

const paidAccessHtml = (env: Record<string, string>, order: any) => darkEmail(`
  <div style="font-family:Arial,sans-serif;background:#0f1113;color:#ffffff;padding:28px">
    <div style="max-width:620px;margin:0 auto;border:1px solid #1f2933;padding:28px">
      <h1 style="margin:0 0 12px;color:#25aef4">Trading Boy Academy</h1>
      <h2 style="margin:0 0 20px">Course Access Approved</h2>
      <p>Hi ${order.full_name},</p>
      <p>Your payment is verified. Your course access is now approved.</p>
      <p><strong>Important:</strong> open the course using this same email address: <strong>${order.email}</strong>.</p>
      ${
        order.course_drive_url || env.DRIVE_COURSE_URL
          ? `<p style="margin:28px 0"><a href="${order.course_drive_url || env.DRIVE_COURSE_URL}" style="background:#25aef4;color:#000000;text-decoration:none;font-weight:bold;padding:14px 20px;display:inline-block">Open Course Drive Folder</a></p>`
          : '<p>The team will share your course access by email within 12 hours.</p>'
      }
      ${
        order.course_discord_url
          ? `<p style="margin:14px 0 28px"><a href="${order.course_discord_url}" style="background:#5865F2;color:#ffffff;text-decoration:none;font-weight:bold;padding:14px 20px;display:inline-block">Join the Course Discord</a></p>`
          : ''
      }
      <table style="width:100%;border-collapse:collapse;margin-top:20px">
        <tr><td style="padding:8px 0;color:#9ca3af">Order ID</td><td style="padding:8px 0;text-align:right">${order.id}</td></tr>
        <tr><td style="padding:8px 0;color:#9ca3af">Amount</td><td style="padding:8px 0;text-align:right">${formatAmount(order.final_amount)}</td></tr>
        <tr><td style="padding:8px 0;color:#9ca3af">Status</td><td style="padding:8px 0;text-align:right">${order.payment_status}</td></tr>
      </table>
      <p style="margin-top:24px;color:#9ca3af">If Google Drive says access denied, contact admin after confirming your email was shared.</p>
      <p style="margin-top:8px;color:#9ca3af">From: admin@tradingboy.in</p>
    </div>
  </div>
`);

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
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('@supabase')) return 'supabase';
            if (id.includes('lucide-react')) return 'icons';
            if (id.includes('embla-carousel')) return 'carousel';
            if (id.includes('react')) return 'react-vendor';
            return 'vendor';
          },
        },
      },
    },
    server: {
      fs: {
        strict: false,
      },
    },
  };
});
