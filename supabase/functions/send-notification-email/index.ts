import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

serve(async (req) => {
  try {
    const { to, name, title, message, link } = await req.json();

    if (!to || !title || !message) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "ARK ONE <noreply@arktechnologiesgroup.com>";

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to,
        subject: `ARK ONE Notification: ${title}`,
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6;">
            <h2>ARK ONE Notification</h2>
            <p>Hello ${name || "User"},</p>
            <p><strong>${title}</strong></p>
            <p>${message}</p>
            ${
              link
                ? `<p><a href="${link}" style="background:#0f172a;color:white;padding:10px 16px;text-decoration:none;border-radius:6px;">Open Ark One</a></p>`
                : ""
            }
            <p>Thank you,<br/>ARK ONE ERP</p>
          </div>
        `,
      }),
    });

    const result = await emailRes.json();

    return new Response(JSON.stringify(result), {
      status: emailRes.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});