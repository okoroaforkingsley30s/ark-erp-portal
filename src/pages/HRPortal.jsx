import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import {
  findDuplicateIdentity,
  isVisibleStaffRecord,
  normalizeEmail,
  syncRelatedIdentityRecords,
} from '@/lib/identity';
import { useFormDraft } from '@/hooks/useFormDraft';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Users, Clock, FileText, CreditCard, BookOpen, Star, Calendar, LayoutDashboard, Eye, Loader2 } from 'lucide-react';

import HRDashboard from '@/components/hr/HRDashboard';
import EmployeeTable from '@/components/hr/EmployeeTable';
import EmployeeFormDialog from '@/components/hr/EmployeeFormDialog';
import AttendanceModule from '@/components/hr/AttendanceModule';
import LeaveModule from '@/components/hr/LeaveModule';
import LoanModule from '@/components/hr/LoanModule';
import TrainingModule from '@/components/hr/TrainingModule';
import PerformanceModule from '@/components/hr/PerformanceModule';
import HolidayModule from '@/components/hr/HolidayModule';

const MAIN_ADMIN_EMAIL = 'iamkizmith@gmail.com';

const EMPTY_EMP = {
  full_name: '', staff_id: '', title: '', phone_number: '', marital_status: '', gender: '',
  date_of_birth: '', home_address: '', job_title: '', current_level: '', department: '',
  religion: '', state_of_origin: '', local_government_area: '', nationality: '', country: 'Nigeria',
  email_address: '', national_id_type: '', national_id_number: '', date_of_employment: '',
  current_pay: '', employment_status: 'Active',
  next_of_kin_full_name: '', next_of_kin_phone_number: '', next_of_kin_address: '',
  next_of_kin_occupation: '', next_of_kin_email_address: '', next_of_kin_relationship: '',
  next_of_kin_id_type: '', next_of_kin_id_number: '',
  guarantor_1_full_name: '', guarantor_1_id_type: '', guarantor_1_id_number: '',
  guarantor_1_phone_number: '', guarantor_1_email_address: '', guarantor_1_home_address: '',
  guarantor_1_office_address: '', guarantor_1_occupation: '',
  guarantor_2_full_name: '', guarantor_2_id_type: '', guarantor_2_id_number: '',
  guarantor_2_phone_number: '', guarantor_2_email_address: '', guarantor_2_home_address: '',
  guarantor_2_office_address: '', guarantor_2_occupation: '',
  create_login: false, login_email: '', login_role: 'engineer',
};

const NAV = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'employees', label: 'Employees', icon: Users },
  { key: 'attendance', label: 'Attendance', icon: Clock },
  { key: 'leave', label: 'Leave', icon: FileText },
  { key: 'loans', label: 'Loans', icon: CreditCard },
  { key: 'training', label: 'Training', icon: BookOpen },
  { key: 'performance', label: 'Performance', icon: Star },
  { key: 'holidays', label: 'Holidays', icon: Calendar },
];

