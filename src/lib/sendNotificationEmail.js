import { supabase } from "@/lib/supabaseClient";

export async function sendNotificationEmail({ to, name, title, message, link }) {
  if (!to || !title || !message) return;

  const { error } = await supabase.functions.invoke("send-notification-email", {
    body: {
      to,
      name,
      title,
      message,
      link: link || "https://portal.arktechnologiesgroup.com",
    },
  });

  if (error) {
    console.error("Email notification failed:", error);
  }
}