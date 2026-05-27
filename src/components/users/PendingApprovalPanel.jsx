import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabaseClient';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

import {
  Clock,
  CheckCircle2,
  XCircle,
  Mail,
  Loader2,
  UserCog
} from 'lucide-react';

import { format, isValid } from 'date-fns';

const ALL_ROLES = [
  { value: 'admin', label: 'Administrator' },
  { value: 'ceo', label: 'CEO' },
  { value: 'ceo_pa', label: 'CEO Personal Assistant' },
  { value: 'agm', label: 'Asst. General Manager' },
  { value: 'manager', label: 'Operational Manager' },
  { value: 'repair_head', label: 'Head of Repair & Refurb.' },
  { value: 'helpdesk', label: 'Help Desk' },
  { value: 'engineer', label: 'Field Engineer' },
  { value: 'hr', label: 'Human Resources' },
  { value: 'finance', label: 'Finance' },
  { value: 'inventory', label: 'Inventory' },
  { value: 'procurement', label: 'Procurement' },
  { value: 'crm', label: 'CRM / Marketing' },
  { value: 'client', label: 'Client / Bank' },
];

const safeDate = (value) => {
  if (!value) return 'No date';

  const d = new Date(value);

  if (!isValid(d)) return 'No date';

  return format(d, 'MMM d, yyyy');
};

