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
  Wrench,
  MapPin,
  Package,
  Radio,
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

  const { data: allUsers = [] } = useQuery({
    queryKey: ['users-count'],

    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('*');

      if (error) return [];

      return data || [];
    },

    enabled: role === 'admin',
  });

  const { data: banks = [] } = useQuery({
    queryKey: ['banks'],

    queryFn: async () => {
      const { data, error } = await supabase
        .from('banks')
        .select('*');

      if (error) return [];

      return data || [];
    },

    enabled: OPS_ROLES.includes(role),
  });

  const { data: devices = [] } = useQuery({
    queryKey: ['devices'],

    queryFn: async () => {
      const { data, error } = await supabase
        .from('devices')
        .select('*');

      if (error) return [];

      return data || [];
    },

    enabled: OPS_ROLES.includes(role),
  });

  const { data: engineers = [] } = useQuery({
    queryKey: ['engineers'],

    queryFn: async () => {
      const { data, error } = await supabase
        .from('engineers')
        .select('*');

      if (error) return [];

      return data || [];
    },

    enabled: OPS_ROLES.includes(role),
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],

    queryFn: async () => {
      const { data, error } = await supabase
        .from('branches')
        .select('*');

      if (error) return [];

      return data || [];
    },

    enabled: OPS_ROLES.includes(role),
  });

  const { data: spareParts = [] } = useQuery({
    queryKey: ['spare-parts'],

    queryFn: async () => {
      const { data, error } = await supabase
        .from('spare_parts')
        .select('*');

      if (error) return [];

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

      const { data, error } = await query;

      if (error) return [];

      return data || [];
    },

    enabled:
      role !== 'client' &&
      role !== 'finance' &&
      role !== 'hr',
  });

  const { data: unreadMessages = [] } = useQuery({
    queryKey: ['unread-dms', user?.email],

    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_email', user.email)
        .eq('type', 'chat_message')
        .eq('read', false)
        .order('created_at', { ascending: false });

      if (error) return [];

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
    <div className="space-y-6">

      <div className="flex items-start justify-between">

        <div>
          <h1 className="text-2xl font-bold">
            {greeting()},{' '}
            {user?.full_name?.split(' ')[0] || 'User'}
          </h1>

          <p className="text-sm text-muted-foreground mt-1">
            ARK ONE Portal Dashboard
          </p>
        </div>

        <div className="flex items-center gap-2">

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

          <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-full">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            Live
          </div>

        </div>

      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

        <StatCard
          title="Total Tickets"
          value={tickets.length}
          icon={Ticket}
        />

        <StatCard
          title="Open Tickets"
          value={openTickets.length}
          icon={Clock}
        />

        <StatCard
          title="Resolved"
          value={resolvedTickets.length}
          icon={CheckCircle2}
        />

        <StatCard
          title="Critical"
          value={criticalTickets.length}
          icon={AlertTriangle}
        />

      </div>

      {showOpsStats && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

            <StatCard
              title="Banks"
              value={banks.length}
              icon={Building2}
            />

            <StatCard
              title="Devices"
              value={devices.length}
              icon={Cpu}
            />

            <StatCard
              title="Engineers"
              value={engineers.length}
              icon={UserCheck}
            />

            <StatCard
              title="Branches"
              value={branches.length}
              icon={MapPin}
            />

          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

            <StatCard
              title="Active Devices"
              value={activeDevices}
              icon={CheckCircle2}
            />

            <StatCard
              title="Faulty Devices"
              value={faultyDevices}
              icon={AlertTriangle}
            />

            <StatCard
              title="Low Stock"
              value={lowStock}
              icon={Package}
            />

            <StatCard
              title="Pending Requests"
              value={spareRequests.length}
              icon={Boxes}
            />

          </div>
        </>
      )}

      {showMap && <LiveMapPanel compact />}

      <div className="grid lg:grid-cols-3 gap-4">

        <div className="lg:col-span-2 space-y-4">

          <TicketTrendChart tickets={tickets} />

          <TicketStatusChart tickets={tickets} />

        </div>

        <div className="space-y-4">

          <SiteStatusPanel />

          <EngineerActivityFeed />

        </div>

      </div>

      {unreadMessages.length > 0 && (
        <div className="border border-primary/20 rounded-xl bg-primary/5 p-4">

          <div className="flex items-center justify-between mb-3">

            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary" />

              <h3 className="font-semibold text-sm">
                Unread Messages ({unreadMessages.length})
              </h3>
            </div>

            <Link
              to="/ark-connect"
              className="text-xs text-primary hover:underline"
            >
              Open ARK Connect →
            </Link>

          </div>

          <div className="space-y-2">

            {unreadMessages.slice(0, 5).map(n => (
              <Link
                key={n.id}
                to="/ark-connect"
                className="flex items-start gap-3 p-2 bg-card rounded-lg border hover:bg-muted/50 transition-colors block"
              >

                <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 text-xs font-bold">
                  {n.title?.[0]?.toUpperCase() || '?'}
                </div>

                <div className="flex-1 min-w-0">

                  <p className="text-xs font-semibold truncate">
                    {n.title}
                  </p>

                  <p className="text-xs text-muted-foreground truncate">
                    {n.message}
                  </p>

                </div>

              </Link>
            ))}

          </div>

        </div>
      )}

      <RecentTicketsTable
        tickets={tickets}
        showAssignee={role !== 'client'}
      />

    </div>
  );
}