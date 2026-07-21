import React from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Activity, AlertTriangle, Bell, BriefcaseBusiness, Building2, CheckCircle2,
  ClipboardCheck, Clock, DollarSign, Package, ShieldCheck, Ticket,
  UserCheck, Users, Wrench,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { normalizeRole } from '@/lib/roleAccess';
import { resolveNotificationTarget } from '@/lib/notificationRouting';
import { Card } from '@/components/ui/card';

const DEPARTMENT_NAMES = {
  system_admin: 'System Administration', ceo: 'Executive Management', agm: 'Executive Management',
  manager: 'Operations Management', admin_head: 'Administration', admin: 'Administration',
  head_of_it: 'Information Technology', it: 'Information Technology', helpdesk: 'Helpdesk',
  operations: 'Operations', engineer: 'Field Engineering', inventory: 'Inventory',
  repair_head: 'Repair & Refurbishment', repair_technician: 'Repair & Refurbishment',
  head_of_account: 'Finance & Accounts', finance: 'Finance & Accounts', procurement: 'Procurement',
  hr: 'Human Resources', head_of_business_development: 'Business Development',
  business_developer: 'Business Development', client: 'Client Support',
};

const ROLE_CARDS = {
  engineer: [
    ['assigned_jobs', 'Assigned Jobs', 'Your jobs requiring field action', Ticket, '/field-ops'],
    ['pending_review', 'Pending Review', 'Your submitted completion reports', Clock, '/field-ops'],
    ['part_requests', 'Part Requests', 'Your active part workflows', Package, '/parts'],
    ['closed_jobs', 'Closed Jobs', 'Your approved completions', CheckCircle2, '/field-ops'],
  ],
  helpdesk: [
    ['open_tickets', 'Open Tickets', 'Helpdesk service queue', Ticket, '/tickets'],
    ['pending_review', 'Pending Review', 'Completions awaiting Helpdesk', ClipboardCheck, '/tickets'],
    ['escalated', 'Escalations', 'Tickets requiring intervention', AlertTriangle, '/tickets'],
    ['closed_tickets', 'Closed Tickets', 'Approved service completions', CheckCircle2, '/tickets'],
  ],
  operations: [
    ['part_approvals', 'Part Approvals', 'Requests awaiting Operations', ClipboardCheck, '/operations/part-requests'],
    ['escalations', 'Escalations', 'Operational exceptions', AlertTriangle, '/operations-feed'],
    ['sent_inventory', 'Sent to Inventory', 'Approved part workflows', Package, '/operations/part-requests'],
    ['active_tickets', 'Active Tickets', 'Current operational calls', Ticket, '/tickets'],
  ],
  inventory: [
    ['part_requests', 'Part Requests', 'Inventory action queue', ClipboardCheck, '/inventory/part-requests'],
    ['rr_consumables', 'RR Consumables', 'Approved RR requests', Package, '/inventory/part-requests'],
    ['low_stock', 'Low Stock', 'Items at reorder level', AlertTriangle, '/spare-parts'],
    ['repair_returns', 'Repair Returns', 'Items returning from RR', Wrench, '/inventory/part-requests'],
  ],
  repair_head: [
    ['repair_intake', 'Repair Intake', 'Jobs awaiting RR assignment', Package, '/rr-part-requests'],
    ['active_repairs', 'Active Repairs', 'Department work in progress', Wrench, '/repair-jobs'],
    ['support_approvals', 'Support Approvals', 'Consumable/fund decisions', ClipboardCheck, '/rr-consumable-requests'],
    ['qa_queue', 'QA Queue', 'Jobs awaiting quality review', ShieldCheck, '/repair-jobs'],
  ],
  repair_technician: [
    ['assigned_repairs', 'Assigned Repairs', 'Your repair jobs', Wrench, '/repair-jobs'],
    ['active_repairs', 'Active Work', 'Your work in progress', Activity, '/repair-jobs'],
    ['consumables', 'Consumables', 'Your support requests', Package, '/rr-consumable-requests'],
    ['qa_submitted', 'QA Submitted', 'Your jobs awaiting QA', ClipboardCheck, '/repair-jobs'],
  ],
  head_of_account: [
    ['fund_requests', 'Fund Requests', 'Accounts action queue', DollarSign, '/fund-requests'],
    ['payments', 'Payments', 'Payments awaiting action', DollarSign, '/finance'],
    ['journals', 'Journals', 'Accounting workflow', BriefcaseBusiness, '/finance'],
    ['reconciliations', 'Reconciliations', 'Bank review queue', ClipboardCheck, '/finance'],
  ],
  hr: [
    ['employees', 'Active Employees', 'HR workforce register', Users, '/hr'],
    ['leave_requests', 'Leave Requests', 'Pending HR decisions', ClipboardCheck, '/hr'],
    ['training', 'Upcoming Training', 'Scheduled development', BriefcaseBusiness, '/hr'],
    ['attendance_today', 'Attendance Today', 'Recorded attendance', UserCheck, '/hr'],
  ],
  head_of_business_development: [
    ['leads', 'Active Leads', 'Business pipeline', BriefcaseBusiness, '/crm'],
    ['clients', 'Clients', 'CRM client register', Building2, '/crm'],
    ['complaints', 'Open Complaints', 'Customer issues', AlertTriangle, '/crm'],
    ['won_business', 'Won Business', 'Converted opportunities', CheckCircle2, '/crm'],
  ],
  head_of_it: [
    ['active_users', 'Active Users', 'Enabled identities', Users, '/users'],
    ['pending_users', 'Pending Users', 'Identity action queue', UserCheck, '/users'],
    ['system_alerts', 'System Alerts', 'Security and service alerts', AlertTriangle, '/admin-diagnostics'],
    ['recent_events', 'Recent Events', 'Last 24 hours', Activity, '/audit-logs'],
  ],
  admin_head: [
    ['staff', 'Active Staff', 'Administration directory', Users, '/staff'],
    ['pending_users', 'Pending Users', 'Approval queue', UserCheck, '/users'],
    ['departments', 'Departments', 'Organizational units', Building2, '/departments'],
    ['recent_activity', 'Recent Activity', 'Last 24 hours', Activity, '/audit-logs'],
  ],
  system_admin: [
    ['active_users', 'Active Users', 'System identities', Users, '/users'],
    ['pending_users', 'Pending Users', 'Approval or identity issues', UserCheck, '/users'],
    ['system_alerts', 'System Alerts', 'Security and workflow failures', AlertTriangle, '/admin-diagnostics'],
    ['recent_events', 'Recent Events', 'System activity in 24 hours', Activity, '/admin-diagnostics'],
  ],
};

