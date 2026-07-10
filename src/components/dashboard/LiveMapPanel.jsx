import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import { supabase } from '@/lib/supabaseClient';
import {
  buildSiteHealthSites,
  getSiteHealthLabel,
  getSiteHealthStyle,
} from '@/lib/siteHealth';

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';

import {
  Navigation,
  MapPin,
  Maximize2,
  Minimize2,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Wrench,
  User,
  X,
  Truck,
  Radio,
  MonitorCog,
  Users,
} from 'lucide-react';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const ENGINEER_STATUS = {
  online: {
    label: 'Online',
    color: '#22c55e',
    bg: 'bg-green-500/15',
    text: 'text-green-300',
    border: 'border-green-400',
  },
  traveling: {
    label: 'In Transit',
    color: '#3b82f6',
    bg: 'bg-blue-500/15',
    text: 'text-blue-300',
    border: 'border-blue-400',
  },
  on_site: {
    label: 'On Site',
    color: '#f59e0b',
    bg: 'bg-amber-500/15',
    text: 'text-amber-300',
    border: 'border-amber-400',
  },
  busy: {
    label: 'Assigned',
    color: '#f59e0b',
    bg: 'bg-amber-500/15',
    text: 'text-amber-300',
    border: 'border-amber-400',
  },
  offline: {
    label: 'Offline',
    color: '#94a3b8',
    bg: 'bg-slate-500/15',
    text: 'text-slate-300',
    border: 'border-slate-400',
  },
};

const mapSiteStatusStyle = (status, bg, text, border) => ({
  ...getSiteHealthStyle(status),
  bg,
  text,
  border,
});

const SITE_STATUS = {
  healthy: mapSiteStatusStyle('healthy', 'bg-green-500/15', 'text-green-300', 'border-green-400'),
  warning: mapSiteStatusStyle('warning', 'bg-amber-500/15', 'text-amber-300', 'border-amber-400'),
  critical: mapSiteStatusStyle('critical', 'bg-red-500/15', 'text-red-300', 'border-red-400'),
  offline: mapSiteStatusStyle('offline', 'bg-slate-500/15', 'text-slate-300', 'border-slate-400'),
  maintenance: mapSiteStatusStyle('maintenance', 'bg-blue-500/15', 'text-blue-300', 'border-blue-400'),
  inactive: mapSiteStatusStyle('inactive', 'bg-slate-600/15', 'text-slate-300', 'border-slate-500'),
  decommissioned: mapSiteStatusStyle('decommissioned', 'bg-zinc-500/15', 'text-zinc-300', 'border-zinc-400'),
  unknown: mapSiteStatusStyle('unknown', 'bg-slate-500/15', 'text-slate-200', 'border-slate-400'),
};

const ACTIVE_TICKET_STATUSES = [
  'new',
  'open',
  'assigned',
  'accepted',
  'traveling',
  'in_transit',
  'en_route',
  'arrived_on_site',
  'arrived',
  'on_site',
  'in_progress',
  'working',
  'pending_review',
  'pending_closure_approval',
  'pending_parts',
  'pending_bank',
];

const normalize = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

const normalizeName = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const getFirst = (...values) =>
  values.find((v) => v !== null && v !== undefined && String(v).trim() !== '') || '';

const getEngineerEmail = (engineer) =>
  getFirst(
    engineer.engineer_email,
    engineer.email,
    engineer.user_email,
    engineer.staff_email,
    engineer.work_email,
    engineer.assigned_engineer_email
  );

const getEngineerPhone = (engineer) =>
  getFirst(engineer.phone, engineer.phone_number, engineer.mobile, engineer.mobile_number, engineer.telephone);

const getEngineerName = (engineer) =>
  getFirst(
    engineer.engineer_name,
    engineer.full_name,
    engineer.name,
    engineer.staff_name,
    engineer.employee_name,
    engineer.assigned_engineer,
    engineer.assigned_to_name,
    engineer.assigned_to,
    getEngineerEmail(engineer),
    'Engineer'
  );

const getEngineerLat = (engineer) =>
  toNumber(
    getFirst(
      engineer.current_latitude,
      engineer.last_latitude,
      engineer.latitude,
      engineer.lat,
      engineer.site_latitude
    )
  );

const getEngineerLng = (engineer) =>
  toNumber(
    getFirst(
      engineer.current_longitude,
      engineer.last_longitude,
      engineer.longitude,
      engineer.lng,
      engineer.long,
      engineer.site_longitude
    )
  );

const engineerHasCoords = (engineer) =>
  getEngineerLat(engineer) !== null && getEngineerLng(engineer) !== null;

