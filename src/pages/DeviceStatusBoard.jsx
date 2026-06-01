import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

import {
  Search,
  Edit2,
  Loader2,
  Trash2,
  Plus,
} from 'lucide-react';

const STATUS_OPTIONS = [
  'Active',
  'Inactive',
  'Faulty',
  'Under Maintenance',
  'Decommissioned',
];

const SLA_OPTIONS = [
  'Normal',
  'Warning',
  'Breached',
  'Critical',
];

const DEVICE_TYPES = [
  'ATM',
  'POS',
  'Card Printer',
  'Cash Counter',
  'Other',
];

const EMPTY_DEVICE = {
  terminal_id: '',
  bank_name: '',
  branch_name: '',
  device_name: '',
  device_type: 'ATM',
  device_model: '',
  assigned_engineer_email: '',
  assigned_engineer_name: '',
  device_status: 'Active',
  sla_status: 'Normal',
};

const STATUS_COLORS = {
  Active: 'bg-green-100 text-green-800 dark:bg-green-900/30',
  Inactive: 'bg-gray-100 text-gray-600',
  Faulty: 'bg-red-100 text-red-800 dark:bg-red-900/30',
  'Under Maintenance': 'bg-yellow-100 text-yellow-800',
  Decommissioned: 'bg-gray-200 text-gray-500',
};

const SLA_COLORS = {
  Normal: 'text-green-600',
  Warning: 'text-yellow-600',
  Breached: 'text-red-600',
  Critical: 'text-red-700 font-bold',
};

