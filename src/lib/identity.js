export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function normalizeStaffId(staffId) {
  return String(staffId || '').trim().toUpperCase();
}

export function getStaffDisplayName(record = {}) {
  return (
    record.full_name ||
    record.engineer_name ||
    record.name ||
    record.email_address ||
    record.user_account_email ||
    record.email ||
    'Unnamed Staff'
  );
}

const HIDDEN_STAFF_STATUSES = new Set([
  'terminated',
  'resigned',
  'inactive',
  'deleted',
]);

export function isVisibleStaffRecord(record = {}) {
  const status = String(
    record.employment_status ||
      record.status ||
      record.account_status ||
      ''
  )
    .trim()
    .toLowerCase();

  return !HIDDEN_STAFF_STATUSES.has(status);
}

function isSameId(left, right) {
  return Boolean(left && right && String(left) === String(right));
}

function getRecordEmail(record = {}) {
  return normalizeEmail(
    record.email ||
      record.email_address ||
      record.user_account_email ||
      record.user_email
  );
}

export function findDuplicateIdentity({
  employees = [],
  engineers = [],
  users = [],
  profiles = [],
  email,
  staffId,
  ignore = {},
}) {
  const cleanEmail = normalizeEmail(email);
  const cleanStaffId = normalizeStaffId(staffId);

  const employee = employees.find((item) => {
    if (isSameId(item.id, ignore.employeeId)) return false;

    const itemEmail = getRecordEmail(item);
    const itemStaffId = normalizeStaffId(item.staff_id);

    return (
      (cleanEmail && itemEmail === cleanEmail) ||
      (cleanStaffId && itemStaffId === cleanStaffId)
    );
  });

  if (employee) {
    return {
      source: 'employees',
      record: employee,
      message: `${getStaffDisplayName(employee)} already exists in Employees.`,
    };
  }

  const engineer = engineers.find((item) => {
    if (isSameId(item.id, ignore.engineerId)) return false;
    return cleanEmail && normalizeEmail(item.email) === cleanEmail;
  });

  if (engineer) {
    return {
      source: 'engineers',
      record: engineer,
      message: `${getStaffDisplayName(engineer)} already exists in Engineers.`,
    };
  }

  const user = users.find((item) => {
    if (isSameId(item.id, ignore.userId)) return false;
    return cleanEmail && normalizeEmail(item.email) === cleanEmail;
  });

  if (user) {
    return {
      source: 'users',
      record: user,
      message: `${getStaffDisplayName(user)} already exists as a User.`,
    };
  }

  const profile = profiles.find((item) => {
    if (isSameId(item.id, ignore.profileId)) return false;
    return cleanEmail && normalizeEmail(item.user_email) === cleanEmail;
  });

  if (profile) {
    return {
      source: 'user_profiles',
      record: profile,
      message: `${cleanEmail} already exists in User Profiles.`,
    };
  }

  return null;
}

export async function lookupStaffIdentity(
  supabase,
  { email, authId, profileId, employeeId, staffId } = {}
) {
  const cleanEmail = normalizeEmail(email);
  const cleanStaffId = normalizeStaffId(staffId);
  const result = {
    user: null,
    profile: null,
    employee: null,
    engineer: null,
  };

  if (authId || cleanEmail) {
    let query = supabase.from('users').select('*').limit(1);
    query = authId
      ? query.eq('id', authId)
      : query.ilike('email', cleanEmail);

    const { data } = await query.maybeSingle();
    result.user = data || null;
  }

  if (profileId || cleanEmail) {
    let query = supabase.from('user_profiles').select('*').limit(1);
    query = profileId
      ? query.eq('id', profileId)
      : query.ilike('user_email', cleanEmail);

    const { data } = await query.maybeSingle();
    result.profile = data || null;
  }

  if (employeeId || cleanEmail || cleanStaffId) {
    let query = supabase.from('employees').select('*').limit(1);

    if (employeeId) {
      query = query.eq('id', employeeId);
    } else if (cleanEmail && cleanStaffId) {
      query = query.or(
        `email_address.ilike.${cleanEmail},user_account_email.ilike.${cleanEmail},staff_id.eq.${cleanStaffId}`
      );
    } else if (cleanEmail) {
      query = query.or(
        `email_address.ilike.${cleanEmail},user_account_email.ilike.${cleanEmail}`
      );
    } else {
      query = query.eq('staff_id', cleanStaffId);
    }

    const { data } = await query.maybeSingle();
    result.employee = data || null;
  }

  if (cleanEmail) {
    const { data } = await supabase
      .from('engineers')
      .select('*')
      .ilike('email', cleanEmail)
      .limit(1)
      .maybeSingle();

    result.engineer = data || null;
  }

  return result;
}

export async function syncRelatedIdentityRecords(
  supabase,
  {
    previousEmail,
    email,
    fullName,
    department,
    employeeId,
    staffId,
    phone,
  } = {}
) {
  const cleanEmail = normalizeEmail(email || previousEmail);
  if (!cleanEmail && !employeeId && !staffId) return;

  if (cleanEmail) {
    const { error } = await supabase.rpc('ark_sync_identity_details', {
      p_email: cleanEmail,
      p_full_name: fullName || null,
      p_department: department ?? null,
      p_employee_id: employeeId || staffId || null,
      p_phone: phone ?? null,
    });
    if (error) throw error;
  }
}
