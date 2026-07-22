const field = (key, label, options = {}) => ({ key, label, ...options });

export const DEPARTMENT_IMPORTS = {
  business_development: {
    label: 'Business Development',
    dataset: 'legacy_clients',
    description: 'Existing paper client register. These records are marked as legacy clients, not newly won business.',
    template: '/templates/ark-one-business-development-import.xlsx',
    uniqueKey: 'client_name',
    fields: [
      field('client_name', 'Client / company name', { required: true }),
      field('legacy_reference', 'Paper file reference'),
      field('industry', 'Industry'),
      field('contact_name', 'Primary contact'),
      field('contact_email', 'Contact email', { type: 'email' }),
      field('contact_phone', 'Contact phone'),
      field('relationship_manager_email', 'Relationship manager email', { type: 'email' }),
      field('contract_value', 'Contract value', { type: 'number' }),
      field('relationship_start_date', 'Original relationship start date', { type: 'date' }),
      field('contract_start', 'Contract start date', { type: 'date' }),
      field('contract_end', 'Contract end date', { type: 'date' }),
      field('sla_level', 'SLA level'),
      field('branch_count', 'Branch / site count', { type: 'integer' }),
      field('status', 'Status'),
      field('notes', 'Notes'),
    ],
  },
  business_development_poc: {
    label: 'Business Development — POC',
    department: 'business_development',
    dataset: 'poc_register',
    description: 'Proof-of-concept register, dates, requirements and outcome.',
    template: '/templates/ark-one-business-development-poc-import.xlsx',
    uniqueKey: 'poc_reference',
    fields: [
      field('poc_reference', 'POC reference', { required: true }),
      field('client_name', 'Client', { required: true }),
      field('product_to_demo', 'Product to demonstrate', { required: true }),
      field('start_date', 'POC start date', { required: true, type: 'date' }),
      field('end_date', 'POC end date', { required: true, type: 'date' }),
      field('requirements', 'POC requirements', { required: true }),
      field('status', 'POC status', { required: true }),
      field('outcome_notes', 'Outcome / other necessary information'),
    ],
  },
  business_development_supply: {
    label: 'Business Development — LPO / Offer to Supply',
    department: 'business_development',
    dataset: 'supply_register',
    description: 'LPO and offer-to-supply commercial register. Invoice and delivery documents are uploaded securely in the BD portal.',
    template: '/templates/ark-one-business-development-supply-import.xlsx',
    uniqueKey: 'lpo_number',
    fields: [
      field('lpo_number', 'LPO / offer number', { required: true }),
      field('client_name', 'Client', { required: true }),
      field('industry', 'Industry'),
      field('contact_name', 'Contact name'),
      field('contact_phone', 'Contact phone number'),
      field('product_requested', 'Product requested', { required: true }),
      field('quantity', 'Quantity', { required: true, type: 'integer' }),
      field('invoice_value', 'Value of product / invoice', { required: true, type: 'number' }),
      field('ark_profit', 'ARK profit', { type: 'number' }),
      field('supplier_name', 'Supplier name'),
      field('supply_date', 'Date of supply', { type: 'date' }),
      field('status', 'Status'),
      field('notes', 'Notes'),
    ],
  },
  business_development_sla: {
    label: 'Business Development — SLA',
    department: 'business_development',
    dataset: 'sla_register',
    description: 'Client SLA products, agreement period and support fee per product.',
    template: '/templates/ark-one-business-development-sla-import.xlsx',
    uniqueKey: 'sla_reference',
    fields: [
      field('sla_reference', 'SLA reference', { required: true }),
      field('client_name', 'Client', { required: true }),
      field('industry', 'Industry'),
      field('contact_name', 'Contact name'),
      field('contact_phone', 'Contact phone number'),
      field('sla_type', 'Type of SLA', { required: true }),
      field('product', 'Product', { required: true }),
      field('agreement_start_date', 'Agreement start date', { required: true, type: 'date' }),
      field('agreement_end_date', 'Agreement end date', { required: true, type: 'date' }),
      field('support_fee_per_product', 'Support fee for each product', { required: true, type: 'number' }),
      field('status', 'Status'),
      field('notes', 'Notes'),
    ],
  },
  human_resources: {
    label: 'Human Resources',
    dataset: 'employees',
    description: 'Employee master records only. Login accounts remain controlled through User Management.',
    template: '/templates/ark-one-human-resources-import.xlsx',
    uniqueKey: 'email_address',
    fields: [
      field('full_name', 'Full name', { required: true }),
      field('staff_id', 'Staff ID', { required: true }),
      field('email_address', 'Email address', { required: true, type: 'email' }),
      field('phone_number', 'Phone number'),
      field('department', 'Department', { required: true }),
      field('job_title', 'Job title'),
      field('date_of_employment', 'Employment date', { type: 'date' }),
      field('employment_status', 'Employment status'),
    ],
  },
  operations: {
    label: 'Operations',
    dataset: 'banks_branches',
    description: 'Customer banks and branch/site master data.',
    template: '/templates/ark-one-operations-import.xlsx',
    uniqueKey: 'bank_name + branch_name',
    uniqueFields: ['bank_name', 'branch_name'],
    fields: [
      field('bank_name', 'Bank / client name', { required: true }),
      field('branch_name', 'Branch / site name', { required: true }),
      field('location', 'Location', { required: true }),
      field('region', 'Region'),
      field('assigned_engineer_email', 'Assigned engineer email', { type: 'email' }),
      field('assigned_engineer_name', 'Assigned engineer name'),
      field('status', 'Status'),
      field('notes', 'Notes'),
    ],
  },
  helpdesk: {
    label: 'Helpdesk',
    dataset: 'supported_devices',
    description: 'Supported customer machines and devices. This does not create tickets.',
    template: '/templates/ark-one-helpdesk-import.xlsx',
    uniqueKey: 'terminal_id',
    fields: [
      field('terminal_id', 'Terminal / device ID', { required: true }),
      field('device_name', 'Device name', { required: true }),
      field('device_type', 'Device type'),
      field('device_model', 'Device model'),
      field('serial_number', 'Serial number'),
      field('client_name', 'Client name', { required: true }),
      field('branch_name', 'Branch / site'),
      field('location', 'Location'),
      field('assigned_engineer_email', 'Assigned engineer email', { type: 'email' }),
      field('assigned_engineer_name', 'Assigned engineer name'),
      field('status', 'Status'),
      field('installation_date', 'Installation date', { type: 'date' }),
      field('warranty_expiry', 'Warranty expiry', { type: 'date' }),
      field('notes', 'Notes'),
    ],
  },
  field_engineering: {
    label: 'Field Engineering',
    dataset: 'device_assignments',
    description: 'Engineer assignment updates for devices already registered by Helpdesk or Operations.',
    template: '/templates/ark-one-field-engineering-import.xlsx',
    uniqueKey: 'terminal_id',
    fields: [
      field('terminal_id', 'Terminal / device ID', { required: true }),
      field('assigned_engineer_email', 'Engineer email', { required: true, type: 'email' }),
      field('assigned_engineer_name', 'Engineer name', { required: true }),
      field('status', 'Device status'),
      field('notes', 'Assignment notes'),
    ],
  },
  inventory: {
    label: 'Inventory',
    dataset: 'spare_parts',
    description: 'Spare-parts and supplies opening stock. Workflow requests are not imported.',
    template: '/templates/ark-one-inventory-import.xlsx',
    uniqueKey: 'part_number',
    fields: [
      field('part_number', 'Part number', { required: true }),
      field('part_name', 'Part name', { required: true }),
      field('category', 'Category'),
      field('device_brand', 'Compatible brand'),
      field('device_model', 'Compatible model'),
      field('quantity_available', 'Opening quantity', { required: true, type: 'integer' }),
      field('minimum_stock_level', 'Minimum stock', { type: 'integer' }),
      field('unit_price_ngn', 'Unit price NGN', { type: 'number' }),
      field('warehouse', 'Warehouse'),
      field('storage_location', 'Storage location'),
      field('tracking_type', 'Tracking type'),
      field('status', 'Status'),
      field('notes', 'Notes'),
    ],
  },
  procurement: {
    label: 'Procurement',
    dataset: 'suppliers',
    description: 'Approved supplier register used by purchase orders.',
    template: '/templates/ark-one-procurement-import.xlsx',
    uniqueKey: 'supplier_name',
    fields: [
      field('supplier_name', 'Supplier name', { required: true }),
      field('contact_person', 'Contact person'),
      field('phone', 'Phone'),
      field('email', 'Email', { type: 'email' }),
      field('address', 'Address'),
      field('tax_identification_number', 'Tax identification number'),
      field('registration_number', 'Registration number'),
      field('payment_terms', 'Payment terms'),
      field('bank_name', 'Bank name'),
      field('bank_account_name', 'Account name'),
      field('bank_account_number', 'Account number'),
      field('status', 'Status'),
      field('notes', 'Notes'),
    ],
  },
  finance_accounts: {
    label: 'Finance & Accounts',
    dataset: 'chart_of_accounts',
    description: 'Chart-of-account master only. Balances, journals and payment requests cannot be imported here.',
    template: '/templates/ark-one-finance-accounts-import.xlsx',
    uniqueKey: 'account_code',
    fields: [
      field('account_code', 'Account code', { required: true }),
      field('account_name', 'Account name', { required: true }),
      field('account_type', 'Account type', { required: true }),
      field('normal_balance', 'Normal balance', { required: true }),
      field('description', 'Description'),
      field('is_active', 'Active'),
    ],
  },
  information_technology: {
    label: 'Information Technology',
    dataset: 'company_assets',
    description: 'ARK-owned company assets. Customer bank machines belong in the Helpdesk device register.',
    template: '/templates/ark-one-information-technology-import.xlsx',
    uniqueKey: 'asset_code',
    fields: [
      field('asset_code', 'Asset code', { required: true }),
      field('asset_name', 'Asset name', { required: true }),
      field('asset_type', 'Asset type'),
      field('serial_number', 'Serial number'),
      field('purchase_date', 'Purchase date', { type: 'date' }),
      field('purchase_cost', 'Purchase cost', { type: 'number' }),
      field('assigned_department', 'Assigned department'),
      field('assigned_employee_id', 'Assigned staff ID'),
      field('assigned_employee_name', 'Assigned employee'),
      field('current_location', 'Current location'),
      field('warranty_expiry', 'Warranty expiry', { type: 'date' }),
      field('status', 'Status'),
    ],
  },
  repair_refurbishment: {
    label: 'Repair & Refurbishment',
    dataset: 'repair_intake',
    description: 'Legacy/offline items received for diagnosis. Imported jobs begin at RR HOD intake and are not assigned automatically.',
    template: '/templates/ark-one-repair-refurbishment-import.xlsx',
    uniqueKey: 'job_number',
    fields: [
      field('job_number', 'Legacy job/reference number', { required: true }),
      field('item_name', 'Item name', { required: true }),
      field('part_number', 'Part number'),
      field('machine_brand', 'Brand'),
      field('machine_model', 'Model'),
      field('quantity_received', 'Quantity received', { required: true, type: 'integer' }),
      field('received_from', 'Received from', { required: true }),
      field('condition_on_arrival', 'Condition on arrival'),
      field('fault_description', 'Reported fault'),
      field('action_required', 'Action required'),
      field('priority', 'Priority'),
      field('notes', 'Notes'),
    ],
  },
};

