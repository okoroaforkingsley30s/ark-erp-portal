import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabaseClient', () => ({ supabase: {} }));

const { validateBalancedJournalEntries } = await import('@/lib/accounting');

describe('finance calculations', () => {
  it('accepts a balanced two-sided journal', () => {
    const result = validateBalancedJournalEntries([
      { debit: 1250.1, credit: 0 },
      { debit: 0, credit: 1250.1 },
    ]);
    expect(result).toMatchObject({ debitTotal: 1250.1, creditTotal: 1250.1, lineCount: 2, isBalanced: true });
    expect(result.errors).toEqual([]);
  });

  it('rejects unbalanced and one-sided journals', () => {
    const result = validateBalancedJournalEntries([{ debit: 100, credit: 0 }]);
    expect(result.isBalanced).toBe(false);
    expect(result.errors).toContain('A journal needs at least two lines.');
    expect(result.errors).toContain('Total debit must equal total credit.');
  });

  it('rejects a line containing both debit and credit', () => {
    const result = validateBalancedJournalEntries([
      { debit: 50, credit: 50 },
      { debit: 0, credit: 0 },
    ]);
    expect(result.isBalanced).toBe(false);
    expect(result.errors).toContain('A journal line cannot have both debit and credit.');
    expect(result.errors).toContain('Each journal line must have either a debit or credit amount.');
  });

  it('rounds monetary totals to two decimal places', () => {
    const result = validateBalancedJournalEntries([
      { debit: 10.005, credit: 0 },
      { debit: 0, credit: 10.005 },
    ]);
    expect(result.debitTotal).toBe(10.01);
    expect(result.creditTotal).toBe(10.01);
    expect(result.isBalanced).toBe(true);
  });
});
