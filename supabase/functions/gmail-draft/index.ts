import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { buildMimeMessage, googleApiError, parseEmailList, requireEnv, safeMailHeader } from '../_shared/security.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (payload: unknown, status = 200) => Response.json(payload, { status, headers: corsHeaders })

async function token(admin: any, connection: any) {
  if (connection.access_token && (!connection.expires_at || new Date(connection.expires_at).getTime() > Date.now() + 60_000)) return connection.access_token
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: Deno.env.get('GOOGLE_CLIENT_ID') || '', client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') || '', refresh_token: connection.refresh_token || '', grant_type: 'refresh_token' }),
  })
  const payload = await response.json()
  if (!response.ok || !payload.access_token) throw new Error(googleApiError(payload, 'Gmail authorization expired'))
  await admin.from('gmail_connections').update({ access_token: payload.access_token, expires_at: new Date(Date.now() + Number(payload.expires_in || 3600) * 1000).toISOString() }).eq('id', connection.id)
  return payload.access_token
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  try {
    const env = requireEnv(['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'])
    const authorization = req.headers.get('Authorization')
    if (!authorization) return json({ error: 'Authentication required' }, 401)
    const userClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, { global: { headers: { Authorization: authorization } } })
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) return json({ error: 'Invalid session' }, 401)
    const body = await req.json()
    const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
    const { data: connection } = await admin.from('gmail_connections').select('*').eq('user_id', user.id).eq('is_active', true).order('connected_at', { ascending: false }).limit(1).maybeSingle()
    if (!connection || String(connection.email).toLowerCase() !== String(user.email || '').toLowerCase()) return json({ error: 'Reconnect your company Gmail mailbox' }, 403)
    const accessToken = await token(admin, connection)
    const draftId = String(body.draftId || '').trim()
    if (body.action === 'delete') {
      if (!draftId) return json({ error: 'Draft ID is required' }, 400)
      const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/drafts/${encodeURIComponent(draftId)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } })
      if (!response.ok && response.status !== 404) throw new Error('Google could not delete the draft')
      await admin.from('email_messages').delete().eq('created_by', user.id).eq('gmail_draft_id', draftId)
      return json({ success: true })
    }
    const to = body.to ? parseEmailList(body.to) : ''
    const cc = parseEmailList(body.cc)
    const bcc = parseEmailList(body.bcc)
    const subject = body.subject ? safeMailHeader(body.subject, 300) : '(No subject)'
    const message = buildMimeMessage({ from: connection.email, to: to || connection.email, cc, bcc, subject, html: String(body.body || ''), attachments: Array.isArray(body.attachments) ? body.attachments : [] })
    const url = draftId ? `https://gmail.googleapis.com/gmail/v1/users/me/drafts/${encodeURIComponent(draftId)}` : 'https://gmail.googleapis.com/gmail/v1/users/me/drafts'
    const response = await fetch(url, { method: draftId ? 'PUT' : 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ message: { raw: message.raw } }) })
    const gmail = await response.json()
    if (!response.ok) throw new Error(googleApiError(gmail, 'Google could not save the draft'))
    const row = {
      gmail_draft_id: gmail.id, gmail_message_id: gmail.message?.id, gmail_thread_id: gmail.message?.threadId,
      sender_email: connection.email, recipient_email: to, cc, bcc, subject,
      message_body: String(body.body || ''), snippet: String(body.body || '').replace(/<[^>]*>/g, '').slice(0, 200),
      direction: 'sent', email_status: 'Draft', is_sent: false, is_read: true, is_draft: true,
      folder: 'drafts', label_ids: ['DRAFT'], attachments: Array.isArray(body.attachments) ? body.attachments.map((a: any) => ({ filename: a.name, mime_type: a.type, size: a.size })) : [],
      received_at: new Date().toISOString(), synced_at: new Date().toISOString(), created_by: user.id,
    }
    const { data: existing } = await admin.from('email_messages').select('id').eq('created_by', user.id).eq('gmail_draft_id', draftId || gmail.id).maybeSingle()
    if (existing) await admin.from('email_messages').update(row).eq('id', existing.id)
    else await admin.from('email_messages').insert(row)
    return json({ success: true, draft_id: gmail.id })
  } catch (error) {
    return json({ error: 'Unable to save Gmail draft', details: String(error).slice(0, 500) }, 500)
  }
})
