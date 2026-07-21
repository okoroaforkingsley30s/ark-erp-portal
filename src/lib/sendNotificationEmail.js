import { supabase } from "@/lib/supabaseClient";
import { reportError } from '@/lib/errorReporting';

export async function sendNotificationEmail({ to, name, title, message, link }) {
  if (!to || !title || !message) return;

  const { error } = await supabase.functions.invoke("send-notification-email", {
    body: {
      to,
      name,
      title,
      message,
      link: link || window.location.origin,
    },
  });

  if (error) {
    reportError(error, { context: 'notification.email.send_legacy', notify: false });
  }
}
