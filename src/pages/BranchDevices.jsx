import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import {
  ArrowLeft,
  Plus,
  Edit2,
  Trash2,
  Loader2,
  Cpu,
} from 'lucide-react';

const EMPTY_DEVICE = {
  terminal_id: '',
  device_name: '',
  device_type: 'ATM',
  device_model: '',
  assigned_engineer: '',
  assigned_engineer_name: '',
  assigned_engineer_email: '',
  device_status: 'Active',
  sla_status: 'Normal',
};

export default function BranchDevices() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState(null);
  const [form, setForm] = useState(EMPTY_DEVICE);

  const { data: branch, isLoading: branchLoading } = useQuery({
    queryKey: ['branch', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: devices = [], isLoading: devicesLoading } = useQuery({
    queryKey: ['branch-devices', id, branch?.branch_name, branch?.bank_name],
    queryFn: async () => {
      if (!branch) return [];

      const { data, error } = await supabase
        .from('devices')
        .select('*')
        .eq('bank_name', branch.bank_name)
        .eq('branch_name', branch.branch_name)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Branch devices fetch error:', error);
        return [];
      }

      return data || [];
    },
    enabled: !!branch,
  });

  const { data: engineers = [] } = useQuery({
    queryKey: ['engineers-for-branch-devices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id,email,full_name,role')
        .eq('role', 'engineer')
        .order('full_name', { ascending: true });

      if (error) {
        console.error('Engineers fetch error:', error);
        return [];
      }

      return data || [];
    },
  });

  const title = useMemo(() => {
    if (!branch) return 'Branch Devices';
    return `${branch.bank_name || ''} - ${branch.branch_name || ''}`;
  }, [branch]);

  const resetForm = () => {
    setEditingDevice(null);
    setForm(EMPTY_DEVICE);
  };

  const openAdd = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (device) => {
    setEditingDevice(device);

    setForm({
      terminal_id: device.terminal_id || device.atm_terminal_id || '',
      device_name: device.device_name || device.name || '',
      device_type: device.device_type || device.category || 'ATM',
      device_model: device.device_model || device.model || '',
      assigned_engineer:
        device.assigned_engineer_email ||
        device.assigned_engineer ||
        '',
      assigned_engineer_name:
        device.assigned_engineer_name ||
        device.assigned_engineer ||
        '',
      assigned_engineer_email:
        device.assigned_engineer_email || '',
      device_status: device.device_status || device.status || 'Active',
      sla_status: device.sla_status || 'Normal',
    });

    setDialogOpen(true);
  };

  const saveDevice = useMutation({
    mutationFn: async () => {
      if (!branch) throw new Error('Branch not found.');

      const selectedEngineer = engineers.find(
        (e) => e.email === form.assigned_engineer
      );

      const payload = {
        bank_name: branch.bank_name || null,
        branch_name: branch.branch_name || null,
        branch: branch.branch_name || null,

        terminal_id: form.terminal_id || null,
        atm_terminal_id: form.terminal_id || null,

        device_name: form.device_name || null,
        name: form.device_name || null,

        device_type: form.device_type || null,
        category: form.device_type || null,

        device_model: form.device_model || null,
        model: form.device_model || null,

        assigned_engineer: selectedEngineer?.full_name || form.assigned_engineer_name || null,
        assigned_engineer_name: selectedEngineer?.full_name || form.assigned_engineer_name || null,
        assigned_engineer_email: selectedEngineer?.email || form.assigned_engineer_email || null,

        device_status: form.device_status || 'Active',
        status: form.device_status || 'Active',
        sla_status: form.sla_status || 'Normal',

        updated_at: new Date().toISOString(),
      };

      if (editingDevice?.id) {
        const { error } = await supabase
          .from('devices')
          .update(payload)
          .eq('id', editingDevice.id);

        if (error) throw error;
        return;
      }

      const { error } = await supabase
        .from('devices')
        .insert({
          ...payload,
          created_at: new Date().toISOString(),
        });

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['branch-devices'] });
      qc.invalidateQueries({ queryKey: ['devices'] });
      qc.invalidateQueries({ queryKey: ['devices-full'] });
      setDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      alert('Device save failed: ' + error.message);
    },
  });

  const deleteDevice = useMutation({
    mutationFn: async (deviceId) => {
      const { error } = await supabase
        .from('devices')
        .delete()
        .eq('id', deviceId);

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['branch-devices'] });
      qc.invalidateQueries({ queryKey: ['devices'] });
      qc.invalidateQueries({ queryKey: ['devices-full'] });
    },
    onError: (error) => {
      alert('Delete failed: ' + error.message);
    },
  });

  if (branchLoading) {
    return (
      <div className="p-6 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
        Loading branch...
      </div>
    );
  }

  if (!branch) {
    return (
      <div className="p-6">
        <Button variant="ghost" onClick={() => navigate('/branches')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Branches
        </Button>

        <p className="mt-6 text-muted-foreground">Branch not found.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/branches')}
            className="mb-2"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Branches
          </Button>

          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Cpu className="w-6 h-6" />
            {title}
          </h1>

          <p className="text-sm text-muted-foreground">
            Manage devices assigned to this branch.
          </p>
        </div>

        <Button onClick={openAdd}>
          <Plus className="w-4 h-4 mr-2" />
          Add Device
        </Button>
      </div>

      {devicesLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading devices...
        </div>
      ) : devices.length === 0 ? (
        <div className="border rounded-xl p-10 text-center text-muted-foreground">
          No devices added for this branch yet.
        </div>
      ) : (
        <div className="overflow-x-auto border rounded-xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground text-xs">
                <th className="p-3">Terminal ID</th>
                <th className="p-3">Device</th>
                <th className="p-3">Type</th>
                <th className="p-3">Model</th>
                <th className="p-3">Engineer</th>
                <th className="p-3">Status</th>
                <th className="p-3">SLA</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>

            <tbody>
              {devices.map((device) => {
                const terminal =
                  device.terminal_id ||
                  device.atm_terminal_id ||
                  '—';

                const name =
                  device.device_name ||
                  device.name ||
                  'Device';

                const engineer =
                  device.assigned_engineer_name ||
                  device.assigned_engineer ||
                  device.assigned_engineer_email ||
                  'Unassigned';

                return (
                  <tr key={device.id} className="border-b last:border-0">
                    <td className="p-3 font-mono text-xs">{terminal}</td>
                    <td className="p-3 font-medium">{name}</td>
                    <td className="p-3">{device.device_type || device.category || '—'}</td>
                    <td className="p-3">{device.device_model || device.model || '—'}</td>
                    <td className="p-3">{engineer}</td>
                    <td className="p-3">
                      <Badge variant="outline">
                        {device.device_status || device.status || 'Active'}
                      </Badge>
                    </td>
                    <td className="p-3">
                      {device.sla_status || 'Normal'}
                    </td>
                    <td className="p-3">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openEdit(device)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>

                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => {
                            if (confirm('Delete this device?')) {
                              deleteDevice.mutate(device.id);
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editingDevice ? 'Edit Device' : 'Add Device'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Bank</Label>
              <Input value={branch.bank_name || ''} disabled />
            </div>

            <div className="space-y-1.5">
              <Label>Branch</Label>
              <Input value={branch.branch_name || ''} disabled />
            </div>

            <div className="space-y-1.5">
              <Label>Terminal ID *</Label>
              <Input
                value={form.terminal_id}
                onChange={(e) =>
                  setForm((f) => ({ ...f, terminal_id: e.target.value }))
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label>Device Name</Label>
              <Input
                value={form.device_name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, device_name: e.target.value }))
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label>Device Type</Label>
              <Select
                value={form.device_type}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, device_type: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="ATM">ATM</SelectItem>
                  <SelectItem value="POS">POS</SelectItem>
                  <SelectItem value="Card Printer">Card Printer</SelectItem>
                  <SelectItem value="Cash Counter">Cash Counter</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Device Model</Label>
              <Input
                value={form.device_model}
                onChange={(e) =>
                  setForm((f) => ({ ...f, device_model: e.target.value }))
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label>Assigned Engineer</Label>
              <Select
                value={form.assigned_engineer}
                onValueChange={(v) => {
                  const eng = engineers.find((e) => e.email === v);

                  setForm((f) => ({
                    ...f,
                    assigned_engineer: v,
                    assigned_engineer_email: eng?.email || '',
                    assigned_engineer_name: eng?.full_name || v,
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select engineer" />
                </SelectTrigger>

                <SelectContent>
                  {engineers.map((eng) => (
                    <SelectItem key={eng.id} value={eng.email}>
                      {eng.full_name || eng.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={form.device_status}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, device_status: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                  <SelectItem value="Faulty">Faulty</SelectItem>
                  <SelectItem value="Under Maintenance">
                    Under Maintenance
                  </SelectItem>
                  <SelectItem value="Decommissioned">
                    Decommissioned
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 col-span-2">
              <Label>SLA Status</Label>
              <Select
                value={form.sla_status}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, sla_status: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="Normal">Normal</SelectItem>
                  <SelectItem value="Warning">Warning</SelectItem>
                  <SelectItem value="Breached">Breached</SelectItem>
                  <SelectItem value="Critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2 flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setDialogOpen(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>

              <Button
                onClick={() => saveDevice.mutate()}
                disabled={saveDevice.isPending || !form.terminal_id}
              >
                {saveDevice.isPending && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                {editingDevice ? 'Save Changes' : 'Add Device'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}