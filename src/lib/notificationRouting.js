import {
  ROUTE_PERMISSIONS,
  canUserAccess,
  getRoleHome,
  getUserRole,
} from '@/lib/roleAccess';

const ROLE_NOTIFICATION_FALLBACKS = Object.freeze({
  engineer: '/field-ops',
  helpdesk: '/tickets',
  operations: '/operations/part-requests',
  inventory: '/inventory/part-requests',
  repair_head: '/repair-jobs',
  repair_technician: '/repair-jobs',
  head_of_account: '/finance',
  finance: '/finance',
  procurement: '/procurement-lpo',
  hr: '/hr',
  head_of_business_development: '/crm',
  business_developer: '/crm',
});

function cleanTarget(target) {
  if (!target || typeof target !== 'string') return '';
  let value = target.trim();
  if (!value) return '';

  try {
    if (/^https?:\/\//i.test(value)) {
      const url = new URL(value);
      value = url.hash?.startsWith('#/') ? url.hash.slice(1) : `${url.pathname}${url.search}`;
    }
  } catch {
    return '';
  }

  value = value.replace(/^#/, '');
  return value.startsWith('/') ? value : `/${value}`;
}

export function routePermissionForTarget(target) {
  const pathname = cleanTarget(target).split(/[?#]/)[0].replace(/\/$/, '') || '/';
  if (ROUTE_PERMISSIONS[pathname]) return ROUTE_PERMISSIONS[pathname];
  if (/^\/tickets\/[^/]+$/.test(pathname)) return ROUTE_PERMISSIONS['/tickets/:id'];
  if (/^\/branches\/[^/]+\/devices$/.test(pathname)) return ROUTE_PERMISSIONS['/branches/:id/devices'];
  return null;
}

function firstAccessible(user, targets) {
  return targets.find((target) => {
    const permission = routePermissionForTarget(target);
    return permission && canUserAccess(user, permission);
  });
}

/**
 * Never navigate a notification recipient into a route they cannot open.
 * Legacy/unknown links are deliberately denied and fall back to a role home.
 */
export function resolveNotificationTarget(user, requestedTarget) {
  const target = cleanTarget(requestedTarget);
  const permission = routePermissionForTarget(target);
  if (permission && canUserAccess(user, permission)) return target;

  const role = getUserRole(user);
  return firstAccessible(user, [
    ROLE_NOTIFICATION_FALLBACKS[role],
    getRoleHome(role),
    '/notifications',
    '/dashboard',
  ].filter(Boolean)) || '/notifications';
}