const getEngineerMergeKeys = (engineer) => {
  const email = getEngineerEmail(engineer);
  const phone = getEngineerPhone(engineer);
  const name = getEngineerName(engineer);

  return [
    email ? `email:${normalize(email)}` : '',
    phone ? `phone:${normalize(phone)}` : '',
    engineer.staff_id ? `staff:${normalize(engineer.staff_id)}` : '',
    engineer.employee_id ? `employee:${normalize(engineer.employee_id)}` : '',
    engineer.engineer_id ? `engineer:${normalize(engineer.engineer_id)}` : '',
    engineer.user_id ? `user:${normalize(engineer.user_id)}` : '',
    engineer.id ? `id:${normalize(engineer.id)}` : '',
    name ? `name:${normalizeName(name)}` : '',
  ].filter(Boolean);
};

const getTicketEngineerKeys = (ticket) => {
  const email = getFirst(
    ticket.assigned_engineer_email,
    ticket.engineer_email,
    ticket.assigned_to_email,
    ticket.assigned_email
  );
  const name = getFirst(
    ticket.assigned_engineer,
    ticket.assigned_to_name,
    ticket.assigned_to,
    ticket.engineer_name
  );

  return [
    email ? `email:${normalize(email)}` : '',
    ticket.assigned_engineer_id ? `engineer:${normalize(ticket.assigned_engineer_id)}` : '',
    ticket.engineer_id ? `engineer:${normalize(ticket.engineer_id)}` : '',
    ticket.staff_id ? `staff:${normalize(ticket.staff_id)}` : '',
    ticket.user_id ? `user:${normalize(ticket.user_id)}` : '',
    name ? `name:${normalizeName(name)}` : '',
  ].filter(Boolean);
};

const ticketToEngineerStatus = (ticketStatus) => {
  const s = normalize(ticketStatus);

  if (['traveling', 'in_transit', 'en_route', 'start_trip', 'on_the_way'].includes(s)) {
    return 'traveling';
  }

  if (
    [
      'arrived_on_site',
      'arrived',
      'on_site',
      'at_site',
      'in_progress',
      'working',
      'start_work',
      'pending_review',
      'pending_closure_approval',
    ].includes(s)
  ) {
    return 'on_site';
  }

  if (['accepted', 'assigned', 'busy'].includes(s)) return 'busy';
  if (['offline', 'inactive', 'logged_out'].includes(s)) return 'offline';

  return 'online';
};

const getEngineerStatus = (engineer) => {
  const raw = getFirst(
    engineer.status,
    engineer.current_status,
    engineer.field_status,
    engineer.availability_status,
    engineer.ticket_status,
    engineer.completion_status
  );

  const s = normalize(raw);

  if (['online', 'available', 'active', 'idle'].includes(s)) return 'online';
  if (['traveling', 'in_transit', 'en_route', 'start_trip', 'on_the_way', 'on_route'].includes(s)) {
    return 'traveling';
  }
  if (
    [
      'on_site',
      'arrived_on_site',
      'arrived',
      'at_site',
      'working',
      'start_work',
      'in_progress',
      'pending_review',
      'pending_closure_approval',
    ].includes(s)
  ) {
    return 'on_site';
  }
  if (['busy', 'assigned', 'accepted'].includes(s)) return 'busy';
  if (['offline', 'inactive', 'logged_out', 'unavailable'].includes(s)) return 'offline';

  return s || 'offline';
};

const isEngineerRole = (row) => {
  const role = normalize(
    getFirst(row.role, row.staff_role, row.employee_role, row.position, row.job_title, row.designation)
  );
  const dept = normalize(getFirst(row.department, row.unit, row.team));

  return (
    ['engineer', 'field_engineer', 'field_engineers', 'field_engr', 'engr', 'technician'].includes(role) ||
    role.includes('engineer') ||
    dept.includes('engineer') ||
    dept.includes('field')
  );
};

const getDeviceStatus = (device) => {
  const s = normalize(
    getFirst(device.device_status, device.status, device.state, device.operational_status, device.health_status)
  );

  if (['active', 'operational', 'working', 'available', 'online', 'healthy'].includes(s)) return 'active';
  if (['faulty', 'failed', 'down', 'out_of_service', 'not_working', 'critical'].includes(s)) return 'faulty';
  if (
    ['maintenance', 'under_maintenance', 'repair', 'in_repair', 'wip', 'pending_parts', 'pending_bank'].includes(s)
  ) {
    return 'maintenance';
  }
  if (['offline', 'inactive', 'decommissioned'].includes(s)) return 'offline';

  return 'unknown';
};

const getDeviceLat = (device, branch) =>
  toNumber(getFirst(device.latitude, device.lat, device.current_latitude, branch?.latitude, branch?.lat));

const getDeviceLng = (device, branch) =>
  toNumber(
    getFirst(device.longitude, device.lng, device.long, device.current_longitude, branch?.longitude, branch?.lng, branch?.long)
  );

const getBranchKey = (bank, branch) =>
  `${String(bank || '').trim().toLowerCase()}__${String(branch || '').trim().toLowerCase()}`;

