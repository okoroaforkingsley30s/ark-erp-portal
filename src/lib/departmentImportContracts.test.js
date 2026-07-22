import { describe, expect, it } from 'vitest';
import { DEPARTMENT_IMPORTS, validateImportRows } from './departmentImportContracts';

describe('department import contracts', () => {
  it('provides a template and a unique key for every department', () => {
    expect(Object.keys(DEPARTMENT_IMPORTS)).toHaveLength(13);
    Object.values(DEPARTMENT_IMPORTS).forEach((contract) => {
      expect(contract.template).toMatch(/\.xlsx$/);
      const uniqueFields = contract.uniqueFields || [contract.uniqueKey];
      expect(uniqueFields.every((key) => contract.fields.some((field) => field.key === key))).toBe(true);
    });
  });

  it('marks missing fields and duplicate identifiers before import', () => {
    const contract = DEPARTMENT_IMPORTS.business_development;
    const result = validateImportRows([
      { client_name: 'Legacy Bank' },
      { client_name: 'legacy bank' },
      { contact_email: 'broken' },
    ], contract);
    expect(result[0].valid).toBe(true);
    expect(result[1].errors.join(' ')).toContain('duplicated');
    expect(result[2].errors.join(' ')).toContain('client_name is required');
  });
});
