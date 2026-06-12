export const ROLE_ACCESS = {
  admin: ['*'],

  ceo: [
    'dashboard',
    'live_map',
    'business',
    'finance',
    'reports',
    'tickets',
    'site_monitor',
    'assets_section',
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
    'tickets',
    'site_monitor',
    'engineering',
    'field_ops',
    'operations',
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
    'business',
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
    'tickets',
    'site_monitor',
    'engineering',
    'field_ops',
    'data_import',
    'operations',
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
    'business',
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
    'branches',
    'devices',
    'device_status',
    'assignments',
    'regional_view',
    'field_engineers',
    'assets_section',
    'assets',
    'reports',
    'notifications',
    'communication',
    'official_mail',
    'ark_connect',
  ],

  engineer: [
    'dashboard',
    'tickets',
    'field_ops',
    'engineering',
    'assets_section',
    'assets',
    'parts_request',
    'notifications',
    'communication',
    'official_mail',
    'ark_connect',
  ],

  repair_head: [
    'dashboard',
    'tickets',
    'repair_jobs',
    'rr_intake',
    'rr_consumables',
    'reports',
    'notifications',
    'communication',
    'official_mail',
    'ark_connect',
  ],

  repair_technician: [
    'dashboard',
    'repair_jobs',
    'rr_consumables',
    'notifications',
    'communication',
    'official_mail',
    'ark_connect',
  ],

  hr: [
    'dashboard',
    'hr',
    'staff_directory',
    'notifications',
    'communication',
    'official_mail',
    'ark_connect',
  ],

  inventory: [
    'dashboard',
    'assets_section',
    'inventory',
    'parts_request',
    'notifications',
    'communication',
    'official_mail',
    'ark_connect',
  ],

  finance: [
    'dashboard',
    'business',
    'finance',
    'notifications',
    'communication',
    'official_mail',
    'ark_connect',
  ],

  procurement: [
    'dashboard',
    'business',
    'procurement',
    'purchase_orders',
    'notifications',
    'communication',
    'official_mail',
    'ark_connect',
  ],

  crm: [
    'dashboard',
    'business',
    'crm',
    'notifications',
    'communication',
    'official_mail',
    'ark_connect',
  ],

  client: [
    'dashboard',
    'tickets',
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
  repair_head: '/rr-part-requests',
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