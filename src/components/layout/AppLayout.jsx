import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import Sidebar from './Sidebar';
import MobileBottomNav from './MobileBottomNav';
import PendingApproval from '@/components/auth/PendingApproval';
import MobileHomeScreen from '@/components/mobile/MobileHomeScreen';

import useCurrentUser from '@/hooks/useCurrentUser';
import useDMNotifications from '@/hooks/useDMNotifications';
import useInactivityLogout from '@/hooks/useInactivityLogout';

import { supabase } from '@/lib/supabaseClient';

export default function AppLayout() {
  const { user, loading } = useCurrentUser();
  const location = useLocation();
  const navigate = useNavigate();

  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);

  const { dmUnreadCount, resetDMCount } = useDMNotifications(user);

  useInactivityLogout(!!user);

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
      !window.location.pathname.includes('/change-password')
    ) {
      navigate('/change-password');
    }
  }, [user, navigate]);

  useEffect(() => {
    if (window.location.pathname.includes('/ark-connect')) {
      resetDMCount();
    }
  }, [location.pathname, resetDMCount]);

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', 'unread', user?.email],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_email', user.email)
        .eq('read', false)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Notifications fetch error:', error);
        return [];
      }

      return data || [];
    },
    enabled: !!user?.email,
    initialData: [],
  });

  useEffect(() => {
    if (!loading && !user) {
      navigate('/welcome', { replace: true });
    }
  }, [loading, user, navigate]);

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">
            Loading ARK ONE Portal...
          </p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  if (!user.role) {
    return <PendingApproval user={user} />;
  }

  const isMobileHome = isMobile && location.pathname === '/';
  const notifCount = notifications?.length || 0;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <div className="hidden md:block flex-shrink-0">
        <Sidebar
          user={user}
          unreadCount={notifCount}
          dmUnreadCount={dmUnreadCount}
        />
      </div>

      <main className="flex-1 overflow-y-auto overflow-x-hidden">
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
      </main>

      <MobileBottomNav
        user={user}
        notifCount={notifCount}
        dmCount={dmUnreadCount}
      />
    </div>
  );
}