export default function DevicesPage() {
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [filterBank, setFilterBank] = useState('all');
  const [filterEngineer, setFilterEngineer] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');

  const [editDevice, setEditDevice] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newDevice, setNewDevice] = useState(EMPTY_DEVICE);

  const { data: devices = [], isLoading } = useQuery({
    queryKey: ['devices-full'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('devices')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Devices fetch error:', error);
        return [];
      }

      return data || [];
    },
  });

  const { data: banks = [] } = useQuery({
    queryKey: ['banks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('banks')
        .select('*')
        .order('bank_name', { ascending: true });

      if (error) {
        console.error('Banks fetch error:', error);
        return [];
      }

      return data || [];
    },
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['branches-for-devices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .order('branch_name', { ascending: true });

      if (error) {
        console.error('Branches fetch error:', error);
        return [];
      }

      return data || [];
    },
  });

  const { data: engineers = [] } = useQuery({
    queryKey: ['engineers-users-for-devices'],
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

  const bankNames = useMemo(() => {
    const fromBanks = banks.map((b) => b.bank_name).filter(Boolean);
    const fromDevices = devices.map((d) => d.bank_name || d.client_name).filter(Boolean);

    return [...new Set([...fromBanks, ...fromDevices])];
  }, [banks, devices]);

  const branchesForNewDevice = useMemo(() => {
    return branches.filter((b) => {
      if (!newDevice.bank_name) return true;
      return b.bank_name === newDevice.bank_name;
    });
  }, [branches, newDevice.bank_name]);

  const branchesForEditDevice = useMemo(() => {
    return branches.filter((b) => {
      if (!editDevice?.bank_name) return true;
      return b.bank_name === editDevice.bank_name;
    });
  }, [branches, editDevice?.bank_name]);

  const types = useMemo(() => {
    const fromDevices = devices.map((d) => d.device_type || d.category).filter(Boolean);
    return [...new Set([...DEVICE_TYPES, ...fromDevices])];
  }, [devices]);

  const engineerNames = useMemo(() => {
    const fromUsers = engineers.map((e) => e.full_name || e.email).filter(Boolean);
    const fromDevices = devices
      .map((d) => d.assigned_engineer_name || d.assigned_engineer)
      .filter(Boolean);

    return [...new Set([...fromUsers, ...fromDevices])];
  }, [engineers, devices]);

  const filtered = useMemo(() => {
    return devices.filter((d) => {
      const q = search.toLowerCase();

      const deviceName = d.device_name || d.name || '';
      const terminalId = d.atm_terminal_id || d.terminal_id || '';
      const branchName = d.branch_name || d.site_name || d.branch_location || '';
      const deviceType = d.device_type || d.category || '';
      const deviceModel = d.device_model || d.model || '';
      const bankName = d.bank_name || d.client_name || '';
      const engineer = d.assigned_engineer || d.assigned_engineer_name || '';

      const matchSearch =
        !search ||
        deviceName.toLowerCase().includes(q) ||
        terminalId.toString().toLowerCase().includes(q) ||
        branchName.toLowerCase().includes(q) ||
        deviceType.toLowerCase().includes(q) ||
        deviceModel.toLowerCase().includes(q) ||
        bankName.toLowerCase().includes(q) ||
        engineer.toLowerCase().includes(q);

      const matchBank = filterBank === 'all' || bankName === filterBank;
      const matchEng = filterEngineer === 'all' || engineer === filterEngineer;
      const matchStatus = filterStatus === 'all' || (d.device_status || d.status) === filterStatus;
      const matchType = filterType === 'all' || deviceType === filterType;

      return matchSearch && matchBank && matchEng && matchStatus && matchType;
    });
  }, [devices, search, filterBank, filterEngineer, filterStatus, filterType]);

  const buildDevicePayload = (deviceForm) => {
    const selectedEngineer = engineers.find(
      (e) => e.email === deviceForm.assigned_engineer_email
    );

    const engineerName =
      selectedEngineer?.full_name ||
      deviceForm.assigned_engineer_name ||
      '';

    return {
      terminal_id: deviceForm.terminal_id || null,
      atm_terminal_id: deviceForm.terminal_id || null,

      bank_name: deviceForm.bank_name || null,
      branch_name: deviceForm.branch_name || null,
      branch: deviceForm.branch_name || null,

      device_name: deviceForm.device_name || null,
      name: deviceForm.device_name || null,

      device_type: deviceForm.device_type || null,
      category: deviceForm.device_type || null,

      device_model: deviceForm.device_model || null,
      model: deviceForm.device_model || null,

      assigned_engineer: engineerName || null,
      assigned_engineer_name: engineerName || null,
      assigned_engineer_email:
        selectedEngineer?.email ||
        deviceForm.assigned_engineer_email ||
        null,

      device_status: deviceForm.device_status || 'Active',
      status: deviceForm.device_status || 'Active',

      sla_status: deviceForm.sla_status || 'Normal',
      updated_at: new Date().toISOString(),
    };
  };

  const addDevice = useMutation({
    mutationFn: async () => {
      const payload = buildDevicePayload(newDevice);

      const { error } = await supabase
        .from('devices')
        .insert({
          ...payload,
          created_at: new Date().toISOString(),
        });

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['devices-full'] });
      qc.invalidateQueries({ queryKey: ['devices'] });
      qc.invalidateQueries({ queryKey: ['branch-devices'] });

      setAddOpen(false);
      setNewDevice(EMPTY_DEVICE);
    },
    onError: (error) => {
      alert('Add Device failed: ' + error.message);
    },
  });

  const updateDevice = useMutation({
    mutationFn: async ({ id, data }) => {
      const { error } = await supabase
        .from('devices')
        .update(data)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['devices-full'] });
      qc.invalidateQueries({ queryKey: ['devices'] });
      qc.invalidateQueries({ queryKey: ['branch-devices'] });

      setEditDevice(null);
    },
    onError: (error) => {
      alert('Error updating device: ' + error.message);
    },
  });

  const deleteDevice = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from('devices')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['devices-full'] });
      qc.invalidateQueries({ queryKey: ['devices'] });
      qc.invalidateQueries({ queryKey: ['branch-devices'] });
    },
    onError: (error) => {
      alert('Delete failed: ' + error.message);
    },
  });

  const saveEditDevice = () => {
    if (!editDevice?.id) return;

    const payload = buildDevicePayload({
      terminal_id: editDevice.terminal_id || editDevice.atm_terminal_id || '',
      bank_name: editDevice.bank_name || editDevice.client_name || '',
      branch_name: editDevice.branch_name || editDevice.site_name || editDevice.branch_location || '',
      device_name: editDevice.device_name || editDevice.name || '',
      device_type: editDevice.device_type || editDevice.category || 'ATM',
      device_model: editDevice.device_model || editDevice.model || '',
      assigned_engineer_email: editDevice.assigned_engineer_email || '',
      assigned_engineer_name: editDevice.assigned_engineer_name || editDevice.assigned_engineer || '',
      device_status: editDevice.device_status || editDevice.status || 'Active',
      sla_status: editDevice.sla_status || 'Normal',
    });

    updateDevice.mutate({
      id: editDevice.id,
      data: payload,
    });
  };

  const renderDeviceForm = ({ mode }) => {
    const isEdit = mode === 'edit';
    const device = isEdit ? editDevice : newDevice;
    const setDevice = isEdit ? setEditDevice : setNewDevice;
    const branchOptions = isEdit ? branchesForEditDevice : branchesForNewDevice;

    if (!device) return null;

    return (
      <div className="space-y-4">
        <div className="grid md:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Bank</Label>
            <Select
              value={device.bank_name || device.client_name || ''}
              onValueChange={(v) =>
                setDevice((d) => ({
                  ...d,
                  bank_name: v,
                  client_name: v,
                  branch_name: '',
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select bank" />
              </SelectTrigger>

              <SelectContent>
                {bankNames.map((bank) => (
                  <SelectItem key={bank} value={bank}>
                    {bank}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Branch / Location</Label>
            <Select
              value={device.branch_name || device.site_name || device.branch_location || ''}
              onValueChange={(v) =>
                setDevice((d) => ({
                  ...d,
                  branch_name: v,
                  site_name: v,
                  branch_location: v,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select branch" />
              </SelectTrigger>

              <SelectContent>
                {branchOptions.map((branch) => (
                  <SelectItem key={branch.id} value={branch.branch_name}>
                    {branch.branch_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Terminal ID *</Label>
            <Input
              value={device.terminal_id || device.atm_terminal_id || ''}
              onChange={(e) =>
                setDevice((d) => ({
                  ...d,
                  terminal_id: e.target.value,
                  atm_terminal_id: e.target.value,
                }))
              }
            />
          </div>

          <div className="space-y-1.5">
            <Label>Device Name</Label>
            <Input
              value={device.device_name || device.name || ''}
              onChange={(e) =>
                setDevice((d) => ({
                  ...d,
                  device_name: e.target.value,
                  name: e.target.value,
                }))
              }
            />
          </div>

          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select
              value={device.device_type || device.category || 'ATM'}
              onValueChange={(v) =>
                setDevice((d) => ({
                  ...d,
                  device_type: v,
                  category: v,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>

              <SelectContent>
                {DEVICE_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Model</Label>
            <Input
              value={device.device_model || device.model || ''}
              onChange={(e) =>
                setDevice((d) => ({
                  ...d,
                  device_model: e.target.value,
                  model: e.target.value,
                }))
              }
            />
          </div>

          <div className="space-y-1.5">
            <Label>Assigned Engineer</Label>
            <Select
              value={device.assigned_engineer_email || ''}
              onValueChange={(v) => {
                const eng = engineers.find((e) => e.email === v);

                setDevice((d) => ({
                  ...d,
                  assigned_engineer_email: v,
                  assigned_engineer_name: eng?.full_name || v,
                  assigned_engineer: eng?.full_name || v,
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
              value={device.device_status || device.status || 'Active'}
              onValueChange={(v) =>
                setDevice((d) => ({
                  ...d,
                  device_status: v,
                  status: v,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>

              <SelectContent>
                {STATUS_OPTIONS.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label>SLA Status</Label>
            <Select
              value={device.sla_status || 'Normal'}
              onValueChange={(v) =>
                setDevice((d) => ({
                  ...d,
                  sla_status: v,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>

              <SelectContent>
                {SLA_OPTIONS.map((sla) => (
                  <SelectItem key={sla} value={sla}>
                    {sla}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button
          className="w-full"
          onClick={() => {
            const terminal = device.terminal_id || device.atm_terminal_id;

            if (!terminal) {
              alert('Terminal ID is required.');
              return;
            }

            if (isEdit) {
              saveEditDevice();
            } else {
              addDevice.mutate();
            }
          }}
          disabled={isEdit ? updateDevice.isPending : addDevice.isPending}
        >
          {(isEdit ? updateDevice.isPending : addDevice.isPending)
            ? 'Saving...'
            : isEdit
              ? 'Save Changes'
              : 'Add Device'}
        </Button>
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Devices</h1>
          <p className="text-muted-foreground text-sm">
            {filtered.length} of {devices.length} devices
          </p>
        </div>

        <Button onClick={() => setAddOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Device
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />

          <Input
            placeholder="Search terminal ID, branch, type, model..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Select value={filterBank} onValueChange={setFilterBank}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Bank" />
          </SelectTrigger>

          <SelectContent>
            <SelectItem value="all">All Banks</SelectItem>
            {bankNames.map((bank) => (
              <SelectItem key={bank} value={bank}>
                {bank}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>

          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {STATUS_OPTIONS.map((status) => (
              <SelectItem key={status} value={status}>
                {status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterEngineer} onValueChange={setFilterEngineer}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Engineer" />
          </SelectTrigger>

          <SelectContent>
            <SelectItem value="all">All Engineers</SelectItem>
            {engineerNames.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {types.length > 0 && (
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Type" />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {types.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12 text-muted-foreground">
          <Loader2 className="w-6 h-6 mr-2 animate-spin" />
          Loading devices...
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground text-xs">
                <th className="pb-2 pr-4 font-medium">Terminal ID</th>
                <th className="pb-2 pr-4 font-medium">Branch/Location</th>
                <th className="pb-2 pr-4 font-medium">Bank</th>
                <th className="pb-2 pr-4 font-medium">Type</th>
                <th className="pb-2 pr-4 font-medium">Model</th>
                <th className="pb-2 pr-4 font-medium">Engineer</th>
                <th className="pb-2 pr-4 font-medium">Status</th>
                <th className="pb-2 font-medium">SLA</th>
                <th className="pb-2 text-right">Actions</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((device) => {
                const terminalId =
                  device.atm_terminal_id ||
                  device.terminal_id ||
                  '—';

                const branch =
                  device.branch_name ||
                  device.site_name ||
                  device.branch_location ||
                  device.device_name ||
                  device.name ||
                  '—';

                const bank = device.bank_name || device.client_name || '—';
                const type = device.device_type || device.category || '—';
                const model = device.device_model || device.model || '—';
                const engineer = device.assigned_engineer || device.assigned_engineer_name;
                const status = device.device_status || device.status || 'Unknown';
                const sla = device.sla_status || 'Normal';

                return (
                  <tr
                    key={device.id}
                    className="border-b hover:bg-muted/30 transition-colors"
                  >
                    <td className="py-2 pr-4 font-mono text-xs text-primary">
                      {terminalId}
                    </td>

                    <td className="py-2 pr-4 font-medium max-w-[160px] truncate">
                      {branch}
                    </td>

                    <td className="py-2 pr-4">
                      <Badge variant="outline" className="text-[10px]">
                        {bank}
                      </Badge>
                    </td>

                    <td className="py-2 pr-4 text-xs text-muted-foreground">
                      {type}
                    </td>

                    <td className="py-2 pr-4 text-xs text-muted-foreground">
                      {model}
                    </td>

                    <td className="py-2 pr-4 text-xs">
                      {engineer || (
                        <span className="text-muted-foreground italic">
                          Unassigned
                        </span>
                      )}
                    </td>

                    <td className="py-2 pr-4">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          STATUS_COLORS[status] ||
                          'bg-muted text-muted-foreground'
                        }`}
                      >
                        {status}
                      </span>
                    </td>

                    <td className="py-2 pr-4">
                      <span className={`text-xs ${SLA_COLORS[sla] || ''}`}>
                        {sla}
                      </span>
                    </td>

                    <td className="py-2">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setEditDevice(device)}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-500"
                          onClick={() => {
                            if (
                              confirm(
                                `Delete ${
                                  device.device_name ||
                                  device.name ||
                                  'this device'
                                }?`
                              )
                            ) {
                              deleteDevice.mutate(device.id);
                            }
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="py-10 text-center text-muted-foreground"
                  >
                    No devices found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Device</DialogTitle>
          </DialogHeader>

          {renderDeviceForm({ mode: 'add' })}
        </DialogContent>
      </Dialog>

      {editDevice && (
        <Dialog open={!!editDevice} onOpenChange={() => setEditDevice(null)}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                Edit Device — {editDevice.device_name || editDevice.name || 'Device'}
              </DialogTitle>
            </DialogHeader>

            {renderDeviceForm({ mode: 'edit' })}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}