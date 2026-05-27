import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

import { Badge } from '@/components/ui/badge';

import {
  Building2,
  Cpu,
  Users,
  MapPin,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Activity,
} from 'lucide-react';

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

const COLORS = [
  '#f59e0b',
  '#ef4444',
  '#3b82f6',
  '#10b981',
  '#8b5cf6',
  '#f97316',
];

const REGION_COLORS = {
  NORTH: '#3b82f6',
  SE: '#10b981',
  SW: '#f59e0b',
  'S/SOUTH': '#8b5cf6',
};

async function fetchDevices() {
  const { data, error } = await supabase
    .from('bank_devices')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(2000);

  if (error) throw error;

  return data || [];
}

async function fetchBanks() {
  const { data, error } = await supabase
    .from('banks')
    .select('*');

  if (error) throw error;

  return data || [];
}

async function fetchEngineers() {
  const { data, error } = await supabase
    .from('engineers')
    .select('*');

  if (error) throw error;

  return data || [];
}

async function fetchBranches() {
  const { data, error } = await supabase
    .from('branches')
    .select('*');

  if (error) throw error;

  return data || [];
}

export default function OperationsDashboard() {
  const { data: devices = [] } = useQuery({
    queryKey: ['bankDevices-ops'],
    queryFn: fetchDevices,
  });

  const { data: banks = [] } = useQuery({
    queryKey: ['banks-ops'],
    queryFn: fetchBanks,
  });

  const { data: engineers = [] } = useQuery({
    queryKey: ['engineers-ops'],
    queryFn: fetchEngineers,
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['branches-ops'],
    queryFn: fetchBranches,
  });

  const stats = useMemo(() => {
    const active = devices.filter(
      (d) => d.device_status === 'Active'
    ).length;

    const inactive = devices.filter(
      (d) => d.device_status === 'Inactive'
    ).length;

    const faulty = devices.filter(
      (d) =>
        d.device_status === 'Faulty' ||
        d.device_status === 'Under Maintenance'
    ).length;

    const slaAlerts = devices.filter(
      (d) =>
        d.sla_status === 'Warning' ||
        d.sla_status === 'Breached' ||
        d.sla_status === 'Critical'
    ).length;

    const unassigned = devices.filter(
      (d) => !d.assigned_engineer
    ).length;

    return {
      active,
      inactive,
      faulty,
      slaAlerts,
      unassigned,
    };
  }, [devices]);

  const byBank = useMemo(() => {
    const map = {};

    devices.forEach((d) => {
      map[d.bank_name] =
        (map[d.bank_name] || 0) + 1;
    });

    return Object.entries(map)
      .map(([name, count]) => ({
        name,
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }, [devices]);

  const byEngineer = useMemo(() => {
    const map = {};

    devices.forEach((d) => {
      if (d.assigned_engineer) {
        map[d.assigned_engineer] =
          (map[d.assigned_engineer] || 0) + 1;
      }
    });

    return Object.entries(map)
      .map(([name, count]) => ({
        name,
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [devices]);

  const byRegion = useMemo(() => {
    const map = {};

    devices.forEach((d) => {
      const eng = engineers.find(
        (e) =>
          e.engineer_name ===
          d.assigned_engineer
      );

      const region =
        eng?.region || 'Unknown';

      map[region] =
        (map[region] || 0) + 1;
    });

    return Object.entries(map).map(
      ([name, count]) => ({
        name,
        count,
      })
    );
  }, [devices, engineers]);

  const statusDist = useMemo(() => {
    const map = {};

    devices.forEach((d) => {
      const status =
        d.device_status || 'Unknown';

      map[status] =
        (map[status] || 0) + 1;
    });

    return Object.entries(map).map(
      ([name, value]) => ({
        name,
        value,
      })
    );
  }, [devices]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          Operations Dashboard
        </h1>

        <p className="text-muted-foreground text-sm">
          Real-time enterprise view of all banking devices
        </p>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        {[
          {
            label: 'Total Banks',
            value: banks.length,
            icon: Building2,
            color: 'text-blue-500',
          },

          {
            label: 'Total Branches',
            value: branches.length,
            icon: MapPin,
            color: 'text-purple-500',
          },

          {
            label: 'Total Devices',
            value: devices.length,
            icon: Cpu,
            color: 'text-yellow-500',
          },

          {
            label: 'Engineers',
            value: engineers.length,
            icon: Users,
            color: 'text-green-500',
          },

          {
            label: 'Active',
            value: stats.active,
            icon: CheckCircle,
            color: 'text-green-500',
          },

          {
            label: 'Faulty/Maint.',
            value: stats.faulty,
            icon: AlertTriangle,
            color: 'text-red-500',
          },

          {
            label: 'SLA Alerts',
            value: stats.slaAlerts,
            icon: Activity,
            color: 'text-orange-500',
          },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4 flex flex-col gap-1">
              <s.icon
                className={`w-5 h-5 ${s.color}`}
              />

              <p className="text-2xl font-bold">
                {s.value}
              </p>

              <p className="text-xs text-muted-foreground">
                {s.label}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Bank */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              Devices per Bank
            </CardTitle>
          </CardHeader>

          <CardContent>
            <ResponsiveContainer
              width="100%"
              height={220}
            >
              <BarChart
                data={byBank}
                margin={{ left: -10 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="opacity-30"
                />

                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                />

                <YAxis
                  tick={{ fontSize: 11 }}
                />

                <Tooltip />

                <Bar
                  dataKey="count"
                  fill="#f59e0b"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              Device Status Distribution
            </CardTitle>
          </CardHeader>

          <CardContent>
            <ResponsiveContainer
              width="100%"
              height={220}
            >
              <PieChart>
                <Pie
                  data={statusDist}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({
                    name,
                    percent,
                  }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                  labelLine={false}
                >
                  {statusDist.map((_, i) => (
                    <Cell
                      key={i}
                      fill={
                        COLORS[
                          i % COLORS.length
                        ]
                      }
                    />
                  ))}
                </Pie>

                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Region */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              Regional Device Distribution
            </CardTitle>
          </CardHeader>

          <CardContent>
            <ResponsiveContainer
              width="100%"
              height={200}
            >
              <BarChart
                data={byRegion}
                margin={{ left: -10 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="opacity-30"
                />

                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                />

                <YAxis
                  tick={{ fontSize: 11 }}
                />

                <Tooltip />

                <Bar
                  dataKey="count"
                  radius={[4, 4, 0, 0]}
                >
                  {byRegion.map(
                    (entry, i) => (
                      <Cell
                        key={i}
                        fill={
                          REGION_COLORS[
                            entry.name
                          ] || '#94a3b8'
                        }
                      />
                    )
                  )}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Engineers */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              Top Engineers by Device Count
            </CardTitle>
          </CardHeader>

          <CardContent>
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {byEngineer.map((e, i) => (
                <div
                  key={e.name}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-4">
                      {i + 1}.
                    </span>

                    <span className="text-sm font-medium">
                      {e.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{
                          width: `${
                            (e.count /
                              byEngineer[0]
                                ?.count) *
                            100
                          }%`,
                        }}
                      />
                    </div>

                    <Badge
                      variant="secondary"
                      className="text-xs"
                    >
                      {e.count}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
          <CardContent className="p-4 flex items-center gap-4">
            <AlertTriangle className="w-8 h-8 text-orange-500" />

            <div>
              <p className="text-2xl font-bold text-orange-600">
                {stats.slaAlerts}
              </p>

              <p className="text-sm text-orange-700 dark:text-orange-400">
                Devices with SLA Alerts
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20">
          <CardContent className="p-4 flex items-center gap-4">
            <TrendingUp className="w-8 h-8 text-yellow-500" />

            <div>
              <p className="text-2xl font-bold text-yellow-600">
                {stats.unassigned}
              </p>

              <p className="text-sm text-yellow-700 dark:text-yellow-400">
                Unassigned Devices
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}