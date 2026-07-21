import { notifyUser } from '@/lib/notificationService';

export async function createNotification({
  userEmail,
  title,
  message,
  type = 'system',
  link = '/notifications',
  sound = 'bell',
  data = {},
  sendEmail = true,
}) {
  if (!userEmail) return null;

  const result = await notifyUser({
    email: userEmail,
    title,
    message,
    type,
    link,
    sound,
    data,
    sendEmail,
  });

  if (!result.success) {
    console.error('Create notification failed:', result.error);
    return null;
  }

  if (sendEmail && result.email?.success === false) {
    console.warn('Notification was created, but its email was not delivered.', result.email.error);
  }

  return result.notification;
}
