import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import Sidebar from './Sidebar';
import MobileBottomNav from './MobileBottomNav';
import PendingApproval from '@/components/auth/PendingApproval';
import MobileHomeScreen from '@/components/mobile/MobileHomeScreen';

import { useAuth } from '@/lib/AuthContext';
import useDMNotifications from '@/hooks/useDMNotifications';
import useInactivityLogout from '@/hooks/useInactivityLogout';

import { supabase } from '@/lib/supabaseClient';

export default function AppLayout() {
  const { user, isLoadingAuth, isAuthenticated } = useAuth();
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
      !location.pathname.includes('/change-password')
    ) {
      navigate('/change-password');
    }
  }, [user, location.pathname, navigate]);

  useEffect(() => {
    if (location.pathname.includes('/ark-connect')) {
      resetDMCount();
    }
  }, [location.pathname, resetDMCount]);

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', 'unread', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];

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
    if (!isLoadingAuth && !isAuthenticated) {
      navigate('/welcome', { replace: true });
    }
  }, [isLoadingAuth, isAuthenticated, navigate]);

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

  if (!isAuthenticated || !user) return null;

  if (!user.role) {
    return <PendingApproval user={user} />;
  }

  const isMobileHome =
    isMobile &&
    (location.pathname === '/' || location.pathname === '/dashboard');

  const notifCount = notifications?.length || 0;

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