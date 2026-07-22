import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  encodeMimeHeader,
  googleApiError,
  htmlMailDocument,
  parseEmailList,
  requireEnv,
  safeMailHeader,
} from "../_shared/security.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(payload: unknown, status = 200) {
  return Response.json(payload, { status, headers: corsHeaders });
}

function base64Url(input: string) {
  return btoa(unescape(encodeURIComponent(input)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function makeReply({ to, cc, subject, body, from, inReplyTo }: any) {
  const messageId = `<${crypto.randomUUID()}@arkone.arktechnologiesgroup.com>`;
  const lines = [
    `From: ${from}`,
    `Reply-To: ${from}`,
    `To: ${to}`,
    cc ? `Cc: ${cc}` : "",
    `Subject: ${encodeMimeHeader(subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: ${messageId}`,
    inReplyTo ? `In-Reply-To: ${inReplyTo}` : "",
    inReplyTo ? `References: ${inReplyTo}` : "",
    "MIME-Version: 1.0",
    `Content-Type: text/html; charset="UTF-8"`,
    "Content-Transfer-Encoding: 8bit",
    "",
    htmlMailDocument(body),
  ].filter(Boolean);

  return { raw: base64Url(lines.join("\r\n")), messageId };
}

async function verifyMailbox(accessToken: string, expectedEmail: string) {
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const profile = await response.json();
  if (!response.ok) throw new Error(googleApiError(profile, "Unable to verify connected Gmail account"));
  if (String(profile.emailAddress || "").trim().toLowerCase() !== expectedEmail.trim().toLowerCase()) {
    throw new Error("Connected Gmail identity does not match the ARK ONE sender. Reconnect Gmail.");
  }
}

async function verifySentMessage(accessToken: string, messageId: string) {
  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}?format=minimal`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const message = await response.json();
  if (!response.ok || !Array.isArray(message.labelIds) || !message.labelIds.includes("SENT")) {
    throw new Error(googleApiError(message, "Google did not confirm the reply in Sent Mail"));
  }
}

async function getAccessToken(supabase: any, connection: any) {
  const expired = connection.expires_at && new Date(connection.expires_at).getTime() <= Date.now() + 60000;
  if (!expired) return connection.access_token;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: Deno.env.get("GOOGLE_CLIENT_ID") || "",
      client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET") || "",
      refresh_token: connection.refresh_token,
      grant_type: "refresh_token",
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));

  await supabase
    .from("gmail_connections")
    .update({
      access_token: data.access_token,
      expires_at: new Date(Date.now() + Number(data.expires_in || 3600) * 1000).toISOString(),
    })
    .eq("id", connection.id);

  return data.access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const env = requireEnv([
      "SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY",
      "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET",
    ]);
    const supabaseUrl = env.SUPABASE_URL;
    const anonKey = env.SUPABASE_ANON_KEY;
    const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) return jsonResponse({ error: "Missing Authorization header" }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return jsonResponse({ error: "Invalid session" }, 401);

    const requestBody = await req.json();
    const originalEmailId = String(requestBody.originalEmailId || "").trim();
    const to = parseEmailList(requestBody.to, true);
    const cc = parseEmailList(requestBody.cc);
    const subject = safeMailHeader(requestBody.subject, 300);
    const body = String(requestBody.body || "");
    if (!originalEmailId) return jsonResponse({ error: "Missing reply data" }, 400);
    if (body.length > 1_000_000) return jsonResponse({ error: "Email body is too large" }, 400);

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: original, error: originalError } = await supabase
      .from("email_messages")
      .select("*")
      .eq("id", originalEmailId)
      .eq("created_by", user.id)
      .single();

    if (originalError || !original) return jsonResponse({ error: "Original email not found" }, 404);

    const { data: connection } = await supabase
      .from("gmail_connections")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("connected_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!connection) return jsonResponse({ error: "No Gmail connected" }, 404);
    const connectedEmail = String(connection.email || "").trim().toLowerCase();
    const signedInEmail = String(user.email || "").trim().toLowerCase();
    if (!connectedEmail.endsWith("@arktechnologiesgroup.com") || connectedEmail !== signedInEmail) {
      return jsonResponse({ error: "Reconnect the same approved ARK Technologies email used to sign in." }, 403);
    }

    const accessToken = await getAccessToken(supabase, connection);
    await verifyMailbox(accessToken, connection.email);

    const rawHeaders = original.raw_headers || [];
    const messageIdHeader =
      Array.isArray(rawHeaders)
        ? rawHeaders.find((h: any) => h.name?.toLowerCase() === "message-id")?.value
        : "";

    const encodedReply = makeReply({
      to,
      cc,
      subject,
      body,
      from: connection.email,
      inReplyTo: messageIdHeader,
    });

    const gmailRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        raw: encodedReply.raw,
        threadId: original.gmail_thread_id,
      }),
    });

    const gmailData = await gmailRes.json();
    if (!gmailRes.ok) {
      return jsonResponse({ error: "Gmail reply failed", details: googleApiError(gmailData, "Google rejected the reply") }, 502);
    }
    await verifySentMessage(accessToken, gmailData.id);

    const { data: saved, error: saveError } = await supabase
      .from("email_messages")
      .insert({
        gmail_message_id: gmailData.id,
        gmail_thread_id: gmailData.threadId || original.gmail_thread_id,
        sender_email: connection.email,
        recipient_email: to,
        cc,
        subject,
        message_body: body,
        snippet: body.replace(/<[^>]*>/g, "").slice(0, 200),
        direction: "sent",
        email_status: "Sent",
        is_sent: true,
        is_read: true,
        is_draft: false,
        archived_status: false,
        folder: "sent",
        received_at: new Date().toISOString(),
        synced_at: new Date().toISOString(),
        created_by: user.id,
        raw_headers: [{ name: "Message-ID", value: encodedReply.messageId }],
      })
      .select()
      .single();

    if (saveError) return jsonResponse({ error: "Replied but failed to save" }, 500);

    await supabase
      .from("email_messages")
      .update({ replied_status: true, email_status: "Replied" })
      .eq("id", original.id)
      .eq("created_by", user.id);

    return jsonResponse({
      message: "Reply accepted by Google",
      message_id: saved.id,
      gmail_message_id: gmailData.id,
      gmail_thread_id: gmailData.threadId || original.gmail_thread_id,
      delivery_status: "accepted_by_google",
    });
  } catch (err) {
    return jsonResponse({ error: "Unexpected gmail-reply failure", details: String(err) }, 500);
  }
});
