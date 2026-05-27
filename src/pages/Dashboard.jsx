import React from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';

import {
  Ticket,
  Users,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Package,
  MapPin,
  Boxes,
  Building2,
  Cpu,
  UserCheck,
  MessageSquare
} from 'lucide-react';

import StatCard from '@/components/dashboard/StatCard';
import RecentTicketsTable from '@/components/dashboard/RecentTicketsTable';
import TicketStatusChart from '@/components/dashboard/TicketStatusChart';
import TicketTrendChart from '@/components/dashboard/TicketTrendChart';
import EngineerActivityFeed from '@/components/dashboard/EngineerActivityFeed';
import SiteStatusPanel from '@/components/dashboard/SiteStatusPanel';
import LiveMapPanel from '@/components/dashboard/LiveMapPanel';
import ExportButton from '@/components/ExportButton';

const OPS_ROLES = [
  'admin',
  'helpdesk',
  'manager',
  'agm',
  'ceo',
  'repair_head'
];

const MAP_ROLES = [
  'admin',
  'helpdesk',
  'manager',
  'agm',
  'ceo'
];

const INVENTORY_ROLES = [
  'admin',
  'inventory',
  'procurement'
];

export default function Dashboard() {
  const { user } = useOutletContext();

  const role = user?.role || 'client';

  const { data: tickets = [] } = useQuery({
    queryKey: ['tickets-dashboard'],

    queryFn: async () => {
      let query = supabase
        .from('tickets')
        .select('*')
        .order('created_at', { ascending: false });

      if (role === 'client') {
        query = query.eq('client_email', user.email);
      }

      if (role === 'engineer') {
        query = query.eq('assigned_to', user.email);
      }

      const { data, error } = await query;

      if (error) {
        console.error(error);
        return [];
      }

      return data || [];
    },

    enabled: !!user,
  });

  const { data: banks = [] } = useQuery({
    queryKey: ['banks'],
    queryFn: async () => {
      const { data } = await supabase.from('banks').select('*');
      return data || [];
    },
    enabled: OPS_ROLES.includes(role),
  });

  const { data: devices = [] } = useQuery({
    queryKey: ['devices'],
    queryFn: async () => {
      const { data } = await supabase.from('devices').select('*');
      return data || [];
    },
    enabled: OPS_ROLES.includes(role),
  });

  const { data: engineers = [] } = useQuery({
    queryKey: ['engineers'],
    queryFn: async () => {
      const { data } = await supabase.from('engineers').select('*');
      return data || [];
    },
    enabled: OPS_ROLES.includes(role),
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const { data } = await supabase.from('branches').select('*');
      return data || [];
    },
    enabled: OPS_ROLES.includes(role),
  });

  const { data: spareParts = [] } = useQuery({
    queryKey: ['spare-parts'],
    queryFn: async () => {
      const { data } = await supabase.from('spare_parts').select('*');
      return data || [];
    },
    enabled:
      OPS_ROLES.includes(role) ||
      INVENTORY_ROLES.includes(role),
  });

  const { data: spareRequests = [] } = useQuery({
    queryKey: ['spare-requests'],
    queryFn: async () => {
      let query = supabase
        .from('spare_part_requests')
        .select('*')
        .eq('status', 'pending');

      if (role === 'engineer') {
        query = query.eq('engineer_email', user.email);
      }

      const { data } = await query;

      return data || [];
    },
    enabled: role !== 'client',
  });

  const { data: unreadMessages = [] } = useQuery({
    queryKey: ['unread-dms', user?.email],

    queryFn: async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_email', user.email)
        .eq('type', 'chat_message')
        .eq('read', false);

      return data || [];
    },

    enabled: !!user,
    refetchInterval: 15000,
  });

  const openTickets = tickets.filter(
    t => !['closed', 'resolved'].includes(t.status)
  );

  const resolvedTickets = tickets.filter(
    t => ['resolved', 'closed'].includes(t.status)
  );

  const criticalTickets = tickets.filter(
    t =>
      t.priority === 'critical' &&
      !['closed', 'resolved'].includes(t.status)
  );

  const lowStock = spareParts.filter(
    p =>
      (p.quantity_available || 0) <=
      (p.minimum_stock_level || 0)
  ).length;

  const activeDevices = devices.filter(
    d => d.status === 'operational'
  ).length;

  const faultyDevices = devices.filter(
    d =>
      d.status === 'faulty' ||
      d.status === 'under_maintenance'
  ).length;

  const showOpsStats =
    OPS_ROLES.includes(role) ||
    INVENTORY_ROLES.includes(role);

  const showMap = MAP_ROLES.includes(role);

  const greeting = () => {
    const h = new Date().getHours();

    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';

    return 'Good Evening';
  };

  return (
    <div className="space-y-6 text-white">

      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">

        <div>
          <h1 className="text-3xl lg:text-4xl font-black tracking-tight">
            {greeting()},{" "}
            <span className="text-[#ff5a00]">
              {user?.full_name?.split(' ')[0] || 'User'}
            </span>
          </h1>

          <p className="text-slate-300 mt-2 text-sm tracking-wide">
            ARK ONE Enterprise Command Center
          </p>
        </div>

        <div className="flex items-center gap-3">

          <div className="scale-95">
            <ExportButton
              filename={`ark-tickets-${new Date().toISOString().split('T')[0]}`}
              label="Export"
              data={tickets.map(t => ({
                ID: t.id,
                Title: t.title || '',
                Status: t.status || '',
                Priority: t.priority || '',
                AssignedTo: t.assigned_to || '',
              }))}
            />
          </div>

          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/15 border border-emerald-400/20 text-emerald-300 text-sm font-semibold">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            Live
          </div>

        </div>

      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

        <StatCard title="Total Tickets" value={tickets.length} icon={Ticket} />
        <StatCard title="Open Tickets" value={openTickets.length} icon={Clock} />
        <StatCard title="Resolved" value={resolvedTickets.length} icon={CheckCircle2} />
        <StatCard title="Critical" value={criticalTickets.length} icon={AlertTriangle} />

      </div>

      {showOpsStats && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

            <StatCard title="Banks" value={banks.length} icon={Building2} />
            <StatCard title="Devices" value={devices.length} icon={Cpu} />
            <StatCard title="Engineers" value={engineers.length} icon={UserCheck} />
            <StatCard title="Branches" value={branches.length} icon={MapPin} />

          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

            <StatCard title="Active Devices" value={activeDevices} icon={CheckCircle2} />
            <StatCard title="Faulty Devices" value={faultyDevices} icon={AlertTriangle} />
            <StatCard title="Low Stock" value={lowStock} icon={Package} />
            <StatCard title="Pending Requests" value={spareRequests.length} icon={Boxes} />

          </div>
        </>
      )}

      {showMap && (
        <div className="rounded-3xl overflow-hidden border border-white/10 bg-[#102969]/90 backdrop-blur-xl shadow-[0_0_30px_rgba(0,0,0,0.25)]">
          <LiveMapPanel compact />
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-4">

        <div className="lg:col-span-2 space-y-4">

          <div className="rounded-3xl overflow-hidden border border-white/10 bg-[#102969]/90 backdrop-blur-xl shadow-[0_0_30px_rgba(0,0,0,0.25)]">
            <TicketTrendChart tickets={tickets} />
          </div>

          <div className="rounded-3xl overflow-hidden border border-white/10 bg-[#102969]/90 backdrop-blur-xl shadow-[0_0_30px_rgba(0,0,0,0.25)]">
            <TicketStatusChart tickets={tickets} />
          </div>

        </div>

        <div className="space-y-4">

          <div className="rounded-3xl overflow-hidden border border-white/10 bg-[#102969]/90 backdrop-blur-xl shadow-[0_0_30px_rgba(0,0,0,0.25)]">
            <SiteStatusPanel />
          </div>

          <div className="rounded-3xl overflow-hidden border border-white/10 bg-[#102969]/90 backdrop-blur-xl shadow-[0_0_30px_rgba(0,0,0,0.25)]">
            <EngineerActivityFeed />
          </div>

        </div>

      </div>

      {unreadMessages.length > 0 && (
        <div className="rounded-3xl border border-[#ff5a00]/20 bg-[#102969]/90 backdrop-blur-xl p-5 shadow-[0_0_30px_rgba(0,0,0,0.25)]">

          <div className="flex items-center justify-between mb-4">

            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-[#ff5a00]" />

              <h3 className="font-bold text-white">
                Unread Messages ({unreadMessages.length})
              </h3>
            </div>

            <Link
              to="/ark-connect"
              className="text-sm text-[#ff5a00] hover:underline"
            >
              Open ARK Connect →
            </Link>

          </div>

          <div className="space-y-3">

            {unreadMessages.slice(0, 5).map(n => (
              <Link
                key={n.id}
                to="/ark-connect"
                className="flex items-start gap-3 p-3 rounded-2xl bg-[#0b1f5e] border border-white/5 hover:border-[#ff5a00]/20 transition-all"
              >

                <div className="w-9 h-9 rounded-full bg-[#ff5a00]/20 flex items-center justify-center flex-shrink-0 text-sm font-bold text-[#ff5a00]">
                  {n.title?.[0]?.toUpperCase() || '?'}
                </div>

                <div className="flex-1 min-w-0">

                  <p className="text-sm font-semibold text-white truncate">
                    {n.title}
                  </p>

                  <p className="text-xs text-slate-300 truncate">
                    {n.message}
                  </p>

                </div>

              </Link>
            ))}

          </div>

        </div>
      )}

      <div className="rounded-3xl overflow-hidden border border-white/10 bg-[#102969]/90 backdrop-blur-xl shadow-[0_0_30px_rgba(0,0,0,0.25)]">
        <RecentTicketsTable
          tickets={tickets}
          showAssignee={role !== 'client'}
        />
      </div>

    </div>
  );
}