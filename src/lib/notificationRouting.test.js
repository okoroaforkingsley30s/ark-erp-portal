import { describe, expect, it } from 'vitest';
import { resolveNotificationTarget } from './notificationRouting';

describe('notification routing', () => {
  it('keeps an allowed destination', () => {
    expect(resolveNotificationTarget({ role: 'helpdesk' }, '/tickets/abc')).toBe('/tickets/abc');
  });

  it('sends an engineer ticket notification to the FE portal', () => {
    expect(resolveNotificationTarget({ role: 'engineer' }, '/tickets/abc')).toBe('/field-ops');
  });

  it('opens client handoffs for only participating roles', () => {
    expect(resolveNotificationTarget({ role: 'helpdesk' }, '/crm-handoffs')).toBe('/crm-handoffs');
    expect(resolveNotificationTarget({ role: 'inventory' }, '/crm-handoffs')).toBe('/crm-handoffs');
    expect(resolveNotificationTarget({ role: 'engineer' }, '/crm-handoffs')).toBe('/field-ops');
  });

  it('denies unknown and privileged legacy links', () => {
    expect(resolveNotificationTarget({ role: 'inventory' }, '/users')).toBe('/inventory/part-requests');
    expect(resolveNotificationTarget({ role: 'inventory' }, '/old-missing-module')).toBe('/inventory/part-requests');
  });
});
