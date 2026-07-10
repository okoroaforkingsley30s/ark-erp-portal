import React, { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import {
  normalizeEmail,
  normalizeStaffId,
  syncRelatedIdentityRecords,
} from '@/lib/identity';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { Switch } from '@/components/ui/switch';
import PendingApprovalPanel from '@/components/users/PendingApprovalPanel';

import {
  Search,
  UserPlus,
  Shield,
  Headphones,
  Wrench,
  User,
  Mail,
  Loader2,
  Phone,
  Building2,
  BadgeCheck,
  UserCog,
  BarChart3,
  DollarSign,
  TrendingUp,
  ShoppingCart,
  UserCheck,
  Trash2,
  KeyRound,
  RefreshCw,
  MonitorCog,
  BriefcaseBusiness,
} from 'lucide-react';

import { format } from 'date-fns';

import {
  ROLE_LABELS,
  ROLE_DEPARTMENTS,
  normalizeRole,
  getRoleDepartment,
  getRoleLabel,
} from '@/lib/roleAccess';

const MAIN_ADMIN_EMAIL = 'iamkizmith@gmail.com';

const ROLE_GROUPS = [
  {
    department: 'Information Technology',
    roles: [
      {
        value: 'system_admin',
        label: 'System Administrator',
        icon: Shield,
        color: 'bg-red-100 text-red-700 border-red-200',
        protected: true,
      },
      {
        value: 'head_of_it',
        label: 'Head of IT',
        icon: MonitorCog,
        color: 'bg-sky-100 text-sky-700 border-sky-200',
      },
      {
        value: 'it',
        label: 'IT Officer',
        icon: MonitorCog,
        color: 'bg-sky-50 text-sky-600 border-sky-100',
      },
    ],
  },
  {
    department: 'Executive Management',
    roles: [
      {
        value: 'ceo',
        label: 'CEO',
        icon: BadgeCheck,
        color: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      },
      {
        value: 'agm',
        label: 'Assistant General Manager',
        icon: BarChart3,
        color: 'bg-purple-100 text-purple-700 border-purple-200',
      },
    ],
  },
  {
    department: 'Administration',
    roles: [
      {
        value: 'admin_head',
        label: 'Head of Administration',
        icon: UserCog,
        color: 'bg-indigo-100 text-indigo-700 border-indigo-200',
      },
      {
        value: 'admin',
        label: 'Administrative Officer',
        icon: UserCog,
        color: 'bg-indigo-50 text-indigo-600 border-indigo-100',
      },
    ],
  },
  {
    department: 'Operations',
    roles: [
      {
        value: 'manager',
        label: 'Operations Manager',
        icon: BarChart3,
        color: 'bg-blue-100 text-blue-700 border-blue-200',
      },
      {
        value: 'operations',
        label: 'Operations Officer',
        icon: BarChart3,
        color: 'bg-blue-50 text-blue-600 border-blue-100',
      },
    ],
  },
  {
    department: 'Helpdesk',
    roles: [
      {
        value: 'helpdesk',
        label: 'Helpdesk Officer',
        icon: Headphones,
        color: 'bg-cyan-100 text-cyan-700 border-cyan-200',
      },
    ],
  },
  {
    department: 'Field Engineering',
    roles: [
      {
        value: 'engineer',
        label: 'Field Engineer',
        icon: Wrench,
        color: 'bg-amber-100 text-amber-700 border-amber-200',
      },
    ],
  },
  {
    department: 'Inventory',
    roles: [
      {
        value: 'inventory',
        label: 'Inventory Officer',
        icon: ShoppingCart,
        color: 'bg-teal-100 text-teal-700 border-teal-200',
      },
    ],
  },
  {
    department: 'Repair & Refurbishment',
    roles: [
      {
        value: 'repair_head',
        label: 'Head of Repair & Refurbishment',
        icon: Wrench,
        color: 'bg-orange-100 text-orange-700 border-orange-200',
      },
      {
        value: 'repair_technician',
        label: 'Repair Technician',
        icon: Wrench,
        color: 'bg-orange-50 text-orange-600 border-orange-100',
      },
    ],
  },
  {
    department: 'Finance & Accounts',
    roles: [
      {
        value: 'head_of_account',
        label: 'Head of Account',
        icon: DollarSign,
        color: 'bg-green-100 text-green-700 border-green-200',
      },
      {
        value: 'finance',
        label: 'Finance Officer',
        icon: DollarSign,
        color: 'bg-green-50 text-green-600 border-green-100',
      },
    ],
  },
  {
    department: 'Procurement',
    roles: [
      {
        value: 'procurement',
        label: 'Procurement Officer',
        icon: ShoppingCart,
        color: 'bg-cyan-100 text-cyan-700 border-cyan-200',
      },
    ],
  },
  {
    department: 'Human Resources',
    roles: [
      {
        value: 'hr',
        label: 'Human Resource Officer',
        icon: UserCheck,
        color: 'bg-pink-100 text-pink-700 border-pink-200',
      },
    ],
  },
  {
    department: 'Business Development',
    roles: [
      {
        value: 'head_of_business_development',
        label: 'Head of Business Development',
        icon: BriefcaseBusiness,
        color: 'bg-violet-100 text-violet-700 border-violet-200',
      },
      {
        value: 'business_developer',
        label: 'Business Development Officer',
        icon: TrendingUp,
        color: 'bg-violet-50 text-violet-600 border-violet-100',
      },
    ],
  },
  {
    department: 'Client',
    roles: [
      {
        value: 'client',
        label: 'Client / Bank',
        icon: User,
        color: 'bg-slate-100 text-slate-600 border-slate-200',
      },
    ],
  },
];

const ALL_ROLES = ROLE_GROUPS.flatMap((group) =>
  group.roles.map((role) => ({
    ...role,
    department: group.department,
  }))
);

const DEPARTMENTS = ROLE_GROUPS.map((group) => group.department);

const EMPTY_PROFILE = {
  employee_id: '',
  phone: '',
  department: '',
  branch: '',
  region: '',
  account_status: 'active',
  is_approved: true,
  must_change_password: false,
};

const getAvailableRolesForDepartment = (department) => {
  const group = ROLE_GROUPS.find((item) => item.department === department);
  return group?.roles || [];
};

export default function UserManagement() {
  const { user } = useOutletContext();
  const qc = useQueryClient();

  const currentUserRole = normalizeRole(user?.role);
  const isMainDeveloper = user?.email === MAIN_ADMIN_EMAIL;
  const isAdmin = isMainDeveloper && ['system_admin', 'admin', 'super_admin'].includes(currentUserRole);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');

  const [inviteOpen, setInviteOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteDepartment, setInviteDepartment] = useState('Helpdesk');
  const [inviteRole, setInviteRole] = useState('helpdesk');
  const [inviting, setInviting] = useState(false);

  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [profileRole, setProfileRole] = useState('');
  const [profileDepartment, setProfileDepartment] = useState('');

  const [savingProfile, setSavingProfile] = useState(false);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('SUPABASE USERS ERROR:', error);
        return [];
      }

      const baseUsers = data || [];
      const emails = baseUsers
        .map((u) => u.email?.toLowerCase())
        .filter(Boolean);

      if (emails.length === 0) return baseUsers;

      const { data: activityProfiles, error: activityError } = await supabase
        .from('user_profiles')
        .select('user_email, last_login, last_seen, online_status')
        .in('user_email', emails);

      if (activityError) {
        console.error('SUPABASE USER ACTIVITY ERROR:', activityError);
        return baseUsers;
      }

      const activityByEmail = (activityProfiles || []).reduce((acc, profileItem) => {
        if (profileItem.user_email) {
          acc[profileItem.user_email.toLowerCase()] = profileItem;
        }

        return acc;
      }, {});

      return baseUsers.map((u) => ({
        ...u,
        role: normalizeRole(u.role),
        activity: activityByEmail[u.email?.toLowerCase()] || null,
      }));
    },
  });

  const roleCounts = useMemo(() => {
    return ALL_ROLES.reduce((acc, r) => {
      acc[r.value] = users.filter((u) => normalizeRole(u.role) === r.value).length;
      return acc;
    }, {});
  }, [users]);

  const departmentCounts = useMemo(() => {
    return DEPARTMENTS.reduce((acc, department) => {
      acc[department] = users.filter((u) => {
        const roleDepartment = getRoleDepartment(u.role);
        return (u.department || roleDepartment) === department;
      }).length;

      return acc;
    }, {});
  }, [users]);

  const filtered = users.filter((u) => {
    const normalizedUserRole = normalizeRole(u.role);
    const inferredDepartment = u.department || getRoleDepartment(normalizedUserRole);

    if (roleFilter !== 'all' && normalizedUserRole !== roleFilter) return false;
    if (departmentFilter !== 'all' && inferredDepartment !== departmentFilter) return false;

    if (search) {
      const s = search.toLowerCase();

      return (
        u.full_name?.toLowerCase().includes(s) ||
        u.email?.toLowerCase().includes(s) ||
        normalizedUserRole?.toLowerCase().includes(s) ||
        inferredDepartment?.toLowerCase().includes(s)
      );
    }

    return true;
  });

  const roleCfg = (role) => {
    const normalized = normalizeRole(role);

    return (
      ALL_ROLES.find((r) => r.value === normalized) || {
        value: normalized || 'unknown',
        label: getRoleLabel(normalized) || 'Unknown Role',
        department: getRoleDepartment(normalized) || 'Unknown Department',
        icon: User,
        color: 'bg-slate-100 text-slate-600 border-slate-200',
      }
    );
  };

  const isUserCurrentlyOnline = (activity) =>
    !!activity?.last_seen &&
    Date.now() - new Date(activity.last_seen).getTime() < 120000;

  const formatActivityDate = (dateValue) => {
    if (!dateValue) return 'Never';

    try {
      return format(new Date(dateValue), 'MMM d, yyyy HH:mm');
    } catch (error) {
      return 'Invalid date';
    }
  };

  const handleInviteDepartmentChange = (department) => {
    setInviteDepartment(department);

    const firstRole = getAvailableRolesForDepartment(department)[0];

    if (firstRole) {
      setInviteRole(firstRole.value);
    }
  };

  const handleProfileDepartmentChange = (department) => {
    setProfileDepartment(department);
    setProfile((prev) => ({
      ...prev,
      department,
    }));

    const availableRoles = getAvailableRolesForDepartment(department);

    if (!availableRoles.some((role) => role.value === profileRole)) {
      const firstRole = availableRoles[0];

      if (firstRole) {
        setProfileRole(firstRole.value);
      }
    }
  };

  const syncUserProfileTable = async ({
    email,
    role,
    department,
    extraUpdates = {},
  }) => {
    const cleanEmail = normalizeEmail(email);
    if (!cleanEmail) return;

    const { error } = await supabase
      .from('user_profiles')
      .update({
        role,
        department,
        updated_at: new Date().toISOString(),
        ...extraUpdates,
      })
      .ilike('user_email', cleanEmail);

    if (error) {
      console.warn('User profile sync warning:', error.message);
    }
  };

  const syncEmployeeRole = async ({ email, role, department }) => {
    const cleanEmail = normalizeEmail(email);
    if (!cleanEmail) return;

    const { error } = await supabase
      .from('employees')
      .update({
        access_role: role,
        department,
        updated_at: new Date().toISOString(),
      })
      .or(`user_account_email.ilike.${cleanEmail},email_address.ilike.${cleanEmail}`);

    if (error) {
      console.warn('Employee role sync warning:', error.message);
    }
  };

  const handleInvite = async () => {
    if (!isAdmin) {
      alert('Unauthorized. Only the System Administrator can invite users.');
      return;
    }

    setInviting(true);

    try {
      const cleanEmail = normalizeEmail(inviteEmail);

      if (!cleanEmail) {
        alert('Please enter an email address.');
        return;
      }

      if (!inviteDepartment || !inviteRole) {
        alert('Please select a department and role.');
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      const response = await fetch(
        'https://fryidzyhqhdenghyxjfp.functions.supabase.co/invite-user',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            email: cleanEmail,
            full_name: cleanEmail.split('@')[0],
            role: inviteRole,
            department: inviteDepartment,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        alert(result?.error || 'Invite failed');
        return;
      }

      await syncUserProfileTable({
        email: cleanEmail,
        role: inviteRole,
        department: inviteDepartment,
      });

      await syncEmployeeRole({
        email: cleanEmail,
        role: inviteRole,
        department: inviteDepartment,
      });

      await syncRelatedIdentityRecords(supabase, {
        email: cleanEmail,
        role: inviteRole,
        department: inviteDepartment,
      });

      if (result?.action_link) {
        await navigator.clipboard.writeText(result.action_link);

        alert(
          `User created successfully.\n\nCreate Password link copied to clipboard.\n\n${result.action_link}`
        );
      } else {
        alert('User created successfully but no password link was returned.');
      }

      setInviteEmail('');
      setInviteDepartment('Helpdesk');
      setInviteRole('helpdesk');
      setInviteOpen(false);

      qc.invalidateQueries({
        queryKey: ['users'],
      });
    } catch (err) {
      console.error(err);
      alert('Unexpected invite error: ' + err.message);
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    if (!isAdmin) {
      alert('Unauthorized. Only the System Administrator can change roles.');
      return;
    }

    const targetUser = users.find((u) => u.id === userId);
    const normalizedNewRole = normalizeRole(newRole);
    const newDepartment = getRoleDepartment(normalizedNewRole);

    if (targetUser?.email === MAIN_ADMIN_EMAIL && normalizedNewRole !== 'system_admin') {
      alert('System Administrator role cannot be changed from this screen.');
      return;
    }

    const { error } = await supabase
      .from('users')
      .update({
        role: normalizedNewRole,
        department: newDepartment,
        status: 'active',
        approval_status: 'approved',
        is_approved: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) {
      alert('Role update failed: ' + error.message);
      return;
    }

    await syncUserProfileTable({
      email: targetUser?.email,
      role: normalizedNewRole,
      department: newDepartment,
    });

    await syncEmployeeRole({
      email: targetUser?.email,
      role: normalizedNewRole,
      department: newDepartment,
    });

    await syncRelatedIdentityRecords(supabase, {
      email: targetUser?.email,
      fullName: targetUser?.full_name,
      department: newDepartment,
      role: normalizedNewRole,
      employeeId: targetUser?.employee_id,
      phone: targetUser?.phone,
    });

    qc.invalidateQueries({ queryKey: ['users'] });
    alert('Role updated successfully');
  };

  const handleForcePasswordReset = async (u) => {
    if (!isAdmin) {
      alert('Unauthorized');
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(u.email, {
      redirectTo: 'https://portal.arktechnologiesgroup.com/#/create-password',
    });

    if (error) {
      alert(error.message);
      return;
    }

    await supabase
      .from('users')
      .update({
        must_change_password: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', u.id);

    alert('Password reset email sent successfully.');

    qc.invalidateQueries({
      queryKey: ['users'],
    });
  };

  const handleBulkForceReset = async () => {
    if (!isAdmin) {
      alert('Unauthorized');
      return;
    }

    if (!confirm(`Force ALL ${users.length} users to change passwords on next login?`)) return;

    const { error } = await supabase
      .from('users')
      .update({
        must_change_password: true,
        updated_at: new Date().toISOString(),
      })
      .not('id', 'is', null);

    if (error) {
      alert(error.message);
      return;
    }

    qc.invalidateQueries({ queryKey: ['users'] });
  };

  const openProfile = (u) => {
    if (!isAdmin) {
      alert('Unauthorized');
      return;
    }

    const normalizedUserRole = normalizeRole(u.role);
    const resolvedDepartment = u.department || getRoleDepartment(normalizedUserRole);

    setSelectedUser(u);
    setProfileRole(normalizedUserRole);
    setProfileDepartment(resolvedDepartment);

    setProfile({
      employee_id: u.employee_id || '',
      phone: u.phone || '',
      department: resolvedDepartment,
      branch: u.branch || '',
      region: u.region || '',
      account_status: u.account_status || 'active',
      is_approved: !!u.is_approved,
      must_change_password: !!u.must_change_password,
    });

    setProfileOpen(true);
  };

  const handleDelete = async () => {
    if (!isAdmin) {
      alert('Unauthorized');
      return;
    }

    if (!deleteConfirmUser) return;

    if (deleteConfirmUser.email === MAIN_ADMIN_EMAIL) {
      alert('System Administrator cannot be deleted.');
      return;
    }

    setDeleting(true);

    try {
      const cleanDeleteEmail = normalizeEmail(deleteConfirmUser.email);
      const cleanEmployeeId = normalizeStaffId(deleteConfirmUser.employee_id);
      const { data: employees, error: employeesFetchError } = await supabase
        .from('employees')
        .select('*');

      if (employeesFetchError) throw employeesFetchError;

      const linkedEmployees = (employees || []).filter(
        (e) =>
          normalizeEmail(e.user_account_email) === cleanDeleteEmail ||
          normalizeEmail(e.email_address) === cleanDeleteEmail ||
          (cleanEmployeeId && normalizeStaffId(e.staff_id) === cleanEmployeeId) ||
          (cleanEmployeeId && String(e.id) === String(deleteConfirmUser.employee_id))
      );

      for (const linked of linkedEmployees) {
        const { error: employeeUpdateError } = await supabase
          .from('employees')
          .update({
            employment_status: 'Terminated',
            user_account_email: null,
            access_role: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', linked.id);

        if (employeeUpdateError) throw employeeUpdateError;
      }

      const { data: engineers, error: engineersFetchError } = await supabase
        .from('engineers')
        .select('*');

      if (engineersFetchError) throw engineersFetchError;

      const linkedEngineers = (engineers || []).filter(
        (engineer) => normalizeEmail(engineer.email) === cleanDeleteEmail
      );

      for (const engineer of linkedEngineers) {
        const { error: engineerUpdateError } = await supabase
          .from('engineers')
          .update({
            status: 'inactive',
            updated_at: new Date().toISOString(),
          })
          .eq('id', engineer.id);

        if (engineerUpdateError) throw engineerUpdateError;
      }

      const { error: profileUpdateError } = await supabase
        .from('user_profiles')
        .update({
          account_status: 'deleted',
          role: null,
          updated_at: new Date().toISOString(),
        })
        .ilike('user_email', cleanDeleteEmail);

      if (profileUpdateError) {
        console.warn('User profile delete sync warning:', profileUpdateError.message);
      }

      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', deleteConfirmUser.id);

      if (error) {
        alert(error.message);
        return;
      }

      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['hr-employees'] });
      qc.invalidateQueries({ queryKey: ['engineers-list'] });
      qc.setQueryData(['hr-employees'], (current = []) =>
        current.filter((employee) => {
          const employeeEmail = normalizeEmail(employee.email_address || employee.user_account_email);
          const staffId = normalizeStaffId(employee.staff_id);

          return (
            employeeEmail !== cleanDeleteEmail &&
            (!cleanEmployeeId || staffId !== cleanEmployeeId)
          );
        })
      );
      qc.setQueryData(['engineers-list'], (current = []) =>
        current.filter((engineer) => normalizeEmail(engineer.email) !== cleanDeleteEmail)
      );
    } catch (err) {
      alert('Delete failed: ' + (err?.message || 'Unknown error'));
    } finally {
      setDeleting(false);
      setDeleteConfirmUser(null);
    }
  };

  const saveProfile = async () => {
    if (!isAdmin) {
      alert('Unauthorized');
      return;
    }

    if (!selectedUser?.id) return;

    const normalizedProfileRole = normalizeRole(profileRole);
    const resolvedDepartment = profileDepartment || getRoleDepartment(normalizedProfileRole);

    if (selectedUser.email === MAIN_ADMIN_EMAIL && normalizedProfileRole !== 'system_admin') {
      alert('System Administrator role cannot be changed from this screen.');
      return;
    }

    if (selectedUser.email === MAIN_ADMIN_EMAIL && profile.account_status !== 'active') {
      alert('System Administrator account must remain active.');
      return;
    }

    setSavingProfile(true);

    try {
      const { error } = await supabase
        .from('users')
        .update({
          role: normalizedProfileRole,
          employee_id: profile.employee_id,
          phone: profile.phone,
          department: resolvedDepartment,
          branch: profile.branch,
          region: profile.region,
          account_status: profile.account_status,
          is_approved: profile.is_approved,
          must_change_password: profile.must_change_password,
          status: profile.is_approved ? 'active' : 'pending',
          approval_status: profile.is_approved ? 'approved' : 'pending',
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedUser.id);

      if (error) {
        alert('Profile save failed: ' + error.message);
        return;
      }

      await syncUserProfileTable({
        email: selectedUser.email,
        role: normalizedProfileRole,
        department: resolvedDepartment,
        extraUpdates: {
          account_status: profile.account_status,
          is_approved: profile.is_approved,
          must_change_password: profile.must_change_password,
        },
      });

      await syncEmployeeRole({
        email: selectedUser.email,
        role: normalizedProfileRole,
        department: resolvedDepartment,
      });

      await syncRelatedIdentityRecords(supabase, {
        email: selectedUser.email,
        fullName: selectedUser.full_name,
        department: resolvedDepartment,
        role: normalizedProfileRole,
        employeeId: profile.employee_id,
        phone: profile.phone,
      });

      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['hr-employees'] });
      setProfileOpen(false);
    } catch (err) {
      console.error(err);
      alert('Unexpected error saving profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const pendingCount = users.filter(
    (u) =>
      !u.role ||
      u.role === '' ||
      u.status === 'pending' ||
      u.approval_status === 'pending' ||
      u.is_approved === false
  ).length;

  const onlineUsers = users.filter((u) => isUserCurrentlyOnline(u.activity));

  const onlineEngineers = onlineUsers.filter((u) => normalizeRole(u.role) === 'engineer').length;
  const onlineHelpdesk = onlineUsers.filter((u) => normalizeRole(u.role) === 'helpdesk').length;
  const onlineManagement = onlineUsers.filter((u) =>
    ['system_admin', 'ceo', 'agm', 'manager', 'admin_head', 'head_of_it', 'head_of_account'].includes(
      normalizeRole(u.role)
    )
  ).length;

  if (!isAdmin) {
    return (
      <div className="max-w-xl mx-auto mt-16">
        <Card className="p-6 text-center">
          <Shield className="w-10 h-10 mx-auto mb-3 text-red-500" />
          <h1 className="text-xl font-bold">Access Denied</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Only the System Administrator can manage users and roles.
          </p>
        </Card>
      </div>
    );
  }

  const inviteRoles = getAvailableRolesForDepartment(inviteDepartment);
  const profileRoles = getAvailableRolesForDepartment(profileDepartment);

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {users.length} registered users ·{' '}
            {ALL_ROLES.filter((r) => roleCounts[r.value] > 0).length} roles active ·{' '}
            {DEPARTMENTS.filter((d) => departmentCounts[d] > 0).length} departments active
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleBulkForceReset}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Reset All Passwords
          </Button>

          <Button onClick={() => setInviteOpen(true)}>
            <UserPlus className="w-4 h-4 mr-2" />
            Invite User
          </Button>
        </div>
      </div>

      {pendingCount > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/15 text-white/50 p-5">
          <PendingApprovalPanel />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <Card className="p-4 border-green-200 bg-green-50/70">
          <p className="text-xs text-green-700 font-medium">Online Users</p>
          <p className="text-2xl font-bold text-green-800 mt-1">{onlineUsers.length}</p>
          <p className="text-xs text-green-700/80 mt-1">Seen in the last 2 minutes</p>
        </Card>

        <Card className="p-4">
          <p className="text-xs text-muted-foreground font-medium">Online Engineers</p>
          <p className="text-2xl font-bold mt-1">{onlineEngineers}</p>
          <p className="text-xs text-muted-foreground mt-1">Field engineers currently active</p>
        </Card>

        <Card className="p-4">
          <p className="text-xs text-muted-foreground font-medium">Online Helpdesk</p>
          <p className="text-2xl font-bold mt-1">{onlineHelpdesk}</p>
          <p className="text-xs text-muted-foreground mt-1">Helpdesk users currently active</p>
        </Card>

        <Card className="p-4">
          <p className="text-xs text-muted-foreground font-medium">Online Management</p>
          <p className="text-2xl font-bold mt-1">{onlineManagement}</p>
          <p className="text-xs text-muted-foreground mt-1">System, executive and department heads</p>
        </Card>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Filter by Department
        </p>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setDepartmentFilter('all')}
            className={
              'px-3 py-1.5 rounded-full text-xs font-medium border transition-all ' +
              (departmentFilter === 'all'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-slate-900/50 border-border text-muted-foreground')
            }
          >
            All Departments ({users.length})
          </button>

          {DEPARTMENTS.filter((d) => departmentCounts[d] > 0).map((department) => (
            <button
              type="button"
              key={department}
              onClick={() => setDepartmentFilter(department)}
              className={
                'px-3 py-1.5 rounded-full text-xs font-medium border transition-all ' +
                (departmentFilter === department
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-slate-900/50 border-border text-muted-foreground')
              }
            >
              {department} ({departmentCounts[department]})
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Filter by Role
        </p>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setRoleFilter('all')}
            className={
              'px-3 py-1.5 rounded-full text-xs font-medium border transition-all ' +
              (roleFilter === 'all'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-slate-900/50 border-border text-muted-foreground')
            }
          >
            All Roles ({users.length})
          </button>

          {ALL_ROLES.filter((r) => roleCounts[r.value] > 0).map((r) => (
            <button
              type="button"
              key={r.value}
              onClick={() => setRoleFilter(r.value)}
              className={
                'px-3 py-1.5 rounded-full text-xs font-medium border transition-all ' +
                (roleFilter === r.value
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-slate-900/50 border-border text-muted-foreground')
              }
            >
              {r.label} ({roleCounts[r.value]})
            </button>
          ))}
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, department or role..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((u) => {
            const normalizedUserRole = normalizeRole(u.role);
            const rc = roleCfg(normalizedUserRole);
            const Icon = rc.icon;
            const activity = u.activity;
            const isOnline = isUserCurrentlyOnline(activity);
            const resolvedDepartment = u.department || ROLE_DEPARTMENTS[normalizedUserRole] || rc.department;

            return (
              <Card key={u.id} className="p-4">
                <div className="flex flex-col xl:flex-row xl:items-center gap-4">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 border border-primary/20">
                      <span className="text-sm font-bold text-primary">
                        {u.full_name?.[0]?.toUpperCase() || '?'}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-sm truncate">
                          {u.full_name || 'Unnamed'}
                        </p>

                        {u.email === MAIN_ADMIN_EMAIL && (
                          <Badge
                            variant="outline"
                            className="text-[10px] bg-red-50 text-red-700 border-red-200"
                          >
                            Protected System Admin
                          </Badge>
                        )}

                        {u.account_status === 'inactive' && (
                          <Badge
                            variant="outline"
                            className="text-[10px] bg-red-50 text-red-600 border-red-200"
                          >
                            Inactive
                          </Badge>
                        )}

                        {u.account_status === 'suspended' && (
                          <Badge
                            variant="outline"
                            className="text-[10px] bg-amber-50 text-amber-600 border-amber-200"
                          >
                            Suspended
                          </Badge>
                        )}

                        {(u.status === 'pending' ||
                          u.approval_status === 'pending' ||
                          u.is_approved === false) && (
                          <Badge
                            variant="outline"
                            className="text-[10px] bg-yellow-50 text-yellow-700 border-yellow-200"
                          >
                            Pending
                          </Badge>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mt-0.5">
                        <p className="text-xs text-muted-foreground">{u.email}</p>

                        {resolvedDepartment && (
                          <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                            <Building2 className="w-3 h-3" />
                            {resolvedDepartment}
                          </span>
                        )}

                        {u.employee_id && (
                          <span className="text-xs font-mono text-muted-foreground">
                            {u.employee_id}
                          </span>
                        )}

                        {u.phone && (
                          <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                            <Phone className="w-3 h-3" />
                            {u.phone}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <Badge
                          variant="outline"
                          className={
                            isOnline
                              ? 'text-[10px] bg-green-50 text-green-700 border-green-200'
                              : 'text-[10px] bg-slate-50 text-slate-600 border-slate-200'
                          }
                        >
                          {isOnline ? '🟢 Online' : '⚫ Offline'}
                        </Badge>

                        <span className="text-xs text-muted-foreground">
                          Last seen: {formatActivityDate(activity?.last_seen)}
                        </span>

                        <span className="text-xs text-muted-foreground">
                          Last login: {formatActivityDate(activity?.last_login)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className={`${rc.color} text-[10px] flex items-center gap-1 flex-shrink-0`}
                    >
                      <Icon className="w-3 h-3" />
                      {rc.label}
                    </Badge>

                    {u.email !== user.email && (
                      <Select
                        value={normalizedUserRole || ''}
                        onValueChange={(v) => handleRoleChange(u.id, v)}
                      >
                        <SelectTrigger className="w-[220px] h-8 text-xs">
                          <SelectValue placeholder="Set role" />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLE_GROUPS.map((group) => (
                            <div key={group.department}>
                              <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                {group.department}
                              </div>

                              {group.roles.map((r) => (
                                <SelectItem key={r.value} value={r.value}>
                                  {r.label}
                                </SelectItem>
                              ))}
                            </div>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    <Button variant="outline" size="sm" onClick={() => openProfile(u)}>
                      <UserCog className="w-3.5 h-3.5 mr-1" />
                      Profile
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      className={
                        u.must_change_password
                          ? 'text-amber-600 border-amber-300 bg-amber-50'
                          : ''
                      }
                      onClick={() => handleForcePasswordReset(u)}
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                    </Button>

                    {u.email !== user.email && u.email !== MAIN_ADMIN_EMAIL && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                        onClick={() => setDeleteConfirmUser(u)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}

                    <span className="text-xs text-muted-foreground hidden lg:block whitespace-nowrap">
                      {u.created_at ? format(new Date(u.created_at), 'MMM d, yyyy') : ''}
                    </span>
                  </div>
                </div>
              </Card>
            );
          })}

          {filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <User className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>No users found</p>
            </div>
          )}
        </div>
      )}

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite / Add User</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Email Address *</Label>
              <Input
                type="email"
                placeholder="user@arktechnologiesgroup.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Department</Label>
              <Select value={inviteDepartment} onValueChange={handleInviteDepartmentChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map((department) => (
                    <SelectItem key={department} value={department}>
                      {department}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Role / Position</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {inviteRoles.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground">
              Department controls where the staff belongs. Role controls what the staff can do.
            </div>

            <Button className="w-full" onClick={handleInvite} disabled={!inviteEmail || inviting}>
              {inviting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Mail className="w-4 h-4 mr-2" />
              )}
              Add User
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!deleteConfirmUser}
        onOpenChange={(open) => !open && setDeleteConfirmUser(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Delete{' '}
              <span className="font-semibold text-foreground">
                {deleteConfirmUser?.full_name || deleteConfirmUser?.email}
              </span>
              ?
            </p>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setDeleteConfirmUser(null)}
                disabled={deleting}
              >
                Cancel
              </Button>

              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-2" />
                )}
                Delete
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Profile — {selectedUser?.full_name || selectedUser?.email}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Department</Label>
                <Select value={profileDepartment} onValueChange={handleProfileDepartmentChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS.map((department) => (
                      <SelectItem key={department} value={department}>
                        {department}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Role / Position</Label>
                <Select value={profileRole} onValueChange={setProfileRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {profileRoles.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Employee ID</Label>
                <Input
                  value={profile.employee_id}
                  onChange={(e) =>
                    setProfile((p) => ({
                      ...p,
                      employee_id: e.target.value,
                    }))
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input
                  value={profile.phone}
                  onChange={(e) =>
                    setProfile((p) => ({
                      ...p,
                      phone: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Branch</Label>
                <Input
                  value={profile.branch}
                  onChange={(e) =>
                    setProfile((p) => ({
                      ...p,
                      branch: e.target.value,
                    }))
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label>Region</Label>
                <Input
                  value={profile.region}
                  onChange={(e) =>
                    setProfile((p) => ({
                      ...p,
                      region: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Account Status</Label>
              <Select
                value={profile.account_status}
                onValueChange={(v) =>
                  setProfile((p) => ({
                    ...p,
                    account_status: v,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Account Approved</p>
                <p className="text-xs text-muted-foreground">User can access the portal</p>
              </div>

              <Switch
                checked={!!profile.is_approved}
                onCheckedChange={(v) =>
                  setProfile((p) => ({
                    ...p,
                    is_approved: v,
                  }))
                }
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Force Password Change</p>
                <p className="text-xs text-muted-foreground">
                  User must change password on next login
                </p>
              </div>

              <Switch
                checked={!!profile.must_change_password}
                onCheckedChange={(v) =>
                  setProfile((p) => ({
                    ...p,
                    must_change_password: v,
                  }))
                }
              />
            </div>

            <Button className="w-full" onClick={saveProfile} disabled={savingProfile}>
              {savingProfile && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Profile
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