const ROLE_ALIASES = {
  finance: 'head_of_account', business_developer: 'head_of_business_development',
  it: 'head_of_it', admin: 'admin_head',
};

const EXECUTIVE_CARDS = [
  ['open_tickets', 'Open Tickets', 'Organization service activity', Ticket, '/tickets'],
  ['part_workflows', 'Part Workflows', 'Active supply workflows', Package, '/operations/part-requests'],
  ['repair_jobs', 'Repair Jobs', 'RR work in progress', Wrench, '/repair-jobs'],
  ['pending_funds', 'Pending Funds', 'Finance decisions', DollarSign, '/fund-requests'],
];

const DEFAULT_CARDS = [
  ['open_items', 'Open Items', 'Items requiring your attention', ClipboardCheck, '/notifications'],
  ['recent_activity', 'Recent Activity', 'Department activity', Activity, '/operations-feed'],
  ['reports', 'Reports', 'Available reports', BriefcaseBusiness, '/reports'],
  ['alerts', 'Alerts', 'Unread alerts', Bell, '/notifications'],
];

async function fetchDepartmentDashboard() {
  const { data, error } = await supabase.rpc('ark_department_dashboard_summary');
  if (error) throw error;
  return data || { cards: {}, recent: [] };
}

export default function Dashboard() {
  const { user } = useOutletContext();
  const navigate = useNavigate();
  const role = normalizeRole(user?.role);
  const configRole = ROLE_ALIASES[role] || role;
  const isExecutive = ['ceo', 'agm', 'manager'].includes(role);
  const cardConfig = isExecutive ? EXECUTIVE_CARDS : (ROLE_CARDS[configRole] || DEFAULT_CARDS);

  const { data = { cards: {}, recent: [] }, isLoading, error } = useQuery({
    queryKey: ['department-dashboard', role, user?.email],
    queryFn: fetchDepartmentDashboard,
    enabled: Boolean(user?.email && role),
    refetchInterval: 30000,
  });

  const greeting = new Date().getHours() < 12 ? 'Good Morning' : new Date().getHours() < 17 ? 'Good Afternoon' : 'Good Evening';
  const openTarget = (target) => navigate(resolveNotificationTarget(user, target));

  return (
    <div className="space-y-6 text-white">
      <header>
        <h1 className="text-3xl lg:text-4xl font-black tracking-tight">
          {greeting}, <span className="text-[#ff5a00]">{user?.full_name?.split(' ')[0] || 'User'}</span>
        </h1>
        <p className="text-slate-300 mt-2 text-sm">
          {DEPARTMENT_NAMES[role] || user?.department || 'Your Department'} Activity Dashboard
        </p>
        <p className="text-xs text-slate-400 mt-1">Only activity assigned to your role and department is shown here.</p>
      </header>

      {error && (
        <Card className="border-red-500/30 bg-red-500/10 p-4 text-red-200">
          Department dashboard could not load: {error.message}
        </Card>
      )}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {cardConfig.map(([key, title, subtitle, Icon, target]) => (
          <button key={key} type="button" onClick={() => openTarget(target)} className="text-left">
            <Card className="h-full p-4 border-white/10 bg-[#102969]/90 hover:border-[#ff5a00]/50 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-slate-300">{title}</p>
                  <p className="text-3xl font-black mt-2 text-white">{isLoading ? '…' : Number(data.cards?.[key] || 0)}</p>
                </div>
                <Icon className="w-6 h-6 text-[#ff5a00]" />
              </div>
              <p className="text-[11px] text-slate-400 mt-3">{subtitle}</p>
            </Card>
          </button>
        ))}
      </div>

      <Card className="p-5 border-white/10 bg-[#102969]/90">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-bold">Your Recent Notifications</h2>
            <p className="text-xs text-slate-400">Only notifications addressed to your account</p>
          </div>
          <button type="button" onClick={() => openTarget('/notifications')} className="text-xs text-[#ff5a00]">View all →</button>
        </div>
        <div className="space-y-2">
          {(data.recent || []).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => openTarget(item.link || '/notifications')}
              className="w-full text-left rounded-xl border border-white/5 bg-[#0b1f5e] p-3 hover:border-[#ff5a00]/30"
            >
              <p className="text-sm font-semibold">{item.title || 'Notification'}</p>
              <p className="text-xs text-slate-300 mt-1 line-clamp-2">{item.message || 'Open for details'}</p>
            </button>
          ))}
          {!isLoading && (data.recent || []).length === 0 && (
            <p className="text-sm text-slate-400 text-center py-8">No activity yet for your account.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