export default function PendingApprovalPanel() {

  const qc = useQueryClient();

  const [approveOpen, setApproveOpen] = useState(false);

  const [selectedUser, setSelectedUser] = useState(null);

  const [assignRole, setAssignRole] = useState('helpdesk');

  const [assignDept, setAssignDept] = useState('');

  const [assignEmpId, setAssignEmpId] = useState('');

  const [saving, setSaving] = useState(false);

  // USERS
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['pending-users'],
    queryFn: async () => {

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data || [];
    },
  });

  // PROFILES
  const { data: profiles = [] } = useQuery({
    queryKey: ['user-profiles'],
    queryFn: async () => {

      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data || [];
    },
  });

  // pending users
  const pendingUsers = users.filter(
    u => !u.role || u.role === ''
  );

  const getProfile = (email) =>
    profiles.find(
      p => p.user_email === email
    );

  const openApprove = (u) => {

    setSelectedUser(u);

    const pf = getProfile(u.email);

    setAssignDept(pf?.department || '');

    setAssignEmpId(pf?.employee_id || '');

    setAssignRole('helpdesk');

    setApproveOpen(true);
  };

  const handleApprove = async () => {

    if (!selectedUser)
      return;

    try {

      setSaving(true);

      // update user role
      const { error: userErr } = await supabase
        .from('users')
        .update({
          role: assignRole,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedUser.id);

      if (userErr)
        throw userErr;

      const existing =
        getProfile(selectedUser.email);

      const profileData = {
        user_email: selectedUser.email,
        department: assignDept,
        employee_id: assignEmpId,
        account_status: 'active',
        updated_at: new Date().toISOString(),
      };

      // update/create profile
      if (existing) {

        const { error } = await supabase
          .from('user_profiles')
          .update(profileData)
          .eq('id', existing.id);

        if (error)
          throw error;

      } else {

        const { error } = await supabase
          .from('user_profiles')
          .insert({
            ...profileData,
            created_at: new Date().toISOString(),
          });

        if (error)
          throw error;
      }

      // notification
      await supabase
        .from('notifications')
        .insert({
          user_email: selectedUser.email,

          title: 'Account Approved',

          message:
            `Your ARK ONE Portal account has been approved. ` +
            `You have been assigned the role: ${
              ALL_ROLES.find(
                r => r.value === assignRole
              )?.label || assignRole
            }.`,

          type: 'system',

          read: false,

          created_at: new Date().toISOString(),
        });

      qc.invalidateQueries({
        queryKey: ['pending-users']
      });

      qc.invalidateQueries({
        queryKey: ['users']
      });

      qc.invalidateQueries({
        queryKey: ['user-profiles']
      });

      alert('User approved successfully');

      setApproveOpen(false);

    } catch (err) {

      console.error(err);

      alert(
        err?.message || 'Approval failed'
      );

    } finally {

      setSaving(false);
    }
  };

  const handleReject = async (u) => {

    try {

      const existing =
        getProfile(u.email);

      const profileData = {
        user_email: u.email,
        account_status: 'suspended',
        updated_at: new Date().toISOString(),
      };

      if (existing) {

        await supabase
          .from('user_profiles')
          .update(profileData)
          .eq('id', existing.id);

      } else {

        await supabase
          .from('user_profiles')
          .insert({
            ...profileData,
            created_at: new Date().toISOString(),
          });
      }

      qc.invalidateQueries({
        queryKey: ['user-profiles']
      });

      alert('User rejected');

    } catch (err) {

      console.error(err);

      alert(
        err?.message || 'Reject failed'
      );
    }
  };

  return (
    <div className="space-y-4">

      <div className="flex items-center gap-3">

        <div className="flex items-center gap-2">

          <Clock className="w-5 h-5 text-amber-500" />

          <h2 className="text-lg font-bold">
            Pending Account Approvals
          </h2>
        </div>

        {pendingUsers.length > 0 && (

          <Badge className="bg-amber-100 text-amber-700 border-amber-200">

            {pendingUsers.length} pending
          </Badge>
        )}
      </div>

      {isLoading ? (

        <div className="flex justify-center py-8">

          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>

      ) : pendingUsers.length === 0 ? (

        <div className="text-center py-10 text-muted-foreground">

          <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-green-400" />

          <p className="font-medium text-sm">
            No pending approvals
          </p>

          <p className="text-xs">
            All registered users have been reviewed.
          </p>
        </div>

      ) : (

        <div className="grid gap-3">

          {pendingUsers.map(u => {

            const pf = getProfile(u.email);

            const isSuspended =
              pf?.account_status === 'suspended';

            return (
              <Card
                key={u.id}
                className="p-4 border-l-4 border-l-amber-400"
              >

                <div className="flex items-center gap-4">

                  <div className="w-10 h-10 rounded-full bg-amber-50 border-2 border-amber-200 flex items-center justify-center flex-shrink-0">

                    <span className="text-sm font-bold text-amber-600">

                      {u.full_name?.[0]?.toUpperCase() || '?'}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">

                    <div className="flex items-center gap-2">

                      <p className="font-semibold text-sm">

                        {u.full_name || 'Unnamed'}
                      </p>

                      {isSuspended ? (

                        <Badge
                          variant="outline"
                          className="text-[10px] bg-red-50 text-red-600 border-red-200"
                        >
                          Rejected
                        </Badge>

                      ) : (

                        <Badge
                          variant="outline"
                          className="text-[10px] bg-amber-50 text-amber-600 border-amber-200"
                        >
                          Pending
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-3 mt-0.5">

                      <p className="text-xs text-muted-foreground flex items-center gap-1">

                        <Mail className="w-3 h-3" />

                        {u.email}
                      </p>

                      <p className="text-xs text-muted-foreground">

                        {safeDate(
                          u.created_at ||
                          u.created_date
                        )}
                      </p>
                    </div>
                  </div>

                  {!isSuspended && (

                    <div className="flex gap-2">

                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => openApprove(u)}
                      >

                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" />

                        Approve
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 border-red-200"
                        onClick={() => handleReject(u)}
                      >

                        <XCircle className="w-3.5 h-3.5 mr-1" />

                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog
        open={approveOpen}
        onOpenChange={setApproveOpen}
      >

        <DialogContent className="sm:max-w-md">

          <DialogHeader>

            <DialogTitle className="flex items-center gap-2">

              <UserCog className="w-5 h-5 text-primary" />

              Approve Account
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">

            <div className="p-3 bg-muted/50 rounded-lg text-sm">

              <p className="font-medium">

                {selectedUser?.full_name}
              </p>

              <p className="text-xs text-muted-foreground">

                {selectedUser?.email}
              </p>
            </div>

            <div className="space-y-1.5">

              <Label>
                Assign Role / Department *
              </Label>

              <Select
                value={assignRole}
                onValueChange={setAssignRole}
              >

                <SelectTrigger>

                  <SelectValue />
                </SelectTrigger>

                <SelectContent>

                  {ALL_ROLES.map(r => (

                    <SelectItem
                      key={r.value}
                      value={r.value}
                    >
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">

              <div className="space-y-1.5">

                <Label>
                  Department Name
                </Label>

                <Input
                  value={assignDept}

                  onChange={e =>
                    setAssignDept(
                      e.target.value
                    )
                  }

                  placeholder="e.g. Operations"
                />
              </div>

              <div className="space-y-1.5">

                <Label>
                  Employee ID
                </Label>

                <Input
                  value={assignEmpId}

                  onChange={e =>
                    setAssignEmpId(
                      e.target.value
                    )
                  }

                  placeholder="ARK-EMP-001"
                />
              </div>
            </div>

            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700">

              The user will gain dashboard access immediately upon approval.
            </div>

            <Button
              className="w-full bg-green-600 hover:bg-green-700 text-white"

              onClick={handleApprove}

              disabled={saving}
            >

              {saving ? (

                <Loader2 className="w-4 h-4 mr-2 animate-spin" />

              ) : (

                <CheckCircle2 className="w-4 h-4 mr-2" />
              )}

              Approve & Grant Access
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}