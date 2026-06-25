import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

function jsonResponse(payload: unknown, status = 200) {
  return Response.json(payload, { status, headers: corsHeaders });
}

function decodeBase64Url(data = "") {
  try {
    const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "="
    );

    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));

    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return "";
  }
}

function decodeHtmlEntities(value = "") {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) =>
      String.fromCharCode(Number(code))
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCharCode(parseInt(code, 16))
    );
}

function stripHtml(html = "") {
  return decodeHtmlEntities(
    html
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p\s*>/gi, "\n\n")
      .replace(/<\/div\s*>/gi, "\n")
      .replace(/<\/li\s*>/gi, "\n")
      .replace(/<\/tr\s*>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  );
}

function cleanText(value = "") {
  return String(value)
    .replace(/\r/g, "")
    .replace(/\u200b|\u200c|\ufeff/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function getHeader(headers: any[], name: string) {
  return (
    headers.find(
      (header) => header.name?.toLowerCase() === name.toLowerCase()
    )?.value || ""
  );
}

function parseEmailName(value = "") {
  const match = value.match(/^(.*?)\s*<(.+?)>$/);

  if (match) {
    return match[1].replace(/"/g, "").trim() || null;
  }

  if (value.includes("@")) {
    return null;
  }

  return value.trim() || null;
}

function extractBody(payload: any) {
  const plainParts: string[] = [];
  const htmlParts: string[] = [];

  function walk(part: any) {
    if (!part) return;

    const mimeType = String(part.mimeType || "").toLowerCase();
    const filename = String(part.filename || "");
    const bodyData = part.body?.data || "";

    const isAttachment =
      Boolean(filename) ||
      String(part.headers || "")
        .toLowerCase()
        .includes("attachment");

    if (!isAttachment && bodyData) {
      const decoded = decodeBase64Url(bodyData);

      if (mimeType === "text/plain" || mimeType.startsWith("text/plain;")) {
        if (decoded) plainParts.push(decoded);
      }

      if (mimeType === "text/html" || mimeType.startsWith("text/html;")) {
        if (decoded) htmlParts.push(decoded);
      }
    }

    for (const child of part.parts || []) {
      walk(child);
    }
  }

  walk(payload);

  const plainBody = cleanText(plainParts.join("\n\n"));
  const htmlBody = cleanText(stripHtml(htmlParts.join("\n\n")));

  if (plainBody.length >= 20) {
    return {
      body: plainBody,
      source: "payload_plain",
      plainLength: plainBody.length,
      htmlLength: htmlBody.length,
    };
  }

  if (htmlBody.length > 0) {
    return {
      body: htmlBody,
      source: "payload_html",
      plainLength: plainBody.length,
      htmlLength: htmlBody.length,
    };
  }

  if (plainBody.length > 0) {
    return {
      body: plainBody,
      source: "payload_plain_short",
      plainLength: plainBody.length,
      htmlLength: htmlBody.length,
    };
  }

  return {
    body: "",
    source: "none",
    plainLength: 0,
    htmlLength: 0,
  };
}

function extractAttachments(payload: any): any[] {
  const attachments: any[] = [];

  function walk(part: any) {
    if (!part) return;

    if (part.filename && part.body?.attachmentId) {
      attachments.push({
        filename: part.filename,
        mimeType: part.mimeType,
        attachmentId: part.body.attachmentId,
        size: part.body.size || 0,
      });
    }

    for (const child of part.parts || []) {
      walk(child);
    }
  }

  walk(payload);

  return attachments;
}

async function refreshAccessToken(supabase: any, connection: any) {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    throw new Error("Missing Google OAuth secrets");
  }

  const refreshResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: connection.refresh_token,
      grant_type: "refresh_token",
    }),
  });

  const refreshData = await refreshResponse.json();

  if (!refreshResponse.ok) {
    throw new Error(JSON.stringify(refreshData));
  }

  const accessToken = refreshData.access_token;
  const expiresAt = new Date(
    Date.now() + Number(refreshData.expires_in || 3600) * 1000
  ).toISOString();

  await supabase
    .from("gmail_connections")
    .update({
      access_token: accessToken,
      expires_at: expiresAt,
    })
    .eq("id", connection.id);

  return accessToken;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return jsonResponse(
        { error: "Missing Supabase environment variables" },
        500
      );
    }

    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return jsonResponse({ error: "Missing Authorization header" }, 401);
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
      return jsonResponse({ error: "Invalid ARK ONE session" }, 401);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: connection, error: connectionError } = await supabase
      .from("gmail_connections")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("connected_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (connectionError) {
      return jsonResponse(
        {
          error: "Failed to read Gmail connection",
          details: connectionError,
        },
        500
      );
    }

    if (!connection) {
      return jsonResponse({ error: "No Gmail connected" }, 404);
    }

    let accessToken = connection.access_token;

    const isExpired =
      connection.expires_at &&
      new Date(connection.expires_at).getTime() <= Date.now() + 60000;

    if (isExpired) {
      accessToken = await refreshAccessToken(supabase, connection);
    }

    const listResponse = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=50&q=in:anywhere",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const listData = await listResponse.json();

    if (!listResponse.ok) {
      return jsonResponse(
        {
          error: "Failed to fetch Gmail messages",
          details: listData,
        },
        400
      );
    }

    const messages = listData.messages || [];
    let synced = 0;
    let bodyFromPayloadPlain = 0;
    let bodyFromPayloadHtml = 0;
    let bodyFromSnippet = 0;
    const debugSamples: any[] = [];

    for (const message of messages) {
      const messageResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}?format=full`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const messageData = await messageResponse.json();

      if (!messageResponse.ok) {
        continue;
      }

      const headers = messageData.payload?.headers || [];
      const extracted = extractBody(messageData.payload);

      const fallbackSnippet = cleanText(messageData.snippet || "");
      const bodyToSave = extracted.body || fallbackSnippet || "";

      if (extracted.source === "payload_plain") {
        bodyFromPayloadPlain++;
      } else if (extracted.source === "payload_html") {
        bodyFromPayloadHtml++;
      } else if (!extracted.body && fallbackSnippet) {
        bodyFromSnippet++;
      }

      const subject = getHeader(headers, "Subject") || "(No Subject)";
      const from = getHeader(headers, "From");
      const to = getHeader(headers, "To");
      const cc = getHeader(headers, "Cc");
      const bcc = getHeader(headers, "Bcc");
      const date = getHeader(headers, "Date");

      const labelIds = messageData.labelIds || [];
      const isUnread = labelIds.includes("UNREAD");
      const isSent = labelIds.includes("SENT");
      const isDraft = labelIds.includes("DRAFT");
      const isArchived = !labelIds.includes("INBOX") && !isSent && !isDraft;

      const { error: saveError } = await supabase
        .from("email_messages")
        .upsert(
          {
            gmail_message_id: messageData.id,
            gmail_thread_id: messageData.threadId,
            gmail_history_id: messageData.historyId
              ? String(messageData.historyId)
              : null,

            sender_email: from,
            sender_name: parseEmailName(from),
            recipient_email: to,
            recipient_name: parseEmailName(to),

            cc,
            bcc,
            subject,
            snippet: messageData.snippet || "",
            message_body: bodyToSave,

            raw_headers: headers,
            attachments: extractAttachments(messageData.payload),

            received_at: date
              ? new Date(date).toISOString()
              : new Date().toISOString(),

            direction: isSent ? "sent" : "inbox",
            email_status: isSent ? "Sent" : "New",
            is_read: !isUnread,
            is_sent: isSent,
            is_draft: isDraft,
            archived_status: isArchived,
            folder: isSent
              ? "sent"
              : isDraft
                ? "drafts"
                : isArchived
                  ? "archived"
                  : "inbox",
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
            error: "Failed to save email",
            details: saveError,
          },
          500
        );
      }

      if (debugSamples.length < 5) {
        debugSamples.push({
          subject,
          gmailMessageId: messageData.id,
          bodySource: extracted.body ? extracted.source : "snippet",
          bodyLength: bodyToSave.length,
          plainLength: extracted.plainLength,
          htmlLength: extracted.htmlLength,
          snippetLength: fallbackSnippet.length,
        });
      }

      synced++;
    }

    return jsonResponse({
      message: "Gmail sync completed",
      synced,
      total: messages.length,
      mailbox: connection.email,
      bodyFromPayloadPlain,
      bodyFromPayloadHtml,
      bodyFromSnippet,
      debugSamples,
    });
  } catch (error) {
    return jsonResponse(
      {
        error: "Unexpected gmail-sync failure",
        details: String(error),
      },
      500
    );
  }
});