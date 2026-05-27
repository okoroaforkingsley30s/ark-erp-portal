import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Ticket, Users, Settings, Bell,
  Wrench, BarChart3, Building2, ClipboardList, Shield,
  ChevronLeft, ChevronRight, LogOut, Menu, X, CircleDot,
  MapPin, Radio, Package, Navigation, Cpu, Users2, DollarSign,
  TrendingUp, ShoppingCart, Map, UserCheck,
  Crown, GanttChart, Boxes, Landmark, GitBranch, Activity,
  UserCog, Globe, MessageCircle, FileText, Mail, FileSpreadsheet
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabaseClient';

const roleMenus = {
  admin: [
    { section: 'Command Center' },
    { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
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
    { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
    { label: 'My Tickets', icon: Ticket, path: '/tickets' },
    { label: 'Notifications', icon: Bell, path: '/notifications' },
  ],
};

const ROLE_LABELS = {
  admin: 'Administrator',
  client: 'Client',
};

export default function Sidebar({ user, unreadCount = 0, dmUnreadCount = 0 }) {
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
    'SUPER_ADMIN'
  ];

  const role = ADMIN_VARIANTS.includes(rawRole) ? 'admin' : rawRole;
  const menu = roleMenus[role] || roleMenus.admin || roleMenus.client;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/welcome';
  };

  const NavContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-sidebar-border">
        <Link to="/" className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-sidebar-primary flex items-center justify-center flex-shrink-0">
            <CircleDot className="w-5 h-5 text-sidebar-primary-foreground" />
          </div>

          {!collapsed && (
            <div className="overflow-hidden">
              <h1 className="text-sm font-bold text-sidebar-foreground tracking-wide">
                ARK ONE
              </h1>
              <p className="text-[10px] text-sidebar-foreground/50 uppercase tracking-widest">
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
                className="text-[9px] font-bold uppercase tracking-widest text-sidebar-foreground/30 px-3 pt-4 pb-1 first:pt-2"
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
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all mb-0.5',
                isActive
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              )}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />

              {!collapsed && <span className="truncate">{item.label}</span>}

              {!collapsed && item.label === 'Notifications' && unreadCount > 0 && (
                <span className="ml-auto text-xs bg-sidebar-primary text-sidebar-primary-foreground rounded-full w-5 h-5 flex items-center justify-center font-bold">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}

              {!collapsed && item.label === 'ARK Connect' && dmUnreadCount > 0 && (
                <span className="ml-auto text-xs bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center font-bold animate-pulse">
                  {dmUnreadCount > 9 ? '9+' : dmUnreadCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-sidebar-border">
        <div className={cn('flex items-center gap-3 px-2 py-1.5', collapsed && 'justify-center')}>
          <div className="w-8 h-8 rounded-full bg-sidebar-primary/30 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-sidebar-primary-foreground">
              {user?.full_name?.[0]?.toUpperCase() || '?'}
            </span>
          </div>

          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-sidebar-foreground truncate">
                {user?.full_name || 'User'}
              </p>
              <p className="text-[10px] text-sidebar-foreground/50 truncate">
                {ROLE_LABELS[role] || role}
              </p>
            </div>
          )}

          {!collapsed && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-sidebar-foreground/50 hover:text-sidebar-foreground"
              onClick={handleLogout}
            >
              <LogOut className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>

      <div className="hidden lg:block p-2 border-t border-sidebar-border">
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-sidebar-foreground/50 hover:text-sidebar-foreground"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden fixed top-3 left-3 z-50 bg-card shadow-md"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </Button>

      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          'fixed top-0 left-0 h-full w-64 bg-sidebar z-50 transform transition-transform lg:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <NavContent />
      </aside>

      <aside
        className={cn(
          'hidden lg:flex flex-col bg-sidebar border-r border-sidebar-border h-screen sticky top-0 transition-all duration-300',
          collapsed ? 'w-[60px]' : 'w-60'
        )}
      >
        <NavContent />
      </aside>
    </>
  );
}