function mergeByKeys(records) {
  const recordsByKey = new Map();
  const aliasToMaster = new Map();

  const mergeRecords = (existing, incoming) => {
    const merged = { ...existing };

    Object.entries(incoming).forEach(([key, value]) => {
      if (value !== null && value !== undefined && String(value).trim?.() !== '') {
        if (!merged[key] || key.startsWith('current_') || key === 'status' || key === 'last_active') {
          merged[key] = value;
        }
      }
    });

    return merged;
  };

  records.forEach((record) => {
    const keys = getEngineerMergeKeys(record);
    if (keys.length === 0) return;

    const master = keys.map((k) => aliasToMaster.get(k)).find(Boolean) || keys[0];
    const existing = recordsByKey.get(master) || {};
    const merged = mergeRecords(existing, record);

    recordsByKey.set(master, merged);
    keys.forEach((key) => aliasToMaster.set(key, master));
  });

  return Array.from(recordsByKey.values());
}

function humanIcon(color) {
  return L.divIcon({
    className: '',
    html: `
      <div style="
        width:36px;height:36px;border-radius:999px;background:${color};
        border:3px solid white;display:flex;align-items:center;justify-content:center;
        color:white;font-size:19px;font-weight:900;
        box-shadow:0 8px 22px rgba(0,0,0,.40),0 0 0 5px ${color}33;
      ">👤</div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

function atmIcon(color, count = 1) {
  return L.divIcon({
    className: '',
    html: `
      <div style="
        min-width:40px;height:38px;padding:0 7px;border-radius:12px;background:${color};
        border:3px solid white;display:flex;align-items:center;justify-content:center;gap:3px;
        color:white;font-size:16px;font-weight:900;
        box-shadow:0 8px 22px rgba(0,0,0,.40),0 0 0 5px ${color}33;
      "><span>🏧</span><span style="font-size:11px">${count}</span></div>
    `,
    iconSize: [42, 38],
    iconAnchor: [21, 19],
  });
}

async function safeFetch(table, select = '*', options = {}) {
  try {
    let query = supabase.from(table).select(select);

    if (options.orderBy) {
      query = query.order(options.orderBy, { ascending: options.ascending ?? false });
    }

    if (options.limit) query = query.limit(options.limit);

    const { data, error } = await query;
    if (error) {
      console.error(`Live Map ${table} query failed:`, error);
      return { rows: [], warning: table };
    }

    return { rows: data || [], warning: null };
  } catch (error) {
    console.error(`Live Map ${table} query failed:`, error);
    return { rows: [], warning: table };
  }
}

async function fetchCurrentMapData() {
  const [
    engineers,
    employees,
    staff,
    staffDirectory,
    profiles,
    users,
    engineerStatuses,
    devices,
    bankDevices,
    branches,
    sites,
    tickets,
  ] = await Promise.all([
    safeFetch('engineers', '*', { limit: 2000 }),
    safeFetch('employees', '*', { limit: 2000 }),
    safeFetch('staff', '*', { limit: 2000 }),
    safeFetch('staff_directory', '*', { limit: 2000 }),
    safeFetch('profiles', '*', { limit: 2000 }),
    safeFetch('users', '*', { limit: 2000 }),
    safeFetch('engineer_statuses', '*', { orderBy: 'last_active', limit: 2000 }),
    safeFetch('devices', '*', { orderBy: 'created_at', limit: 5000 }),
    safeFetch('bank_devices', '*', { orderBy: 'created_at', limit: 5000 }),
    safeFetch('branches', '*', { limit: 5000 }),
    safeFetch('sites', '*', { limit: 5000 }),
    safeFetch('tickets', '*', { orderBy: 'updated_at', limit: 2000 }),
  ]);

  if (devices.warning && bankDevices.warning) {
    throw new Error('Site Health device sources could not be loaded.');
  }

  const warnings = [
    engineers,
    employees,
    staff,
    staffDirectory,
    profiles,
    users,
    engineerStatuses,
    devices,
    bankDevices,
    branches,
    sites,
    tickets,
  ]
    .map((result) => result.warning)
    .filter(Boolean);

  return {
    staffEngineers: [
      ...engineers.rows,
      ...employees.rows,
      ...staff.rows,
      ...staffDirectory.rows,
      ...profiles.rows,
      ...users.rows,
    ].filter(isEngineerRole),
    engineerStatuses: engineerStatuses.rows,
    devices: [...devices.rows, ...bankDevices.rows],
    branches: branches.rows,
    sourceSites: sites.rows,
    tickets: tickets.rows,
    warnings,
  };
}

function buildEngineers(staffEngineers, engineerStatuses, tickets) {
  const activeTickets = tickets.filter((ticket) =>
    ACTIVE_TICKET_STATUSES.includes(normalize(ticket.status || ticket.completion_status))
  );

  const ticketByKey = new Map();
  activeTickets.forEach((ticket) => {
    getTicketEngineerKeys(ticket).forEach((key) => {
      if (key && !ticketByKey.has(key)) ticketByKey.set(key, ticket);
    });
  });

  const mergedRecords = mergeByKeys([...staffEngineers, ...engineerStatuses]);

  const engineersWithTickets = mergedRecords.map((engineer) => {
    const keys = getEngineerMergeKeys(engineer);
    const assignedTicket = keys.map((key) => ticketByKey.get(key)).find(Boolean);
    const ticketStatus = assignedTicket?.status || assignedTicket?.completion_status;
    const liveStatus = getEngineerStatus(engineer);
    const status = assignedTicket ? ticketToEngineerStatus(ticketStatus) : liveStatus;

    return {
      ...engineer,
      id: getFirst(engineer.id, engineer.engineer_id, engineer.staff_id, engineer.user_id, getEngineerEmail(engineer), getEngineerName(engineer)),
      engineer_name: getEngineerName(engineer),
      engineer_email: getEngineerEmail(engineer),
      status,
      current_ticket_id: getFirst(engineer.current_ticket_id, assignedTicket?.id),
      ticket_number: getFirst(engineer.ticket_number, assignedTicket?.ticket_number),
      ticket_status: ticketStatus || engineer.ticket_status,
      terminal_id: getFirst(engineer.terminal_id, assignedTicket?.terminal_id),
      current_site_name: getFirst(
        engineer.current_site_name,
        assignedTicket?.branch_name,
        assignedTicket?.site_name,
        assignedTicket?.location,
        assignedTicket?.device_location,
        assignedTicket?.bank_name
      ),
      current_latitude: getFirst(
        engineer.current_latitude,
        engineer.last_latitude,
        engineer.latitude,
        assignedTicket?.current_latitude,
        assignedTicket?.latitude,
        assignedTicket?.site_latitude
      ),
      current_longitude: getFirst(
        engineer.current_longitude,
        engineer.last_longitude,
        engineer.longitude,
        engineer.lng,
        assignedTicket?.current_longitude,
        assignedTicket?.longitude,
        assignedTicket?.site_longitude
      ),
      last_active: getFirst(engineer.last_active, engineer.updated_at, assignedTicket?.updated_at, assignedTicket?.created_at),
    };
  });

  activeTickets.forEach((ticket) => {
    const keys = getTicketEngineerKeys(ticket);
    const exists = engineersWithTickets.some((eng) => {
      const engKeys = getEngineerMergeKeys(eng);
      return keys.some((key) => engKeys.includes(key));
    });

    if (!exists && keys.length > 0) {
      engineersWithTickets.push({
        id: getFirst(ticket.assigned_engineer_id, ticket.engineer_id, ticket.staff_id, keys[0]),
        engineer_name: getFirst(ticket.assigned_engineer, ticket.assigned_to_name, ticket.assigned_to, ticket.engineer_name, 'Unknown Engineer'),
        engineer_email: getFirst(ticket.assigned_engineer_email, ticket.engineer_email, ticket.assigned_to_email),
        status: ticketToEngineerStatus(ticket.status || ticket.completion_status),
        current_ticket_id: ticket.id,
        ticket_number: ticket.ticket_number,
        ticket_status: ticket.status,
        terminal_id: ticket.terminal_id,
        current_site_name: getFirst(ticket.branch_name, ticket.site_name, ticket.location, ticket.device_location, ticket.bank_name),
        current_latitude: getFirst(ticket.current_latitude, ticket.latitude, ticket.site_latitude),
        current_longitude: getFirst(ticket.current_longitude, ticket.longitude, ticket.site_longitude),
        last_active: getFirst(ticket.updated_at, ticket.created_at),
      });
    }
  });

  return mergeByKeys(engineersWithTickets).sort((a, b) => {
    const da = new Date(a.last_active || 0).getTime();
    const db = new Date(b.last_active || 0).getTime();
    return db - da;
  });
}

function buildSiteGroups(devices, branches, tickets) {
  return buildSiteHealthSites({ devices, branches, tickets })
    .map((site) => ({
      ...site,
      latitude: toNumber(site.latitude),
      longitude: toNumber(site.longitude),
    }))
    .filter((site) => site.latitude !== null && site.longitude !== null);
}

export default function LiveMapPanel({ compact = false }) {
  const [expanded, setExpanded] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [layerFilter, setLayerFilter] = useState('all');
  const [detailPanel, setDetailPanel] = useState(null);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['live-operations-map-command-center'],
    queryFn: fetchCurrentMapData,
    refetchInterval: 15000,
  });

  const engineers = useMemo(
    () => buildEngineers(data?.staffEngineers || [], data?.engineerStatuses || [], data?.tickets || []),
    [data]
  );

  const siteGroups = useMemo(
    () => buildSiteGroups(data?.devices || [], [...(data?.branches || []), ...(data?.sourceSites || [])], data?.tickets || []),
    [data]
  );

  const mappedEngineers = useMemo(() => engineers.filter(engineerHasCoords), [engineers]);

  const engineerGroups = useMemo(
    () => ({
      all: engineers,
      mapped: mappedEngineers,
      online: engineers.filter((e) => getEngineerStatus(e) === 'online'),
      onSite: engineers.filter((e) => getEngineerStatus(e) === 'on_site'),
      inTransit: engineers.filter((e) => getEngineerStatus(e) === 'traveling'),
      offline: engineers.filter((e) => getEngineerStatus(e) === 'offline'),
      active: engineers.filter((e) => getEngineerStatus(e) !== 'offline'),
    }),
    [engineers, mappedEngineers]
  );

  const siteStatusGroups = useMemo(
    () => ({
      all: siteGroups,
      healthy: siteGroups.filter((s) => s.health === 'healthy'),
      warning: siteGroups.filter((s) => s.health === 'warning'),
      critical: siteGroups.filter((s) => s.health === 'critical'),
      maintenance: siteGroups.filter((s) => s.health === 'maintenance'),
      offline: siteGroups.filter((s) => s.health === 'offline'),
      inactive: siteGroups.filter((s) => s.health === 'inactive'),
      unknown: siteGroups.filter((s) => s.health === 'unknown'),
    }),
    [siteGroups]
  );

  const visibleEngineers = useMemo(() => {
    if (layerFilter === 'engineers_online') return mappedEngineers.filter((e) => getEngineerStatus(e) === 'online');
    if (layerFilter === 'engineers_on_site') return mappedEngineers.filter((e) => getEngineerStatus(e) === 'on_site');
    if (layerFilter === 'engineers_transit') return mappedEngineers.filter((e) => getEngineerStatus(e) === 'traveling');
    if (layerFilter === 'engineers_offline') return mappedEngineers.filter((e) => getEngineerStatus(e) === 'offline');
    if (layerFilter.startsWith('sites_')) return [];
    return mappedEngineers;
  }, [layerFilter, mappedEngineers]);

  const visibleSites = useMemo(() => {
    if (layerFilter === 'sites_active') return siteStatusGroups.healthy;
    if (layerFilter === 'sites_down') return siteStatusGroups.critical;
    if (layerFilter === 'sites_wip') return siteStatusGroups.maintenance;
    if (layerFilter === 'sites_offline') return siteStatusGroups.offline;
    if (layerFilter.startsWith('engineers_')) return [];
    return siteGroups;
  }, [layerFilter, siteGroups, siteStatusGroups]);

  const stats = useMemo(
    () => ({
      engineersOnline: engineerGroups.online.length,
      engineersOnSite: engineerGroups.onSite.length,
      engineersInTransit: engineerGroups.inTransit.length,
      engineersOffline: engineerGroups.offline.length,
      engineersTotal: engineers.length,
      engineersMapped: mappedEngineers.length,
      activeSites: siteStatusGroups.healthy.length,
      downSites: siteStatusGroups.critical.length,
      maintenanceSites: siteStatusGroups.maintenance.length,
      offlineSites: siteStatusGroups.offline.length,
      totalSites: siteGroups.length,
      totalDevices: data?.devices?.length || 0,
    }),
    [engineerGroups, engineers.length, mappedEngineers.length, siteStatusGroups, siteGroups.length, data?.devices?.length]
  );

  const center = [9.082, 8.675];
  const mapHeight = minimized ? 'h-[120px]' : compact ? 'h-[340px]' : 'h-[520px]';

  const handleCardClick = (filter, panel) => {
    setLayerFilter(filter);
    setDetailPanel(panel);
  };

  const MapView = ({ zoom = 6 }) => (
    <MapContainer center={center} zoom={zoom} style={{ height: '100%', width: '100%' }} zoomControl scrollWheelZoom>
      <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

      {visibleSites.map((site) => {
        const cfg = SITE_STATUS[site.health] || SITE_STATUS.unknown;

        return (
          <Marker key={`site-${site.key}`} position={[site.latitude, site.longitude]} icon={atmIcon(cfg.color, site.total)}>
            <Popup>
              <div className="min-w-[240px] space-y-2">
                <div>
                  <p className="font-bold text-sm">🏧 {site.branch_name}</p>
                  <p className="text-xs text-gray-500">{site.bank_name}</p>
                </div>

                <div className="text-xs">
                  <span style={{ color: cfg.color, fontWeight: 800 }}>● Machine/Site: {getSiteHealthLabel(site.health)}</span>
                  {site.region && <span className="text-gray-500"> · {site.region}</span>}
                </div>

                <div className="grid grid-cols-2 gap-1 text-xs">
                  <div>Machines: <b>{site.total}</b></div>
                  <div>Open tickets: <b>{site.openTickets}</b></div>
                  <div>Healthy: <b>{site.counts.healthy}</b></div>
                  <div>Critical: <b>{site.counts.critical}</b></div>
                  <div>WIP: <b>{site.counts.maintenance}</b></div>
                  <div>Offline: <b>{site.counts.offline}</b></div>
                </div>

                <div className="flex flex-wrap gap-1 pt-1">
                  <Link
                    to={`/bank-devices?bank=${encodeURIComponent(site.bank_name)}&branch=${encodeURIComponent(site.branch_name)}`}
                    className="text-xs rounded-md bg-blue-600 px-2 py-1 text-white"
                  >
                    View machines
                  </Link>

                  <Link
                    to={`/tickets?bank=${encodeURIComponent(site.bank_name)}&branch=${encodeURIComponent(site.branch_name)}`}
                    className="text-xs rounded-md bg-slate-700 px-2 py-1 text-white"
                  >
                    View tickets
                  </Link>
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}

      {visibleEngineers.map((eng, index) => {
        const status = getEngineerStatus(eng);
        const cfg = ENGINEER_STATUS[status] || ENGINEER_STATUS.offline;
        const lat = getEngineerLat(eng);
        const lng = getEngineerLng(eng);

        if (lat === null || lng === null) return null;

        return (
          <Marker
            key={`engineer-${eng.id || getEngineerEmail(eng) || getEngineerName(eng)}-${index}`}
            position={[lat, lng]}
            icon={humanIcon(cfg.color)}
          >
            <Popup>
              <div className="min-w-[220px] space-y-1">
                <p className="font-bold text-sm">👤 {getEngineerName(eng)}</p>
                <p className="text-xs capitalize" style={{ color: cfg.color }}>● Engineer: {cfg.label}</p>

                {getEngineerEmail(eng) && <p className="text-xs text-gray-500">{getEngineerEmail(eng)}</p>}
                {eng.current_site_name && <p className="text-xs">📍 {eng.current_site_name}</p>}
                {eng.terminal_id && <p className="text-xs">ATM: {eng.terminal_id}</p>}

                {eng.current_ticket_id && (
                  <Link to={`/tickets/${eng.current_ticket_id}`} className="text-xs text-blue-600 underline">
                    🎫 Open current ticket
                  </Link>
                )}

                {eng.last_active && (
                  <p className="text-xs text-gray-400">Last known: {new Date(eng.last_active).toLocaleString()}</p>
                )}
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );

  const StatButton = ({ label, value, icon: Icon, colorClass, filter, panel, active }) => (
    <button
      type="button"
      onClick={() => handleCardClick(filter, panel)}
      className={`rounded-xl border p-2 text-left transition-all ${
        active ? `${colorClass.border} ${colorClass.bg}` : 'border-white/10 bg-white/5 hover:bg-white/10'
      }`}
    >
      <Icon className={`w-4 h-4 mb-1 ${colorClass.text}`} />
      <p className="font-bold">{value}</p>
      <p className="text-slate-300">{label}</p>
    </button>
  );

  const content = (
    <Card className="overflow-hidden border-white/10 bg-[#102969]/90 text-white shadow-2xl">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Navigation className="w-5 h-5 text-[#ff5a00]" />
              Live Operations Command Center
            </CardTitle>
            <p className="text-xs text-slate-300 mt-1">
              Human icons = engineers · ATM icons = machines/sites · Click any card to filter map and list.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 bg-white/10 border-white/20 text-white hover:bg-white/20" onClick={() => refetch()}>
              <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </Button>

            <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/10" onClick={() => setExpanded(true)}>
              <Maximize2 className="w-4 h-4" />
            </Button>

            <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/10" onClick={() => setMinimized((v) => !v)}>
              <Minimize2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-3 text-xs">
          <StatButton
            label="Online Engrs"
            value={stats.engineersOnline}
            icon={Radio}
            filter="engineers_online"
            panel="online_engineers"
            active={layerFilter === 'engineers_online'}
            colorClass={ENGINEER_STATUS.online}
          />
          <StatButton
            label="On Site"
            value={stats.engineersOnSite}
            icon={User}
            filter="engineers_on_site"
            panel="on_site"
            active={layerFilter === 'engineers_on_site'}
            colorClass={ENGINEER_STATUS.on_site}
          />
          <StatButton
            label="In Transit"
            value={stats.engineersInTransit}
            icon={Truck}
            filter="engineers_transit"
            panel="in_transit"
            active={layerFilter === 'engineers_transit'}
            colorClass={ENGINEER_STATUS.traveling}
          />
          <StatButton
            label="Offline Engrs"
            value={stats.engineersOffline}
            icon={Users}
            filter="engineers_offline"
            panel="offline_engineers"
            active={layerFilter === 'engineers_offline'}
            colorClass={ENGINEER_STATUS.offline}
          />
          <button
            type="button"
            onClick={() => setLayerFilter('all')}
            className={`rounded-xl border p-2 text-left transition-all ${
              layerFilter === 'all' ? 'border-[#ff5a00] bg-[#ff5a00]/20' : 'border-white/10 bg-white/5 hover:bg-white/10'
            }`}
          >
            <MapPin className="w-4 h-4 mb-1 text-[#ff5a00]" />
            <p className="font-bold">{stats.engineersMapped}/{stats.totalSites}</p>
            <p className="text-slate-300">All Map</p>
          </button>
        </div>

        {(error || data?.warnings?.length > 0) && (
          <p className="mt-3 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-xs text-amber-100">
            Some Site Health data could not be loaded.
          </p>
        )}

        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-2 text-xs">
          <StatButton
            label="Healthy Sites"
            value={stats.activeSites}
            icon={CheckCircle2}
            filter="sites_active"
            panel="active_sites"
            active={layerFilter === 'sites_active'}
            colorClass={SITE_STATUS.healthy}
          />
          <StatButton
            label="Critical Sites"
            value={stats.downSites}
            icon={AlertTriangle}
            filter="sites_down"
            panel="down_sites"
            active={layerFilter === 'sites_down'}
            colorClass={SITE_STATUS.critical}
          />
          <StatButton
            label="WIP Sites"
            value={stats.maintenanceSites}
            icon={Wrench}
            filter="sites_wip"
            panel="maintenance_sites"
            active={layerFilter === 'sites_wip'}
            colorClass={SITE_STATUS.maintenance}
          />
          <StatButton
            label="Offline Sites"
            value={stats.offlineSites}
            icon={MonitorCog}
            filter="sites_offline"
            panel="offline_sites"
            active={layerFilter === 'sites_offline'}
            colorClass={SITE_STATUS.offline}
          />
          <button
            type="button"
            onClick={() => setDetailPanel('all_engineers')}
            className="rounded-xl border border-white/10 bg-white/5 p-2 text-left hover:bg-white/10 transition-all"
          >
            <User className="w-4 h-4 mb-1 text-blue-300" />
            <p className="font-bold">{stats.engineersTotal}</p>
            <p className="text-slate-300">All Engrs</p>
          </button>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {isLoading ? (
          <div className={`${mapHeight} flex items-center justify-center bg-[#08153d]`}>
            <div className="w-8 h-8 border-4 border-[#ff5a00]/20 border-t-[#ff5a00] rounded-full animate-spin" />
          </div>
        ) : (
          <div className={mapHeight} style={{ borderRadius: '0 0 0.75rem 0.75rem', overflow: 'hidden', position: 'relative', zIndex: 0 }}>
            <MapView zoom={compact ? 5 : 6} />
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <>
      {content}

      {expanded && (
        <div className="fixed inset-0 z-[9999] bg-black/80 p-4">
          <div className="h-full rounded-2xl overflow-hidden border border-white/10 bg-[#08153d]">
            <div className="flex items-center justify-between p-3 bg-[#102969] text-white border-b border-white/10">
              <div>
                <p className="font-bold">Live Operations Command Center</p>
                <p className="text-xs text-slate-300">
                  Fullscreen · {stats.totalDevices} machines · {stats.engineersMapped} mapped engineers · {stats.totalSites} sites
                </p>
              </div>

              <Button variant="ghost" className="text-white hover:bg-white/10" onClick={() => setExpanded(false)}>
                Close
              </Button>
            </div>

            <div className="h-[calc(100%-61px)]">
              <MapView zoom={6} />
            </div>
          </div>
        </div>
      )}

      {detailPanel && (
        <LiveMapDetailPanel
          type={detailPanel}
          onClose={() => setDetailPanel(null)}
          engineers={engineerGroups}
          sites={siteStatusGroups}
        />
      )}
    </>
  );
}

function LiveMapDetailPanel({ type, onClose, engineers, sites }) {
  const config = {
    online_engineers: {
      title: 'Online Engineers',
      empty: 'No online engineers found.',
      kind: 'engineer',
      rows: engineers.online,
    },
    all_engineers: {
      title: 'All Engineers',
      empty: 'No engineers found.',
      kind: 'engineer',
      rows: engineers.all,
    },
    offline_engineers: {
      title: 'Offline Engineers',
      empty: 'No offline engineers found.',
      kind: 'engineer',
      rows: engineers.offline,
    },
    on_site: {
      title: 'Engineers On Site',
      empty: 'No engineers currently on site.',
      kind: 'engineer',
      rows: engineers.onSite,
    },
    in_transit: {
      title: 'Engineers In Transit',
      empty: 'No engineers currently in transit.',
      kind: 'engineer',
      rows: engineers.inTransit,
    },
    active_sites: {
      title: 'Healthy Sites',
      empty: 'No healthy sites found.',
      kind: 'site',
      rows: sites.healthy,
    },
    down_sites: {
      title: 'Critical Sites',
      empty: 'No critical sites found.',
      kind: 'site',
      rows: sites.critical,
    },
    maintenance_sites: {
      title: 'Maintenance / WIP Sites',
      empty: 'No maintenance sites found.',
      kind: 'site',
      rows: sites.maintenance,
    },
    offline_sites: {
      title: 'Offline Sites',
      empty: 'No offline sites found.',
      kind: 'site',
      rows: sites.offline,
    },
  }[type];

  if (!config) return null;

  return (
    <div className="fixed inset-0 z-[10000] bg-black/70 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-2xl border border-white/10 bg-[#08153d] text-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 bg-[#102969] p-4">
          <div>
            <p className="text-lg font-bold">{config.title}</p>
            <p className="text-xs text-slate-300">{config.rows.length} record(s)</p>
          </div>

          <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="max-h-[65vh] overflow-y-auto p-3 space-y-2">
          {config.rows.length === 0 ? (
            <p className="text-sm text-slate-300 p-4">{config.empty}</p>
          ) : config.kind === 'engineer' ? (
            config.rows.map((engineer, index) => (
              <EngineerListItem key={`${engineer.id || getEngineerEmail(engineer) || getEngineerName(engineer)}-${index}`} engineer={engineer} />
            ))
          ) : (
            config.rows.map((site) => <SiteListItem key={site.key} site={site} />)
          )}
        </div>
      </div>
    </div>
  );
}

function EngineerListItem({ engineer }) {
  const status = getEngineerStatus(engineer);
  const cfg = ENGINEER_STATUS[status] || ENGINEER_STATUS.offline;
  const email = getEngineerEmail(engineer);
  const mapped = engineerHasCoords(engineer);

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">👤 {getEngineerName(engineer)}</p>
          <p className="text-xs text-slate-300">{email || 'No email'}</p>
          <p className="text-xs capitalize mt-1" style={{ color: cfg.color }}>● {cfg.label}</p>
        </div>

        <div className="text-right text-xs text-slate-300">
          {mapped ? 'Mapped' : 'No GPS'}
          {engineer.last_active && <p>{new Date(engineer.last_active).toLocaleString()}</p>}
        </div>
      </div>

      <div className="mt-2 grid md:grid-cols-2 gap-2 text-xs text-slate-300">
        <p>Site: {engineer.current_site_name || 'Not set'}</p>
        <p>Ticket: {engineer.ticket_number || engineer.current_ticket_id || 'Not set'}</p>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {engineer.current_ticket_id && (
          <Link to={`/tickets/${engineer.current_ticket_id}`} className="rounded-lg bg-[#ff5a00] px-3 py-1.5 text-xs font-semibold text-white">
            Open ticket
          </Link>
        )}

        {email && (
          <Link to={`/engineers-ops?search=${encodeURIComponent(email)}`} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white">
            View engineer
          </Link>
        )}
      </div>
    </div>
  );
}

function SiteListItem({ site }) {
  const cfg = SITE_STATUS[site.health] || SITE_STATUS.unknown;

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">🏧 {site.branch_name}</p>
          <p className="text-xs text-slate-300">{site.bank_name}</p>
          <p className="text-xs mt-1" style={{ color: cfg.color }}>● {getSiteHealthLabel(site.health)}</p>
          {site.region && <p className="text-xs text-slate-400">{site.region}</p>}
        </div>

        <div className="text-right text-xs text-slate-300">
          <p>{site.total} machine(s)</p>
          <p>{site.openTickets} open ticket(s)</p>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-4 gap-2 text-center text-xs">
        <div className="rounded-lg bg-green-500/15 p-2">
          <p className="font-bold text-green-300">{site.counts.healthy}</p>
          <p className="text-slate-300">Healthy</p>
        </div>
        <div className="rounded-lg bg-red-500/15 p-2">
          <p className="font-bold text-red-300">{site.counts.critical}</p>
          <p className="text-slate-300">Critical</p>
        </div>
        <div className="rounded-lg bg-amber-500/15 p-2">
          <p className="font-bold text-amber-300">{site.counts.maintenance}</p>
          <p className="text-slate-300">WIP</p>
        </div>
        <div className="rounded-lg bg-slate-500/15 p-2">
          <p className="font-bold text-slate-300">{site.counts.offline}</p>
          <p className="text-slate-300">Offline</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          to={`/bank-devices?bank=${encodeURIComponent(site.bank_name)}&branch=${encodeURIComponent(site.branch_name)}`}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white"
        >
          View machines
        </Link>

        <Link
          to={`/tickets?bank=${encodeURIComponent(site.bank_name)}&branch=${encodeURIComponent(site.branch_name)}`}
          className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white"
        >
          View tickets
        </Link>
      </div>
    </div>
  );
}
