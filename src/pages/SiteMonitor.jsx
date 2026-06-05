import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
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
    light: 'bg-green-500/15 text-green-300',
    borderLeft: '#22c55e',
  },
  Faulty: {
    label: 'Faulty',
    dot: 'bg-red-500',
    border: 'border-red-200',
    light: 'bg-red-500/15 text-red-300',
    borderLeft: '#ef4444',
  },
  'Under Maintenance': {
    label: 'Maintenance',
    dot: 'bg-amber-400',
    border: 'border-amber-200',
    light: 'bg-amber-500/15 text-amber-300',
    borderLeft: '#f59e0b',
  },
  Inactive: {
    label: 'Inactive',
    dot: 'bg-slate-400',
    border: 'border-slate-200',
    light: 'bg-slate-500/15 text-slate-300',
    borderLeft: '#94a3b8',
  },
  Decommissioned: {
    label: 'Decomm.',
    dot: 'bg-gray-300',
    border: 'border-gray-200',
    light: 'bg-gray-50 text-gray-500',
    borderLeft: '#d1d5db',
  },
};

const normalize = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

const getDeviceStatus = (device) => {
  const raw = normalize(device.device_status || device.status || device.state || device.current_status);

  if (['active', 'operational', 'online', 'working', 'available'].includes(raw)) {
    return 'Active';
  }

  if (['faulty', 'fault', 'failed', 'down', 'not_working', 'offline', 'out_of_service'].includes(raw)) {
    return 'Faulty';
  }

  if (['under_maintenance', 'maintenance', 'in_maintenance', 'repair', 'under_repair'].includes(raw)) {
    return 'Under Maintenance';
  }

  if (['decommissioned', 'retired', 'scrapped'].includes(raw)) {
    return 'Decommissioned';
  }

  if (['inactive', 'disabled', 'unknown', ''].includes(raw)) {
    return 'Inactive';
  }

  return 'Inactive';
};

const hasSlaAlert = (device) => {
  const raw = normalize(device.sla_status || device.sla_state || device.sla || device.health_status);
  return ['warning', 'breached', 'critical', 'at_risk', 'sla_breached'].includes(raw);
};

const isOpenTicket = (ticket) => {
  const status = normalize(ticket.status);
  const completionStatus = normalize(ticket.completion_status);

  return ![
    'closed',
    'resolved',
    'completed',
    'approved',
    'cancelled',
    'canceled',
  ].includes(status) && !['approved', 'completed', 'closed'].includes(completionStatus);
};

const getDeviceBank = (device) =>
  device.bank_name || device.bank || device.client_name || device.bankName || 'Unknown Bank';

const getDeviceBranch = (device) =>
  device.branch_name ||
  device.branch ||
  device.location ||
  device.device_location ||
  device.site_name ||
  'Unknown Branch';

const getDeviceEngineer = (device, branch) =>
  device.assigned_engineer ||
  device.engineer_name ||
  device.assigned_to_name ||
  device.assigned_to ||
  branch?.assigned_engineer ||
  branch?.engineer_name ||
  '';

