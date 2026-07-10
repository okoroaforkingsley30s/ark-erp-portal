import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Ticket,
  MapPin,
  Package,
  MessageCircle,
  User,
  Briefcase,
  Users2,
  ShoppingCart,
  ClipboardList,
  BarChart3,
} from 'lucide-react';
import {
  canUserAccess,
  getUserRole,
  ROUTE_PERMISSIONS,
} from '@/lib/roleAccess';

const TABS_BY_ROLE = {
  engineer: [
    { label: 'Home', icon: LayoutDashboard, path: '/dashboard' },
    { label: 'My Jobs', icon: Briefcase, path: '/tickets' },
    { label: 'Map', icon: MapPin, path: '/live-map' },
    { label: 'Parts', icon: Package, path: '/spare-parts' },
    { label: 'Chat', icon: MessageCircle, path: '/ark-connect' },
    { label: 'Profile', icon: User, path: '/settings' },
  ],

  helpdesk: [
    { label: 'Home', icon: LayoutDashboard, path: '/dashboard' },
    { label: 'Tickets', icon: Ticket, path: '/tickets' },
    { label: 'Engineers', icon: Users2, path: '/engineers' },
    { label: 'Chat', icon: MessageCircle, path: '/ark-connect' },
    { label: 'Profile', icon: User, path: '/settings' },
  ],

  inventory: [
    { label: 'Home', icon: LayoutDashboard, path: '/dashboard' },
    { label: 'Requests', icon: ClipboardList, path: '/spare-parts' },
    { label: 'Stock', icon: ShoppingCart, path: '/spare-parts' },
    { label: 'Chat', icon: MessageCircle, path: '/ark-connect' },
    { label: 'Profile', icon: User, path: '/settings' },
  ],

  default: [
    { label: 'Home', icon: LayoutDashboard, path: '/dashboard' },
    { label: 'Tickets', icon: Ticket, path: '/tickets' },
    { label: 'Map', icon: MapPin, path: '/live-map' },
    { label: 'Reports', icon: BarChart3, path: '/reports' },
    { label: 'Chat', icon: MessageCircle, path: '/ark-connect' },
    { label: 'Profile', icon: User, path: '/settings' },
  ],
};

export default function MobileBottomNav({
  user,
  notifCount = 0,
  dmCount = 0,
}) {
  const location = useLocation();
  const rawRole = getUserRole(user);
  const role = ['system_admin', 'admin', 'admin_head', 'ceo', 'agm', 'manager'].includes(rawRole)
    ? 'default'
    : rawRole;

  const tabs = (TABS_BY_ROLE[role] || TABS_BY_ROLE.default).filter((tab) => {
    const basePath = tab.path.split('?')[0];
    const permission = ROUTE_PERMISSIONS[basePath];

    return !permission || canUserAccess(user, permission);
  });

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-[#ff5a00]/20 bg-gradient-to-r from-[#08153d] via-[#0b1f5e] to-[#102969] shadow-[0_-10px_30px_rgba(0,0,0,0.35)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-center justify-around px-1 py-2">
        {tabs.map((tab) => {
          const isActive =
            location.pathname === tab.path ||
            location.pathname.startsWith(`${tab.path}/`);

          const showBadge =
            (tab.path === '/ark-connect' && dmCount > 0) ||
            (tab.path === '/dashboard' && notifCount > 0);

          const badgeCount =
            tab.path === '/ark-connect' ? dmCount : notifCount;

          return (
            <Link
              key={tab.label + tab.path}
              to={tab.path}
              className="flex flex-col items-center gap-0.5 min-w-[48px] relative py-1 group"
            >
              {isActive && (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[#ff5a00] shadow-[0_0_12px_rgba(255,90,0,0.8)]" />
              )}

              <div
                className={cn(
                  'relative w-10 h-10 flex items-center justify-center rounded-2xl transition-all duration-300 border',
                  isActive
                    ? 'bg-[#ff5a00]/15 border-[#ff5a00]/30 shadow-[0_0_20px_rgba(255,90,0,0.22)]'
                    : 'bg-transparent border-transparent group-active:bg-white/5'
                )}
              >
                <tab.icon
                  className={cn(
                    'w-5 h-5 transition-all duration-300',
                    isActive ? 'text-[#ff5a00]' : 'text-slate-400'
                  )}
                />

                {showBadge && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
                    {badgeCount > 9 ? '9+' : badgeCount}
                  </span>
                )}
              </div>

              <span
                className={cn(
                  'text-[9px] font-semibold leading-none tracking-wide transition-colors',
                  isActive ? 'text-[#ff5a00]' : 'text-slate-400'
                )}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
