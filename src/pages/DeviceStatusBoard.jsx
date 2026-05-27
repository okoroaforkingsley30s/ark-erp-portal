import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';

import {
  Search,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Wrench,
  Activity,
  Loader2
} from 'lucide-react';

const STATUS_CONFIG = {
  Active: {
    icon: CheckCircle2,
    color: 'text-green-500',
    bg: 'bg-green-50 dark:bg-green-950/20',
    border: 'border-green-200'
  },

  Inactive: {
    icon: XCircle,
    color: 'text-gray-400',
    bg: 'bg-gray-50 dark:bg-gray-900/20',
    border: 'border-gray-200'
  },

  Faulty: {
    icon: AlertTriangle,
    color: 'text-red-500',
    bg: 'bg-red-50 dark:bg-red-950/20',
    border: 'border-red-200'
  },

  'Under Maintenance': {
    icon: Wrench,
    color: 'text-yellow-500',
    bg: 'bg-yellow-50 dark:bg-yellow-950/20',
    border: 'border-yellow-200'
  },

  Decommissioned: {
    icon: XCircle,
    color: 'text-gray-300',
    bg: 'bg-gray-100',
    border: 'border-gray-100'
  },
};

export default function DeviceStatusBoard() {

  const [search, setSearch] = useState('');

  const [filterBank, setFilterBank] = useState('all');

  const [filterSLA, setFilterSLA] = useState('all');

  const [filterEngineer, setFilterEngineer] = useState('all');

  const {
    data: devices = [],
    isLoading
  } = useQuery({
    queryKey: ['devices-status-board'],

    queryFn: async () => {

      const { data, error } = await supabase
        .from('devices')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error(error);
        return [];
      }

      return data || [];
    },
  });

  const {
    data: banks = []
  } = useQuery({
    queryKey: ['banks'],

    queryFn: async () => {

      const { data, error } = await supabase
        .from('banks')
        .select('*')
        .order('bank_name', { ascending: true });

      if (error) {
        console.error(error);
        return [];
      }

      return data || [];
    },
  });

  const {
    data: engineers = []
  } = useQuery({
    queryKey: ['engineers'],

    queryFn: async () => {

      const { data, error } = await supabase
        .from('engineers')
        .select('*')
        .order('engineer_name', { ascending: true });

      if (error) {
        console.error(error);
        return [];
      }

      return data || [];
    },
  });

  const counts = useMemo(() => ({
    Active:
      devices.filter(
        d => d.device_status === 'Active'
      ).length,

    Inactive:
      devices.filter(
        d => d.device_status === 'Inactive'
      ).length,

    Faulty:
      devices.filter(
        d => d.device_status === 'Faulty'
      ).length,

    Maintenance:
      devices.filter(
        d => d.device_status === 'Under Maintenance'
      ).length,

    SLAAlert:
      devices.filter(
        d =>
          ['Warning', 'Breached', 'Critical']
            .includes(d.sla_status)
      ).length,

  }), [devices]);

  const filtered = useMemo(() => {

    return devices.filter(d => {

      const q = search.toLowerCase();

      const matchSearch =
        !search ||
        d.device_name?.toLowerCase().includes(q) ||
        d.branch_name?.toLowerCase().includes(q) ||
        d.atm_terminal_id?.toString().includes(q) ||
        d.terminal_id?.toString().includes(q);

      const matchBank =
        filterBank === 'all' ||
        d.bank_name === filterBank ||
        d.client_name === filterBank;

      const matchSLA =
        filterSLA === 'all' ||
        d.sla_status === filterSLA;

      const matchEng =
        filterEngineer === 'all' ||
        d.assigned_engineer === filterEngineer ||
        d.assigned_engineer_name === filterEngineer;

      return (
        matchSearch &&
        matchBank &&
        matchSLA &&
        matchEng
      );
    });

  }, [
    devices,
    search,
    filterBank,
    filterSLA,
    filterEngineer
  ]);

  const grouped = useMemo(() => {

    const groups = {
      Faulty: [],
      'Under Maintenance': [],
      Inactive: [],
      Active: [],
      Decommissioned: []
    };

    filtered.forEach(d => {

      const key =
        d.device_status ||
        d.status ||
        'Active';

      if (groups[key]) {
        groups[key].push(d);
      }
    });

    return groups;

  }, [filtered]);

  return (
    <div className="p-6 space-y-6">

      <div>
        <h1 className="text-2xl font-bold">
          Device Status Board
        </h1>

        <p className="text-muted-foreground text-sm">
          Live status view of all banking devices
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">

        {[
          {
            label: 'Active',
            count: counts.Active,
            color: 'text-green-600',
            icon: CheckCircle2
          },

          {
            label: 'Inactive',
            count: counts.Inactive,
            color: 'text-gray-500',
            icon: XCircle
          },

          {
            label: 'Faulty',
            count: counts.Faulty,
            color: 'text-red-600',
            icon: AlertTriangle
          },

          {
            label: 'In Maintenance',
            count: counts.Maintenance,
            color: 'text-yellow-600',
            icon: Wrench
          },

          {
            label: 'SLA Alerts',
            count: counts.SLAAlert,
            color: 'text-orange-600',
            icon: Activity
          },

        ].map(s => (

          <Card key={s.label}>

            <CardContent className="p-3 flex items-center gap-3">

              <s.icon className={`w-5 h-5 ${s.color}`} />

              <div>

                <p className={`text-xl font-bold ${s.color}`}>
                  {s.count}
                </p>

                <p className="text-[10px] text-muted-foreground">
                  {s.label}
                </p>

              </div>

            </CardContent>

          </Card>
        ))}

      </div>

      <div className="flex flex-wrap gap-3">

        <div className="relative flex-1 min-w-[200px]">

          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />

          <Input
            placeholder="Search..."
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />

        </div>

        <Select
          value={filterBank}
          onValueChange={setFilterBank}
        >

          <SelectTrigger className="w-32">
            <SelectValue placeholder="Bank" />
          </SelectTrigger>

          <SelectContent>

            <SelectItem value="all">
              All Banks
            </SelectItem>

            {banks.map(b => (

              <SelectItem
                key={b.id}
                value={b.bank_name}
              >
                {b.bank_name}
              </SelectItem>
            ))}

          </SelectContent>

        </Select>

        <Select
          value={filterSLA}
          onValueChange={setFilterSLA}
        >

          <SelectTrigger className="w-36">
            <SelectValue placeholder="SLA Status" />
          </SelectTrigger>

          <SelectContent>

            <SelectItem value="all">
              All SLA
            </SelectItem>

            {[
              'Normal',
              'Warning',
              'Breached',
              'Critical'
            ].map(s => (

              <SelectItem
                key={s}
                value={s}
              >
                {s}
              </SelectItem>
            ))}

          </SelectContent>

        </Select>

        <Select
          value={filterEngineer}
          onValueChange={setFilterEngineer}
        >

          <SelectTrigger className="w-40">
            <SelectValue placeholder="Engineer" />
          </SelectTrigger>

          <SelectContent>

            <SelectItem value="all">
              All Engineers
            </SelectItem>

            {engineers.map(e => (

              <SelectItem
                key={e.id}
                value={e.engineer_name}
              >
                {e.engineer_name}
              </SelectItem>
            ))}

          </SelectContent>

        </Select>

      </div>

      {isLoading ? (

        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>

      ) : (

        <div className="space-y-6">

          {Object.entries(grouped)
            .filter(([, items]) => items.length > 0)
            .map(([status, items]) => {

              const cfg =
                STATUS_CONFIG[status] ||
                STATUS_CONFIG.Active;

              const Icon = cfg.icon;

              return (

                <div key={status}>

                  <div className="flex items-center gap-2 mb-3">

                    <Icon className={`w-4 h-4 ${cfg.color}`} />

                    <h3 className="font-semibold">
                      {status}
                    </h3>

                    <Badge variant="secondary">
                      {items.length}
                    </Badge>

                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">

                    {items.map(device => (

                      <Card
                        key={device.id}
                        className={`${cfg.bg} ${cfg.border} border hover:shadow-md transition-shadow`}
                      >

                        <CardContent className="p-3 space-y-2">

                          <div className="flex justify-between items-start">

                            <span className="font-medium text-sm leading-tight">
                              {
                                device.device_name ||
                                device.name ||
                                device.branch_name
                              }
                            </span>

                            <Badge
                              variant="outline"
                              className="text-[10px] ml-1 flex-shrink-0"
                            >
                              {
                                device.bank_name ||
                                device.client_name
                              }
                            </Badge>

                          </div>

                          {(device.atm_terminal_id || device.terminal_id) && (

                            <p className="font-mono text-[10px] text-muted-foreground">
                              {
                                device.atm_terminal_id ||
                                device.terminal_id
                              }
                            </p>
                          )}

                          <div className="flex items-center justify-between">

                            {(
                              device.assigned_engineer ||
                              device.assigned_engineer_name
                            ) ? (

                              <span className="text-xs text-muted-foreground">
                                {
                                  device.assigned_engineer ||
                                  device.assigned_engineer_name
                                }
                              </span>

                            ) : (

                              <span className="text-xs text-red-400 italic">
                                Unassigned
                              </span>
                            )}

                            {device.sla_status &&
                              device.sla_status !== 'Normal' && (

                              <Badge
                                variant="destructive"
                                className="text-[9px]"
                              >
                                {device.sla_status}
                              </Badge>
                            )}

                          </div>

                        </CardContent>

                      </Card>
                    ))}

                  </div>

                </div>
              );
            })}

        </div>
      )}

    </div>
  );
}