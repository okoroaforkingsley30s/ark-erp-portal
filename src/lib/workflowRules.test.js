import { describe, expect, it } from 'vitest';
import {
  canDoInventoryAction,
  canDoOperationAction,
  canDoRRAction,
  getInventoryState,
  getRRState,
  normalizeStatus,
  workflowCan,
} from '@/lib/workflowRules';

describe('workflow rules', () => {
  it('standardizes legacy RR status aliases', () => {
    expect(normalizeStatus('assigned_to_rr_tech')).toBe('assigned_to_rr_technician');
    expect(normalizeStatus('RR_ASSIGNED')).toBe('assigned');
    expect(normalizeStatus('scrapped')).toBe('scrap');
  });

  it('allows only actions defined for the current state', () => {
    expect(workflowCan({ pending: ['approve'] }, 'pending', 'approve')).toBe(true);
    expect(workflowCan({ pending: ['approve'] }, 'pending', 'delete')).toBe(false);
    expect(workflowCan(null, 'pending', 'approve')).toBe(false);
  });

  it('enforces operations and inventory transitions', () => {
    expect(canDoOperationAction({ operations_status: 'pending' }, 'approve')).toBe(true);
    expect(canDoOperationAction({ operations_status: 'pending_review', inventory_status: 'returned_to_operations' }, 'approve')).toBe(true);
    expect(canDoOperationAction({ operations_status: 'pending_review', inventory_status: 'returned_to_operations' }, 'reject')).toBe(true);
    expect(canDoOperationAction({ operations_status: 'rejected' }, 'approve')).toBe(false);
    expect(getInventoryState({ dispatch_status: 'dispatched' })).toBe('dispatched_to_engineer');
    expect(canDoInventoryAction({ inventory_status: 'sent_to_inventory' }, 'check_stock')).toBe(true);
    expect(canDoInventoryAction({ dispatch_status: 'dispatched' }, 'check_stock')).toBe(false);
  });

  it('prevents completed RR work from returning to mutable states', () => {
    expect(getRRState({ rr_status: 'assigned_to_rr_tech' })).toBe('assigned_to_rr_technician');
    expect(canDoRRAction({ rr_status: 'assigned_to_rr_tech' }, 'start_repair')).toBe(true);
    expect(canDoRRAction({ rr_status: 'completed' }, 'start_repair')).toBe(false);
  });
});