export default function HRPortal() {
  const { user } = useOutletContext();
  const role = user?.role || 'engineer';
  const isAdmin = ['admin', 'super_admin'].includes(role);
  const canManage = isAdmin || ['hr'].includes(role);
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState('dashboard');
  const [empFormOpen, setEmpFormOpen] = useState(false);
  const [editingEmp, setEditingEmp] = useState(null);
  const [empForm, setEmpForm] = useState(EMPTY_EMP);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [viewEmp, setViewEmp] = useState(null);
  const employeeDraftKey = editingEmp?.id
    ? `hr-employee-edit-${editingEmp.id}`
    : 'hr-employee-new';
  const { clearDraft: clearEmployeeDraft } = useFormDraft({
    key: employeeDraftKey,
    form: empForm,
    setForm: setEmpForm,
    userId: user?.email,
    enabled: empFormOpen,
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['hr-employees'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Employees fetch error:', error);
        return [];
      }

      return (data || []).filter(isVisibleStaffRecord);
    },
  });

  const { data: attendance = [] } = useQuery({
    queryKey: ['hr-attendance'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hr_attendance')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  const { data: leaveRequests = [] } = useQuery({
    queryKey: ['hr-leaves'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hr_leave')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  const { data: loans = [] } = useQuery({
    queryKey: ['hr-loans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hr_loans')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  const { data: trainings = [] } = useQuery({
    queryKey: ['hr-trainings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hr_training')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ['hr-reviews'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hr_performance')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  const { data: holidays = [] } = useQuery({
    queryKey: ['hr-holidays'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hr_holidays')
        .select('*')
        .order('holiday_date', { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });

  const pendingLeave = leaveRequests.filter(l => l.approval_status === 'Pending').length;

  const saveEmployee = async () => {
    if (!empForm.full_name?.trim()) {
      alert('Please fill in Full Name (required).');
      return;
    }

    setSaving(true);

    try {
      const formEmail = normalizeEmail(empForm.email_address);
      const loginEmail = normalizeEmail(empForm.login_email || formEmail);
      const cleanForm = {
        ...empForm,
        email_address: formEmail,
        staff_id: empForm.staff_id?.trim() || `ARK-${Date.now().toString().slice(-6)}`,
        department: empForm.department?.trim() || 'General',
        current_pay: parseFloat(empForm.current_pay) || 0,
      };

      const {
        create_login,
        login_email,
        login_role,
        ...employeeData
      } = cleanForm;

      const cleanLoginEmail = normalizeEmail(login_email || loginEmail);

      employeeData.user_account_email = create_login && cleanLoginEmail
        ? cleanLoginEmail
        : employeeData.user_account_email || null;

      employeeData.access_role = create_login && login_role
        ? login_role
        : employeeData.access_role || null;

      employeeData.updated_at = new Date().toISOString();
      let shouldSyncLoginRole = Boolean(employeeData.access_role);

      const [employeeRows, engineerRows, userRows, profileRows] = await Promise.all([
        supabase.from('employees').select('id, full_name, staff_id, email_address, user_account_email'),
        supabase.from('engineers').select('id, engineer_name, email'),
        supabase.from('users').select('id, full_name, email'),
        supabase.from('user_profiles').select('id, user_email'),
      ]);

      const duplicate = findDuplicateIdentity({
        employees: employeeRows.data || [],
        engineers: engineerRows.data || [],
        users: [],
        profiles: [],
        email: employeeData.email_address || cleanLoginEmail,
        staffId: employeeData.staff_id,
        ignore: {
          employeeId: editingEmp?.id,
        },
      });

      if (duplicate) {
        alert(`${duplicate.message} Open that record and edit it instead of creating another staff profile.`);
        return;
      }

      if (create_login && cleanLoginEmail) {
        const existingUser = (userRows.data || []).find(
          (item) => normalizeEmail(item.email) === cleanLoginEmail
        );

        if (existingUser) {
          shouldSyncLoginRole = false;

          const { error: userUpdateError } = await supabase
            .from('users')
            .update({
              full_name: employeeData.full_name,
              department: employeeData.department || 'General',
              employee_id: employeeData.staff_id || null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingUser.id);

          if (userUpdateError) throw userUpdateError;
        } else {
          const { error: pendingError } = await supabase
            .from('users')
            .insert({
            email: cleanLoginEmail,
            full_name: employeeData.full_name,
            role: null,
            status: 'pending',
            approval_status: 'pending',
            is_approved: false,
            account_status: 'active',
            department: employeeData.department || 'General',
            employee_id: employeeData.staff_id || null,
            updated_at: new Date().toISOString(),
          });

          if (pendingError) {
            console.error('Pending user creation failed:', pendingError);
            throw pendingError;
          }
        }

        const existingProfile = (profileRows.data || []).find(
          (item) => normalizeEmail(item.user_email) === cleanLoginEmail
        );

        if (!existingProfile) {
          await supabase.from('user_profiles').insert({
            user_email: cleanLoginEmail,
            employee_id: employeeData.staff_id || null,
            department: employeeData.department || 'General',
            account_status: 'active',
            role: login_role || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }

        if (!existingUser) {
          await supabase
            .from('notifications')
            .insert({
            title: 'New User Approval Request',
            message: `${employeeData.full_name} requires login access approval as ${login_role}.`,
            type: 'approval',
            user_email: MAIN_ADMIN_EMAIL,
            recipient_email: MAIN_ADMIN_EMAIL,
            read: false,
            is_read: false,
            data: {
              email: cleanLoginEmail,
              full_name: employeeData.full_name,
              role: login_role,
              department: employeeData.department || 'General',
              employee_id: employeeData.staff_id || null,
            },
            link: '/users',
            sound: 'bell',
            created_at: new Date().toISOString(),
          });
        }
      }

      if (editingEmp) {
        const previousEmail = editingEmp.email_address || editingEmp.user_account_email;

        const { error } = await supabase
          .from('employees')
          .update(employeeData)
          .eq('id', editingEmp.id);

        if (error) throw error;

        await syncRelatedIdentityRecords(supabase, {
          previousEmail,
          email: employeeData.email_address || employeeData.user_account_email,
          fullName: employeeData.full_name,
          department: employeeData.department,
          role: employeeData.access_role,
          employeeId: employeeData.staff_id,
          phone: employeeData.phone_number,
          excludeEmployeeId: editingEmp.id,
        });
      } else {
        const { error } = await supabase
          .from('employees')
          .insert([{
            ...employeeData,
            created_at: new Date().toISOString(),
          }]);

        if (error) throw error;

        await syncRelatedIdentityRecords(supabase, {
          email: employeeData.email_address || employeeData.user_account_email,
          fullName: employeeData.full_name,
          department: employeeData.department,
          role: shouldSyncLoginRole ? employeeData.access_role : undefined,
          employeeId: employeeData.staff_id,
          phone: employeeData.phone_number,
        });
      }

      qc.invalidateQueries({ queryKey: ['hr-employees'] });
      qc.invalidateQueries({ queryKey: ['users'] });

      clearEmployeeDraft();
      setEmpFormOpen(false);
      setEditingEmp(null);
      setEmpForm(EMPTY_EMP);

      alert('Employee saved successfully');
    } catch (err) {
      console.error('Error saving employee:', err);
      alert('Error saving employee: ' + (err?.message || 'Unknown error. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEmployee = async (emp) => {
    if (!canManage) {
      alert('Unauthorized.');
      return;
    }

    if (!emp?.id) return;

    const ok = confirm(
      `Delete employee record for ${emp.full_name || emp.email_address || 'this employee'}?`
    );

    if (!ok) return;

    try {
      const { error } = await supabase
        .from('employees')
        .delete()
        .eq('id', emp.id);

      if (error) throw error;

      qc.invalidateQueries({ queryKey: ['hr-employees'] });

      alert('Employee deleted successfully.');
    } catch (err) {
      console.error('Delete employee failed:', err);
      alert('Delete failed: ' + (err?.message || 'Unknown error'));
    }
  };

  const handleEdit = (emp) => {
    setEditingEmp(emp);
    setEmpForm({ ...EMPTY_EMP, ...emp });
    setEmpFormOpen(true);
  };

  const handleSync = async () => {
    setSyncing(true);

    try {
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('*')
        .not('email', 'is', null);

      if (usersError) throw usersError;

      if (!users?.length) {
        alert('No users found to sync.');
        return;
      }

      const employeesToSync = users.map((user) => ({
        full_name: user.full_name || user.name || user.email?.split('@')[0] || 'Unknown User',
        email_address: normalizeEmail(user.email),
        user_account_email: normalizeEmail(user.email),
        access_role: user.role || 'staff',
        department: user.department || 'General',
        job_title: user.job_title || user.role || 'Staff',
        employment_status: 'Active',
        updated_at: new Date().toISOString(),
      }));

      const uniqueEmployees = Array.from(
        new Map(employeesToSync.map((emp) => [emp.email_address, emp])).values()
      ).filter((emp) => emp.email_address);

      const { data: existingEmployees, error: employeesError } = await supabase
        .from('employees')
        .select('id, email_address, user_account_email');

      if (employeesError) throw employeesError;

      const employeesByEmail = new Map();

      (existingEmployees || []).forEach((employee) => {
        const email = normalizeEmail(employee.email_address || employee.user_account_email);
        if (email && !employeesByEmail.has(email)) {
          employeesByEmail.set(email, employee);
        }
      });

      let createdCount = 0;
      let updatedCount = 0;

      for (const employee of uniqueEmployees) {
        const existing = employeesByEmail.get(employee.email_address);

        if (existing) {
          const { error } = await supabase
            .from('employees')
            .update(employee)
            .eq('id', existing.id);

          if (error) throw error;
          updatedCount += 1;
        } else {
          const { error } = await supabase.from('employees').insert({
            ...employee,
            created_at: new Date().toISOString(),
          });

          if (error) throw error;
          createdCount += 1;
        }
      }

      qc.invalidateQueries({ queryKey: ['hr-employees'] });

      alert(`Sync complete. Created ${createdCount}, updated ${updatedCount}, skipped duplicates by email.`);
    } catch (err) {
      console.error('Sync Users & Staff → Employees failed:', err);
      alert('Sync failed: ' + (err?.message || 'Unknown error'));
    } finally {
      setSyncing(false);
    }
  };

  const handleAdd = () => {
    setEditingEmp(null);
    setEmpForm(EMPTY_EMP);
    setEmpFormOpen(true);
  };

  return (
    <div className="flex h-full min-h-screen">
      <nav className="hidden md:flex flex-col w-48 flex-shrink-0 border-r border-white/10 bg-[#102969]/90 py-4 gap-1 pr-2 text-white">
        <p className="text-xs font-semibold text-slate-300 uppercase px-3 mb-2">
          HR Portal
        </p>

        {NAV.map((n) => {
          const badge =
            n.key === 'leave' && pendingLeave > 0
              ? pendingLeave
              : null;

          const isActive = activeTab === n.key;

          return (
            <button
              key={n.key}
              type="button"
              onClick={() => setActiveTab(n.key)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
                isActive
                  ? 'bg-[#ff5a00] text-white shadow-sm'
                  : 'text-slate-200 hover:bg-white/10 hover:text-white'
              }`}
            >
              <n.icon className="w-4 h-4 flex-shrink-0" />

              <span className="flex-1">
                {n.label}
              </span>

              {badge && (
                <span className="bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="md:hidden w-full absolute top-0 left-0 z-10">
        <div className="flex gap-1 overflow-x-auto p-2 bg-slate-900/50 border-b">
          {NAV.map(n => (
            <button
              key={n.key}
              onClick={() => setActiveTab(n.key)}
              className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${activeTab === n.key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
            >
              <n.icon className="w-3 h-3" />{n.label}
            </button>
          ))}
        </div>
      </div>

      <main className="flex-1 p-4 md:p-6 overflow-auto md:mt-0 mt-12">
        <div className="max-w-6xl mx-auto space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">
              {NAV.find(n => n.key === activeTab)?.label}
            </h1>
          </div>

          {activeTab === 'dashboard' && (
            <HRDashboard employees={employees} attendance={attendance} leaveRequests={leaveRequests} loans={loans} trainings={trainings} reviews={reviews} holidays={holidays} />
          )}

          {activeTab === 'employees' && (
            <div className="space-y-3">
              {canManage && (
                <div className="flex justify-end">
                  <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
                    {syncing ? <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" />Syncing...</> : '⟳ Sync Users & Staff → Employees'}
                  </Button>
                </div>
              )}

              <EmployeeTable
                employees={employees}
                canManage={canManage}
                onEdit={handleEdit}
                onView={emp => setViewEmp(emp)}
                onAdd={handleAdd}
                onDelete={handleDeleteEmployee}
              />
            </div>
          )}

          {activeTab === 'attendance' && (
            <AttendanceModule attendance={attendance} employees={employees} canManage={canManage} />
          )}

          {activeTab === 'leave' && (
            <LeaveModule leaveRequests={leaveRequests} canManage={canManage} user={user} />
          )}

          {activeTab === 'loans' && (
            <LoanModule loans={loans} canManage={canManage} user={user} />
          )}

          {activeTab === 'training' && (
            <TrainingModule trainings={trainings} canManage={canManage} />
          )}

          {activeTab === 'performance' && (
            <PerformanceModule reviews={reviews} canManage={canManage} />
          )}

          {activeTab === 'holidays' && (
            <HolidayModule holidays={holidays} canManage={canManage} />
          )}
        </div>
      </main>

      <EmployeeFormDialog
        open={empFormOpen}
        onOpenChange={setEmpFormOpen}
        form={empForm}
        setForm={setEmpForm}
        editing={editingEmp}
        onSave={saveEmployee}
        saving={saving}
      />

      <Dialog open={!!viewEmp} onOpenChange={() => setViewEmp(null)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              <Eye className="w-4 h-4 inline mr-2" />
              Employee Profile
            </DialogTitle>
          </DialogHeader>

          {viewEmp && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-2">
                {[
                  ['Full Name', (viewEmp.title ? viewEmp.title + ' ' : '') + viewEmp.full_name],
                  ['Staff ID', viewEmp.staff_id],
                  ['Job Title', viewEmp.job_title],
                  ['Department', viewEmp.department],
                  ['Country', viewEmp.country],
                  ['Email', viewEmp.email_address],
                  ['Phone', viewEmp.phone_number],
                  ['Gender', viewEmp.gender],
                  ['Date of Birth', viewEmp.date_of_birth],
                  ['Date of Employment', viewEmp.date_of_employment],
                  ['Employment Status', viewEmp.employment_status],
                  ['Current Pay', viewEmp.current_pay ? `₦${Number(viewEmp.current_pay).toLocaleString()}` : '—'],
                  ['National ID', `${viewEmp.national_id_type || ''} ${viewEmp.national_id_number || ''}`],
                ].map(([k, v]) => v ? (
                  <div key={k} className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">{k}</p>
                    <p className="font-medium text-sm">{v}</p>
                  </div>
                ) : null)}
              </div>

              {viewEmp.next_of_kin_full_name && (
                <div className="border-t pt-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Next of Kin</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      ['Name', viewEmp.next_of_kin_full_name],
                      ['Relationship', viewEmp.next_of_kin_relationship],
                      ['Phone', viewEmp.next_of_kin_phone_number],
                    ].map(([k, v]) => v ? (
                      <div key={k}>
                        <p className="text-xs text-muted-foreground">{k}</p>
                        <p className="font-medium">{v}</p>
                      </div>
                    ) : null)}
                  </div>
                </div>
              )}

              {viewEmp.guarantor_1_full_name && (
                <div className="border-t pt-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Guarantor 1</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      ['Name', viewEmp.guarantor_1_full_name],
                      ['Phone', viewEmp.guarantor_1_phone_number],
                      ['Occupation', viewEmp.guarantor_1_occupation],
                    ].map(([k, v]) => v ? (
                      <div key={k}>
                        <p className="text-xs text-muted-foreground">{k}</p>
                        <p className="font-medium">{v}</p>
                      </div>
                    ) : null)}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
