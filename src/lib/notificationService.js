import { supabase } from '@/lib/supabaseClient';
import { reportError } from '@/lib/errorReporting';

const DEFAULT_PORTAL_LINK = window.location.origin;

function normalizePortalLink(link) {
  if (!link) return DEFAULT_PORTAL_LINK;

  if (link.startsWith('http://') || link.startsWith('https://')) {
    return link;
  }

  if (link.startsWith('/')) {
    return `${DEFAULT_PORTAL_LINK}/#${link}`;
  }

  return `${DEFAULT_PORTAL_LINK}/#/${link}`;
}

export async function sendNotificationEmail({
  to,
  name,
  title,
  message,
  link,
}) {
  if (!to || !title || !message) return { success: false };

  const { data, error } = await supabase.functions.invoke(
    'send-notification-email',
    {
      body: {
        to,
        name,
        title,
        message,
        link: normalizePortalLink(link),
      },
    }
  );

  if (error) {
    reportError(error, { context: 'notification.email.send', notify: false });
    return { success: false, error };
  }

  return { success: true, data };
}

export async function notifyUser({
  email,
  recipient_email,
  user_email,
  name,
  title,
  message,
  type = 'system',
  link = '/notifications',
  data = {},
  sound = 'bell',
  sendEmail = true,
}) {
  const targetEmail = email || user_email || recipient_email;

  if (!targetEmail || !title || !message) {
    console.warn('notifyUser skipped: missing required fields', {
      targetEmail,
      title,
      message,
    });

    return {
      success: false,
      error: 'Missing targetEmail, title, or message',
    };
  }

  const now = new Date().toISOString();

  const notificationPayload = {
    user_email: targetEmail.trim().toLowerCase(),
    recipient_email: targetEmail.trim().toLowerCase(),
    title,
    message,
    message_body: message,
    type,
    read: false,
    is_read: false,
    data,
    link,
    sound,
    created_at: now,
  };

  const { error: notificationError } = await supabase
    .from('notifications')
    .insert(notificationPayload);

  if (notificationError) {
    reportError(notificationError, { context: 'notification.database.insert', notify: false });

    return {
      success: false,
      error: notificationError,
    };
  }

  let emailResult = null;

  if (sendEmail) {
    emailResult = await sendNotificationEmail({
      to: targetEmail,
      name,
      title,
      message,
      link,
    });
  }

  return {
    success: true,
    notification: notificationPayload,
    email: emailResult,
  };
}

export async function notifyManyUsers({
  recipients = [],
  title,
  message,
  type = 'system',
  link = '/notifications',
  data = {},
  sound = 'bell',
  sendEmail = true,
}) {
  if (!Array.isArray(recipients) || recipients.length === 0) {
    return {
      success: false,
      error: 'No recipients provided',
    };
  }

  const results = [];

  for (const recipient of recipients) {
    const result = await notifyUser({
      email: recipient.email || recipient.user_email || recipient.recipient_email,
      name: recipient.name || recipient.full_name,
      title,
      message,
      type,
      link,
      data,
      sound,
      sendEmail,
    });

    results.push(result);
  }

  return {
    success: true,
    results,
  };
}