export function normalizeImportRow(source, contract) {
  const normalized = {};
  const lowered = Object.fromEntries(Object.entries(source || {}).map(([key, value]) => [String(key).trim().toLowerCase(), value]));
  contract.fields.forEach(({ key }) => {
    const value = lowered[key.toLowerCase()];
    normalized[key] = typeof value === 'string' ? value.trim() : value ?? '';
  });
  return normalized;
}

export function validateImportRows(rows, contract) {
  const seen = new Set();
  return rows.map((source, index) => {
    const row = normalizeImportRow(source, contract);
    const errors = [];
    contract.fields.forEach((item) => {
      const value = row[item.key];
      if (item.required && String(value ?? '').trim() === '') errors.push(`${item.key} is required`);
      if (value !== '' && item.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))) errors.push(`${item.key} is not a valid email`);
      if (value !== '' && item.type === 'number' && (!Number.isFinite(Number(value)) || Number(value) < 0)) errors.push(`${item.key} must be a non-negative number`);
      if (value !== '' && item.type === 'integer' && (!Number.isInteger(Number(value)) || Number(value) < 0)) errors.push(`${item.key} must be a non-negative whole number`);
      if (value !== '' && item.type === 'date' && Number.isNaN(Date.parse(String(value)))) errors.push(`${item.key} must be a valid date`);
    });
    const key = (contract.uniqueFields || [contract.uniqueKey])
      .map((fieldKey) => String(row[fieldKey] || '').trim().toLowerCase())
      .join('::');
    const hasKey = key.replaceAll(':', '') !== '';
    if (hasKey && seen.has(key)) errors.push(`${contract.uniqueKey} is duplicated in this file`);
    if (hasKey) seen.add(key);
    return { rowNumber: index + 2, row, errors, valid: errors.length === 0 };
  });
}
