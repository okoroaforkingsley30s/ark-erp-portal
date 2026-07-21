import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';

import {
  Ticket, MapPin, Package, Users2, MessageCircle, CheckSquare,
  AlertTriangle, Plus, ChevronRight, Activity, ClipboardList,
  Navigation, FileText, Bell, Zap, BarChart3,
} from 'lucide-react';

import { format } from 'date-fns';

const ROLE_LABELS = {
  admin: 'Administrator',
  super_admin: 'Super Admin',
  engineer: 'Field Engineer',
  helpdesk: 'Help Desk',
  hr: 'Human Resources',
  finance: 'Finance',
  manager: 'Ops Manager',
  inventory: 'Inventory',
  ceo: 'CEO',
  agm: 'Asst. GM',
  procurement: 'Procurement',
  crm: 'CRM',
  repair_head: 'Head of Repair',
};

const BADGE_COLORS = {
  admin: 'bg-red-500',
  super_admin: 'bg-red-600',
  engineer: 'bg-amber-500',
  helpdesk: 'bg-blue-500',
  hr: 'bg-pink-500',
  finance: 'bg-green-500',
  manager: 'bg-indigo-500',
  inventory: 'bg-teal-500',
  ceo: 'bg-yellow-500',
  default: 'bg-slate-500',
};

