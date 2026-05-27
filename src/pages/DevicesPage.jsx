import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Search, Edit2, Loader2 } from 'lucide-react';

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

  const { data: devices = [], isLoading } = useQuery({
    queryKey: ['devices-full'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('devices')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error(error);
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
        console.error(error);
        return [];
      }

      return data || [];
    },
  });

  const { data: engineers = [] } = useQuery({
    queryKey: ['engineers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('engineers')
        .select('*')
        .order('engineer_name', { ascending: true });

      if (error) {
        console.error(error);
        return [];
      }

      return data || [];
    },
  });

  const types = useMemo(() => {
    return [...new Set(devices.map(d => d.device_type || d.category).filter(Boolean))];
  }, [devices]);

  const engineerNames = useMemo(() => {
    return [...new Set(engineers.map(e => e.engineer_name).filter(Boolean))];
  }, [engineers]);

  const filtered = useMemo(() => {
    return devices.filter(d => {
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
        deviceModel.toLowerCase().includes(q);

      const matchBank = filterBank === 'all' || bankName === filterBank;
      const matchEng = filterEngineer === 'all' || engineer === filterEngineer;
      const matchStatus = filterStatus === 'all' || (d.device_status || d.status) === filterStatus;
      const matchType = filterType === 'all' || deviceType === filterType;

      return matchSearch && matchBank && matchEng && matchStatus && matchType;
    });
  }, [devices, search, filterBank, filterEngineer, filterStatus, filterType]);

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
      setEditDevice(null);
    },
    onError: (error) => {
      alert('Error updating device: ' + error.message);
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Devices</h1>
          <p className="text-muted-foreground text-sm">
            {filtered.length} of {devices.length} devices
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search terminal ID, branch, type, model..."
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <Select value={filterBank} onValueChange={setFilterBank}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Bank" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Banks</SelectItem>
            {banks.map(b => (
              <SelectItem key={b.id} value={b.bank_name}>
                {b.bank_name}
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
            {['Active', 'Inactive', 'Faulty', 'Under Maintenance', 'Decommissioned', 'operational', 'faulty', 'under_maintenance', 'offline'].map(s => (
              <SelectItem key={s} value={s}>
                {s}
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
            {engineerNames.map(n => (
              <SelectItem key={n} value={n}>
                {n}
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
              {types.map(t => (
                <SelectItem key={t} value={t}>
                  {t}
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
                <th className="pb-2" />
              </tr>
            </thead>

            <tbody>
              {filtered.map(device => {
                const terminalId = device.atm_terminal_id || device.terminal_id || '—';
                const branch = device.branch_name || device.site_name || device.branch_location || device.device_name || device.name || '—';
                const bank = device.bank_name || device.client_name || '—';
                const type = device.device_type || device.category || '—';
                const model = device.device_model || device.model || '—';
                const engineer = device.assigned_engineer || device.assigned_engineer_name;
                const status = device.device_status || device.status || 'Unknown';
                const sla = device.sla_status || 'Normal';

                return (
                  <tr key={device.id} className="border-b hover:bg-muted/30 transition-colors">
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
                      {engineer || <span className="text-muted-foreground italic">Unassigned</span>}
                    </td>
                    <td className="py-2 pr-4">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[status] || 'bg-muted text-muted-foreground'}`}>
                        {status}
                      </span>
                    </td>
                    <td className="py-2 pr-4">
                      <span className={`text-xs ${SLA_COLORS[sla] || ''}`}>
                        {sla}
                      </span>
                    </td>
                    <td className="py-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setEditDevice(device)}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editDevice && (
        <Dialog open={!!editDevice} onOpenChange={() => setEditDevice(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Edit Device — {editDevice.device_name || editDevice.name || 'Device'}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label>Status</Label>
                <Select
                  value={editDevice.device_status || editDevice.status || 'Active'}
                  onValueChange={v => setEditDevice(d => ({ ...d, device_status: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['Active', 'Inactive', 'Faulty', 'Under Maintenance', 'Decommissioned'].map(s => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>SLA Status</Label>
                <Select
                  value={editDevice.sla_status || 'Normal'}
                  onValueChange={v => setEditDevice(d => ({ ...d, sla_status: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['Normal', 'Warning', 'Breached', 'Critical'].map(s => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Assigned Engineer</Label>
                <Select
                  value={editDevice.assigned_engineer || editDevice.assigned_engineer_name || ''}
                  onValueChange={v => setEditDevice(d => ({ ...d, assigned_engineer: v, assigned_engineer_name: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select engineer" />
                  </SelectTrigger>
                  <SelectContent>
                    {engineerNames.map(n => (
                      <SelectItem key={n} value={n}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                className="w-full"
                onClick={() =>
                  updateDevice.mutate({
                    id: editDevice.id,
                    data: {
                      device_status: editDevice.device_status || editDevice.status || 'Active',
                      sla_status: editDevice.sla_status || 'Normal',
                      assigned_engineer: editDevice.assigned_engineer || editDevice.assigned_engineer_name || null,
                      assigned_engineer_name: editDevice.assigned_engineer_name || editDevice.assigned_engineer || null,
                    },
                  })
                }
                disabled={updateDevice.isPending}
              >
                {updateDevice.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}