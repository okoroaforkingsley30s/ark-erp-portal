export const ROLE_ACCESS = {
  admin: [
  'dashboard',
  'sla_analytics',
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
  'assignments',
  'regional_view',
  'field_engineers',

  'assets_section',
  'assets',
  'inventory',

  'finance',
  'procurement',
  'purchase_orders',
  'crm',
  'hr',

  'users',
  'staff_directory',
  'departments',

  'audit_logs',
  'reports',
  'notifications',
  'settings',

  'communication',
  'official_mail',
  'ark_connect'
],

  ceo: [
    'dashboard',
    'live_map',
    'ceo_dashboard',
    'business_overview',
    'finance',
    'reports',
    'manager_dashboard',
    'tickets',
    'site_monitor',
    'assets',
    'notifications',
    'communication',
    'official_mail',
    'ark_connect',
  ],

  ceo_pa: [
    'dashboard',
    'reports',
    'notifications',
    'communication',
    'official_mail',
    'ark_connect',
  ],

  agm: [
    'dashboard',
    'live_map',
    'manager_dashboard',
    'tickets',
    'site_monitor',
    'engineering',
    'field_ops',
    'operations',
    'ops_dashboard',
    'banks',
    'devices',
    'device_status',
    'regional_view',
    'assets_section',
    'assets',
    'inventory',
    'finance',
    'hr',
    'reports',
    'notifications',
    'communication',
    'official_mail',
    'ark_connect',
  ],

  manager: [
    'dashboard',
    'live_map',
    'manager_dashboard',
    'tickets',
    'site_monitor',
    'engineering',
    'field_ops',
    'operations',
    'ops_dashboard',
    'banks',
    'devices',
    'device_status',
    'regional_view',
    'assets_section',
    'assets',
    'inventory',
    'finance',
    'hr',
    'reports',
    'notifications',
    'communication',
    'official_mail',
    'ark_connect',
  ],

  helpdesk: [
    'dashboard',
    'sla_analytics',
    'live_map',
    'tickets',
    'site_monitor',
    'engineering',
    'field_ops',
    'operations',
    'ops_dashboard',
    'banks',
    'devices',
    'device_status',
    'assets_section',
    'assets',
    'inventory',
    'reports',
    'notifications',
    'communication',
    'official_mail',
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

  // Repair Operations
  'repair_jobs',
  'tickets',

  // Inventory
  'spare_parts',

  // Management
  'reports',
  'notifications',

  // Communication
  'communication',
  'official_mail',
  'ark_connect',
],

  repair_technician: [
  'dashboard',

  // Repair Work
  'repair_jobs',
  'parts_request',

  // Communication
  'communication',
  'notifications',
  'official_mail',
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
    'official_mail',
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
    'official_mail',
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
    'official_mail',
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
    'official_mail',
    'ark_connect',
  ],

  crm: [
    'dashboard',
    'crm',
    'clients',
    'marketing',
    'communication',
    'notifications',
    'official_mail',
    'ark_connect',
  ],

  client: [
    'dashboard',
    'my_tickets',
    'communication',
    'notifications',
    'ark_connect',
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
  repair_head: '/repair-jobs',
  repair_technician: '/repair-jobs',
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
  repair_technician: 'Repair Technician',
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