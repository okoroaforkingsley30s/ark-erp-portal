import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const ALLOWED_ROLES = [
  'admin', 'administrator', 'Administrator', 'ADMIN',
  'super_admin', 'Super Admin', 'SUPER_ADMIN',
  'hr', 'HR'
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!ALLOWED_ROLES.includes(user.role)) {
      return Response.json({ error: `Permission denied. Role "${user.role}" cannot run sync.` }, { status: 403 });
    }

    const sr = base44.asServiceRole;

    // Fetch all data sources in parallel
    const [allUsers, allEmployees, allStaff, allEngineers] = await Promise.all([
      sr.entities.User.list(),
      sr.entities.Employee.list(),
      sr.entities.Staff.list(),
      sr.entities.Engineer.list(),
    ]);

    // Build lookup indexes by email and name
    const byEmail = new Set(allEmployees.map(e => (e.email_address || '').toLowerCase().trim()).filter(Boolean));
    const byName = new Set(allEmployees.map(e => (e.full_name || '').toLowerCase().trim()).filter(Boolean));
    const byPhone = new Set(allEmployees.map(e => (e.phone_number || '').replace(/\s/g, '').trim()).filter(Boolean));

    const created = [];
    const skipped = [];

    const isDuplicate = (email, name, phone) => {
      if (email && byEmail.has(email.toLowerCase().trim())) return true;
      if (name && byName.has(name.toLowerCase().trim())) return true;
      if (phone && phone.length > 6 && byPhone.has(phone.replace(/\s/g, '').trim())) return true;
      return false;
    };

    const registerNew = (emp) => {
      if (emp.email_address) byEmail.add(emp.email_address.toLowerCase().trim());
      if (emp.full_name) byName.add(emp.full_name.toLowerCase().trim());
      if (emp.phone_number) byPhone.add(emp.phone_number.replace(/\s/g, '').trim());
    };

    // 1. Sync Users → Employee
    for (const u of allUsers) {
      const email = (u.email || '').toLowerCase().trim();
      const name = (u.full_name || '').toLowerCase().trim();
      if (isDuplicate(email, name, '')) {
        skipped.push({ source: 'user', id: u.id, email, reason: 'already exists' });
        continue;
      }
      const empData = {
        full_name: u.full_name || u.email.split('@')[0],
        staff_id: `USR-${u.id.slice(-6).toUpperCase()}`,
        email_address: u.email,
        user_account_email: u.email,
        access_role: u.role || 'user',
        department: 'Unassigned',
        employment_status: 'Active',
        employee_type: 'Full-Time',
        country: 'Nigeria',
      };
      const rec = await sr.entities.Employee.create(empData);
      registerNew(empData);
      created.push({ source: 'user', email: u.email, id: rec.id });
    }

    // 2. Migrate Staff Directory → Employee
    for (const s of allStaff) {
      const email = (s.email || '').toLowerCase().trim();
      const name = (s.full_name || '').toLowerCase().trim();
      const phone = (s.phone || '').replace(/\s/g, '').trim();
      if (isDuplicate(email, name, phone)) {
        skipped.push({ source: 'staff', name: s.full_name, reason: 'already exists' });
        continue;
      }
      const statusMap = { active: 'Active', inactive: 'Resigned', on_leave: 'On Leave' };
      const empData = {
        full_name: s.full_name || 'Unknown',
        staff_id: s.employee_id?.trim() || `STF-${s.id.slice(-6).toUpperCase()}`,
        email_address: s.email || '',
        user_account_email: s.email || '',
        phone_number: s.phone || '',
        job_title: s.job_title || '',
        department: s.department || 'Unassigned',
        home_address: s.location || '',
        employment_status: statusMap[s.status] || 'Active',
        employee_type: 'Full-Time',
        country: 'Nigeria',
      };
      const rec = await sr.entities.Employee.create(empData);
      registerNew(empData);
      created.push({ source: 'staff', name: s.full_name, id: rec.id });
    }

    // 3. Sync Engineers → Employee
    for (const eng of allEngineers) {
      const email = (eng.email || '').toLowerCase().trim();
      const name = (eng.engineer_name || '').toLowerCase().trim();
      const phone = (eng.phone_number || '').replace(/\s/g, '').trim();
      if (isDuplicate(email, name, phone)) {
        skipped.push({ source: 'engineer', name: eng.engineer_name, reason: 'already exists' });
        continue;
      }
      const statusMap = { active: 'Active', inactive: 'Resigned', on_leave: 'On Leave' };
      const empData = {
        full_name: eng.engineer_name || 'Unknown Engineer',
        staff_id: `ENG-${eng.id.slice(-6).toUpperCase()}`,
        email_address: eng.email || '',
        user_account_email: eng.email || '',
        phone_number: eng.phone_number || '',
        job_title: 'Field Engineer',
        department: 'Engineering',
        home_address: eng.assigned_location || '',
        employment_status: statusMap[eng.status] || 'Active',
        employee_type: 'Full-Time',
        access_role: 'engineer',
        profile_photo: eng.profile_photo || '',
        country: 'Nigeria',
      };
      const rec = await sr.entities.Employee.create(empData);
      registerNew(empData);
      created.push({ source: 'engineer', name: eng.engineer_name, id: rec.id });
    }

    return Response.json({
      success: true,
      summary: {
        sources: { users: allUsers.length, staff: allStaff.length, engineers: allEngineers.length },
        employees_before: allEmployees.length,
        created: created.length,
        skipped: skipped.length,
      },
      created,
      skipped,
    });
  } catch (error) {
    console.error('syncUsersToEmployees error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});