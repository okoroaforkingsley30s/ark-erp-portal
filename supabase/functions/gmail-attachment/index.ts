import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { googleApiError, requireEnv } from '../_shared/security.ts'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const json = (payload: unknown, status = 200) => Response.json(payload, { status, headers: cors })
const decode = (value: string) => {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/')
  return Uint8Array.from(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')), c => c.charCodeAt(0))
}

async function token(client: any, connection: any) {
  if (!connection.expires_at || new Date(connection.expires_at).getTime() > Date.now() + 60_000) return connection.access_token
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: Deno.env.get('GOOGLE_CLIENT_ID') || '', client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') || '', refresh_token: connection.refresh_token || '', grant_type: 'refresh_token' }) })
  const payload = await response.json()
  if (!response.ok || !payload.access_token) throw new Error(googleApiError(payload, 'Gmail access renewal failed'))
  await client.from('gmail_connections').update({ access_token: payload.access_token, expires_at: new Date(Date.now() + Number(payload.expires_in || 3600) * 1000).toISOString() }).eq('id', connection.id).eq('user_id', connection.user_id)
  return payload.access_token
}

serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  try {
    const env = requireEnv(['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'])
    const authorization = request.headers.get('Authorization')
    if (!authorization) return json({ error: 'Authentication required' }, 401)
    const auth = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, { global: { headers: { Authorization: authorization } } })
    const { data: { user } } = await auth.auth.getUser()
    if (!user) return json({ error: 'Invalid session' }, 401)
    const { emailId, attachmentId } = await request.json()
    const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
    const { data: message } = await admin.from('email_messages').select('gmail_message_id,attachments').eq('id', emailId).eq('created_by', user.id).maybeSingle()
    if (!message) return json({ error: 'Email not found' }, 404)
    const metadata = (Array.isArray(message.attachments) ? message.attachments : []).find((item: any) => item.attachment_id === attachmentId)
    if (!metadata) return json({ error: 'Attachment not found' }, 404)
    if (Number(metadata.size || 0) > 50 * 1024 * 1024) return json({ error: 'Attachment exceeds 50 MB limit' }, 413)
    const { data: connection } = await admin.from('gmail_connections').select('*').eq('user_id', user.id).eq('is_active', true).order('connected_at', { ascending: false }).limit(1).maybeSingle()
    if (!connection) return json({ error: 'No Gmail connection found' }, 404)
    const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(message.gmail_message_id)}/attachments/${encodeURIComponent(attachmentId)}`, { headers: { Authorization: `Bearer ${await token(admin, connection)}` } })
    const payload = await response.json()
    if (!response.ok || !payload.data) return json({ error: googleApiError(payload, 'Attachment download failed') }, 502)
    return new Response(decode(payload.data), { headers: { ...cors, 'Content-Type': metadata.mime_type || 'application/octet-stream', 'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(metadata.filename || 'attachment')}`, 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return json({ error: 'Unable to open attachment', details: String(error) }, 500)
  }
})
