import { describe, expect, it } from 'vitest';
import { buildSiteHealthSites } from './siteHealth';

describe('site health synchronization', () => {
  it('keeps registered branches visible before devices are attached', () => {
    const sites = buildSiteHealthSites({
      branches: [
        {
          id: 'branch-1',
          bank_name: 'ARK Test Bank',
          branch_name: 'Lagos Main',
          region: 'South West',
          assigned_engineer_name: 'Test Engineer',
          status: 'active',
        },
      ],
    });

    expect(sites).toHaveLength(1);
    expect(sites[0]).toMatchObject({
      bank_name: 'ARK Test Bank',
      branch_name: 'Lagos Main',
      total: 0,
      health: 'healthy',
    });
  });

  it('combines branch, device and open-ticket state into one site', () => {
    const sites = buildSiteHealthSites({
      branches: [{ bank_name: 'ARK Test Bank', branch_name: 'Lagos Main', status: 'active' }],
      devices: [
        {
          id: 'device-1',
          bank_name: 'ARK Test Bank',
          branch_name: 'Lagos Main',
          device_status: 'active',
        },
      ],
      tickets: [
        {
          id: 'ticket-1',
          bank_name: 'ARK Test Bank',
          branch_name: 'Lagos Main',
          status: 'open',
          priority: 'high',
        },
      ],
    });

    expect(sites).toHaveLength(1);
    expect(sites[0]).toMatchObject({ total: 1, active: 1, openTickets: 1, health: 'critical' });
  });
});