function StatCard({ icon: Icon, label, value, color, sub }) {
  return (
    <div
      className="rounded-2xl p-3 flex flex-col gap-1 flex-1 min-w-0"
      style={{
        background: 'linear-gradient(135deg, #1a1a1a 0%, #242424 100%)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${color}`}>
        <Icon className="w-4 h-4 text-white" />
      </div>
      <p className="text-white font-black text-xl leading-none">{value ?? '—'}</p>
      <p className="text-white/50 text-[10px] leading-none font-medium">{label}</p>
      {sub && <p className="text-amber-400 text-[9px] font-semibold">{sub}</p>}
    </div>
  );
}

function QuickAction({ icon: Icon, label, path, color, badge }) {
  return (
    <Link
      to={path}
      className="rounded-2xl p-3.5 flex flex-col items-center gap-2 active:scale-95 transition-transform"
      style={{
        background: 'linear-gradient(135deg, #1a1a1a 0%, #242424 100%)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div className={`relative w-10 h-10 rounded-2xl flex items-center justify-center ${color}`}>
        <Icon className="w-5 h-5 text-white" />
        {badge > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </div>
      <span className="text-white/80 text-[10px] font-semibold text-center leading-tight">
        {label}
      </span>
    </Link>
  );
}

function TicketRow({ ticket }) {
  const urgency = ticket.priority || ticket.urgency || 'medium';

  const urgencyColor =
    {
      critical: 'bg-red-500',
      high: 'bg-orange-500',
      medium: 'bg-amber-500',
      low: 'bg-green-500',
    }[urgency] || 'bg-slate-500';

  return (
    <Link
      to={`/tickets/${ticket.id}`}
      className="flex items-center gap-3 py-3 border-b active:bg-[#102969]/5 transition-colors"
      style={{ borderColor: 'rgba(255,255,255,0.06)' }}
    >
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${urgencyColor}`} />

      <div className="flex-1 min-w-0">
        <p className="text-white/90 text-xs font-medium truncate">
          {ticket.title || ticket.description || 'Ticket'}
        </p>
        <p className="text-white/40 text-[10px]">
          {ticket.site_name || ticket.client_name || ''} · {ticket.status || 'open'}
        </p>
      </div>

      <ChevronRight className="w-3 h-3 text-white/30 flex-shrink-0" />
    </Link>
  );
}

function EngineerHome({ user }) {
  const myEmail = user?.email;

  const { data: tickets = [] } = useQuery({
    queryKey: ['my-tickets', myEmail],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .or(`assigned_engineer_email.eq.${myEmail},assigned_to.eq.${myEmail}`);

      if (error) throw error;
      return data || [];
    },
    enabled: !!myEmail,
  });

  const { data: engStatus } = useQuery({
    queryKey: ['my-eng-status', myEmail],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('engineer_statuses')
        .select('*')
        .eq('engineer_email', myEmail)
        .order('updated_at', { ascending: false })
        .limit(1);

      if (error) throw error;
      return data?.[0] || null;
    },
    enabled: !!myEmail,
  });

  const { data: partRequests = [] } = useQuery({
    queryKey: ['my-parts', myEmail],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('spare_part_requests')
        .select('*')
        .eq('engineer_email', myEmail)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!myEmail,
  });

  const active = tickets.filter(t => !['resolved', 'closed'].includes(t.status?.toLowerCase()));
  const overdue = tickets.filter(t => t.sla_status === 'Breached' || t.sla_status === 'Critical');
  const pendingParts = partRequests.filter(r => (r.status || r.request_status) === 'pending').length;

  return (
    <>
      <div className="flex gap-2.5 mb-5">
        <StatCard icon={Ticket} label="Active Jobs" value={active.length} color="bg-amber-500" />
        <StatCard
          icon={AlertTriangle}
          label="SLA Alerts"
          value={overdue.length}
          color={overdue.length > 0 ? 'bg-red-500' : 'bg-slate-600'}
          sub={overdue.length > 0 ? 'Action needed!' : undefined}
        />
        <StatCard icon={Package} label="Pending Parts" value={pendingParts} color="bg-teal-500" />
      </div>

      <div
        className="rounded-2xl p-3.5 mb-5 flex items-center gap-3"
        style={{
          background:
            engStatus?.status === 'on_site'
              ? 'linear-gradient(135deg,rgba(34,197,94,0.15),rgba(21,128,61,0.1))'
              : 'linear-gradient(135deg,rgba(251,191,36,0.08),rgba(0,0,0,0))',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center ${
            engStatus?.status === 'on_site' ? 'bg-green-500/30' : 'bg-amber-500/20'
          }`}
        >
          <Navigation
            className={`w-4 h-4 ${
              engStatus?.status === 'on_site' ? 'text-green-400' : 'text-amber-400'
            }`}
          />
        </div>

        <div className="flex-1">
          <p className="text-white/90 text-xs font-semibold">
            {engStatus?.status === 'on_site'
              ? `On Site: ${engStatus?.current_site_name || 'Active'}`
              : 'Not checked in'}
          </p>
          <p className="text-white/40 text-[10px]">
            {engStatus?.location_label || 'Tap to update status'}
          </p>
        </div>

        <Link to="/field-ops" className="px-3 py-1.5 rounded-xl bg-amber-400 text-white text-[10px] font-bold">
          {engStatus?.status === 'on_site' ? 'Check Out' : 'Check In'}
        </Link>
      </div>

      <div className="grid grid-cols-4 gap-2.5 mb-5">
        <QuickAction icon={Ticket} label="My Jobs" path="/tickets" color="bg-amber-500" badge={active.length} />
        <QuickAction icon={MapPin} label="Live Map" path="/live-map" color="bg-blue-500" />
        <QuickAction icon={Package} label="Request Parts" path="/spare-parts" color="bg-teal-500" badge={pendingParts} />
        <QuickAction icon={FileText} label="Field Ops" path="/field-ops" color="bg-indigo-500" />
      </div>

      {active.length > 0 && (
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #1a1a1a 0%, #242424 100%)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <p className="text-white font-bold text-sm">My Active Jobs</p>
            <Link to="/tickets" className="text-amber-400 text-[10px] font-semibold flex items-center gap-0.5">
              See all <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="px-4 pb-2">
            {active.slice(0, 4).map(t => <TicketRow key={t.id} ticket={t} />)}
          </div>
        </div>
      )}
    </>
  );
}

function HelpdeskHome() {
  const { data: tickets = [] } = useQuery({
    queryKey: ['all-tickets-hd'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data || [];
    },
  });

  const open = tickets.filter(t => t.status === 'open' || t.status === 'new').length;
  const inProgress = tickets.filter(t => t.status === 'in_progress').length;
  const breached = tickets.filter(t => t.sla_status === 'Breached').length;
  return (
    <>
      <div className="flex gap-2.5 mb-5">
        <StatCard icon={Ticket} label="Open" value={open} color="bg-amber-500" />
        <StatCard icon={Activity} label="In Progress" value={inProgress} color="bg-blue-500" />
        <StatCard icon={AlertTriangle} label="Breached" value={breached} color={breached > 0 ? 'bg-red-500' : 'bg-slate-600'} />
      </div>

      <div className="grid grid-cols-4 gap-2.5 mb-5">
        <QuickAction icon={Plus} label="New Ticket" path="/tickets" color="bg-amber-500" />
        <QuickAction icon={Ticket} label="All Tickets" path="/tickets" color="bg-blue-500" badge={open} />
        <QuickAction icon={Users2} label="Engineers" path="/engineers" color="bg-indigo-500" />
        <QuickAction icon={MapPin} label="Live Map" path="/live-map" color="bg-green-500" />
      </div>

      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #1a1a1a 0%, #242424 100%)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <p className="text-white font-bold text-sm">Recent Tickets</p>
          <Link to="/tickets" className="text-amber-400 text-[10px] font-semibold flex items-center gap-0.5">
            See all <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="px-4 pb-2">
          {tickets.slice(0, 5).map(t => <TicketRow key={t.id} ticket={t} />)}
        </div>
      </div>
    </>
  );
}

function InventoryHome() {
  const { data: requests = [] } = useQuery({
    queryKey: ['part-requests-inv'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('spare_part_requests')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data || [];
    },
  });

  const { data: items = [] } = useQuery({
    queryKey: ['inv-items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('spare_parts')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      return data || [];
    },
  });

  const pending = requests.filter(r => (r.status || r.request_status) === 'pending').length;
  const lowStock = items.filter(i => Number(i.quantity_available || 0) <= Number(i.minimum_stock_level || 2)).length;

  return (
    <>
      <div className="flex gap-2.5 mb-5">
        <StatCard icon={ClipboardList} label="Pending Reqs" value={pending} color="bg-amber-500" sub={pending > 0 ? 'Action needed' : undefined} />
        <StatCard icon={AlertTriangle} label="Low Stock" value={lowStock} color={lowStock > 0 ? 'bg-red-500' : 'bg-slate-600'} />
        <StatCard icon={Package} label="Total Items" value={items.length} color="bg-teal-500" />
      </div>

      <div className="grid grid-cols-3 gap-2.5 mb-5">
        <QuickAction icon={CheckSquare} label="Requests" path="/spare-parts" color="bg-amber-500" badge={pending} />
        <QuickAction icon={Package} label="Stock List" path="/spare-parts" color="bg-teal-500" />
        <QuickAction icon={BarChart3} label="Reports" path="/reports" color="bg-indigo-500" />
      </div>
    </>
  );
}

function DefaultHome() {
  const { data: tickets = [] } = useQuery({
    queryKey: ['tickets-home'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data || [];
    },
  });

  const open = tickets.filter(t => !['resolved', 'closed'].includes(t.status?.toLowerCase())).length;

  return (
    <>
      <div className="flex gap-2.5 mb-5">
        <StatCard icon={Ticket} label="Open Tickets" value={open} color="bg-amber-500" />
        <StatCard icon={Activity} label="Total Tickets" value={tickets.length} color="bg-blue-500" />
        <StatCard icon={Zap} label="System" value="OK" color="bg-green-500" />
      </div>

      <div className="grid grid-cols-4 gap-2.5 mb-5">
        <QuickAction icon={Ticket} label="Tickets" path="/tickets" color="bg-amber-500" badge={open} />
        <QuickAction icon={MapPin} label="Live Map" path="/live-map" color="bg-blue-500" />
        <QuickAction icon={Users2} label="Staff" path="/staff" color="bg-pink-500" />
        <QuickAction icon={BarChart3} label="Reports" path="/reports" color="bg-indigo-500" />
      </div>

      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #1a1a1a 0%, #242424 100%)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <p className="text-white font-bold text-sm">Recent Activity</p>
          <Link to="/tickets" className="text-amber-400 text-[10px] font-semibold flex items-center gap-0.5">
            All <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="px-4 pb-2">
          {tickets.slice(0, 5).map(t => <TicketRow key={t.id} ticket={t} />)}
        </div>
      </div>
    </>
  );
}

export default function MobileHomeScreen({ user, notifCount = 0, dmCount = 0 }) {
  const role = user?.role || 'default';
  const hour = new Date().getHours();

  const greeting =
    hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  const firstName = user?.full_name?.split(' ')[0] || 'User';
  const roleLabel = ROLE_LABELS[role] || role;
  const badgeColor = BADGE_COLORS[role] || BADGE_COLORS.default;

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications-mobile', user?.email],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_email', user.email)
        .eq('read', false);

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.email,
    initialData: [],
  });

  const totalNotif = notifications.length || notifCount;

  return (
    <div className="min-h-screen" style={{ background: '#0a0a0a' }}>
      <div
        className="relative px-4 pt-4 pb-6 overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0a0a0a 0%, #111 50%, #1a1200 100%)' }}
      >
        <div
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10"
          style={{
            background: 'radial-gradient(circle, #fbbf24 0%, transparent 70%)',
            transform: 'translate(30%, -30%)',
          }}
        />

        <div
          className="absolute bottom-0 left-0 w-32 h-32 rounded-full opacity-5"
          style={{
            background: 'radial-gradient(circle, #ef4444 0%, transparent 70%)',
            transform: 'translate(-20%, 20%)',
          }}
        />

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-amber-400 font-black text-xs tracking-widest">ARK ONE</span>
            <span className="text-white/20 text-xs">·</span>
            <span className="text-white/40 text-xs">Portal</span>
          </div>

          <div className="flex items-center gap-2">
            <Link to="/ark-connect" className="relative">
              <div className="w-8 h-8 rounded-xl bg-[#102969]/10 flex items-center justify-center">
                <MessageCircle className="w-4 h-4 text-white/70" />
              </div>
              {dmCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {dmCount > 9 ? '9+' : dmCount}
                </span>
              )}
            </Link>

            <Link to="/notifications" className="relative">
              <div className="w-8 h-8 rounded-xl bg-[#102969]/10 flex items-center justify-center">
                <Bell className="w-4 h-4 text-white/70" />
              </div>
              {totalNotif > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {totalNotif > 9 ? '9+' : totalNotif}
                </span>
              )}
            </Link>
          </div>
        </div>

        <div>
          <p className="text-white/50 text-sm font-medium mb-0.5">{greeting},</p>
          <h1 className="text-white font-black text-2xl leading-tight mb-3">
            {firstName} 👋
          </h1>

          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-full text-white text-[10px] font-bold ${badgeColor}`}>
              {roleLabel}
            </span>

            <span className="px-2.5 py-1 rounded-full bg-green-500/20 text-green-400 text-[10px] font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />
              Online
            </span>

            <span className="text-white/30 text-[10px]">
              {format(new Date(), 'EEE, d MMM')}
            </span>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 pb-32">
        {role === 'engineer' && <EngineerHome user={user} />}
        {role === 'helpdesk' && <HelpdeskHome user={user} />}
        {role === 'inventory' && <InventoryHome user={user} />}
        {!['engineer', 'helpdesk', 'inventory'].includes(role) && <DefaultHome user={user} />}
      </div>
    </div>
  );
}
