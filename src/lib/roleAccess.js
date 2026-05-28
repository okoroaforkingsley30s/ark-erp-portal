export const ROLE_ACCESS = {
  admin: ['*'],

  ceo: [
    'dashboard',
    'sla_analytics',
    'tickets',
    'engineering',
    'field_engineers',
    'finance_summary',
    'hr_summary',
    'crm',
    'reports',
    'notifications',
    'communication',
    'ark_connect',
  ],

  ceo_pa: [
    'dashboard',
    'reports_limited',
    'communication',
    'notifications',
    'ark_connect',
  ],

  agm: [
    'dashboard',
    'live_map',
    'tickets',
    'site_monitor',
    'engineering',
    'field_ops',
    'ops_dashboard',
    'banks',
    'branches',
    'devices',
    'device_status',
    'reports',
    'notifications',
    'communication',
    'ark_connect',
  ],

  manager: [
    'dashboard',
    'live_map',
    'tickets',
    'site_monitor',
    'engineering',
    'field_ops',
    'ops_dashboard',
    'banks',
    'branches',
    'devices',
    'device_status',
    'reports',
    'notifications',
    'communication',
    'ark_connect',
  ],

  helpdesk: [
    'dashboard',
    'tickets',
    'devices',
    'clients',
    'communication',
    'notifications',
    'ark_connect',
  ],

 engineer: [
  'dashboard',
  'my_jobs',
  'field_ops',
  'assets_section',
  'assets',
  'parts_request',
  'team',
  'engineering',
  'communication',
  'notifications',
  'ark_connect',
],
  repair_head: [
    'dashboard',
    'repair_jobs',
    'inventory_parts',
    'assigned_tickets',
    'communication',
    'notifications',
    'ark_connect',
  ],

  hr: [
    'dashboard',
    'hr',
    'staff_directory',
    'attendance',
    'leave',
    'loans',
    'training',
    'performance',
    'holidays',
    'communication',
    'notifications',
    'ark_connect',
  ],

  inventory: [
    'dashboard',
    'inventory',
    'spare_parts',
    'stock_movement',
    'parts_request',
    'communication',
    'notifications',
    'ark_connect',
  ],

  finance: [
    'dashboard',
    'finance',
    'invoices',
    'payments',
    'payroll_summary',
    'loans_finance',
    'communication',
    'notifications',
    'ark_connect',
  ],

  procurement: [
    'dashboard',
    'procurement',
    'purchase_orders',
    'vendors',
    'purchase_requests',
    'inventory_parts',
    'communication',
    'notifications',
    'ark_connect',
  ],

  crm: [
    'dashboard',
    'crm',
    'clients',
    'marketing',
    'communication',
    'notifications',
    'ark_connect',
  ],

  client: [
    'dashboard',
    'my_tickets',
    'communication',
    'notifications',
  ],
};

export const ROLE_HOME = {
  admin: '/dashboard',
  ceo: '/dashboard',
  ceo_pa: '/dashboard',
  agm: '/dashboard',
  manager: '/dashboard',
  helpdesk: '/tickets',
  engineer: '/tickets',
  repair_head: '/dashboard',
  hr: '/hr',
  inventory: '/spare-parts',
  finance: '/finance',
  procurement: '/procurement',
  crm: '/crm',
  client: '/tickets',
};

export const ROLE_LABELS = {
  admin: 'Administrator',
  ceo: 'CEO',
  ceo_pa: 'CEO Personal Assistant',
  agm: 'Asst. General Manager',
  manager: 'Operational Manager',
  helpdesk: 'Help Desk',
  engineer: 'Field Engineer',
  repair_head: 'Head of Repair & Refurbish',
  hr: 'Human Resource',
  inventory: 'Inventory',
  finance: 'Finance',
  procurement: 'Procurement',
  crm: 'CRM / Marketing',
  client: 'Client / Bank',
};

export function canAccess(role, permission) {
  if (!role || !permission) return false;

  const access = ROLE_ACCESS[role];

  if (!access) return false;

  if (access.includes('*')) return true;

  return access.includes(permission);
}

export function getRoleHome(role) {
  return ROLE_HOME[role] || '/dashboard';
}

export function isAdmin(role) {
  return role === 'admin';
}

export function isPendingUser(user) {
  return (
    !user?.role ||
    user?.status === 'pending' ||
    user?.approval_status === 'pending' ||
    user?.is_approved === false
  );
}