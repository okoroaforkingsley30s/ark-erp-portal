import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const ADMIN_ROLES = new Set(['system_admin', 'super_admin'])
const ASSIGNABLE_ROLES = new Set([
  'system_admin', 'head_of_it', 'it', 'ceo', 'agm', 'admin_head', 'admin',
  'manager', 'operations', 'helpdesk', 'engineer', 'inventory', 'repair_head',
  'repair_technician', 'head_of_account', 'finance', 'procurement', 'hr',
  'head_of_business_development', 'business_developer', 'client',
])

function jsonResponse(payload: unknown, status = 200) {
  return Response.json(payload, { status, headers: corsHeaders })
}

function normalizeEmail(value: unknown) {
  return String(value || '').trim().toLowerCase()
}

function normalizeRole(value: unknown) {
  return String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const authorization = req.headers.get('Authorization')

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return jsonResponse({ error: 'Server configuration is incomplete' }, 500)
    }
    if (!authorization) return jsonResponse({ error: 'Authentication required' }, 401)

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
    })
    const { data: { user: caller }, error: authError } = await userClient.auth.getUser()
    if (authError || !caller?.email) return jsonResponse({ error: 'Invalid session' }, 401)

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)
    const callerEmail = normalizeEmail(caller.email)
    const { data: callerRecord, error: callerError } = await supabaseAdmin
      .from('users')
      .select('role, account_status, status, approval_status, is_approved')
      .eq('id', caller.id)
      .maybeSingle()

    let effectiveCaller = callerRecord
    if (!effectiveCaller) {
      const { data: emailRecord, error: emailLookupError } = await supabaseAdmin
        .from('users')
        .select('role, account_status, status, approval_status, is_approved')
        .ilike('email', callerEmail)
        .limit(1)
        .maybeSingle()
      if (emailLookupError) return jsonResponse({ error: 'Unable to verify caller access' }, 500)
      effectiveCaller = emailRecord
    }

    if (callerError || !effectiveCaller) {
      return jsonResponse({ error: 'Caller profile not found' }, 403)
    }

    const callerRole = normalizeRole(effectiveCaller.role)
    const isApproved = effectiveCaller.is_approved === true ||
      String(effectiveCaller.approval_status || '').toLowerCase() === 'approved' ||
      String(effectiveCaller.status || '').toLowerCase() === 'approved'
    const isActive = !effectiveCaller.account_status ||
      String(effectiveCaller.account_status).toLowerCase() === 'active'

    if (!ADMIN_ROLES.has(callerRole) || !isApproved || !isActive) {
      return jsonResponse({ error: 'System administrator access required' }, 403)
    }

    const body = await req.json()
    const targetUserId = String(body.target_user_id || '').trim()
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(targetUserId)) {
      return jsonResponse({ error: 'A valid target user is required' }, 400)
    }

    // Identity, role and approval state come only from the server-controlled profile.
    const { data: target, error: targetError } = await supabaseAdmin
      .from('users')
      .select('id, email, full_name, role, department, employee_id, account_status, approval_status, is_approved')
      .eq('id', targetUserId)
      .single()
    if (targetError || !target) return jsonResponse({ error: 'Approved target user was not found' }, 404)

    const email = normalizeEmail(target.email)
    const role = normalizeRole(target.role)
    const fullName = String(target.full_name || '').trim().slice(0, 160) || null
    const department = String(target.department || '').trim().slice(0, 120) || null
    const employeeId = String(target.employee_id || '').trim().slice(0, 80) || null

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonResponse({ error: 'A valid email is required' }, 400)
    }
    if (!ASSIGNABLE_ROLES.has(role)) {
      return jsonResponse({ error: 'Invalid role' }, 400)
    }
    if (target.is_approved !== true || String(target.approval_status || '').toLowerCase() !== 'approved' ||
        String(target.account_status || 'active').toLowerCase() !== 'active') {
      return jsonResponse({ error: 'Target user has not been approved' }, 409)
    }

    let authUserId: string
    const { data: createdUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name: fullName, department, employee_id: employeeId },
    })

    if (createError) {
      if (!createError.message.toLowerCase().includes('already')) {
        return jsonResponse({ error: createError.message }, 400)
      }
      const { data: listedUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers()
      if (listError) return jsonResponse({ error: 'Unable to locate existing account' }, 500)
      const existingUser = listedUsers.users.find((user) => normalizeEmail(user.email) === email)
      if (!existingUser) return jsonResponse({ error: 'Existing account could not be found' }, 409)
      authUserId = existingUser.id
      const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(authUserId, {
        email_confirm: true,
        user_metadata: { full_name: fullName, department, employee_id: employeeId },
      })
      if (updateAuthError) return jsonResponse({ error: updateAuthError.message }, 400)
    } else {
      authUserId = createdUser.user.id
    }

    const now = new Date().toISOString()
    const { error: publicUserError } = await supabaseAdmin.from('users').update({
      must_change_password: true,
      updated_at: now,
    }).eq('id', target.id)
    if (publicUserError) return jsonResponse({ error: publicUserError.message }, 400)

    const profilePayload = {
      user_email: email,
      employee_id: employeeId,
      department,
      role,
      account_status: 'active',
      updated_at: now,
    }
    const { data: existingProfile } = await supabaseAdmin
      .from('user_profiles').select('id').ilike('user_email', email).limit(1).maybeSingle()
    const profileQuery = existingProfile
      ? supabaseAdmin.from('user_profiles').update(profilePayload).eq('id', existingProfile.id)
      : supabaseAdmin.from('user_profiles').insert({ ...profilePayload, created_at: now })
    const { error: profileError } = await profileQuery
    if (profileError) console.warn('user_profiles sync warning:', profileError.message)

    const { error: employeeError } = await supabaseAdmin
      .from('employees')
      .update({ user_account_email: email, access_role: role, department, updated_at: now })
      .or(`email_address.eq.${email},user_account_email.eq.${email}`)
    if (employeeError) console.warn('employees sync warning:', employeeError.message)

    const redirectTo = Deno.env.get('PASSWORD_SETUP_REDIRECT_URL')
    if (!redirectTo) return jsonResponse({ error: 'Server configuration is incomplete' }, 500)
    const { error: inviteEmailError } = await supabaseAdmin.auth.resetPasswordForEmail(
      email,
      { redirectTo },
    )
    if (inviteEmailError) return jsonResponse({ error: inviteEmailError.message }, 400)

    // Supabase sends the setup email. No privileged action link is exposed to callers.
    return jsonResponse({ success: true, user_id: authUserId, email })
  } catch (error) {
    console.error('invite-user failure:', error)
    return jsonResponse({ error: 'Unable to invite user' }, 500)
  }
})
