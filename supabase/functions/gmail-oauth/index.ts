import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireEnv } from '../_shared/security.ts'

const ALLOWED_DOMAIN = '@arktechnologiesgroup.com'
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

function jsonResponse(payload: unknown, status = 200) {
  return Response.json(payload, { status, headers: corsHeaders })
}

function toBase64Url(bytes: Uint8Array) {
  let binary = ''
  bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

function fromBase64Url(value: string) {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/')
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='))
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

async function stateKey(secret: string) {
  return crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false,
    ['sign', 'verify'],
  )
}

async function createState(userId: string, secret: string) {
  const payload = toBase64Url(new TextEncoder().encode(JSON.stringify({
    user_id: userId,
    nonce: crypto.randomUUID(),
    exp: Date.now() + 10 * 60 * 1000,
  })))
  const signature = await crypto.subtle.sign('HMAC', await stateKey(secret), new TextEncoder().encode(payload))
  return `${payload}.${toBase64Url(new Uint8Array(signature))}`
}

async function verifyState(state: string, secret: string) {
  const [payload, signature] = state.split('.')
  if (!payload || !signature) return null
  const valid = await crypto.subtle.verify(
    'HMAC', await stateKey(secret), fromBase64Url(signature), new TextEncoder().encode(payload),
  )
  if (!valid) return null
  const parsed = JSON.parse(new TextDecoder().decode(fromBase64Url(payload)))
  if (!parsed.user_id || !parsed.exp || Number(parsed.exp) < Date.now()) return null
  return parsed as { user_id: string }
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const url = new URL(req.url)
    const env = requireEnv([
      'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI',
      'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY',
      'GMAIL_OAUTH_STATE_SECRET',
    ])
    const clientId = env.GOOGLE_CLIENT_ID
    const clientSecret = env.GOOGLE_CLIENT_SECRET
    const redirectUri = env.GOOGLE_REDIRECT_URI
    const supabaseUrl = env.SUPABASE_URL
    const anonKey = env.SUPABASE_ANON_KEY
    const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY
    const stateSecret = env.GMAIL_OAUTH_STATE_SECRET

    // Authenticated initiation: the user ID is derived from the verified session.
    if (req.method === 'POST') {
      const authorization = req.headers.get('Authorization')
      if (!authorization) return jsonResponse({ error: 'Authentication required' }, 401)
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authorization } },
      })
      const { data: { user }, error } = await userClient.auth.getUser()
      if (error || !user) return jsonResponse({ error: 'Invalid session' }, 401)

      const state = await createState(user.id, stateSecret)
      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
      authUrl.searchParams.set('client_id', clientId)
      authUrl.searchParams.set('redirect_uri', redirectUri)
      authUrl.searchParams.set('response_type', 'code')
      authUrl.searchParams.set('scope', [
        'openid', 'email', 'profile',
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.modify',
      ].join(' '))
      authUrl.searchParams.set('access_type', 'offline')
      authUrl.searchParams.set('prompt', 'consent')
      authUrl.searchParams.set('state', state)
      return jsonResponse({ authorization_url: authUrl.toString() })
    }

    if (req.method !== 'GET') return jsonResponse({ error: 'Method not allowed' }, 405)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    if (!code || !state) return new Response('Missing OAuth callback data', { status: 400 })

    const verifiedState = await verifyState(state, stateSecret)
    if (!verifiedState) return new Response('Invalid or expired OAuth state', { status: 403 })

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code, client_id: clientId, client_secret: clientSecret,
        redirect_uri: redirectUri, grant_type: 'authorization_code',
      }),
    })
    const tokens = await tokenResponse.json()
    if (!tokenResponse.ok || !tokens.access_token) {
      return new Response('Failed to exchange OAuth code', { status: 400 })
    }

    const profileResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    const profile = await profileResponse.json()
    const connectedEmail = String(profile.email || '').trim().toLowerCase()
    if (!profileResponse.ok || !profile.verified_email || !connectedEmail.endsWith(ALLOWED_DOMAIN)) {
      return new Response('Only a verified ARK Technologies Workspace email can be connected.', {
        status: 403,
      })
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)
    const expiresAt = new Date(Date.now() + Number(tokens.expires_in || 3600) * 1000).toISOString()
    const { data: previous } = await supabase
      .from('gmail_connections')
      .select('refresh_token')
      .eq('user_id', verifiedState.user_id)
      .eq('email', connectedEmail)
      .order('connected_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    await supabase.from('gmail_connections').update({ is_active: false })
      .eq('user_id', verifiedState.user_id)

    const { error: saveError } = await supabase.from('gmail_connections').insert({
      user_id: verifiedState.user_id,
      email: connectedEmail,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || previous?.refresh_token,
      expires_at: expiresAt,
      provider: 'google',
      is_active: true,
      connected_at: new Date().toISOString(),
    })
    if (saveError) {
      console.error('Gmail connection save failed:', saveError)
      return new Response('Gmail connected but could not be saved.', { status: 500 })
    }

    return new Response(`
      <html><body style="font-family:Arial;padding:40px">
        <h2>Gmail Connected Successfully</h2>
        <p>Email: ${escapeHtml(connectedEmail)}</p>
        <p>You can close this tab and return to ARK ONE.</p>
      </body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  } catch (error) {
    console.error('gmail-oauth failure:', error)
    return jsonResponse({ error: 'Unable to connect Gmail' }, 500)
  }
})
