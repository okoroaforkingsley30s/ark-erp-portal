import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';

import Sidebar from './Sidebar';
import MobileBottomNav from './MobileBottomNav';
import PendingApproval from '@/components/auth/PendingApproval';
import MobileHomeScreen from '@/components/mobile/MobileHomeScreen';
import FieldEngineerMobileApp from '@/components/mobile/FieldEngineerMobileApp';

import { useAuth } from '@/lib/AuthContext';
import useDMNotifications from '@/hooks/useDMNotifications';
import useInactivityLogout from '@/hooks/useInactivityLogout';

import { supabase } from '@/lib/supabaseClient';

export default function AppLayout() {
  const { user, isLoadingAuth, isAuthenticated } = useAuth();

  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 768;
  });

  const [notifications, setNotifications] = useState([]);

  const previousNotifCountRef = useRef(0);
  const globalRefreshTimerRef = useRef(null);

  const { dmUnreadCount, resetDMCount } = useDMNotifications(user);

  useInactivityLogout(!!user);

  const playNotificationSound = useCallback((sound = 'bell') => {
    try {
      const audio = new Audio(
        sound === 'click' ? '/sounds/click.mp3' : '/sounds/bell.mp3'
      );

      audio.volume = 0.65;
      audio.play().catch((err) => {
        console.warn('Notification sound blocked:', err);
      });
    } catch (err) {
      console.error('Notification sound error:', err);
    }
  }, []);

  const fetchUnreadNotifications = useCallback(async () => {
    if (!user?.email) {
      setNotifications([]);
      return;
    }

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_email', user.email)
      .eq('read', false)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Notifications fetch error:', error);
      return;
    }

    setNotifications(data || []);
  }, [user?.email]);

  const triggerGlobalRefresh = useCallback(() => {
    if (globalRefreshTimerRef.current) {
      clearTimeout(globalRefreshTimerRef.current);
    }

    globalRefreshTimerRef.current = setTimeout(() => {
      queryClient.invalidateQueries();
      fetchUnreadNotifications();
    }, 500);
  }, [queryClient, fetchUnreadNotifications]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    const reason = sessionStorage.getItem('ark_logout_reason');

    if (reason === 'inactivity') {
      sessionStorage.removeItem('ark_logout_reason');
    }
  }, []);

  useEffect(() => {
    if (
      user?.must_change_password &&
      !location.pathname.includes('/change-password') &&
      !location.pathname.includes('/create-password')
    ) {
      navigate('/change-password');
    }
  }, [user, location.pathname, navigate]);

  useEffect(() => {
    if (location.pathname.includes('/ark-connect')) {
      resetDMCount();
    }
  }, [location.pathname, resetDMCount]);

  useEffect(() => {
    if (!isLoadingAuth && !isAuthenticated && location.pathname !== '/welcome') {
      navigate('/welcome', { replace: true });
    }
  }, [isLoadingAuth, isAuthenticated, location.pathname, navigate]);

  useEffect(() => {
    fetchUnreadNotifications();

    const interval = setInterval(fetchUnreadNotifications, 5000);

    return () => clearInterval(interval);
  }, [fetchUnreadNotifications]);

  useEffect(() => {
    if (!user?.email) return;

    const channel = supabase
      .channel(`notifications-${user.email}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_email=eq.${user.email}`,
        },
        (payload) => {
          fetchUnreadNotifications();
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
          playNotificationSound(payload?.new?.sound || 'bell');
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_email=eq.${user.email}`,
        },
        () => {
          fetchUnreadNotifications();
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
        }
      )
      .subscribe((status) => {
        console.log('Notification realtime status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.email, fetchUnreadNotifications, playNotificationSound, queryClient]);

  useEffect(() => {
    if (!user?.email) return;

    const realtimeTables = [
      'tickets',
      'chat_messages',
      'notifications',
      'engineer_statuses',
      'engineers',
      'devices',
      'bank_devices',
      'branches',
      'banks',
      'part_requests',
      'spare_part_requests',
      'spare_parts',
      'inventory_movements',
      'purchase_requests',
      'workflow_requests',
      'workflows',
      'repair_jobs',
      'site_visits',
      'email_messages',
      'expenses',
      'invoices',
      'lpos',
      'hr_attendance',
      'hr_leave',
      'hr_loans',
      'hr_performance',
      'hr_training',
      'audit_logs',
    ];

    const channel = supabase.channel(`ark-global-refresh-${user.email}`);

    realtimeTables.forEach((table) => {
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
        },
        () => {
          triggerGlobalRefresh();
        }
      );
    });

    channel.subscribe((status) => {
      console.log('ARK global realtime status:', status);
    });

    return () => {
      supabase.removeChannel(channel);

      if (globalRefreshTimerRef.current) {
        clearTimeout(globalRefreshTimerRef.current);
      }
    };
  }, [user?.email, triggerGlobalRefresh]);

  useEffect(() => {
    const refreshOnFocus = () => {
      triggerGlobalRefresh();
    };

    const refreshOnVisible = () => {
      if (document.visibilityState === 'visible') {
        triggerGlobalRefresh();
      }
    };

    window.addEventListener('focus', refreshOnFocus);
    document.addEventListener('visibilitychange', refreshOnVisible);

    return () => {
      window.removeEventListener('focus', refreshOnFocus);
      document.removeEventListener('visibilitychange', refreshOnVisible);
    };
  }, [triggerGlobalRefresh]);

  const notifCount = notifications?.length || 0;

  useEffect(() => {
    if (!user?.email) return;

    if (previousNotifCountRef.current === 0) {
      previousNotifCountRef.current = notifCount;
      return;
    }

    if (notifCount > previousNotifCountRef.current) {
      playNotificationSound('bell');
    }

    previousNotifCountRef.current = notifCount;
  }, [notifCount, user?.email, playNotificationSound]);

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-[#08153d] via-[#0b1f5e] to-[#102969]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-[#ff5a00]/20 border-t-[#ff5a00] animate-spin" />
          <p className="text-sm text-slate-200 font-medium">
            Loading ARK ONE Portal...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (!user?.role) {
    return <PendingApproval user={user} />;
  }

  const role = user?.role?.toLowerCase?.() || '';

  const isEngineerMobile =
    isMobile &&
    (
      role === 'engineer' ||
      role === 'field engineer'
    );

  if (isEngineerMobile) {
    return (
      <FieldEngineerMobileApp
        user={user}
        notifCount={notifCount}
        dmCount={dmUnreadCount}
      />
    );
  }

  const isMobileHome =
    isMobile &&
    (location.pathname === '/' || location.pathname === '/dashboard');

  return (
    <div className="flex h-screen overflow-hidden bg-gradient-to-br from-[#08153d] via-[#0b1f5e] to-[#102969] text-white">
      <div className="hidden md:block flex-shrink-0">
        <Sidebar
          user={user}
          unreadCount={notifCount}
          dmUnreadCount={dmUnreadCount}
        />
      </div>

      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="min-h-screen bg-gradient-to-br from-[#08153d] via-[#0b1f5e] to-[#102969]">
          {isMobileHome ? (
            <MobileHomeScreen
              user={user}
              notifCount={notifCount}
              dmCount={dmUnreadCount}
            />
          ) : (
            <div className="p-4 lg:p-6 pt-4 md:pt-16 lg:pt-6 pb-28 md:pb-24 lg:pb-6 max-w-[1600px] mx-auto">
              <Outlet context={{ user }} />
            </div>
          )}
        </div>
      </main>

      <MobileBottomNav
        user={user}
        notifCount={notifCount}
        dmCount={dmUnreadCount}
      />
    </div>
  );
}
