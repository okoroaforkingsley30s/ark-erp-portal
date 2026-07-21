import React, { useState, useRef } from 'react';
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
  FileSpreadsheet,
  PackageCheck,
  Inbox,
  Wallet,
  Search,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabaseClient';

import {
  canUserAccess,
  getRoleLabel,
  getUserRole,
} from '@/lib/roleAccess';

const ALL_MENUS = [
  { section: 'Command Center', permission: 'dashboard' },

  {
    label: 'Dashboard',
    icon: LayoutDashboard,
    path: '/dashboard',
    permission: 'dashboard',
  },
  {
  label: 'Fund / Loan Requests',
  icon: Wallet,
  path: '/fund-requests',
  permission: 'fund_requests',
},
  {
    label: 'SLA Analytics',
    icon: Activity,
    path: '/sla-analytics',
    permission: 'sla_analytics',
  },
  {
    label: 'Live Map',
    icon: Map,
    path: '/live-map',
    permission: 'live_map',
  },
  {
    label: 'Operations Feed',
    icon: Activity,
    path: '/operations-feed',
    permission: 'dashboard',
  },
  {
    label: 'Tickets',
    icon: Ticket,
    path: '/tickets',
    permission: 'tickets',
  },
  {
    label: 'Repair Jobs',
    icon: Ticket,
    path: '/repair-jobs',
    permission: 'repair_jobs',
  },
  {
  label: 'Ops Part Requests',
  icon: Boxes,
  path: '/operations/part-requests',
  permission: 'operations',
},
{
  label: "RR Intake & Assignment",
  icon: Inbox,
  path: "/rr-part-requests",
  permission: "rr_intake",
},
{
  label: 'RR Consumables',
  icon: PackageCheck,
  path: '/rr-consumable-requests',
  permission: 'repair_jobs',
},
{
  label: 'Inventory Requests',
  icon: Boxes,
  path: '/inventory/part-requests',
  permission: 'inventory',
},
  {
    label: 'Site Monitor',
    icon: Radio,
    path: '/sites',
    permission: 'site_monitor',
  },
  {
    label: 'Engineer Board',
    icon: MapPin,
    path: '/engineers',
    permission: 'engineering',
  },
  {
    label: 'Field Operations',
    icon: Navigation,
    path: '/field-ops',
    permission: 'field_ops',
  },

  { section: 'Banking Operations', permission: 'operations' },

  {
    label: 'Ops Dashboard',
    icon: Activity,
    path: '/ops-dashboard',
    permission: 'ops_dashboard',
  },
  {
    label: 'Banks',
    icon: Landmark,
    path: '/banks',
    permission: 'banks',
  },
  {
    label: 'Branches',
    icon: GitBranch,
    path: '/branches',
    permission: 'branches',
  },
  {
    label: 'Bank Devices',
    icon: Cpu,
    path: '/bank-devices',
    permission: 'devices',
  },
  {
    label: 'Device Status',
    icon: Activity,
    path: '/device-status',
    permission: 'device_status',
  },
  {
    label: 'Assignments',
    icon: UserCog,
    path: '/device-assignment',
    permission: 'assignments',
  },
  {
    label: 'Regional View',
    icon: Globe,
    path: '/regional-coverage',
    permission: 'regional_view',
  },
  {
    label: 'Field Engineers',
    icon: Users2,
    path: '/engineers-ops',
    permission: 'field_engineers',
  },

  { section: 'Assets', permission: 'assets_section' },

  {
    label: 'Assets',
    icon: Cpu,
    path: '/assets',
    permission: 'assets',
  },
  {
    label: 'Inventory',
    icon: Boxes,
    path: '/spare-parts?tab=inventory',
    permission: 'inventory',
  },
 {
  label: 'ARK ONE Inventory Analytics',
  icon: BarChart3,
  path: '/inventory-analytics',
  permission: 'inventory',
},
{
  label: 'Purchase Orders',
  icon: FileText,
  path: '/procurement-lpo',
  permission: 'purchase_orders',
},
  {
    label: 'Parts Workflow',
    icon: Boxes,
    path: '/parts',
    permission: 'parts_request',
  },

  { section: 'Business', permission: 'business' },

  {
    label: 'Finance',
    icon: DollarSign,
    path: '/finance',
    permission: 'finance',
  },
  {
    label: 'Procurement',
    icon: ShoppingCart,
    path: '/procurement',
    permission: 'procurement',
  },
  {
    label: 'CRM',
    icon: TrendingUp,
    path: '/crm',
    permission: 'crm',
  },
  {
    label: 'HR Portal',
    icon: UserCheck,
    path: '/hr',
    permission: 'hr',
  },

  { section: 'Administration', permission: 'users' },

  {
    label: 'Users',
    icon: Users,
    path: '/users',
    permission: 'users',
  },
  {
    label: 'Staff Directory',
    icon: Users2,
    path: '/staff',
    permission: 'staff_directory',
  },
  {
    label: 'Departments',
    icon: Building2,
    path: '/departments',
    permission: 'departments',
  },
  {
    label: 'Audit Logs',
    icon: Shield,
    path: '/audit-logs',
    permission: 'audit_logs',
  },
  {
    label: 'ERP Diagnostics',
    icon: Search,
    path: '/admin-diagnostics',
    permission: 'admin_diagnostics',
  },
  {
    label: 'Reports',
    icon: BarChart3,
    path: '/reports',
    permission: 'reports',
  },
  {
    label: 'Notifications',
    icon: Bell,
    path: '/notifications',
    permission: 'notifications',
  },
  {
    label: 'Data Import',
    icon: FileSpreadsheet,
    path: '/data-import',
    permission: 'data_import',
  },
  {
    label: 'Settings',
    icon: Settings,
    path: '/settings',
    permission: 'settings',
  },

  { section: 'Communication', permission: 'communication' },

  {
    label: 'Mail',
    icon: Mail,
    path: '/official-mail',
    permission: 'communication',
  },
  {
    label: 'ARK Connect',
    icon: MessageCircle,
    path: '/ark-connect',
    permission: 'ark_connect',
  },
];

function Sidebar({
  user,
  unreadCount = 0,
  dmUnreadCount = 0,
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const location = useLocation();
  const navRef = useRef(null);
  const role = getUserRole(user);

  const filteredMenu = ALL_MENUS.filter((item) => {
    return canUserAccess(user, item.permission);
  });

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/welcome';
  };

  const NavContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-[#ff5a00]/20">
        <Link
          to="/dashboard"
          className="flex items-center gap-3"
        >
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

      <nav
        ref={navRef}
        className="flex-1 p-2 overflow-y-auto"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {filteredMenu.map((item, idx) => {
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

          const itemBasePath = item.path.split('?')[0];
          const itemFullPath = item.path;
          const currentFullPath = `${location.pathname}${location.search}`;

          const isActive = item.path.includes('?')
            ? currentFullPath === itemFullPath
            : location.pathname === itemBasePath ||
              location.pathname.startsWith(`${itemBasePath}/`);

          return (
            <Link
              key={item.path + item.label}
              to={item.path}
              preventScrollReset
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
                {getRoleLabel(role)}
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
          collapsed
            ? 'w-[60px]'
            : 'w-60'
        )}
      >
        <NavContent />
      </aside>
    </>
  );
}

export default React.memo(Sidebar);
