export const SITE_HEALTH_STATES = [
  'healthy',
  'warning',
  'critical',
  'offline',
  'maintenance',
  'inactive',
  'decommissioned',
  'unknown',
];

export const SITE_HEALTH_STYLES = {
  healthy: {
    label: 'Healthy',
    severity: 1,
    dot: 'bg-green-500',
    color: '#22c55e',
    border: 'border-green-400/40',
    badge: 'bg-green-500/15 text-green-300 border-green-400/40',
  },
  warning: {
    label: 'Warning',
    severity: 4,
    dot: 'bg-amber-400',
    color: '#f59e0b',
    border: 'border-amber-400/40',
    badge: 'bg-amber-500/15 text-amber-300 border-amber-400/40',
  },
  critical: {
    label: 'Critical',
    severity: 7,
    dot: 'bg-red-500',
    color: '#ef4444',
    border: 'border-red-400/40',
    badge: 'bg-red-500/15 text-red-300 border-red-400/40',
  },
  offline: {
    label: 'Offline',
    severity: 6,
    dot: 'bg-slate-400',
    color: '#94a3b8',
    border: 'border-slate-400/40',
    badge: 'bg-slate-500/15 text-slate-300 border-slate-400/40',
  },
  maintenance: {
    label: 'Maintenance',
    severity: 5,
    dot: 'bg-blue-400',
    color: '#60a5fa',
    border: 'border-blue-400/40',
    badge: 'bg-blue-500/15 text-blue-300 border-blue-400/40',
  },
  inactive: {
    label: 'Inactive',
    severity: 2,
    dot: 'bg-slate-500',
    color: '#64748b',
    border: 'border-slate-500/40',
    badge: 'bg-slate-600/15 text-slate-300 border-slate-500/40',
  },
  decommissioned: {
    label: 'Decommissioned',
    severity: 0,
    dot: 'bg-zinc-400',
    color: '#a1a1aa',
    border: 'border-zinc-400/40',
    badge: 'bg-zinc-500/15 text-zinc-300 border-zinc-400/40',
  },
  unknown: {
    label: 'Unknown',
    severity: 3,
    dot: 'bg-slate-300',
    color: '#cbd5e1',
    border: 'border-slate-300/40',
    badge: 'bg-slate-500/15 text-slate-200 border-slate-300/40',
  },
};

export const normalizeOperationalStatus = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');

const toKey = (value) => normalizeOperationalStatus(value).replace(/\s+/g, '_');

const firstValue = (...values) =>
  values.find((value) => value !== null && value !== undefined && String(value).trim() !== '') || '';

const HEALTH_ALIASES = {
  healthy: new Set(['active', 'online', 'operational', 'working', 'healthy', 'available', 'ok']),
  warning: new Set([
    'warning',
    'degraded',
    'intermittent',
    'attention',
    'at_risk',
    'pending_review',
    'awaiting_engineer',
    'engineer_assigned',
    'assigned',
    'travelling',
    'traveling',
    'arrived',
    'arrived_on_site',
    'on_site',
    'pending_parts',
    'pending_bank',
  ]),
  critical: new Set([
    'faulty',
    'fault',
    'failed',
    'critical',
    'down',
    'breakdown',
    'out_of_service',
    'not_working',
    'sla_breached',
    'breached',
  ]),
  offline: new Set(['offline', 'unreachable', 'disconnected', 'communication_lost', 'comm_lost']),
  maintenance: new Set([
    'maintenance',
    'under_maintenance',
    'servicing',
    'repair',
    'repair_in_progress',
    'under_repair',
    'in_repair',
    'wip',
    'in_progress',
    'working',
  ]),
  inactive: new Set(['inactive', 'disabled', 'not_active']),
  decommissioned: new Set(['decommissioned', 'retired', 'removed', 'scrapped']),
};

export function normalizeSiteHealthStatus(value) {
  const key = toKey(value);
  if (!key) return 'unknown';

  for (const [health, aliases] of Object.entries(HEALTH_ALIASES)) {
    if (aliases.has(key)) return health;
  }

  return SITE_HEALTH_STATES.includes(key) ? key : 'unknown';
}

