import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

    const cleanEmail = email.trim().toLowerCase()

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

    await supabaseAdmin.from('users').upsert(
      {
        id: authUserId,
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
      },
      {
        onConflict: 'email',
      }
    )

    return new Response(
      JSON.stringify({
        success: true,
        user_id: authUserId,
        email: cleanEmail,
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