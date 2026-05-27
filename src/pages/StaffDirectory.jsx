import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';

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

import {
  Plus,
  Search,
  Users,
  MapPin,
  Building2,
  Phone,
  Mail,
  Pencil,
  Loader2,
} from 'lucide-react';

const statusColors = {
  Active: 'bg-green-100 text-green-700 border-green-200',
  'On Leave': 'bg-amber-100 text-amber-700 border-amber-200',
  Suspended: 'bg-red-100 text-red-700 border-red-200',
  Terminated: 'bg-slate-100 text-slate-500 border-slate-200',
  Resigned: 'bg-slate-100 text-slate-500 border-slate-200',
  Inactive: 'bg-slate-100 text-slate-500 border-slate-200',
};

const emptyForm = {
  full_name: '',
  staff_id: '',
  email_address: '',
  phone_number: '',
  job_title: '',
  department: '',
  home_address: '',
  employment_status: 'Active',
  country: 'Nigeria',
  create_login: false,
  login_email: '',
  login_role: 'engineer',
};

async function fetchEmployees() {
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) throw error;
  return data || [];
}

async function fetchEngineers() {
  const { data, error } = await supabase
    .from('engineers')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) throw error;
  return data || [];
}

export default function StaffDirectory() {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const { data: employees = [], isLoading: loadingEmp } = useQuery({
    queryKey: ['hr-employees'],
    queryFn: fetchEmployees,
  });

  const { data: engineers = [], isLoading: loadingEng } = useQuery({
    queryKey: ['engineers-list'],
    queryFn: fetchEngineers,
  });

  const isLoading = loadingEmp || loadingEng;

  const allStaff = useMemo(() => {
    const empEmails = new Set(
      employees
        .map((e) =>
          (e.email_address || e.user_account_email || '').toLowerCase()
        )
        .filter(Boolean)
    );

    const engAsStaff = engineers
      .filter((eng) => !empEmails.has((eng.email || '').toLowerCase()))
      .map((eng) => ({
        id: 'eng_' + eng.id,
        full_name: eng.engineer_name,
        email_address: eng.email,
        phone_number: eng.phone || eng.phone_number,
        job_title: 'Field Engineer',
        department: 'Field Operations',
        home_address: eng.assigned_location || eng.region,
        employment_status:
          eng.status === 'active'
            ? 'Active'
            : eng.status === 'on_leave'
              ? 'On Leave'
              : 'Inactive',
        staff_id: eng.id?.slice(-6)?.toUpperCase(),
        _source: 'engineer',
      }));

    return [
      ...employees.map((e) => ({
        ...e,
        _source: 'employee',
      })),
      ...engAsStaff,
    ];
  }, [employees, engineers]);

  const departments = [
    ...new Set(allStaff.map((e) => e.department).filter(Boolean)),
  ].sort();

  const filtered = allStaff.filter((e) => {
    if (deptFilter !== 'all' && e.department !== deptFilter) return false;

    if (search) {
      const q = search.toLowerCase();

      return (
        e.full_name?.toLowerCase().includes(q) ||
        e.email_address?.toLowerCase().includes(q) ||
        e.job_title?.toLowerCase().includes(q) ||
        e.department?.toLowerCase().includes(q) ||
        e.staff_id?.toLowerCase().includes(q)
      );
    }

    return true;
  });

  const handleSave = async () => {
    if (!form.full_name?.trim()) {
      alert('Full Name is required.');
      return;
    }

    const staffId = form.staff_id?.trim() || `ARK-${Date.now().toString().slice(-6)}`;

    setSaving(true);

    try {
      const {
        create_login,
        login_email,
        login_role,
        ...employeeData
      } = {
        ...form,
        staff_id: staffId,
        updated_at: new Date().toISOString(),
      };

      if (editing && editing._source === 'employee') {
        const { error } = await supabase
          .from('employees')
          .update(employeeData)
          .eq('id', editing.id);

        if (error) throw error;
      } else if (editing && editing._source === 'engineer') {
        const engineerId = String(editing.id).replace('eng_', '');

        const { error } = await supabase
          .from('engineers')
          .update({
            engineer_name: employeeData.full_name,
            email: employeeData.email_address,
            phone: employeeData.phone_number,
            assigned_location: employeeData.home_address,
            status:
              employeeData.employment_status === 'Active'
                ? 'active'
                : employeeData.employment_status === 'On Leave'
                  ? 'on_leave'
                  : 'inactive',
            updated_at: new Date().toISOString(),
          })
          .eq('id', engineerId);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('employees').insert({
          ...employeeData,
          staff_id: staffId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        if (error) throw error;

        if (create_login && login_email) {
          const { error: userError } = await supabase.from('users').upsert(
            {
              email: login_email,
              full_name: employeeData.full_name,
              role: login_role,
              phone: employeeData.phone_number,
              department: employeeData.department,
              status: 'pending',
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'email' }
          );

          if (userError) {
            alert('Staff saved. However, user profile creation failed: ' + userError.message);
          }
        }
      }

      queryClient.invalidateQueries({ queryKey: ['hr-employees'] });
      queryClient.invalidateQueries({ queryKey: ['engineers-list'] });

      setForm(emptyForm);
      setEditing(null);
      setDialogOpen(false);
    } catch (err) {
      alert('Error saving staff: ' + (err?.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (e) => {
    setEditing(e);

    setForm({
      full_name: e.full_name || '',
      staff_id: e.staff_id || '',
      email_address: e.email_address || '',
      phone_number: e.phone_number || '',
      job_title: e.job_title || '',
      department: e.department || '',
      home_address: e.home_address || '',
      employment_status: e.employment_status || 'Active',
      country: e.country || 'Nigeria',
      create_login: false,
      login_email: e.email_address || '',
      login_role: 'engineer',
    });

    setDialogOpen(true);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Staff Directory</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {allStaff.length} staff member{allStaff.length !== 1 ? 's' : ''}
          </p>
        </div>

        <Button
          onClick={() => {
            setEditing(null);
            setForm(emptyForm);
            setDialogOpen(true);
          }}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Staff
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, title, ID..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Select value={deptFilter} onValueChange={setDeptFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Department" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {departments.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((e) => (
            <Card key={e.id} className="p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    {e.profile_photo ? (
                      <img
                        src={e.profile_photo}
                        alt={e.full_name}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <span className="text-sm font-bold text-primary">
                        {e.full_name?.[0]?.toUpperCase() || '?'}
                      </span>
                    )}
                  </div>

                  <div>
                    <p className="font-semibold text-sm">
                      {(e.title ? e.title + ' ' : '') + e.full_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {e.job_title || 'No title'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1">
                  <Badge
                    variant="outline"
                    className={`${statusColors[e.employment_status] || 'bg-slate-100'} text-[10px]`}
                  >
                    {e.employment_status || 'Active'}
                  </Badge>

                  {e._source === 'engineer' && (
                    <Badge
                      className="text-[9px] bg-blue-100 text-blue-700 border-blue-200"
                      variant="outline"
                    >
                      Engineer
                    </Badge>
                  )}
                </div>
              </div>

              <div className="space-y-1.5 text-xs text-muted-foreground">
                {e.department && (
                  <div className="flex items-center gap-1.5">
                    <Building2 className="w-3 h-3" />
                    <span>{e.department}</span>
                  </div>
                )}

                {e.home_address && (
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3 h-3" />
                    <span className="truncate">{e.home_address}</span>
                  </div>
                )}

                {e.email_address && (
                  <div className="flex items-center gap-1.5">
                    <Mail className="w-3 h-3" />
                    <span className="truncate">{e.email_address}</span>
                  </div>
                )}

                {e.phone_number && (
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3 h-3" />
                    <span>{e.phone_number}</span>
                  </div>
                )}

                {e.staff_id && (
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded">
                      ID: {e.staff_id}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex gap-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => handleEdit(e)}
                >
                  <Pencil className="w-3 h-3 mr-1" />
                  Edit
                </Button>
              </div>
            </Card>
          ))}

          {filtered.length === 0 && (
            <div className="col-span-full text-center py-16 text-muted-foreground">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No staff found</p>
              <p className="text-xs mt-1">
                Add staff from HR Portal or click "Add Staff" above.
              </p>
            </div>
          )}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit' : 'Add'} Staff Member</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Full Name *</Label>
                <Input
                  value={form.full_name}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      full_name: e.target.value,
                    }))
                  }
                  placeholder="Legal full name"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Staff ID</Label>
                <Input
                  value={form.staff_id}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      staff_id: e.target.value,
                    }))
                  }
                  placeholder="e.g. ARK-001"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.email_address}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      email_address: e.target.value,
                    }))
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input
                  value={form.phone_number}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      phone_number: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Job Title</Label>
              <Input
                value={form.job_title}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    job_title: e.target.value,
                  }))
                }
                placeholder="e.g. Field Engineer"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Department *</Label>
                <Input
                  value={form.department}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      department: e.target.value,
                    }))
                  }
                  placeholder="e.g. IT Operations"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select
                  value={form.employment_status}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      employment_status: v,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="On Leave">On Leave</SelectItem>
                    <SelectItem value="Suspended">Suspended</SelectItem>
                    <SelectItem value="Terminated">Terminated</SelectItem>
                    <SelectItem value="Resigned">Resigned</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Address / Location</Label>
              <Input
                value={form.home_address}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    home_address: e.target.value,
                  }))
                }
                placeholder="e.g. Lagos HQ, 10 Marina Road"
              />
            </div>

            {!editing && (
              <div className="rounded-lg border p-3 space-y-3 bg-muted/30">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.create_login}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        create_login: e.target.checked,
                        login_email: f.login_email || f.email_address,
                      }))
                    }
                  />
                  <Label>Create user login profile</Label>
                </div>

                {form.create_login && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Login Email</Label>
                      <Input
                        type="email"
                        value={form.login_email}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            login_email: e.target.value,
                          }))
                        }
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label>Login Role</Label>
                      <Select
                        value={form.login_role}
                        onValueChange={(v) =>
                          setForm((f) => ({
                            ...f,
                            login_role: v,
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="engineer">Engineer</SelectItem>
                          <SelectItem value="helpdesk">Helpdesk</SelectItem>
                          <SelectItem value="inventory">Inventory</SelectItem>
                          <SelectItem value="procurement">Procurement</SelectItem>
                          <SelectItem value="finance">Finance</SelectItem>
                          <SelectItem value="hr">HR</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
            )}

            <Button
              className="w-full"
              onClick={handleSave}
              disabled={!form.full_name || saving}
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editing ? 'Update' : 'Add'} Staff
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}