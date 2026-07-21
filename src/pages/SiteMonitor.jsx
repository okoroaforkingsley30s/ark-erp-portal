import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import {
  SITE_HEALTH_STATES,
  buildSiteHealthSites,
  getSiteHealthLabel,
  getSiteHealthStyle,
  summarizeSiteHealth,
} from '@/lib/siteHealth';

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

const getDeviceBank = (device) =>
  device.bank_name || device.bank || device.client_name || device.bankName || 'Unknown Bank';

const getDeviceBranch = (device) =>
  device.branch_name ||
  device.branch ||
  device.location ||
  device.device_location ||
  device.site_name ||
  'Unknown Branch';

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

  const warnings = [];
  const getRows = (result, tableName) => {
    if (result.status !== 'fulfilled') {
      console.error(`Site Monitor ${tableName} query failed:`, result.reason);
      warnings.push(tableName);
      return [];
    }

    if (result.value.error) {
      console.error(`Site Monitor ${tableName} query failed:`, result.value.error);
      warnings.push(tableName);
      return [];
    }

    return result.value.data || [];
  };

  const bankDevices = getRows(bankDevicesResult, 'bank_devices');
  const devices = getRows(devicesResult, 'devices');

  if (warnings.length === 2) {
    throw new Error('Site Health device sources could not be loaded.');
  }

  const merged = [...devices, ...bankDevices];
  const seen = new Set();

  const rows = merged.filter((device) => {
    const key =
      device.id ||
      device.terminal_id ||
      device.device_id ||
      `${getDeviceBank(device)}-${getDeviceBranch(device)}-${device.serial_number || device.part_number || ''}`;

    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { rows, warnings };
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
    data: deviceResult = { rows: [], warnings: [] },
    isLoading,
    error: devicesError,
    refetch,
  } = useQuery({
    queryKey: ['site-monitor-devices'],
    queryFn: fetchDevices,
    refetchInterval: 60000,
  });

  const { data: engineers = [], error: engineersError } = useQuery({
    queryKey: ['engineers-site-monitor'],
    queryFn: fetchEngineers,
  });

  const { data: banks = [], error: banksError } = useQuery({
    queryKey: ['banks'],
    queryFn: fetchBanks,
  });

  const { data: tickets = [], error: ticketsError } = useQuery({
    queryKey: ['tickets-monitor'],
    queryFn: fetchTickets,
    refetchInterval: 60000,
  });

  const { data: branches = [], error: branchesError } = useQuery({
    queryKey: ['branches'],
    queryFn: fetchBranches,
  });

  const devices = deviceResult.rows || [];
  const dataWarnings = deviceResult.warnings || [];
  const queryError = devicesError || branchesError || engineersError || banksError || ticketsError;

  const sites = useMemo(() => {
    return buildSiteHealthSites({ devices, branches, tickets });
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
        const matchStatus = filterStatus === 'all' || site.health === filterStatus;
        const matchEngineer = filterEngineer === 'all' || site.assigned_engineer === filterEngineer;

        return matchSearch && matchBank && matchStatus && matchEngineer;
      }),
    [sites, search, filterBank, filterStatus, filterEngineer]
  );

  const summary = useMemo(() => summarizeSiteHealth(sites), [sites]);

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
          <h1 className="text-3xl font-bold flex items-center gap-2 text-white">
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

      {(queryError || dataWarnings.length > 0) && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Some Site Health data could not be loaded. Refresh the page or contact IT if the issue persists.
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
        {[
          {
            key: 'healthy',
            label: 'Healthy',
            icon: CheckCircle2,
          },
          {
            key: 'warning',
            label: 'Warning',
            icon: AlertTriangle,
          },
          {
            key: 'critical',
            label: 'Critical',
            icon: AlertTriangle,
          },
          {
            key: 'offline',
            label: 'Offline',
            icon: Activity,
          },
          {
            key: 'maintenance',
            label: 'Maintenance',
            icon: Wrench,
          },
          {
            key: 'inactive',
            label: 'Inactive',
            icon: Activity,
          },
          {
            key: 'decommissioned',
            label: 'Decomm.',
            icon: Radio,
          },
          {
            key: 'unknown',
            label: 'Unknown',
            icon: Activity,
          },
        ].map(({ key, label, icon: Icon }) => {
          const style = getSiteHealthStyle(key);

          return (
            <button
              key={key}
              type="button"
              onClick={() => setFilterStatus(filterStatus === key ? 'all' : key)}
              className={`rounded-xl border p-4 text-left transition-all hover:shadow-md ${style.badge}${
                filterStatus === key ? ' ring-2 ring-offset-1 ring-primary' : ''
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <Icon className="w-4 h-4 text-muted-foreground" />
                <span className={`w-2.5 h-2.5 rounded-full ${style.dot}`} />
              </div>

              <p className="text-2xl font-bold">{summary[key] || 0}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </button>
          );
        })}
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
            {SITE_HEALTH_STATES.map((status) => (
              <SelectItem key={status} value={status}>
                {getSiteHealthLabel(status)}
              </SelectItem>
            ))}
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
            const sc = getSiteHealthStyle(site.health);

            return (
              <Card
                key={site.key}
                className="p-4 hover:shadow-lg transition-all border-l-4"
                style={{ borderLeftColor: sc.color }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${sc.dot} ${
                          site.health === 'healthy' ? 'animate-pulse' : ''
                        }`}
                      />
                      <h3 className="font-semibold text-sm truncate">{site.branch_name}</h3>
                    </div>

                    <p className="text-xs text-muted-foreground mt-0.5 ml-4">{site.bank_name}</p>
                  </div>

                  <Badge variant="outline" className={`${sc.badge} text-[10px] ml-2 flex-shrink-0`}>
                    {getSiteHealthLabel(site.health)}
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
                    <p className="text-green-600">Healthy</p>
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
