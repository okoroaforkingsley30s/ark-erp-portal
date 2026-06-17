import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { QUERY_KEYS, fetchDevices, fetchBanks, fetchEngineers } from '@/lib/dataService';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Search, Cpu, Edit2, Loader2, Hash, Building2, User, Activity } from 'lucide-react';

const STATUS_COLORS = {
  Active: 'bg-green-100 text-green-700 border-green-200',
  Inactive: 'bg-gray-100 text-gray-600 border-gray-200',
  Faulty: 'bg-red-100 text-red-700 border-red-200',
  'Under Maintenance': 'bg-amber-100 text-amber-700 border-amber-200',
  Decommissioned: 'bg-slate-100 text-slate-500 border-slate-200',
};

const SLA_COLORS = {
  Normal: 'bg-green-500/15 text-green-300',
  Warning: 'bg-yellow-50 text-yellow-700',
  Breached: 'bg-red-500/15 text-red-300',
  Critical: 'bg-red-100 text-red-800 font-bold',
};

const normalizeDevice = (d) => ({
  ...d,
  device_name: d.device_name || d.machine_name || d.name || '',
  atm_terminal_id: d.atm_terminal_id || d.terminal_id || d.device_id || '',
  branch_name: d.branch_name || d.branch || '',
  device_type: d.device_type || d.machine_type || '',
  device_model: d.device_model || d.model || '',
  device_status: d.device_status || d.status || 'Active',
  sla_status: d.sla_status || 'Normal',
});

