import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Ticket, MapPin, Package, MessageCircle, User,
  Briefcase, Wrench, Users2, ShoppingCart, ClipboardList, BarChart3,
} from 'lucide-react';

const TABS_BY_ROLE = {
  engineer: [
    { label: 'Home',    icon: LayoutDashboard, path: '/' },
    { label: 'My Jobs', icon: Briefcase,       path: '/tickets' },
    { label: 'Map',     icon: MapPin,           path: '/live-map' },
    { label: 'Parts',   icon: Package,          path: '/spare-parts' },
    { label: 'Chat',    icon: MessageCircle,    path: '/ark-connect' },
    { label: 'Profile', icon: User,             path: '/settings' },
  ],
  helpdesk: [
    { label: 'Home',      icon: LayoutDashboard, path: '/' },
    { label: 'Tickets',   icon: Ticket,          path: '/tickets' },
    { label: 'Engineers', icon: Users2,           path: '/engineers' },
    { label: 'Chat',      icon: MessageCircle,   path: '/ark-connect' },
    { label: 'Profile',   icon: User,            path: '/settings' },
  ],
  inventory: [
    { label: 'Home',     icon: LayoutDashboard, path: '/' },
    { label: 'Requests', icon: ClipboardList,   path: '/spare-parts' },
    { label: 'Stock',    icon: ShoppingCart,    path: '/spare-parts' },
    { label: 'Chat',     icon: MessageCircle,   path: '/ark-connect' },
    { label: 'Profile',  icon: User,            path: '/settings' },
  ],
  default: [
    { label: 'Home',    icon: LayoutDashboard, path: '/' },
    { label: 'Tickets', icon: Ticket,          path: '/tickets' },
    { label: 'Map',     icon: MapPin,          path: '/live-map' },
    { label: 'Reports', icon: BarChart3,       path: '/reports' },
    { label: 'Chat',    icon: MessageCircle,   path: '/ark-connect' },
    { label: 'Profile', icon: User,            path: '/settings' },
  ],
};

export default function MobileBottomNav({ user, notifCount = 0, dmCount = 0 }) {
  const location = useLocation();
  const rawRole = user?.role || 'default';

const ADMIN_VARIANTS = [
  'super_admin',
  'administrator',
  'Administrator',
  'ADMIN',
  'Super Admin',
  'SUPER_ADMIN'
];

const role = ADMIN_VARIANTS.includes(rawRole)
  ? 'default'
  : rawRole;
  const tabs = TABS_BY_ROLE[role] || TABS_BY_ROLE.default;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50"
      style={{ background: 'linear-gradient(135deg, #111111 0%, #1a1a1a 100%)', borderTop: '1px solid rgba(251,191,36,0.2)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex items-center justify-around px-1 py-2">
        {tabs.map((tab) => {
          const isActive = tab.path === '/' ? location.pathname === '/' : location.pathname.startsWith(tab.path);
          const showBadge = (tab.path === '/ark-connect' && dmCount > 0) || (tab.path === '/' && notifCount > 0);
          const badgeCount = tab.path === '/ark-connect' ? dmCount : notifCount;

          return (
            <Link
              key={tab.label + tab.path}
              to={tab.path}
              className="flex flex-col items-center gap-0.5 min-w-[48px] relative py-1 group"
            >
              {/* Active indicator dot */}
              {isActive && (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-amber-400" />
              )}

              {/* Icon container */}
              <div className={cn(
                'relative w-10 h-10 flex items-center justify-center rounded-2xl transition-all duration-200',
                isActive
                  ? 'bg-amber-400 shadow-[0_4px_16px_rgba(251,191,36,0.4)]'
                  : 'bg-transparent group-active:bg-white/10'
              )}>
                <tab.icon className={cn(
                  'w-5 h-5 transition-all duration-200',
                  isActive ? 'text-black' : 'text-white/50'
                )} />

                {/* Badge */}
                {showBadge && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
                    {badgeCount > 9 ? '9+' : badgeCount}
                  </span>
                )}
              </div>

              <span className={cn(
                'text-[9px] font-semibold leading-none tracking-wide transition-colors',
                isActive ? 'text-amber-400' : 'text-white/40'
              )}>
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}