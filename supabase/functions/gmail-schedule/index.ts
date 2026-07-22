import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { parseEmailList, requireEnv, safeMailHeader } from '../_shared/security.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (payload: unknown, status = 200) => Response.json(payload, { status, headers: corsHeaders })

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  try {
    const env = requireEnv(['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'])
    const authorization = req.headers.get('Authorization')
    if (!authorization) return json({ error: 'Authentication required' }, 401)
    const client = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, { global: { headers: { Authorization: authorization } } })
    const { data: { user }, error: authError } = await client.auth.getUser()
    if (authError || !user) return json({ error: 'Invalid session' }, 401)
    const body = await req.json()
    const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
    if (body.action === 'cancel') {
      const { data } = await admin.from('ark_scheduled_emails').update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', String(body.id || '')).eq('user_id', user.id).eq('status', 'scheduled').select('id').maybeSingle()
      return data ? json({ success: true }) : json({ error: 'Scheduled message was not found' }, 404)
    }
    const scheduledAt = new Date(body.scheduledAt || '')
    if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() < Date.now() + 60_000) {
      return json({ error: 'Schedule mail at least one minute in the future' }, 400)
    }
    const { data: connection } = await admin.from('gmail_connections').select('email').eq('user_id', user.id).eq('is_active', true).order('connected_at', { ascending: false }).limit(1).maybeSingle()
    if (!connection || String(connection.email).toLowerCase() !== String(user.email || '').toLowerCase()) return json({ error: 'Reconnect your company Gmail mailbox' }, 403)
    const row = {
      user_id: user.id,
      sender_email: connection.email,
      recipient_email: parseEmailList(body.to, true),
      cc: parseEmailList(body.cc),
      bcc: parseEmailList(body.bcc),
      subject: safeMailHeader(body.subject, 300),
      message_body: String(body.body || ''),
      attachments: Array.isArray(body.attachments) ? body.attachments : [],
      scheduled_at: scheduledAt.toISOString(),
    }
    const { data, error } = await admin.from('ark_scheduled_emails').insert(row).select('id, scheduled_at').single()
    if (error) return json({ error: 'Scheduled email could not be saved', details: error.message }, 500)
    return json({ success: true, scheduled: data })
  } catch (error) {
    return json({ error: 'Unable to schedule email', details: String(error).slice(0, 500) }, 500)
  }
})
