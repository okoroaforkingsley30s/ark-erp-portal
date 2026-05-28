import { supabase } from '@/lib/supabaseClient';

export async function createNotification({
  userEmail,
  title,
  message,
  type = 'system',
  link = '/notifications',
  sound = 'bell',
  data = {},
}) {
  if (!userEmail) return;

  const { error } = await supabase.from('notifications').insert({
    user_email: userEmail,
    recipient_email: userEmail,

    title,
    message,
    type,

    link,
    sound,

    read: false,
    is_read: false,

    data,
    created_at: new Date().toISOString(),
  });

  if (error) {
    console.error('Create notification failed:', error);
  }
}