export function isOpenTicket(ticket = {}) {
  const status = toKey(ticket.status);
  const completionStatus = toKey(ticket.completion_status);

  const closedStatuses = new Set([
    'closed',
    'resolved',
    'completed',
    'complete',
    'approved',
    'cancelled',
    'canceled',
    'done',
  ]);

  return !closedStatuses.has(status) && !closedStatuses.has(completionStatus);
}

export function deriveDeviceHealth(device = {}) {
  return normalizeSiteHealthStatus(
    firstValue(
      device.device_status,
      device.status,
      device.state,
      device.current_status,
      device.operational_status,
      device.health_status,
      device.sla_status
    )
  );
}

const getTicketPriorityHealth = (ticket = {}) => {
  if (!isOpenTicket(ticket)) return 'unknown';

  const statusHealth = normalizeSiteHealthStatus(firstValue(ticket.sla_status, ticket.sla_state, ticket.status));
  const priority = toKey(firstValue(ticket.priority, ticket.severity, ticket.sla_level));

  if (statusHealth === 'critical' || ['critical', 'high', 'urgent', 'emergency'].includes(priority)) {
    return 'critical';
  }

  return 'warning';
};

const getCount = (counts, key) => counts[key] || 0;

export function deriveSiteHealth(site = {}, devices = [], openTickets = []) {
  const siteHealth = normalizeSiteHealthStatus(
    firstValue(site.health_status, site.site_status, site.status, site.current_status)
  );

  const deviceCounts = SITE_HEALTH_STATES.reduce((acc, key) => ({ ...acc, [key]: 0 }), {});
  devices.forEach((device) => {
    deviceCounts[deriveDeviceHealth(device)] += 1;
  });

  const openIncidentCount = openTickets.length;
  const ticketHealth = openTickets.map(getTicketPriorityHealth);
  const slaBreachCount = openTickets.filter((ticket) => getTicketPriorityHealth(ticket) === 'critical').length;
  const hasCriticalTicket = ticketHealth.includes('critical');

  // Priority order is deliberate: explicit site decommissioning wins, then active incidents,
  // then offline/maintenance/warning states, and only then normal/unknown fallback states.
  let health = 'unknown';
  if (siteHealth === 'decommissioned') health = 'decommissioned';
  else if (getCount(deviceCounts, 'critical') > 0 || hasCriticalTicket) health = 'critical';
  else if (siteHealth === 'offline' || (devices.length > 0 && getCount(deviceCounts, 'offline') === devices.length)) {
    health = 'offline';
  } else if (siteHealth === 'maintenance' || getCount(deviceCounts, 'maintenance') > 0) health = 'maintenance';
  else if (
    openIncidentCount > 0 ||
    siteHealth === 'warning' ||
    getCount(deviceCounts, 'warning') > 0 ||
    getCount(deviceCounts, 'unknown') > 0
  ) {
    health = 'warning';
  } else if (devices.length > 0 && getCount(deviceCounts, 'healthy') > 0) health = 'healthy';
  else if (siteHealth === 'inactive' || (devices.length > 0 && getCount(deviceCounts, 'inactive') === devices.length)) {
    health = 'inactive';
  } else if (siteHealth !== 'unknown') health = siteHealth;

  return {
    health,
    status: health,
    deviceHealthCounts: deviceCounts,
    openIncidentCount,
    slaBreachCount,
  };
}

export function getSiteHealthLabel(status) {
  return SITE_HEALTH_STYLES[normalizeSiteHealthStatus(status)]?.label || SITE_HEALTH_STYLES.unknown.label;
}

export function getSiteHealthSeverity(status) {
  return SITE_HEALTH_STYLES[normalizeSiteHealthStatus(status)]?.severity ?? SITE_HEALTH_STYLES.unknown.severity;
}

export function getSiteHealthBadgeClass(status) {
  return SITE_HEALTH_STYLES[normalizeSiteHealthStatus(status)]?.badge || SITE_HEALTH_STYLES.unknown.badge;
}

export function getSiteHealthStyle(status) {
  return SITE_HEALTH_STYLES[normalizeSiteHealthStatus(status)] || SITE_HEALTH_STYLES.unknown;
}

