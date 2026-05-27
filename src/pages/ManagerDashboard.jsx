import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';

import { Card } from '@/components/ui/card';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

import {
  Users,
  Ticket,
  MapPin,
  Cpu,
  AlertTriangle,
  Clock,
  Target,
  Activity,
} from 'lucide-react';

import {
  format,
  subDays,
  startOfDay,
} from 'date-fns';

const COLORS = [
  '#22c55e',
  '#ef4444',
  '#f59e0b',
  '#94a3b8',
  '#6366f1',
];

async function fetchTickets() {
  const { data, error } = await supabase
    .from('tickets')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) throw error;

  return data || [];
}

async function fetchSites() {
  const { data, error } = await supabase
    .from('sites')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) throw error;

  return data || [];
}

async function fetchDevices() {
  const { data, error } = await supabase
    .from('devices')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) throw error;

  return data || [];
}

async function fetchEngineerStatuses() {
  const { data, error } = await supabase
    .from('engineer_statuses')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(100);

  if (error) throw error;

  return data || [];
}

async function fetchSparePartRequests() {
  const { data, error } = await supabase
    .from('spare_part_requests')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) throw error;

  return data || [];
}

async function fetchLeaveRequests() {
  const { data, error } = await supabase
    .from('leave_requests')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw error;

  return data || [];
}

async function fetchPurchaseRequests() {
  const { data, error } = await supabase
    .from('purchase_requests')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw error;

  return data || [];
}

export default function ManagerDashboard() {
  const { user } = useOutletContext();

  const { data: tickets = [] } = useQuery({
    queryKey: ['tickets-mgr'],
    queryFn: fetchTickets,
    refetchInterval: 60000,
  });

  const { data: sites = [] } = useQuery({
    queryKey: ['sites-mgr'],
    queryFn: fetchSites,
  });

  const { data: devices = [] } = useQuery({
    queryKey: ['devices-mgr'],
    queryFn: fetchDevices,
  });

  const { data: engineers = [] } = useQuery({
    queryKey: ['eng-statuses-mgr'],
    queryFn: fetchEngineerStatuses,
  });

  const { data: partRequests = [] } = useQuery({
    queryKey: ['spare-req-mgr'],
    queryFn: fetchSparePartRequests,
  });

  const { data: leaves = [] } = useQuery({
    queryKey: ['leaves-mgr'],
    queryFn: fetchLeaveRequests,
  });

  const { data: procReqs = [] } = useQuery({
    queryKey: ['proc-mgr'],
    queryFn: fetchPurchaseRequests,
  });

  // 7 day trend
  const trendData = Array.from({ length: 7 }, (_, i) => {
    const d = subDays(new Date(), 6 - i);

    const count = tickets.filter((t) => {
      if (!t.created_at) return false;

      return (
        startOfDay(new Date(t.created_at)).getTime() ===
        startOfDay(d).getTime()
      );
    }).length;

    return {
      day: format(d, 'EEE'),
      count,
    };
  });

  // Ticket status breakdown
  const statusData = [
    'new',
    'assigned',
    'in_progress',
    'pending',
    'resolved',
    'closed',
  ]
    .map((s) => ({
      name: s.replace('_', ' '),
      value: tickets.filter((t) => t.status === s).length,
    }))
    .filter((x) => x.value > 0);

  // Device stats
  const deviceStats = {
    operational: devices.filter(
      (d) => d.status === 'operational'
    ).length,

    faulty: devices.filter(
      (d) => d.status === 'faulty'
    ).length,

    maintenance: devices.filter(
      (d) => d.status === 'under_maintenance'
    ).length,

    offline: devices.filter(
      (d) => d.status === 'offline'
    ).length,
  };

  // SLA
  const resolved = tickets.filter((t) =>
    ['resolved', 'closed'].includes(t.status)
  );

  const slaRate =
    tickets.length > 0
      ? Math.round((resolved.length / tickets.length) * 100)
      : 0;

  // Active engineers
  const activeEngineers = engineers.filter((e) =>
    ['online', 'on_site', 'busy'].includes(e.status)
  ).length;

  const kpis = [
    {
      label: 'Open Tickets',
      value: tickets.filter(
        (t) => !['resolved', 'closed'].includes(t.status)
      ).length,
      icon: Ticket,
      cls: 'border-blue-200 bg-blue-50',
      vCls: 'text-blue-700',
    },

    {
      label: 'Critical Issues',
      value: tickets.filter(
        (t) =>
          t.priority === 'critical' &&
          !['resolved', 'closed'].includes(t.status)
      ).length,
      icon: AlertTriangle,
      cls: 'border-red-200 bg-red-50',
      vCls: 'text-red-700',
    },

    {
      label: 'Active Engineers',
      value: `${activeEngineers}/${engineers.length}`,
      icon: Users,
      cls: 'border-green-200 bg-green-50',
      vCls: 'text-green-700',
    },

    {
      label: 'Down Sites',
      value: sites.filter(
        (s) => s.status === 'down'
      ).length,
      icon: MapPin,
      cls: 'border-amber-200 bg-amber-50',
      vCls: 'text-amber-700',
    },

    {
      label: 'Faulty Devices',
      value: deviceStats.faulty,
      icon: Cpu,
      cls: 'border-red-100 bg-red-50',
      vCls: 'text-red-600',
    },

    {
      label: 'Resolution Rate',
      value: `${slaRate}%`,
      icon: Target,
      cls: 'border-green-200 bg-green-50',
      vCls: 'text-green-700',
    },

    {
      label: 'Pending Leaves',
      value: leaves.length,
      icon: Clock,
      cls: 'border-purple-200 bg-purple-50',
      vCls: 'text-purple-700',
    },

    {
      label: 'Pending POs',
      value: procReqs.length,
      icon: Activity,
      cls: 'border-orange-200 bg-orange-50',
      vCls: 'text-orange-700',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          Manager Dashboard
        </h1>

        <p className="text-sm text-muted-foreground">
          Executive overview — ARK ONE Operations
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <div
            key={k.label}
            className={`rounded-xl border p-4 ${k.cls}`}
          >
            <k.icon className="w-5 h-5 text-muted-foreground mb-2" />

            <p className={`text-2xl font-bold ${k.vCls}`}>
              {k.value}
            </p>

            <p className="text-xs text-muted-foreground">
              {k.label}
            </p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <h3 className="font-semibold text-sm mb-4">
            Ticket Volume — 7 Days
          </h3>

          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={trendData}>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#f0f0f0"
              />

              <XAxis
                dataKey="day"
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />

              <YAxis
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />

              <Tooltip />

              <Bar
                dataKey="count"
                fill="hsl(var(--primary))"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold text-sm mb-4">
            Ticket Status Breakdown
          </h3>

          <div className="flex items-center gap-4">
            <ResponsiveContainer width="50%" height={180}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={75}
                  dataKey="value"
                >
                  {statusData.map((_, i) => (
                    <Cell
                      key={i}
                      fill={COLORS[i % COLORS.length]}
                    />
                  ))}
                </Pie>

                <Tooltip />
              </PieChart>
            </ResponsiveContainer>

            <div className="space-y-2">
              {statusData.map((s, i) => (
                <div
                  key={s.name}
                  className="flex items-center gap-2 text-xs"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{
                      background:
                        COLORS[i % COLORS.length],
                    }}
                  />

                  <span className="capitalize text-muted-foreground">
                    {s.name}
                  </span>

                  <span className="font-semibold ml-auto">
                    {s.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}