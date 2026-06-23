import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

function jsonResponse(payload: unknown, status = 200) {
  return Response.json(payload, {
    status,
    headers: corsHeaders,
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return jsonResponse(
        {
          error: "Missing Supabase environment variables",
          hasSupabaseUrl: !!supabaseUrl,
          hasAnonKey: !!anonKey,
          hasServiceRoleKey: !!serviceRoleKey,
        },
        500
      );
    }

    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return jsonResponse(
        {
          error: "Missing Authorization header",
          message: "ARK ONE session token was not sent to gmail-sync.",
        },
        401
      );
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return jsonResponse(
        {
          error: "Invalid ARK ONE session",
          details: userError,
        },
        401
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: connection, error: connError } = await supabase
      .from("gmail_connections")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("connected_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (connError) {
      return jsonResponse(
        {
          error: "Failed to read Gmail connection",
          details: connError,
          user_id: user.id,
          user_email: user.email,
        },
        500
      );
    }

    if (!connection) {
      return jsonResponse(
        {
          error: "No Gmail connected for this ARK ONE user",
          user_id: user.id,
          user_email: user.email,
        },
        404
      );
    }

    let accessToken = connection.access_token;

    const tokenExpired =
      connection.expires_at && new Date(connection.expires_at).getTime() <= Date.now() + 60_000;

    if (tokenExpired) {
      if (!connection.refresh_token) {
        return jsonResponse(
          {
            error: "Gmail access token expired and no refresh token was saved",
            mailbox: connection.email,
          },
          401
        );
      }

      const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
      const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");

      if (!clientId || !clientSecret) {
        return jsonResponse(
          {
            error: "Missing Google OAuth secrets for token refresh",
          },
          500
        );
      }

      const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: connection.refresh_token,
          grant_type: "refresh_token",
        }),
      });

      const refreshData = await refreshRes.json();

      if (!refreshRes.ok) {
        return jsonResponse(
          {
            error: "Failed to refresh Gmail access token",
            details: refreshData,
            mailbox: connection.email,
          },
          401
        );
      }

      accessToken = refreshData.access_token;

      const refreshedExpiresAt = new Date(
        Date.now() + Number(refreshData.expires_in || 3600) * 1000
      ).toISOString();

      await supabase
        .from("gmail_connections")
        .update({
          access_token: accessToken,
          expires_at: refreshedExpiresAt,
        })
        .eq("id", connection.id);
    }

    const listRes = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20&q=in:inbox",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const listData = await listRes.json();

    if (!listRes.ok) {
      return jsonResponse(
        {
          error: "Failed to fetch Gmail messages",
          details: listData,
          mailbox: connection.email,
        },
        400
      );
    }

    const messages = listData.messages || [];
    let synced = 0;

    for (const msg of messages) {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const msgData = await msgRes.json();

      if (!msgRes.ok) {
        continue;
      }

      const headers = msgData.payload?.headers || [];

      const getHeader = (name: string) =>
        headers.find((h: any) => h.name?.toLowerCase() === name.toLowerCase())?.value || "";

      const subject = getHeader("Subject") || "(No Subject)";
      const from = getHeader("From");
      const to = getHeader("To");
      const cc = getHeader("Cc");
      const date = getHeader("Date");

      const isUnread = (msgData.labelIds || []).includes("UNREAD");
      const isSent = (msgData.labelIds || []).includes("SENT");
      const isDraft = (msgData.labelIds || []).includes("DRAFT");

      const { error: saveError } = await supabase.from("email_messages").upsert(
        {
          gmail_message_id: msgData.id,
          gmail_thread_id: msgData.threadId,
          sender_email: from,
          recipient_email: to,
          cc,
          subject,
          snippet: msgData.snippet || "",
          message_body: msgData.snippet || "",
          received_at: date ? new Date(date).toISOString() : new Date().toISOString(),
          direction: isSent ? "sent" : "inbox",
          email_status: "received",
          is_read: !isUnread,
          is_sent: isSent,
          is_draft: isDraft,
          archived_status: false,
          folder: isSent ? "sent" : "inbox",
          synced_at: new Date().toISOString(),
          created_by: user.id,
        },
        {
          onConflict: "gmail_message_id",
        }
      );

      if (saveError) {
        return jsonResponse(
          {
            error: "Failed to save email to Supabase",
            details: saveError,
            sample: {
              gmail_message_id: msgData.id,
              subject,
              from,
              to,
              created_by: user.id,
            },
          },
          500
        );
      }

      synced++;
    }

    return jsonResponse({
      message: "Gmail sync completed",
      synced,
      total: messages.length,
      user_id: user.id,
      mailbox: connection.email,
    });
  } catch (err) {
    return jsonResponse(
      {
        error: "Unexpected gmail-sync failure",
        details: String(err),
      },
      500
    );
  }
});