export function summarizeSiteHealth(sites = []) {
  return sites.reduce(
    (summary, site) => {
      const health = normalizeSiteHealthStatus(site.health || site.status);
      summary.total += 1;
      summary[health] += 1;
      summary.openIncidentCount += Number(site.openIncidentCount || site.openTickets || 0);
      summary.slaBreachCount += Number(site.slaBreachCount || site.slaAlerts || 0);
      return summary;
    },
    {
      total: 0,
      healthy: 0,
      warning: 0,
      critical: 0,
      offline: 0,
      maintenance: 0,
      inactive: 0,
      decommissioned: 0,
      unknown: 0,
      openIncidentCount: 0,
      slaBreachCount: 0,
    }
  );
}

export function getSiteKey(bank, branch) {
  return `${normalizeOperationalStatus(bank)}__${normalizeOperationalStatus(branch)}`;
}

export function buildSiteHealthSites({ devices = [], branches = [], sites = [], tickets = [] } = {}) {
  const branchMap = new Map();

  [...branches, ...sites].forEach((branch) => {
    const bank = firstValue(branch.bank_name, branch.client_name, branch.bank, 'Unknown Bank');
    const branchName = firstValue(branch.branch_name, branch.name, branch.location, branch.device_location, 'Unknown Branch');
    branchMap.set(getSiteKey(bank, branchName), branch);
  });

  const map = new Map();

  devices.forEach((device) => {
    const bankName = firstValue(device.bank_name, device.bank, device.client_name, device.bankName, 'Unknown Bank');
    const branchName = firstValue(
      device.branch_name,
      device.branch,
      device.location,
      device.device_location,
      device.site_name,
      'Unknown Branch'
    );
    const key = getSiteKey(bankName, branchName);
    const branch = branchMap.get(key);

    if (!map.has(key)) {
      map.set(key, {
        key,
        bank_name: bankName,
        branch_name: branchName,
        region: firstValue(branch?.region, device.region, device.state),
        assigned_engineer: firstValue(
          device.assigned_engineer,
          device.engineer_name,
          device.assigned_to_name,
          device.assigned_to,
          branch?.assigned_engineer,
          branch?.engineer_name
        ),
        latitude: firstValue(device.latitude, device.lat, device.current_latitude, branch?.latitude, branch?.lat),
        longitude: firstValue(
          device.longitude,
          device.lng,
          device.long,
          device.current_longitude,
          branch?.longitude,
          branch?.lng,
          branch?.long
        ),
        sourceSite: branch,
        devices: [],
      });
    }

    map.get(key).devices.push(device);
  });

  sites.forEach((site) => {
    const bankName = firstValue(site.bank_name, site.client_name, site.bank, 'Unknown Bank');
    const branchName = firstValue(site.branch_name, site.name, site.location, site.device_location, 'Unknown Branch');
    const key = getSiteKey(bankName, branchName);

    if (!map.has(key)) {
      map.set(key, {
        key,
        bank_name: bankName,
        branch_name: branchName,
        region: site.region || '',
        assigned_engineer: firstValue(site.assigned_engineer, site.engineer_name),
        latitude: firstValue(site.latitude, site.lat),
        longitude: firstValue(site.longitude, site.lng, site.long),
        sourceSite: site,
        devices: [],
      });
    }
  });

  return Array.from(map.values()).map((site) => {
    const openTickets = tickets.filter((ticket) => {
      const sameBank =
        normalizeOperationalStatus(firstValue(ticket.bank_name, ticket.client_name, ticket.bank)) ===
        normalizeOperationalStatus(site.bank_name);
      const ticketBranch = firstValue(ticket.branch_name, ticket.branch, ticket.device_location, ticket.location, ticket.site_name);
      const sameBranch = normalizeOperationalStatus(ticketBranch) === normalizeOperationalStatus(site.branch_name);
      return sameBank && sameBranch && isOpenTicket(ticket);
    });

    const derived = deriveSiteHealth(site.sourceSite || site, site.devices, openTickets);
    const counts = derived.deviceHealthCounts;

    return {
      ...site,
      ...derived,
      total: site.devices.length,
      active: counts.healthy,
      healthy: counts.healthy,
      warningDevices: counts.warning,
      faulty: counts.critical,
      critical: counts.critical,
      maintenance: counts.maintenance,
      offline: counts.offline,
      inactive: counts.inactive,
      decommissioned: counts.decommissioned,
      unknown: counts.unknown,
      openTickets: derived.openIncidentCount,
      slaAlerts: derived.slaBreachCount,
      counts,
    };
  });
}
