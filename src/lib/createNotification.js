import { supabase } from '@/lib/supabaseClient';

export async function createNotification({
  userEmail,
  title,
  message,
  type = 'system',
  link = '/notifications',
  sound = 'bell',
}) {
  if (!userEmail) return null;

  const { data, error } = await supabase
    .from('notifications')
    .insert({
      user_email: userEmail,
      title,
      message,
      type,
      link,
      sound,
      read: false,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('Create notification failed:', error);
    return null;
  }

  return data;
}