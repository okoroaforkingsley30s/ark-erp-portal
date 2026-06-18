import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const url = new URL(req.url);

  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  const redirectUri = Deno.env.get("GOOGLE_REDIRECT_URI");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!clientId || !clientSecret || !redirectUri) {
    return new Response("Missing Google OAuth configuration", { status: 500 });
  }

  const code = url.searchParams.get("code");

  if (!code) {
    const scope = [
      "openid",
      "email",
      "profile",
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/gmail.modify",
    ].join(" ");

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");

    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", scope);
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent");

    return Response.redirect(authUrl.toString(), 302);
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  const tokenData = await tokenRes.json();

  if (!tokenRes.ok) {
    return Response.json(
      {
        error: "Failed to exchange code for token",
        details: tokenData,
      },
      { status: 400 }
    );
  }

  const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
    },
  });

  const profile = await profileRes.json();

  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json({
      message: "Gmail connected, but Supabase service role env is missing.",
      email: profile.email,
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

  const { error } = await supabase.from("gmail_connections").upsert(
    {
      email: profile.email,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: expiresAt,
      provider: "google",
      is_active: true,
      connected_at: new Date().toISOString(),
    },
    {
      onConflict: "email",
    }
  );

  if (error) {
    return Response.json(
      {
        error: "Gmail connected but failed to save connection",
        details: error,
      },
      { status: 500 }
    );
  }

  return new Response(
    `
    <html>
      <body style="font-family: Arial; padding: 40px;">
        <h2>Gmail Connected Successfully</h2>
        <p>Email: ${profile.email}</p>
        <p>You can close this tab and return to ARK ONE.</p>
      </body>
    </html>
    `,
    {
      headers: {
        "Content-Type": "text/html",
      },
    }
  );
});