async function fetchDevices() {
  const [bankDevicesResult, devicesResult] = await Promise.allSettled([
    supabase
      .from('bank_devices')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(3000),
    supabase
      .from('devices')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(3000),
  ]);

  const bankDevices =
    bankDevicesResult.status === 'fulfilled' && !bankDevicesResult.value.error
      ? bankDevicesResult.value.data || []
      : [];

  const devices =
    devicesResult.status === 'fulfilled' && !devicesResult.value.error
      ? devicesResult.value.data || []
      : [];

  const merged = [...devices, ...bankDevices];
  const seen = new Set();

  return merged.filter((device) => {
    const key =
      device.id ||
      device.terminal_id ||
      device.device_id ||
      `${getDeviceBank(device)}-${getDeviceBranch(device)}-${device.serial_number || device.part_number || ''}`;

    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function fetchBranches() {
  const { data, error } = await supabase.from('branches').select('*');
  if (error) throw error;
  return data || [];
}

async function fetchEngineers() {
  const [engineersResult, usersResult] = await Promise.allSettled([
    supabase.from('engineers').select('*'),
    supabase.from('users').select('*').in('role', ['engineer', 'field_engineer', 'Field Engineer']),
  ]);

  const engineers =
    engineersResult.status === 'fulfilled' && !engineersResult.value.error
      ? engineersResult.value.data || []
      : [];

  const users =
    usersResult.status === 'fulfilled' && !usersResult.value.error
      ? usersResult.value.data || []
      : [];

  return [...engineers, ...users];
}

async function fetchBanks() {
  const { data, error } = await supabase.from('banks').select('*');
  if (error) throw error;
  return data || [];
}

async function fetchTickets() {
  const { data, error } = await supabase
    .from('tickets')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1000);

  if (error) throw error;
  return data || [];
}

export default function SiteMonitor() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filterBank, setFilterBank] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterEngineer, setFilterEngineer] = useState('all');

  const {
    data: devices = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['site-monitor-devices'],
    queryFn: fetchDevices,
    refetchInterval: 60000,
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: fetchBranches,
  });

  const { data: engineers = [] } = useQuery({
    queryKey: ['engineers-site-monitor'],
    queryFn: fetchEngineers,
  });

  const { data: banks = [] } = useQuery({
    queryKey: ['banks'],
    queryFn: fetchBanks,
  });

  const { data: tickets = [] } = useQuery({
    queryKey: ['tickets-monitor'],
    queryFn: fetchTickets,
    refetchInterval: 60000,
  });

  const sites = useMemo(() => {
    const map = {};

    devices.forEach((device) => {
      const bankName = getDeviceBank(device);
      const branchName = getDeviceBranch(device);
      const key = `${bankName}__${branchName}`;

      if (!map[key]) {
        const branch = branches.find(
          (b) =>
            normalize(b.branch_name || b.name) === normalize(branchName) &&
            normalize(b.bank_name || b.bank) === normalize(bankName)
        );

        map[key] = {
          key,
          bank_name: bankName,
          branch_name: branchName,
          region: branch?.region || device.region || device.state || '',
          assigned_engineer: getDeviceEngineer(device, branch),
          devices: [],
        };
      }

      map[key].devices.push(device);
    });

    return Object.values(map).map((site) => {
      const total = site.devices.length;
      const active = site.devices.filter((device) => getDeviceStatus(device) === 'Active').length;
      const faulty = site.devices.filter((device) => getDeviceStatus(device) === 'Faulty').length;
      const maintenance = site.devices.filter((device) => getDeviceStatus(device) === 'Under Maintenance').length;
      const inactive = site.devices.filter((device) => getDeviceStatus(device) === 'Inactive').length;
      const decommissioned = site.devices.filter((device) => getDeviceStatus(device) === 'Decommissioned').length;
      const slaAlerts = site.devices.filter(hasSlaAlert).length;

      const openTickets = tickets.filter((ticket) => {
        const sameBank = normalize(ticket.bank_name || ticket.bank) === normalize(site.bank_name);
        const ticketBranch = ticket.branch_name || ticket.device_location || ticket.location || ticket.site_name;
        const sameBranch = normalize(ticketBranch) === normalize(site.branch_name);
        return sameBank && sameBranch && isOpenTicket(ticket);
      }).length;

      let status = 'Active';

      if (total === 0) {
        status = 'Inactive';
      } else if (faulty > 0 && faulty + maintenance >= total) {
        status = 'Faulty';
      } else if (faulty > 0 || maintenance > 0 || slaAlerts > 0 || openTickets > 0) {
        status = 'Under Maintenance';
      } else if (active === 0 && inactive + decommissioned >= total) {
        status = 'Inactive';
      }

      return {
        ...site,
        total,
        active,
        faulty,
        maintenance,
        inactive,
        decommissioned,
        slaAlerts,
        openTickets,
        status,
      };
    });
  }, [devices, branches, tickets]);

  const filtered = useMemo(
    () =>
      sites.filter((site) => {
        const q = search.toLowerCase();

        const matchSearch =
          !search ||
          site.branch_name?.toLowerCase().includes(q) ||
          site.bank_name?.toLowerCase().includes(q) ||
          site.region?.toLowerCase().includes(q) ||
          site.assigned_engineer?.toLowerCase().includes(q);

        const matchBank = filterBank === 'all' || site.bank_name === filterBank;
        const matchStatus = filterStatus === 'all' || site.status === filterStatus;
        const matchEngineer = filterEngineer === 'all' || site.assigned_engineer === filterEngineer;

        return matchSearch && matchBank && matchStatus && matchEngineer;
      }),
    [sites, search, filterBank, filterStatus, filterEngineer]
  );

  const counts = useMemo(
    () => ({
      Active: sites.filter((site) => site.status === 'Active').length,
      Faulty: sites.filter((site) => site.status === 'Faulty').length,
      Maintenance: sites.filter((site) => site.status === 'Under Maintenance').length,
      Inactive: sites.filter((site) => site.status === 'Inactive').length,
    }),
    [sites]
  );

  const bankOptions = useMemo(() => {
    const fromSites = sites.map((site) => site.bank_name).filter(Boolean);
    const fromBanks = banks.map((bank) => bank.bank_name || bank.name).filter(Boolean);
    return [...new Set([...fromBanks, ...fromSites])].sort();
  }, [banks, sites]);

  const engineerOptions = useMemo(() => {
    const fromSites = sites.map((site) => site.assigned_engineer).filter(Boolean);
    const fromEngineers = engineers
      .map((engineer) => engineer.engineer_name || engineer.full_name || engineer.name || engineer.email)
      .filter(Boolean);

    return [...new Set([...fromEngineers, ...fromSites])].sort();
  }, [engineers, sites]);

  const goToDevices = (site, status = 'all') => {
    const params = new URLSearchParams();

    if (site?.bank_name) params.set('bank', site.bank_name);
    if (site?.branch_name) params.set('branch', site.branch_name);
    if (status && status !== 'all') params.set('status', status);

    navigate(`/bank-devices?${params.toString()}`);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Radio className="w-6 h-6 text-primary" />
            Site Monitor
          </h1>

          <p className="text-sm text-muted-foreground mt-0.5">
            Real-time device status across all bank branches — {sites.length} sites · {devices.length} devices
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={() => refetch()}>
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
            cls: 'border-green-500/30 bg-green-500/15 text-white',
          },
          {
            key: 'Faulty',
            label: 'Faulty',
            icon: AlertTriangle,
            cls: 'border-red-500/30 bg-red-500/15 text-white',
          },
          {
            key: 'Maintenance',
            label: 'Maintenance',
            icon: Wrench,
            cls: 'border-amber-500/30 bg-amber-500/15 text-white',
          },
          {
            key: 'Inactive',
            label: 'Inactive',
            icon: Activity,
            cls: 'border-slate-500/30 bg-slate-500/15 text-white',
          },
        ].map(({ key, label, icon: Icon, cls }) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilterStatus(filterStatus === key ? 'all' : key)}
            className={`rounded-xl border p-4 text-left transition-all hover:shadow-md ${cls}${
              filterStatus === key ? ' ring-2 ring-offset-1 ring-primary' : ''
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <Icon className="w-4 h-4 text-muted-foreground" />
              <span className={`w-2.5 h-2.5 rounded-full ${STATUS_CFG[key]?.dot || STATUS_CFG.Active.dot}`} />
            </div>

            <p className="text-2xl font-bold">{counts[key] || 0}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search branch, bank, engineer, region..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Select value={filterBank} onValueChange={setFilterBank}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All Banks" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Banks</SelectItem>
            {bankOptions.map((bankName) => (
              <SelectItem key={bankName} value={bankName}>
                {bankName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="Faulty">Faulty</SelectItem>
            <SelectItem value="Under Maintenance">Maintenance</SelectItem>
            <SelectItem value="Inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterEngineer} onValueChange={setFilterEngineer}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All Engineers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Engineers</SelectItem>
            {engineerOptions.map((engineerName) => (
              <SelectItem key={engineerName} value={engineerName}>
                {engineerName}
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
          {filtered.map((site) => {
            const sc = STATUS_CFG[site.status] || STATUS_CFG.Active;

            return (
              <Card
                key={site.key}
                className="p-4 hover:shadow-lg transition-all border-l-4"
                style={{ borderLeftColor: sc.borderLeft }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${sc.dot} ${
                          site.status === 'Active' ? 'animate-pulse' : ''
                        }`}
                      />
                      <h3 className="font-semibold text-sm truncate">{site.branch_name}</h3>
                    </div>

                    <p className="text-xs text-muted-foreground mt-0.5 ml-4">{site.bank_name}</p>
                  </div>

                  <Badge variant="outline" className={`${sc.light} ${sc.border} text-[10px] ml-2 flex-shrink-0`}>
                    {sc.label}
                  </Badge>
                </div>

                <div className="space-y-1.5 text-xs text-muted-foreground mb-3">
                  {site.region && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3 h-3 flex-shrink-0" />
                      <span>{site.region}</span>
                    </div>
                  )}

                  {site.assigned_engineer && (
                    <div className="flex items-center gap-1.5">
                      <User className="w-3 h-3 flex-shrink-0" />
                      <span>{site.assigned_engineer}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5">
                    <Cpu className="w-3 h-3 flex-shrink-0" />
                    <span>
                      {site.active}/{site.total} devices active
                    </span>
                  </div>

                  {site.openTickets > 0 && (
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle className="w-3 h-3 text-orange-500 flex-shrink-0" />
                      <span className="text-orange-600">{site.openTickets} open ticket(s)</span>
                    </div>
                  )}

                  {site.slaAlerts > 0 && (
                    <div className="flex items-center gap-1.5">
                      <Activity className="w-3 h-3 text-red-500 flex-shrink-0" />
                      <span className="text-red-600">{site.slaAlerts} SLA alert(s)</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-4 gap-1.5 text-center text-[10px]">
                  <button
                    type="button"
                    onClick={() => goToDevices(site, 'active')}
                    className="bg-green-50 rounded p-1 hover:ring-2 hover:ring-green-400 transition-all cursor-pointer"
                    title="View active devices for this site"
                  >
                    <p className="font-bold text-green-700">{site.active}</p>
                    <p className="text-green-600">Active</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => goToDevices(site, 'faulty')}
                    className="bg-red-50 rounded p-1 hover:ring-2 hover:ring-red-400 transition-all cursor-pointer"
                    title="View faulty devices for this site"
                  >
                    <p className="font-bold text-red-700">{site.faulty}</p>
                    <p className="text-red-600">Faulty</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => goToDevices(site, 'maintenance')}
                    className="bg-amber-50 rounded p-1 hover:ring-2 hover:ring-amber-400 transition-all cursor-pointer"
                    title="View maintenance devices for this site"
                  >
                    <p className="font-bold text-amber-700">{site.maintenance}</p>
                    <p className="text-amber-600">Maint.</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => goToDevices(site, 'all')}
                    className="bg-muted rounded p-1 hover:ring-2 hover:ring-primary transition-all cursor-pointer"
                    title="View all devices for this site"
                  >
                    <p className="font-bold">{site.total}</p>
                    <p className="text-muted-foreground">Total</p>
                  </button>
                </div>
              </Card>
            );
          })}

          {filtered.length === 0 && !isLoading && (
            <div className="col-span-full text-center py-16 text-muted-foreground">
              <MapPin className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No sites found</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
