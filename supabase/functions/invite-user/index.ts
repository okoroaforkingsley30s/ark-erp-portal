import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  // HANDLE CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
    })
  }

  try {
    const { email, full_name, role, department } = await req.json()

    if (!email) {
      return new Response(
        JSON.stringify({
          error: 'Email is required',
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      )
    }

    // ADMIN CLIENT
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // CREATE AUTH USER + SEND INVITATION EMAIL
    const { data, error } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: {
          full_name,
          role,
        },

        // LOCAL TESTING URL
        redirectTo: 'http://localhost:3000/change-password',
      })

    if (error) {
      return new Response(
        JSON.stringify({
          error: error.message,
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      )
    }

    // CREATE ERP USER PROFILE
    await supabaseAdmin.from('users').upsert({
      id: data.user.id,
      email,
      full_name,
      role,
      department,

      account_status: 'active',
      is_approved: true,
      must_change_password: true,

      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

    return new Response(
      JSON.stringify({
        success: true,
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