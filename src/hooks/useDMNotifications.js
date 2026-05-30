import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function useDMNotifications(user) {
  const [dmUnreadCount, setDmUnreadCount] = useState(0);

  const fetchDMUnreadCount = useCallback(async () => {
    if (!user?.email) {
      setDmUnreadCount(0);
      return;
    }

    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_email', user.email)
      .eq('read', false)
      .in('type', [
        'ark_connect',
        'ark_connect_dm',
        'ark_connect_channel',
      ]);

    if (error) {
      console.error('ARK Connect unread count error:', error);
      setDmUnreadCount(0);
      return;
    }

    setDmUnreadCount(count || 0);
  }, [user?.email]);

  const resetDMCount = useCallback(async () => {
    if (!user?.email) {
      setDmUnreadCount(0);
      return;
    }

    const { error } = await supabase
      .from('notifications')
      .update({
        read: true,
      })
      .eq('user_email', user.email)
      .eq('read', false)
      .in('type', [
        'ark_connect',
        'ark_connect_dm',
        'ark_connect_channel',
      ]);

    if (error) {
      console.error('Reset ARK Connect count error:', error);
      return;
    }

    setDmUnreadCount(0);
  }, [user?.email]);

  useEffect(() => {
    fetchDMUnreadCount();

    const interval = setInterval(fetchDMUnreadCount, 5000);

    return () => clearInterval(interval);
  }, [fetchDMUnreadCount]);

  useEffect(() => {
    if (!user?.email) return;

    const channel = supabase
      .channel(`ark-connect-notifications-${user.email}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_email=eq.${user.email}`,
        },
        () => {
          fetchDMUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.email, fetchDMUnreadCount]);

  return {
    dmUnreadCount,
    resetDMCount,
  };
}