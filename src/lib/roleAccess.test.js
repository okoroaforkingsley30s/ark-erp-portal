import { describe, expect, it } from 'vitest';
import {
  PERMISSIONS,
  ROUTE_PERMISSIONS,
  canAccess,
  canUserAccess,
  getRoleHome,
  normalizeRole,
} from '@/lib/roleAccess';

describe('role access', () => {
  it('normalizes controlled role aliases', () => {
    expect(normalizeRole(' Super_Admin ')).toBe('system_admin');
    expect(normalizeRole('accounts')).toBe('finance');
    expect(normalizeRole('field_engineer')).toBe('engineer');
  });

  it('denies unknown roles and missing permissions', () => {
    expect(canAccess('unknown_role', PERMISSIONS.FINANCE)).toBe(false);
    expect(canAccess('finance', '')).toBe(false);
    expect(canUserAccess({}, PERMISSIONS.DASHBOARD)).toBe(false);
  });

  it('grants only role-defined permissions', () => {
    expect(canAccess('finance', PERMISSIONS.FINANCE)).toBe(true);
    expect(canAccess('finance', PERMISSIONS.USER_MANAGEMENT)).toBe(false);
    expect(canAccess('engineer', PERMISSIONS.PARTS_REQUEST)).toBe(true);
    expect(canAccess('engineer', PERMISSIONS.TICKETS)).toBe(false);
    expect(getRoleHome('engineer')).toBe('/dashboard');
    expect(canAccess('system_admin', PERMISSIONS.ADMIN_DIAGNOSTICS)).toBe(true);
    expect(canAccess('system_admin', PERMISSIONS.FINANCE)).toBe(false);
    expect(canAccess('system_admin', PERMISSIONS.FUND_REQUESTS)).toBe(false);
    expect(canAccess('system_admin', PERMISSIONS.RELEASE_FUND)).toBe(false);
    expect(canAccess('ceo', PERMISSIONS.ADMIN_DIAGNOSTICS)).toBe(false);
    expect(canAccess('admin', PERMISSIONS.ADMIN_DIAGNOSTICS)).toBe(false);
  });

  it('defines permissions for the security-sensitive routes', () => {
    for (const route of ['/machines', '/manager', '/ops-dashboard', '/part-requests', '/sla-analytics', '/workflows', '/admin-diagnostics', '/crm-handoffs']) {
      expect(ROUTE_PERMISSIONS[route], `${route} must be deny-by-default protected`).toBeTruthy();
    }
  });

  it('routes approved client handoffs only to participating departments', () => {
    for (const role of ['business_developer', 'head_of_business_development', 'helpdesk', 'operations', 'inventory', 'procurement', 'finance', 'head_of_it']) {
      expect(canAccess(role, PERMISSIONS.CRM_HANDOFFS), `${role} should receive client handoffs`).toBe(true);
    }
    expect(canAccess('engineer', PERMISSIONS.CRM_HANDOFFS)).toBe(false);
    expect(canAccess('hr', PERMISSIONS.CRM_HANDOFFS)).toBe(false);
  });
});
