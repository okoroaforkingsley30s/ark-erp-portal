import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(payload: unknown, status = 200) {
  return Response.json(payload, { status, headers: corsHeaders })
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function normalizeEmail(value: unknown) {
  return String(value || '').trim().toLowerCase()
}

function safePortalLink(value: unknown) {
  const portalUrl = Deno.env.get('PORTAL_URL')
  if (!portalUrl) throw new Error('PORTAL_URL is not configured')
  const portalOrigin = new URL(portalUrl).origin
  if (!value) return portalUrl

  try {
    const url = new URL(String(value), portalUrl)
    return url.origin === portalOrigin ? url.toString() : portalUrl
  } catch {
    return portalUrl
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    const authorization = req.headers.get('Authorization')

    if (!supabaseUrl || !anonKey || !serviceRoleKey || !resendApiKey) {
      return jsonResponse({ error: 'Server configuration is incomplete' }, 500)
    }
    if (!authorization) return jsonResponse({ error: 'Authentication required' }, 401)

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
    })
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) return jsonResponse({ error: 'Invalid session' }, 401)

    const body = await req.json()
    const notificationId = String(body.notificationId || '').trim()
    let to = normalizeEmail(body.to)
    let title = String(body.title || '').trim()
    let message = String(body.message || '').trim()
    let requestedLink = body.link

    if (!notificationId && (!to || !title || !message)) {
      return jsonResponse({ error: 'Missing required fields' }, 400)
    }
    if (title.length > 160 || message.length > 5000) {
      return jsonResponse({ error: 'Notification content is too long' }, 400)
    }
    if (/[\r\n]/.test(title)) {
      return jsonResponse({ error: 'Notification title contains invalid characters' }, 400)
    }

    // Do not permit this function to act as a general-purpose external mail relay.
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)
    const { data: caller } = await supabaseAdmin
      .from('users')
      .select('email, role, is_approved, account_status')
      .eq('id', user.id)
      .maybeSingle()
    const callerRole = String(caller?.role || '').toLowerCase()
    const mayNotifyOthers = [
      'system_admin', 'admin_head', 'admin', 'it', 'head_of_it',
      'ceo', 'agm', 'manager', 'operations', 'operations_manager',
      'helpdesk', 'engineer', 'inventory', 'inventory_head',
      'repair_head', 'rr_hod', 'repair_technician', 'rr_technician',
      'head_of_account', 'finance', 'procurement', 'hr', 'head_of_hr',
      'crm', 'business_developer', 'head_of_business_development',
    ].includes(callerRole)
    if (!caller || caller.is_approved !== true || String(caller.account_status || 'active').toLowerCase() !== 'active') {
      return jsonResponse({ error: 'Caller is not an active approved user' }, 403)
    }

    let isVerifiedEngineerMajorEvent = false
    if (notificationId) {
      const { data: storedNotification, error: storedError } = await supabaseAdmin
        .from('notifications')
        .select('user_email, recipient_email, title, message, message_body, type, link, data, email_status, email_attempts')
        .eq('id', notificationId)
        .maybeSingle()

      if (storedError || !storedNotification) {
        return jsonResponse({ error: 'Verified notification was not found' }, 404)
      }

      isVerifiedEngineerMajorEvent = callerRole === 'engineer'
        && String(storedNotification.type || '').toLowerCase() === 'ticket_completion_submitted'
        && normalizeEmail(storedNotification.data?.engineer_email) === normalizeEmail(caller.email)

      if (!mayNotifyOthers && !isVerifiedEngineerMajorEvent) {
        return jsonResponse({ error: 'You are not permitted to email this notification' }, 403)
      }

      to = normalizeEmail(storedNotification.recipient_email || storedNotification.user_email)
      title = String(storedNotification.title || '').trim()
      message = String(storedNotification.message || storedNotification.message_body || '').trim()
      requestedLink = storedNotification.link

      if (storedNotification.email_status === 'sent') {
        return jsonResponse({ success: true, already_sent: true })
      }

      await supabaseAdmin
        .from('notifications')
        .update({
          major_notification: true,
          email_status: 'processing',
          email_attempts: Number(storedNotification.email_attempts || 0) + 1,
          email_last_error: null,
        })
        .eq('id', notificationId)
    }

    if (!to || !title || !message) {
      return jsonResponse({ error: 'Verified notification content is incomplete' }, 400)
    }
    if (normalizeEmail(caller.email) !== to && !mayNotifyOthers && !isVerifiedEngineerMajorEvent) {
      return jsonResponse({ error: 'You are not permitted to email this recipient' }, 403)
    }
    const { data: recipient, error: recipientError } = await supabaseAdmin
      .from('users')
      .select('email, full_name, account_status')
      .ilike('email', to)
      .limit(1)
      .maybeSingle()

    if (recipientError) return jsonResponse({ error: 'Unable to verify recipient' }, 500)
    if (!recipient || String(recipient.account_status || 'active').toLowerCase() !== 'active') {
      return jsonResponse({ error: 'Recipient is not an active ARK ONE user' }, 403)
    }

    const link = safePortalLink(requestedLink)
    const recipientName = escapeHtml(recipient.full_name || body.name || 'User')
    const safeTitle = escapeHtml(title)
    const safeMessage = escapeHtml(message).replaceAll('\n', '<br>')
    const safeLink = escapeHtml(link)
    const fromEmail = Deno.env.get('FROM_EMAIL')
    if (!fromEmail) return jsonResponse({ error: 'Server configuration is incomplete' }, 500)

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: recipient.email,
        subject: `ARK ONE Notification: ${title}`,
        html: `
          <div style="font-family:Arial,sans-serif;line-height:1.6">
            <h2>ARK ONE Notification</h2>
            <p>Hello ${recipientName},</p>
            <p><strong>${safeTitle}</strong></p>
            <p>${safeMessage}</p>
            <p><a href="${safeLink}" style="background:#0f172a;color:white;padding:10px 16px;text-decoration:none;border-radius:6px">Open ARK ONE</a></p>
            <p>Thank you,<br>ARK ONE ERP</p>
          </div>
        `,
      }),
    })

    if (!emailResponse.ok) {
      const providerError = `Resend ${emailResponse.status}: ${await emailResponse.text()}`.slice(0, 1000)
      console.error('Resend request failed:', providerError)
      if (notificationId) {
        await supabaseAdmin
          .from('notifications')
          .update({ email_status: 'retry', email_last_error: providerError })
          .eq('id', notificationId)
      }
      return jsonResponse({ error: 'Notification email could not be sent' }, 502)
    }

    const result = await emailResponse.json()
    if (notificationId) {
      await supabaseAdmin
        .from('notifications')
        .update({
          major_notification: true,
          email_status: 'sent',
          email_sent_at: new Date().toISOString(),
          email_last_error: null,
        })
        .eq('id', notificationId)
    }
    return jsonResponse({ success: true, id: result.id })
  } catch (error) {
    console.error('send-notification-email failure:', error)
    return jsonResponse({ error: 'Unable to send notification email' }, 500)
  }
})
