import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (_req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json({ error: "Missing Supabase env" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: connection, error: connError } = await supabase
    .from("gmail_connections")
    .select("*")
    .eq("is_active", true)
    .order("connected_at", { ascending: false })
    .limit(1)
    .single();

  if (connError || !connection) {
    return Response.json({ error: "No active Gmail connection" }, { status: 404 });
  }

  const listRes = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10&q=in:inbox",
    {
      headers: {
        Authorization: `Bearer ${connection.access_token}`,
      },
    }
  );

  const listData = await listRes.json();

  if (!listRes.ok) {
    return Response.json(
      { error: "Failed to fetch Gmail messages", details: listData },
      { status: 400 }
    );
  }

  const messages = listData.messages || [];
  let synced = 0;

  for (const msg of messages) {
    const msgRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
      {
        headers: {
          Authorization: `Bearer ${connection.access_token}`,
        },
      }
    );

    const msgData = await msgRes.json();

    if (!msgRes.ok) continue;

    const headers = msgData.payload?.headers || [];

    const getHeader = (name: string) =>
      headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || "";

    const subject = getHeader("Subject");
    const from = getHeader("From");
    const to = getHeader("To");
    const date = getHeader("Date");

    const { error } = await supabase.from("email_messages").upsert(
      {
        gmail_message_id: msgData.id,
        gmail_thread_id: msgData.threadId,
        sender_email: from,
        recipient_email: to,
        subject,
        snippet: msgData.snippet || "",
        message_body: msgData.snippet || "",
        received_at: date ? new Date(date).toISOString() : new Date().toISOString(),
        direction: "inbox",
        email_status: "received",
        is_read: !(msgData.labelIds || []).includes("UNREAD"),
        is_sent: false,
        is_draft: false,
        archived_status: false,
        folder: "inbox",
        synced_at: new Date().toISOString(),
      },
      {
        onConflict: "gmail_message_id",
      }
    );

    if (error) {
  return Response.json(
    {
      error: "Failed to save email to Supabase",
      details: error,
      sample: {
        gmail_message_id: msgData.id,
        subject,
        from,
        to,
      },
    },
    { status: 500 }
  );
}

synced++;
  }

  return Response.json({
    message: "Gmail sync completed",
    synced,
    total: messages.length,
  });
});