export default function Assets() {
  const { user } = useOutletContext();
  const role = user?.role || 'client';
  const isEngineer = role === 'engineer';
  const canEdit = ['admin', 'manager', 'helpdesk', 'repair_head'].includes(role);
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [filterBank, setFilterBank] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterEngineer, setFilterEngineer] = useState('all');
  const [editDevice, setEditDevice] = useState(null);

  const { data: rawDevices = [], isLoading } = useQuery({
    queryKey: QUERY_KEYS.devices,
    queryFn: fetchDevices,
  });

  const { data: banks = [] } = useQuery({
    queryKey: QUERY_KEYS.banks,
    queryFn: fetchBanks,
    enabled: !isEngineer,
  });

  const { data: engineers = [] } = useQuery({
    queryKey: QUERY_KEYS.engineers,
    queryFn: fetchEngineers,
    enabled: true,
  });

  const allDevices = useMemo(() => rawDevices.map(normalizeDevice), [rawDevices]);

  const myEngineerName = useMemo(() => {
    if (!isEngineer) return null;
    const eng = engineers.find(e => e.email === user?.email) || engineers.find(e => e.engineer_name === user?.full_name);
    return eng?.engineer_name || user?.full_name;
  }, [isEngineer, engineers, user]);

  const devices = useMemo(() => {
    if (isEngineer) {
      return allDevices.filter(d =>
        d.assigned_engineer === myEngineerName ||
        d.assigned_engineer === user?.full_name ||
        d.assigned_engineer === user?.email
      );
    }
    return allDevices;
  }, [allDevices, isEngineer, myEngineerName, user]);

  const engineerNames = useMemo(() => {
    return engineers
      .map(e => e.engineer_name || e.full_name || e.email)
      .filter(Boolean);
  }, [engineers]);

  const filtered = useMemo(() => devices.filter(d => {
    const q = search.toLowerCase();
    const matchSearch = !search ||
      d.device_name?.toLowerCase().includes(q) ||
      d.atm_terminal_id?.toString().includes(q) ||
      d.branch_name?.toLowerCase().includes(q) ||
      d.device_type?.toLowerCase().includes(q) ||
      d.device_model?.toLowerCase().includes(q) ||
      d.assigned_engineer?.toLowerCase().includes(q);

    const matchBank = filterBank === 'all' || d.bank_name === filterBank;
    const matchStatus = filterStatus === 'all' || d.device_status === filterStatus;
    const matchEng = filterEngineer === 'all' || d.assigned_engineer === filterEngineer;

    return matchSearch && matchBank && matchStatus && matchEng;
  }), [devices, search, filterBank, filterStatus, filterEngineer]);

  const counts = useMemo(() => ({
    active: devices.filter(d => d.device_status === 'Active').length,
    faulty: devices.filter(d => d.device_status === 'Faulty' || d.device_status === 'Under Maintenance').length,
    inactive: devices.filter(d => d.device_status === 'Inactive').length,
    sla: devices.filter(d => ['Warning', 'Breached', 'Critical'].includes(d.sla_status)).length,
  }), [devices]);

  const updateDevice = useMutation({
    mutationFn: async ({ id, data }) => {
      const { error } = await supabase
        .from('devices')
        .update({
          status: data.device_status,
          device_status: data.device_status,
          assigned_engineer: data.assigned_engineer,
          notes: data.notes,
          sla_status: data.sla_status,
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.devices });
      setEditDevice(null);
    },
    onError: (error) => {
      alert('Error updating device: ' + error.message);
    },
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2 text-white">
          <Cpu className="w-6 h-6 text-primary" />
          {isEngineer ? 'My Assigned Devices' : 'Assets'}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {isEngineer ? `${devices.length} device(s) assigned to you` : `All operational devices — ${devices.length} total`}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="px-3 py-1.5 rounded-lg bg-green-500/15 text-green-300 text-xs font-medium border border-green-200">{counts.active} Active</span>
        <span className="px-3 py-1.5 rounded-lg bg-red-500/15 text-red-300 text-xs font-medium border border-red-200">{counts.faulty} Faulty / Maintenance</span>
        <span className="px-3 py-1.5 rounded-lg bg-gray-50 text-gray-600 text-xs font-medium border border-gray-200">{counts.inactive} Inactive</span>
        <span className="px-3 py-1.5 rounded-lg bg-orange-50 text-orange-700 text-xs font-medium border border-orange-200">{counts.sla} SLA Alerts</span>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search terminal ID, branch, type, model, engineer..."
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {!isEngineer && (
          <Select value={filterBank} onValueChange={setFilterBank}>
            <SelectTrigger className="w-32"><SelectValue placeholder="Bank" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Banks</SelectItem>
              {banks.map(b => <SelectItem key={b.id || b.bank_name} value={b.bank_name}>{b.bank_name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {['Active', 'Inactive', 'Faulty', 'Under Maintenance', 'Decommissioned'].map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {!isEngineer && (
          <Select value={filterEngineer} onValueChange={setFilterEngineer}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Engineer" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Engineers</SelectItem>
              {engineerNames.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(device => (
            <Card key={device.id} className="p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Cpu className="w-5 h-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm leading-tight">{device.device_name || device.branch_name}</p>
                    <p className="text-xs text-muted-foreground">{device.bank_name}</p>
                  </div>
                </div>
                <Badge variant="outline" className={`${STATUS_COLORS[device.device_status] || 'bg-muted'} text-[10px] ml-1 flex-shrink-0`}>
                  {device.device_status || 'Active'}
                </Badge>
              </div>

              <div className="space-y-1.5 text-xs text-muted-foreground mb-3">
                {device.atm_terminal_id && (
                  <div className="flex items-center gap-1.5">
                    <Hash className="w-3 h-3 flex-shrink-0" />
                    <span className="font-mono">{device.atm_terminal_id}</span>
                  </div>
                )}

                {device.branch_name && (
                  <div className="flex items-center gap-1.5">
                    <Building2 className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{device.branch_name}</span>
                  </div>
                )}

                {(device.device_type || device.device_model) && (
                  <div className="flex items-center gap-1.5">
                    <Cpu className="w-3 h-3 flex-shrink-0" />
                    <span>{[device.device_type, device.device_model].filter(Boolean).join(' · ')}</span>
                  </div>
                )}

                {device.assigned_engineer && (
                  <div className="flex items-center gap-1.5">
                    <User className="w-3 h-3 flex-shrink-0" />
                    <span>{device.assigned_engineer}</span>
                  </div>
                )}

                {device.sla_status && device.sla_status !== 'Normal' && (
                  <div className="flex items-center gap-1.5">
                    <Activity className="w-3 h-3 flex-shrink-0 text-orange-500" />
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${SLA_COLORS[device.sla_status]}`}>
                      SLA: {device.sla_status}
                    </span>
                  </div>
                )}
              </div>

              {canEdit && (
                <Button variant="outline" size="sm" className="w-full" onClick={() => setEditDevice({ ...device })}>
                  <Edit2 className="w-3 h-3 mr-1" /> Edit
                </Button>
              )}
            </Card>
          ))}

          {filtered.length === 0 && !isLoading && (
            <div className="col-span-full text-center py-16 text-muted-foreground">
              <Cpu className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No devices found</p>
            </div>
          )}
        </div>
      )}

      {editDevice && (
        <Dialog open={!!editDevice} onOpenChange={() => setEditDevice(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Device — {editDevice.device_name}</DialogTitle>
            </DialogHeader>

            <div className="space-y-3">
              <div>
                <Label>Terminal ID</Label>
                <Input value={editDevice.atm_terminal_id || ''} disabled className="font-mono bg-muted" />
              </div>

              <div>
                <Label>Bank</Label>
                <Input value={editDevice.bank_name || ''} disabled className="bg-muted" />
              </div>

              <div>
                <Label>Device Status</Label>
                <Select value={editDevice.device_status || 'Active'} onValueChange={v => setEditDevice(d => ({ ...d, device_status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['Active', 'Inactive', 'Faulty', 'Under Maintenance', 'Decommissioned'].map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>SLA Status</Label>
                <Select value={editDevice.sla_status || 'Normal'} onValueChange={v => setEditDevice(d => ({ ...d, sla_status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['Normal', 'Warning', 'Breached', 'Critical'].map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Assigned Engineer</Label>
                <Select value={editDevice.assigned_engineer || ''} onValueChange={v => setEditDevice(d => ({ ...d, assigned_engineer: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select engineer" /></SelectTrigger>
                  <SelectContent>
                    {engineerNames.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Notes</Label>
                <Textarea value={editDevice.notes || ''} onChange={e => setEditDevice(d => ({ ...d, notes: e.target.value }))} className="h-16" />
              </div>

              <Button
                className="w-full"
                onClick={() => updateDevice.mutate({
                  id: editDevice.id,
                  data: {
                    device_status: editDevice.device_status,
                    sla_status: editDevice.sla_status,
                    assigned_engineer: editDevice.assigned_engineer,
                    notes: editDevice.notes,
                  },
                })}
                disabled={updateDevice.isPending}
              >
                {updateDevice.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}