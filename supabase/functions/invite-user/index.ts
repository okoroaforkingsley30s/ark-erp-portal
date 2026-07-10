import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function normalizeEmail(email: unknown) {
  return String(email || '').trim().toLowerCase()
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
    })
  }

  try {
    const { email, full_name, role, department, employee_id } = await req.json()

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      )
    }

    const cleanEmail = normalizeEmail(email)

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    let authUserId: string | null = null

    const { data: createdUser, error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email: cleanEmail,
        email_confirm: true,
        user_metadata: {
          full_name,
          role,
          department,
          employee_id,
        },
      })

    if (createError) {
      if (!createError.message.toLowerCase().includes('already')) {
        return new Response(
          JSON.stringify({ error: createError.message }),
          {
            status: 400,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        )
      }

      const { data: listedUsers, error: listError } =
        await supabaseAdmin.auth.admin.listUsers()

      if (listError) {
        return new Response(
          JSON.stringify({ error: listError.message }),
          {
            status: 400,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        )
      }

      const existingUser = listedUsers.users.find(
        (u) => u.email?.toLowerCase() === cleanEmail
      )

      if (!existingUser) {
        return new Response(
          JSON.stringify({ error: 'User already exists but could not be found.' }),
          {
            status: 400,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        )
      }

      authUserId = existingUser.id

      await supabaseAdmin.auth.admin.updateUserById(authUserId, {
        email_confirm: true,
        user_metadata: {
          full_name,
          role,
          department,
          employee_id,
        },
      })
    } else {
      authUserId = createdUser.user.id
    }

    const userPayload = {
        email: cleanEmail,
        full_name,
        role,
        department,
        employee_id,
        account_status: 'active',
        status: 'approved',
        approval_status: 'approved',
        is_approved: true,
        must_change_password: true,
        updated_at: new Date().toISOString(),
      }

    const { data: existingPublicUser, error: existingPublicUserError } =
      await supabaseAdmin
        .from('users')
        .select('id, email')
        .ilike('email', cleanEmail)
        .limit(1)
        .maybeSingle()

    if (existingPublicUserError) {
      return new Response(
        JSON.stringify({ error: existingPublicUserError.message }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      )
    }

    if (existingPublicUser) {
      const { error: updatePublicUserError } = await supabaseAdmin
        .from('users')
        .update(userPayload)
        .eq('id', existingPublicUser.id)

      if (updatePublicUserError) {
        return new Response(
          JSON.stringify({ error: updatePublicUserError.message }),
          {
            status: 400,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        )
      }
    } else {
      const { error: insertPublicUserError } = await supabaseAdmin
        .from('users')
        .insert({
          id: authUserId,
          ...userPayload,
        })

      if (insertPublicUserError) {
        return new Response(
          JSON.stringify({ error: insertPublicUserError.message }),
          {
            status: 400,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        )
      }
    }

    const profilePayload: Record<string, unknown> = {
      user_email: cleanEmail,
      account_status: 'active',
      updated_at: new Date().toISOString(),
    }

    if (employee_id !== undefined) profilePayload.employee_id = employee_id || null
    if (department !== undefined) profilePayload.department = department || null
    if (role !== undefined) profilePayload.role = role || null

    const { data: existingProfile, error: existingProfileError } =
      await supabaseAdmin
        .from('user_profiles')
        .select('id')
        .ilike('user_email', cleanEmail)
        .limit(1)
        .maybeSingle()

    if (existingProfileError) {
      console.warn('user_profiles lookup warning:', existingProfileError.message)
    } else if (existingProfile) {
      const { error: profileUpdateError } = await supabaseAdmin
        .from('user_profiles')
        .update(profilePayload)
        .eq('id', existingProfile.id)

      if (profileUpdateError) {
        console.warn('user_profiles update warning:', profileUpdateError.message)
      }
    } else {
      const { error: profileInsertError } = await supabaseAdmin
        .from('user_profiles')
        .insert({
          ...profilePayload,
          created_at: new Date().toISOString(),
        })

      if (profileInsertError) {
        console.warn('user_profiles insert warning:', profileInsertError.message)
      }
    }

    const employeePayload: Record<string, unknown> = {
      user_account_email: cleanEmail,
      updated_at: new Date().toISOString(),
    }

    if (role !== undefined) employeePayload.access_role = role || null
    if (department !== undefined) employeePayload.department = department || null

    const { error: employeeSyncError } = await supabaseAdmin
      .from('employees')
      .update(employeePayload)
      .or(`email_address.ilike.${cleanEmail},user_account_email.ilike.${cleanEmail}`)

    if (employeeSyncError) {
      console.warn('employees sync warning:', employeeSyncError.message)
    }

    // SEND CREATE PASSWORD EMAIL
    const { data: linkData, error: linkError } =
  await supabaseAdmin.auth.admin.generateLink({
    type: 'invite',
    email: cleanEmail,
    options: {
      redirectTo:
        'https://portal.arktechnologiesgroup.com/#/create-password',
    },
  })

if (linkError) {
  return new Response(
    JSON.stringify({ error: linkError.message }),
    {
      status: 400,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    }
  )
}

    return new Response(
  JSON.stringify({
    success: true,
    user_id: authUserId,
    email: cleanEmail,
    action_link: linkData?.properties?.action_link,
  }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: err.message,
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    )
  }
})
