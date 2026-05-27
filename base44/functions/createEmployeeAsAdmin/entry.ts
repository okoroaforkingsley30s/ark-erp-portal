import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const ALLOWED_ROLES = [
  'admin', 'administrator', 'Administrator', 'ADMIN',
  'super_admin', 'Super Admin', 'super admin', 'SUPER_ADMIN',
  'hr', 'HR', 'Human Resources', 'human_resource', 'human resources',
  'manager', 'Manager'
];

Deno.serve(async (req) => {
  // Parse body FIRST before anything else that might affect the request stream
  let body;
  try {
    body = await req.json();
  } catch (parseErr) {
    console.error('Body parse error:', parseErr.message);
    return Response.json({ error: 'Invalid JSON body: ' + parseErr.message }, { status: 400 });
  }

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized — please log in.' }, { status: 401 });
    }

    console.log('createEmployeeAsAdmin called by:', user.email, '| role:', user.role);

    if (!ALLOWED_ROLES.includes(user.role)) {
      console.warn('Permission denied for role:', user.role);
      return Response.json({
        error: `Permission denied. Role "${user.role}" cannot create/update employees. Required: admin, hr, or manager.`
      }, { status: 403 });
    }

    const { employeeData, employeeId } = body;

    if (!employeeData) {
      return Response.json({ error: 'Missing employeeData in request body' }, { status: 400 });
    }

    if (!employeeData.full_name?.trim()) {
      return Response.json({ error: 'full_name is required' }, { status: 400 });
    }

    // Apply safe defaults so the entity schema never rejects the record
    const safeData = {
      email_address: '',
      phone_number: '',
      job_title: '',
      department: 'General',
      home_address: '',
      employment_status: 'Active',
      employee_type: 'Full-Time',
      country: 'Nigeria',
      ...employeeData,
      // Always ensure these are set
      full_name: employeeData.full_name.trim(),
      staff_id: (employeeData.staff_id?.trim()) || `ARK-${Date.now().toString().slice(-6)}`,
      department: (employeeData.department?.trim()) || 'General',
      country: (employeeData.country?.trim()) || 'Nigeria',
      employment_status: (employeeData.employment_status?.trim()) || 'Active',
    };

    // Strip undefined/null AND empty strings from enum fields to avoid schema validation errors
    const ENUM_FIELDS = ['title', 'marital_status', 'gender', 'religion', 'country', 'employee_type', 'national_id_type', 'employment_status'];
    Object.keys(safeData).forEach(k => {
      if (safeData[k] === null || safeData[k] === undefined) {
        delete safeData[k];
      }
    });
    ENUM_FIELDS.forEach(k => {
      if (safeData[k] === '') delete safeData[k];
    });
    // Ensure country always has a valid default
    if (!safeData.country) safeData.country = 'Nigeria';
    if (!safeData.employment_status) safeData.employment_status = 'Active';
    if (!safeData.employee_type) safeData.employee_type = 'Full-Time';

    console.log('Saving employee data:', JSON.stringify({ 
      full_name: safeData.full_name,
      staff_id: safeData.staff_id,
      department: safeData.department,
      employeeId: employeeId || 'NEW'
    }));

    let result;
    if (employeeId) {
      // Use asServiceRole to bypass RLS — role is already verified above
      result = await base44.asServiceRole.entities.Employee.update(employeeId, safeData);
      console.log('Employee updated successfully:', employeeId);
    } else {
      result = await base44.asServiceRole.entities.Employee.create(safeData);
      console.log('Employee created successfully:', result?.id);
    }

    // Optionally invite user login (only on create)
    let inviteError = null;
    if (!employeeId && body.inviteEmail && body.inviteRole) {
      try {
        const isAdmin = body.inviteRole === 'admin';
        await base44.asServiceRole.users.inviteUser(body.inviteEmail, isAdmin ? 'admin' : 'user');
        // Update role after invite
        const allUsers = await base44.asServiceRole.entities.User.list();
        const newUser = allUsers.find(u => u.email === body.inviteEmail);
        if (newUser) {
          await base44.asServiceRole.entities.User.update(newUser.id, { role: body.inviteRole, must_change_password: true });
        }
      } catch (invErr) {
        console.warn('Invite failed:', invErr.message);
        inviteError = invErr.message;
      }
    }

    return Response.json({ success: true, data: result, inviteError });

  } catch (error) {
    console.error('createEmployeeAsAdmin error:', error.message, error.stack);
    // Return the actual error message so the frontend can show a useful message
    return Response.json({
      error: error.message || 'Unknown server error',
      details: error.stack ? error.stack.split('\n')[0] : undefined
    }, { status: 500 });
  }
});