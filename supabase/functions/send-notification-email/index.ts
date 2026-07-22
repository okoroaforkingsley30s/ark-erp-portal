import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireEnv } from '../_shared/security.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(payload: unknown, status = 200) {
  return Response.json(payload, { status, headers: corsHeaders })
}

function email(value: unknown) {
  return String(value || '').trim().toLowerCase()
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  try {
    const env = requireEnv(['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'])
    const authorization = req.headers.get('Authorization')
    if (!authorization) return jsonResponse({ error: 'Authentication required' }, 401)
    const userClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authorization } },
    })
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) return jsonResponse({ error: 'Invalid session' }, 401)

    const body = await req.json()
    const notificationId = String(body.notificationId || '').trim()
    const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

    const { data: caller } = await admin.from('users')
      .select('email, is_approved, account_status').eq('id', user.id).maybeSingle()
    if (!caller?.is_approved || String(caller.account_status || 'active').toLowerCase() !== 'active') {
      return jsonResponse({ error: 'Caller is not an active approved user' }, 403)
    }

    if (notificationId) {
      const { data: notification } = await admin.from('notifications')
        .select('id, user_email, recipient_email, email_status, major_notification')
        .eq('id', notificationId).maybeSingle()
      if (!notification) return jsonResponse({ error: 'Verified notification was not found' }, 404)
      if (notification.email_status === 'sent') return jsonResponse({ success: true, already_sent: true })
      const recipientEmail = email(notification.recipient_email || notification.user_email)
      const { data: recipient } = await admin.from('users').select('id, account_status')
        .ilike('email', recipientEmail).limit(1).maybeSingle()
      if (!recipient || String(recipient.account_status || 'active').toLowerCase() !== 'active') {
        return jsonResponse({ error: 'Recipient is not an active ARK ONE user' }, 403)
      }
      await admin.from('notifications').update({
        major_notification: true,
        email_status: 'queued',
        email_last_error: null,
      }).eq('id', notificationId)
      return jsonResponse({ success: true, queued: true, notification_id: notificationId, provider: 'google' })
    }

    const to = email(body.to)
    const title = String(body.title || '').trim()
    const message = String(body.message || '').trim()
    if (!to || !title || !message || title.length > 160 || message.length > 5000) {
      return jsonResponse({ error: 'Valid recipient, title and message are required' }, 400)
    }
    const { data: recipient } = await admin.from('users').select('email, account_status')
      .ilike('email', to).limit(1).maybeSingle()
    if (!recipient || String(recipient.account_status || 'active').toLowerCase() !== 'active') {
      return jsonResponse({ error: 'Recipient is not an active ARK ONE user' }, 403)
    }
    const { data: notification, error: insertError } = await admin.from('notifications').insert({
      user_email: recipient.email,
      recipient_email: recipient.email,
      title,
      message,
      message_body: message,
      type: String(body.type || 'system'),
      link: String(body.link || '/notifications'),
      sound: 'bell',
      major_notification: true,
      email_status: 'queued',
      data: { source: 'send-notification-email', requested_by: caller.email },
    }).select('id').single()
    if (insertError) return jsonResponse({ error: 'Notification could not be queued' }, 500)
    return jsonResponse({ success: true, queued: true, notification_id: notification.id, provider: 'google' })
  } catch (error) {
    console.error('send-notification-email failure:', error)
    return jsonResponse({ error: 'Unable to queue notification email', details: String(error).slice(0, 500) }, 500)
  }
})
