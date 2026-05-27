import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Ticket,
  Users,
  Settings,
  Bell,
  BarChart3,
  Building2,
  Shield,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu,
  X,
  MapPin,
  Radio,
  Navigation,
  Cpu,
  Users2,
  DollarSign,
  TrendingUp,
  ShoppingCart,
  Map,
  UserCheck,
  Boxes,
  Landmark,
  GitBranch,
  Activity,
  UserCog,
  Globe,
  MessageCircle,
  FileText,
  Mail,
  FileSpreadsheet
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabaseClient';

const roleMenus = {
  admin: [
    { section: 'Command Center' },

    { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { label: 'SLA Analytics', icon: Activity, path: '/sla-analytics' },
    { label: 'Live Map', icon: Map, path: '/live-map' },
    { label: 'Tickets', icon: Ticket, path: '/tickets' },
    { label: 'Site Monitor', icon: Radio, path: '/sites' },
    { label: 'Engineer Board', icon: MapPin, path: '/engineers' },
    { label: 'Field Operations', icon: Navigation, path: '/field-ops' },

    { section: 'Banking Operations' },

    { label: 'Ops Dashboard', icon: Activity, path: '/ops-dashboard' },
    { label: 'Banks', icon: Landmark, path: '/banks' },
    { label: 'Branches', icon: GitBranch, path: '/branches' },
    { label: 'Bank Devices', icon: Cpu, path: '/bank-devices' },
    { label: 'Device Status', icon: Activity, path: '/device-status' },
    { label: 'Assignments', icon: UserCog, path: '/device-assignment' },
    { label: 'Regional View', icon: Globe, path: '/regional-coverage' },
    { label: 'Field Engineers', icon: Users2, path: '/engineers-ops' },

    { section: 'Assets' },

    { label: 'Assets', icon: Cpu, path: '/assets' },
    { label: 'Inventory', icon: Boxes, path: '/spare-parts' },

    { section: 'Business' },

    { label: 'Finance', icon: DollarSign, path: '/finance' },
    { label: 'Procurement', icon: ShoppingCart, path: '/procurement' },
    { label: 'Purchase Orders', icon: FileText, path: '/procurement-lpo' },
    { label: 'CRM', icon: TrendingUp, path: '/crm' },
    { label: 'HR Portal', icon: UserCheck, path: '/hr' },

    { section: 'Administration' },

    { label: 'Data Import', icon: FileSpreadsheet, path: '/data-import' },
    { label: 'Users', icon: Users, path: '/users' },
    { label: 'Staff Directory', icon: Users2, path: '/staff' },
    { label: 'Departments', icon: Building2, path: '/departments' },
    { label: 'Audit Logs', icon: Shield, path: '/audit-logs' },
    { label: 'Reports', icon: BarChart3, path: '/reports' },
    { label: 'Notifications', icon: Bell, path: '/notifications' },
    { label: 'Settings', icon: Settings, path: '/settings' },

    { section: 'Communication' },

    { label: 'Mail', icon: Mail, path: '/official-mail' },
    { label: 'ARK Connect', icon: MessageCircle, path: '/ark-connect' },
  ],

  client: [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { label: 'My Tickets', icon: Ticket, path: '/tickets' },
    { label: 'Notifications', icon: Bell, path: '/notifications' },
  ],
};

const ROLE_LABELS = {
  admin: 'Administrator',
  client: 'Client',
};

export default function Sidebar({
  user,
  unreadCount = 0,
  dmUnreadCount = 0,
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const location = useLocation();

  const rawRole = user?.role || 'client';

  const ADMIN_VARIANTS = [
    'super_admin',
    'administrator',
    'Administrator',
    'ADMIN',
    'Super Admin',
    'SUPER_ADMIN',
    'admin',
  ];

  const role = ADMIN_VARIANTS.includes(rawRole)
    ? 'admin'
    : rawRole;

  const menu =
    roleMenus[role] ||
    roleMenus.admin ||
    roleMenus.client;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/welcome';
  };

  const NavContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-[#ff5a00]/20">
        <Link to="/dashboard" className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#ff5a00]/10 border border-[#ff5a00]/30 flex items-center justify-center shadow-[0_0_20px_rgba(255,90,0,0.2)] flex-shrink-0">
            <img
              src="/logo.png"
              alt="ARK Technologies Logo"
              className="w-10 h-10 object-contain"
            />
          </div>

          {!collapsed && (
            <div className="overflow-hidden">
              <h1 className="text-sm font-bold text-white tracking-wide">
                ARK ONE
              </h1>

              <p className="text-[10px] text-slate-300 uppercase tracking-widest">
                Enterprise Portal
              </p>
            </div>
          )}
        </Link>
      </div>

      <nav className="flex-1 p-2 overflow-y-auto">
        {menu.map((item, idx) => {
          if (item.section) {
            if (collapsed) return null;

            return (
              <p
                key={item.section + idx}
                className="text-[9px] font-bold uppercase tracking-widest text-slate-400 px-3 pt-4 pb-1 first:pt-2"
              >
                {item.section}
              </p>
            );
          }

          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.path + item.label}
              to={item.path}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all mb-0.5 border',
                isActive
                  ? 'bg-[#ff5a00]/15 text-[#ff5a00] border-[#ff5a00]/20 shadow-sm'
                  : 'border-transparent text-slate-200 hover:bg-[#ff5a00]/10 hover:text-[#ff5a00]'
              )}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />

              {!collapsed && (
                <span className="truncate">
                  {item.label}
                </span>
              )}

              {!collapsed &&
                item.label === 'Notifications' &&
                unreadCount > 0 && (
                  <span className="ml-auto text-xs bg-[#ff5a00] text-white rounded-full w-5 h-5 flex items-center justify-center font-bold">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}

              {!collapsed &&
                item.label === 'ARK Connect' &&
                dmUnreadCount > 0 && (
                  <span className="ml-auto text-xs bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center font-bold animate-pulse">
                    {dmUnreadCount > 9 ? '9+' : dmUnreadCount}
                  </span>
                )}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-[#ff5a00]/20">
        <div
          className={cn(
            'flex items-center gap-3 px-2 py-1.5',
            collapsed && 'justify-center'
          )}
        >
          <div className="w-8 h-8 rounded-full bg-[#ff5a00]/20 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-white">
              {user?.full_name?.[0]?.toUpperCase() || '?'}
            </span>
          </div>

          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">
                {user?.full_name || 'User'}
              </p>

              <p className="text-[10px] text-slate-300 truncate">
                {ROLE_LABELS[role] || role}
              </p>
            </div>
          )}

          {!collapsed && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-slate-300 hover:text-white hover:bg-white/5"
              onClick={handleLogout}
            >
              <LogOut className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>

      <div className="hidden lg:block p-2 border-t border-[#ff5a00]/20">
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-slate-300 hover:text-white hover:bg-white/5"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden fixed top-3 left-3 z-50 bg-[#102969] text-white shadow-md"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? (
          <X className="w-5 h-5" />
        ) : (
          <Menu className="w-5 h-5" />
        )}
      </Button>

      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          'fixed top-0 left-0 h-full w-64 bg-gradient-to-b from-[#08153d] via-[#0b1f5e] to-[#102969] z-50 transform transition-transform lg:hidden',
          mobileOpen
            ? 'translate-x-0'
            : '-translate-x-full'
        )}
      >
        <NavContent />
      </aside>

      <aside
        className={cn(
          'hidden lg:flex flex-col bg-gradient-to-b from-[#08153d] via-[#0b1f5e] to-[#102969] border-r border-[#ff5a00]/20 h-screen sticky top-0 transition-all duration-300',
          collapsed ? 'w-[60px]' : 'w-60'
        )}
      >
        <NavContent />
      </aside>
    </>
  );
}