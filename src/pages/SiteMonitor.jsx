import React, {
  useState,
  useMemo,
} from 'react';

import {
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { supabase } from '@/lib/supabaseClient';

import { Card } from '@/components/ui/card';

import { Badge } from '@/components/ui/badge';

import { Button } from '@/components/ui/button';

import { Input } from '@/components/ui/input';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import {
  Search,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  Wrench,
  Cpu,
  User,
  RefreshCw,
  Radio,
  Activity,
} from 'lucide-react';

const STATUS_CFG = {
  Active: {
    label: 'Active',
    dot: 'bg-green-500',
    border: 'border-green-200',
    light:
      'bg-green-50 text-green-700',
    borderLeft: '#22c55e',
  },

  Faulty: {
    label: 'Faulty',
    dot: 'bg-red-500',
    border: 'border-red-200',
    light:
      'bg-red-50 text-red-700',
    borderLeft: '#ef4444',
  },

  'Under Maintenance': {
    label: 'Maintenance',
    dot: 'bg-amber-400',
    border: 'border-amber-200',
    light:
      'bg-amber-50 text-amber-700',
    borderLeft: '#f59e0b',
  },

  Inactive: {
    label: 'Inactive',
    dot: 'bg-slate-400',
    border: 'border-slate-200',
    light:
      'bg-slate-50 text-slate-600',
    borderLeft: '#94a3b8',
  },

  Decommissioned: {
    label: 'Decomm.',
    dot: 'bg-gray-300',
    border: 'border-gray-200',
    light:
      'bg-gray-50 text-gray-500',
    borderLeft: '#d1d5db',
  },
};

async function fetchDevices() {
  const { data, error } =
    await supabase
      .from('bank_devices')
      .select('*')
      .order('created_at', {
        ascending: false,
      })
      .limit(3000);

  if (error) throw error;

  return data || [];
}

async function fetchBranches() {
  const { data, error } =
    await supabase
      .from('branches')
      .select('*');

  if (error) throw error;

  return data || [];
}

async function fetchEngineers() {
  const { data, error } =
    await supabase
      .from('engineers')
      .select('*');

  if (error) throw error;

  return data || [];
}

async function fetchBanks() {
  const { data, error } =
    await supabase
      .from('banks')
      .select('*');

  if (error) throw error;

  return data || [];
}

async function fetchTickets() {
  const { data, error } =
    await supabase
      .from('tickets')
      .select('*')
      .order('created_at', {
        ascending: false,
      })
      .limit(500);

  if (error) throw error;

  return data || [];
}

export default function SiteMonitor() {
  const qc = useQueryClient();

  const [search, setSearch] =
    useState('');

  const [
    filterBank,
    setFilterBank,
  ] = useState('all');

  const [
    filterStatus,
    setFilterStatus,
  ] = useState('all');

  const [
    filterEngineer,
    setFilterEngineer,
  ] = useState('all');

  const {
    data: devices = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['site-monitor-devices'],

    queryFn: fetchDevices,

    refetchInterval: 60000,
  });

  const {
    data: branches = [],
  } = useQuery({
    queryKey: ['branches'],

    queryFn: fetchBranches,
  });

  const {
    data: engineers = [],
  } = useQuery({
    queryKey: ['engineers'],

    queryFn: fetchEngineers,
  });

  const {
    data: banks = [],
  } = useQuery({
    queryKey: ['banks'],

    queryFn: fetchBanks,
  });

  const {
    data: tickets = [],
  } = useQuery({
    queryKey: ['tickets-monitor'],

    queryFn: fetchTickets,
  });

  // Site grouping
  const sites = useMemo(() => {
    const map = {};

    devices.forEach((d) => {
      const key = `${d.bank_name}__${d.branch_name}`;

      if (!map[key]) {
        const branch =
          branches.find(
            (b) =>
              b.branch_name ===
                d.branch_name &&
              b.bank_name ===
                d.bank_name
          );

        map[key] = {
          key,

          bank_name:
            d.bank_name,

          branch_name:
            d.branch_name,

          region:
            branch?.region || '',

          assigned_engineer:
            d.assigned_engineer ||
            branch?.assigned_engineer ||
            '',

          devices: [],
        };
      }

      map[key].devices.push(d);
    });

    return Object.values(map).map(
      (site) => {
        const total =
          site.devices.length;

        const active =
          site.devices.filter(
            (d) =>
              d.device_status ===
              'Active'
          ).length;

        const faulty =
          site.devices.filter(
            (d) =>
              d.device_status ===
                'Faulty' ||
              d.device_status ===
                'Under Maintenance'
          ).length;

        const slaAlerts =
          site.devices.filter(
            (d) =>
              [
                'Warning',
                'Breached',
                'Critical',
              ].includes(
                d.sla_status
              )
          ).length;

        const openTickets =
          tickets.filter(
            (t) =>
              t.bank_name ===
                site.bank_name &&
              (t.branch_name ===
                site.branch_name ||
                t.device_location ===
                  site.branch_name) &&
              ![
                'closed',
                'resolved',
              ].includes(
                t.status
              )
          ).length;

        let status =
          'Active';

        if (
          faulty > 0 &&
          faulty === total
        ) {
          status = 'Faulty';
        } else if (
          faulty > 0
        ) {
          status =
            'Under Maintenance';
        } else if (
          active === 0
        ) {
          status =
            'Inactive';
        }

        return {
          ...site,
          total,
          active,
          faulty,
          slaAlerts,
          openTickets,
          status,
        };
      }
    );
  }, [
    devices,
    branches,
    tickets,
  ]);

  const filtered = useMemo(
    () =>
      sites.filter((s) => {
        const q =
          search.toLowerCase();

        const matchSearch =
          !search ||
          s.branch_name
            ?.toLowerCase()
            .includes(q) ||
          s.bank_name
            ?.toLowerCase()
            .includes(q) ||
          s.region
            ?.toLowerCase()
            .includes(q) ||
          s.assigned_engineer
            ?.toLowerCase()
            .includes(q);

        const matchBank =
          filterBank ===
            'all' ||
          s.bank_name ===
            filterBank;

        const matchStatus =
          filterStatus ===
            'all' ||
          s.status ===
            filterStatus;

        const matchEng =
          filterEngineer ===
            'all' ||
          s.assigned_engineer ===
            filterEngineer;

        return (
          matchSearch &&
          matchBank &&
          matchStatus &&
          matchEng
        );
      }),
    [
      sites,
      search,
      filterBank,
      filterStatus,
      filterEngineer,
    ]
  );

  const counts = useMemo(
    () => ({
      Active:
        sites.filter(
          (s) =>
            s.status ===
            'Active'
        ).length,

      Faulty:
        sites.filter(
          (s) =>
            s.status ===
            'Faulty'
        ).length,

      Maintenance:
        sites.filter(
          (s) =>
            s.status ===
            'Under Maintenance'
        ).length,

      Inactive:
        sites.filter(
          (s) =>
            s.status ===
            'Inactive'
        ).length,
    }),
    [sites]
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Radio className="w-6 h-6 text-primary" />
            Site Monitor
          </h1>

          <p className="text-sm text-muted-foreground mt-0.5">
            Real-time device status across all bank branches — {sites.length} sites
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
        >
          <RefreshCw className="w-4 h-4 mr-1" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            key: 'Active',
            label: 'Active Sites',
            icon: CheckCircle2,
            cls:
              'border-green-200 bg-green-50',
          },

          {
            key: 'Faulty',
            label: 'Faulty',
            icon: AlertTriangle,
            cls:
              'border-red-200 bg-red-50',
          },

          {
            key: 'Maintenance',
            label: 'Maintenance',
            icon: Wrench,
            cls:
              'border-amber-200 bg-amber-50',
          },

          {
            key: 'Inactive',
            label: 'Inactive',
            icon: Activity,
            cls:
              'border-slate-200 bg-slate-50',
          },
        ].map(
          ({
            key,
            label,
            icon: Ic,
            cls,
          }) => (
            <button
              key={key}
              onClick={() =>
                setFilterStatus(
                  filterStatus ===
                    key
                    ? 'all'
                    : key
                )
              }
              className={`rounded-xl border p-4 text-left transition-all hover:shadow-md ${cls}${
                filterStatus ===
                key
                  ? ' ring-2 ring-offset-1 ring-primary'
                  : ''
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <Ic className="w-4 h-4 text-muted-foreground" />

                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    STATUS_CFG[
                      key
                    ]?.dot ||
                    STATUS_CFG
                      .Active.dot
                  }`}
                />
              </div>

              <p className="text-2xl font-bold">
                {counts[key] || 0}
              </p>

              <p className="text-xs text-muted-foreground">
                {label}
              </p>
            </button>
          )
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />

          <Input
            placeholder="Search branch, bank, engineer, region..."
            className="pl-9"
            value={search}
            onChange={(e) =>
              setSearch(
                e.target.value
              )
            }
          />
        </div>

        <Select
          value={filterBank}
          onValueChange={
            setFilterBank
          }
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All Banks" />
          </SelectTrigger>

          <SelectContent>
            <SelectItem value="all">
              All Banks
            </SelectItem>

            {banks.map((b) => (
              <SelectItem
                key={b.id}
                value={
                  b.bank_name
                }
              >
                {b.bank_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filterStatus}
          onValueChange={
            setFilterStatus
          }
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>

          <SelectContent>
            <SelectItem value="all">
              All Status
            </SelectItem>

            <SelectItem value="Active">
              Active
            </SelectItem>

            <SelectItem value="Faulty">
              Faulty
            </SelectItem>

            <SelectItem value="Under Maintenance">
              Maintenance
            </SelectItem>

            <SelectItem value="Inactive">
              Inactive
            </SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filterEngineer}
          onValueChange={
            setFilterEngineer
          }
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All Engineers" />
          </SelectTrigger>

          <SelectContent>
            <SelectItem value="all">
              All Engineers
            </SelectItem>

            {engineers.map((e) => (
              <SelectItem
                key={e.id}
                value={
                  e.engineer_name
                }
              >
                {
                  e.engineer_name
                }
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(
            (site) => {
              const sc =
                STATUS_CFG[
                  site.status
                ] ||
                STATUS_CFG.Active;

              return (
                <Card
                  key={site.key}
                  className="p-4 hover:shadow-lg transition-all border-l-4"
                  style={{
                    borderLeftColor:
                      sc.borderLeft,
                  }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${sc.dot} ${
                            site.status ===
                            'Active'
                              ? 'animate-pulse'
                              : ''
                          }`}
                        />

                        <h3 className="font-semibold text-sm truncate">
                          {
                            site.branch_name
                          }
                        </h3>
                      </div>

                      <p className="text-xs text-muted-foreground mt-0.5 ml-4">
                        {
                          site.bank_name
                        }
                      </p>
                    </div>

                    <Badge
                      variant="outline"
                      className={`${sc.light} ${sc.border} text-[10px] ml-2 flex-shrink-0`}
                    >
                      {sc.label}
                    </Badge>
                  </div>

                  <div className="space-y-1.5 text-xs text-muted-foreground mb-3">
                    {site.region && (
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3 h-3 flex-shrink-0" />

                        <span>
                          {
                            site.region
                          }
                        </span>
                      </div>
                    )}

                    {site.assigned_engineer && (
                      <div className="flex items-center gap-1.5">
                        <User className="w-3 h-3 flex-shrink-0" />

                        <span>
                          {
                            site.assigned_engineer
                          }
                        </span>
                      </div>
                    )}

                    <div className="flex items-center gap-1.5">
                      <Cpu className="w-3 h-3 flex-shrink-0" />

                      <span>
                        {
                          site.active
                        }
                        /
                        {
                          site.total
                        }{' '}
                        devices active
                      </span>
                    </div>

                    {site.openTickets >
                      0 && (
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle className="w-3 h-3 text-orange-500 flex-shrink-0" />

                        <span className="text-orange-600">
                          {
                            site.openTickets
                          }{' '}
                          open
                          ticket(s)
                        </span>
                      </div>
                    )}

                    {site.slaAlerts >
                      0 && (
                      <div className="flex items-center gap-1.5">
                        <Activity className="w-3 h-3 text-red-500 flex-shrink-0" />

                        <span className="text-red-600">
                          {
                            site.slaAlerts
                          }{' '}
                          SLA
                          alert(s)
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 text-center text-[10px]">
                    <div className="bg-green-50 rounded p-1">
                      <p className="font-bold text-green-700">
                        {
                          site.active
                        }
                      </p>

                      <p className="text-green-600">
                        Active
                      </p>
                    </div>

                    <div className="bg-red-50 rounded p-1">
                      <p className="font-bold text-red-700">
                        {
                          site.faulty
                        }
                      </p>

                      <p className="text-red-600">
                        Faulty
                      </p>
                    </div>

                    <div className="bg-muted rounded p-1">
                      <p className="font-bold">
                        {
                          site.total
                        }
                      </p>

                      <p className="text-muted-foreground">
                        Total
                      </p>
                    </div>
                  </div>
                </Card>
              );
            }
          )}

          {filtered.length ===
            0 &&
            !isLoading && (
              <div className="col-span-full text-center py-16 text-muted-foreground">
                <MapPin className="w-10 h-10 mx-auto mb-3 opacity-30" />

                <p className="font-medium">
                  No sites found
                </p>
              </div>
            )}
        </div>
      )}
    </div>
  );
}