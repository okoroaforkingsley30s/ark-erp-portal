import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

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

import {
  Plus,
  Search,
  Cpu,
  Loader2,
  Pencil,
  MapPin,
  Calendar,
  Wifi,
  Banknote,
  CreditCard,
  Monitor,
  Radio,
  Fingerprint,
  ChevronRight,
  ChevronDown,
  Building2,
  Wrench,
  ArrowLeft
} from 'lucide-react';

import { format } from 'date-fns';

const CATEGORY_CONFIG = {
  atm: { label: 'ATM', icon: Banknote },
  card_printer: { label: 'Card Printer', icon: CreditCard },
  cash_counter: { label: 'Cash Counter', icon: Banknote },
  pos_terminal: { label: 'POS', icon: Monitor },
  kiosk: { label: 'Kiosk', icon: Monitor },
  deposit_machine: { label: 'Deposit Machine', icon: Banknote },
  cash_recycler: { label: 'Cash Recycler', icon: Banknote },
  biometric_device: { label: 'Biometric', icon: Fingerprint },
  self_service_terminal: { label: 'Self Service', icon: Monitor },
  ups_power: { label: 'UPS', icon: Cpu },
  networking_device: { label: 'Network', icon: Wifi },
  other: { label: 'Other', icon: Radio },
};

const EMPTY = {
  name: '',
  serial_number: '',
  terminal_id: '',
  category: 'atm',
  model: '',
  brand: '',
  client_name: '',
  client_email: '',
  site_name: '',
  branch_location: '',
  status: 'operational',
  health_score: 100,
  assigned_engineer_email: '',
  assigned_engineer_name: '',
  notes: '',
};

export default function DeviceManagement() {

  const { user } = useOutletContext();

  const role = user?.role || 'user';

  const qc = useQueryClient();

  const [selectedBank, setSelectedBank] = useState(null);

  const [open, setOpen] = useState(false);

  const [editing, setEditing] = useState(null);

  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState('');

  const [form, setForm] = useState(EMPTY);

  const f = (k, v) => {
    setForm(prev => ({
      ...prev,
      [k]: v
    }));
  };

  const {
    data: devices = [],
    isLoading
  } = useQuery({
    queryKey: ['devices'],

    queryFn: async () => {

      let query = supabase
        .from('devices')
        .select('*')
        .order('created_at', { ascending: false });

      if (role === 'client') {
        query = query.eq('client_email', user.email);
      }

      const { data, error } = await query;

      if (error) {
        console.error(error);
        return [];
      }

      return data || [];
    },

    enabled: !!user,
  });

  const {
    data: engineers = []
  } = useQuery({
    queryKey: ['engineers'],

    queryFn: async () => {

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'engineer');

      if (error) {
        console.error(error);
        return [];
      }

      return data || [];
    },
  });

  const banks = useMemo(() => {

    const map = {};

    devices.forEach(d => {

      const key = d.client_name || 'Unknown Bank';

      if (!map[key]) {
        map[key] = [];
      }

      map[key].push(d);
    });

    return Object.entries(map).map(([name, devs]) => ({
      name,
      devices: devs,
      branches: new Set(
        devs.map(d => d.site_name || 'Unknown')
      ).size,
    }));

  }, [devices]);

  const bankDevices = useMemo(() => {

    if (!selectedBank) return [];

    return devices.filter(
      d => d.client_name === selectedBank
    );

  }, [devices, selectedBank]);

  const handleSave = async () => {

    setSaving(true);

    try {

      const payload = {
        ...form,
        health_score:
          parseInt(form.health_score) || 100
      };

      if (editing) {

        const { error } = await supabase
          .from('devices')
          .update(payload)
          .eq('id', editing.id);

        if (error) throw error;

      } else {

        const { error } = await supabase
          .from('devices')
          .insert(payload);

        if (error) throw error;
      }

      qc.invalidateQueries({
        queryKey: ['devices']
      });

      setOpen(false);

      setEditing(null);

      setForm(EMPTY);

    } catch (err) {

      console.error(err);

      alert(err.message);

    } finally {

      setSaving(false);
    }
  };

  const handleStatus = async (device, status) => {

    try {

      const { error } = await supabase
        .from('devices')
        .update({ status })
        .eq('id', device.id);

      if (error) throw error;

      qc.invalidateQueries({
        queryKey: ['devices']
      });

    } catch (err) {

      console.error(err);

      alert(err.message);
    }
  };

  const openEdit = (d) => {

    setEditing(d);

    setForm({
      ...EMPTY,
      ...d
    });

    setOpen(true);
  };

  const filteredBanks = banks.filter(b =>
    b.name.toLowerCase().includes(
      search.toLowerCase()
    )
  );

  return (
    <div className="space-y-6">

      {!selectedBank ? (

        <>
          <div className="flex items-center justify-between">

            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Building2 className="w-6 h-6 text-primary" />
                Device Management
              </h1>

              <p className="text-sm text-muted-foreground">
                Bank device hierarchy
              </p>
            </div>

            <Button onClick={() => setOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Device
            </Button>

          </div>

          <div className="relative">

            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />

            <Input
              placeholder="Search bank..."
              className="pl-9"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />

          </div>

          {isLoading ? (

            <div className="flex justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>

          ) : (

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">

              {filteredBanks.map(bank => (

                <Card
                  key={bank.name}
                  className="p-5 cursor-pointer hover:shadow-lg"
                  onClick={() => setSelectedBank(bank.name)}
                >

                  <div className="flex items-center justify-between mb-4">

                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Building2 className="w-6 h-6 text-primary" />
                    </div>

                    <ChevronRight className="w-5 h-5 text-muted-foreground" />

                  </div>

                  <p className="font-bold">
                    {bank.name}
                  </p>

                  <p className="text-sm text-muted-foreground mt-1">
                    {bank.devices.length} devices
                  </p>

                  <p className="text-xs text-muted-foreground">
                    {bank.branches} branches
                  </p>

                </Card>
              ))}

            </div>

          )}
        </>

      ) : (

        <>
          <div className="flex items-center justify-between">

            <div className="flex items-center gap-3">

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedBank(null)}
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back
              </Button>

              <div>

                <h2 className="text-xl font-bold">
                  {selectedBank}
                </h2>

                <p className="text-sm text-muted-foreground">
                  {bankDevices.length} devices
                </p>

              </div>

            </div>

            <Button onClick={() => setOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Device
            </Button>

          </div>

          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">

            {bankDevices.map(device => {

              const CatIcon =
                CATEGORY_CONFIG[
                  device.category
                ]?.icon || Cpu;

              return (

                <Card
                  key={device.id}
                  className="p-4"
                >

                  <div className="flex items-start justify-between mb-3">

                    <div className="flex gap-3">

                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <CatIcon className="w-5 h-5 text-primary" />
                      </div>

                      <div>

                        <p className="font-semibold text-sm">
                          {device.name}
                        </p>

                        <p className="text-xs text-muted-foreground">
                          {device.serial_number}
                        </p>

                        {device.terminal_id && (
                          <p className="text-xs text-primary">
                            {device.terminal_id}
                          </p>
                        )}

                      </div>

                    </div>

                    <Badge variant="outline">
                      {device.status}
                    </Badge>

                  </div>

                  {device.branch_location && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                      <MapPin className="w-3 h-3" />
                      {device.branch_location}
                    </p>
                  )}

                  {device.assigned_engineer_name && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mb-3">
                      <Wrench className="w-3 h-3" />
                      {device.assigned_engineer_name}
                    </p>
                  )}

                  <div className="flex gap-2">

                    <Select
                      value={device.status}
                      onValueChange={v =>
                        handleStatus(device, v)
                      }
                    >

                      <SelectTrigger className="h-8 text-xs flex-1">
                        <SelectValue />
                      </SelectTrigger>

                      <SelectContent>

                        <SelectItem value="operational">
                          Operational
                        </SelectItem>

                        <SelectItem value="faulty">
                          Faulty
                        </SelectItem>

                        <SelectItem value="under_maintenance">
                          Maintenance
                        </SelectItem>

                        <SelectItem value="offline">
                          Offline
                        </SelectItem>

                      </SelectContent>

                    </Select>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEdit(device)}
                    >
                      <Pencil className="w-3 h-3" />
                    </Button>

                  </div>

                </Card>
              );
            })}

          </div>
        </>
      )}

      <Dialog
        open={open}
        onOpenChange={setOpen}
      >

        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">

          <DialogHeader>
            <DialogTitle>
              {editing ? 'Edit' : 'Add'} Device
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3">

            <div className="col-span-2 space-y-1.5">

              <Label>Device Name</Label>

              <Input
                value={form.name}
                onChange={e =>
                  f('name', e.target.value)
                }
              />

            </div>

            <div className="space-y-1.5">

              <Label>Serial Number</Label>

              <Input
                value={form.serial_number}
                onChange={e =>
                  f('serial_number', e.target.value)
                }
              />

            </div>

            <div className="space-y-1.5">

              <Label>Terminal ID</Label>

              <Input
                value={form.terminal_id}
                onChange={e =>
                  f('terminal_id', e.target.value)
                }
              />

            </div>

            <div className="space-y-1.5">

              <Label>Category</Label>

              <Select
                value={form.category}
                onValueChange={v =>
                  f('category', v)
                }
              >

                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>

                  {Object.entries(CATEGORY_CONFIG).map(([k, v]) => (
                    <SelectItem
                      key={k}
                      value={k}
                    >
                      {v.label}
                    </SelectItem>
                  ))}

                </SelectContent>

              </Select>

            </div>

            <div className="space-y-1.5">

              <Label>Bank Name</Label>

              <Input
                value={form.client_name}
                onChange={e =>
                  f('client_name', e.target.value)
                }
              />

            </div>

            <div className="space-y-1.5">

              <Label>Branch</Label>

              <Input
                value={form.site_name}
                onChange={e =>
                  f('site_name', e.target.value)
                }
              />

            </div>

            <div className="col-span-2 space-y-1.5">

              <Label>Location</Label>

              <Input
                value={form.branch_location}
                onChange={e =>
                  f('branch_location', e.target.value)
                }
              />

            </div>

            <div className="space-y-1.5">

              <Label>Assigned Engineer</Label>

              <Select
                value={form.assigned_engineer_email}
                onValueChange={v => {

                  const eng = engineers.find(
                    x => x.email === v
                  );

                  f('assigned_engineer_email', v);

                  f(
                    'assigned_engineer_name',
                    eng?.full_name || ''
                  );
                }}
              >

                <SelectTrigger>
                  <SelectValue placeholder="Select engineer" />
                </SelectTrigger>

                <SelectContent>

                  {engineers.map(e => (
                    <SelectItem
                      key={e.email}
                      value={e.email}
                    >
                      {e.full_name}
                    </SelectItem>
                  ))}

                </SelectContent>

              </Select>

            </div>

            <div className="space-y-1.5">

              <Label>Status</Label>

              <Select
                value={form.status}
                onValueChange={v =>
                  f('status', v)
                }
              >

                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>

                  <SelectItem value="operational">
                    Operational
                  </SelectItem>

                  <SelectItem value="faulty">
                    Faulty
                  </SelectItem>

                  <SelectItem value="under_maintenance">
                    Maintenance
                  </SelectItem>

                  <SelectItem value="offline">
                    Offline
                  </SelectItem>

                </SelectContent>

              </Select>

            </div>

            <div className="col-span-2 space-y-1.5">

              <Label>Notes</Label>

              <Textarea
                value={form.notes}
                onChange={e =>
                  f('notes', e.target.value)
                }
              />

            </div>

            <Button
              className="col-span-2"
              onClick={handleSave}
              disabled={
                !form.name ||
                !form.serial_number ||
                saving
              }
            >

              {saving && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}

              {editing ? 'Update' : 'Add'} Device

            </Button>

          </div>

        </DialogContent>

      </Dialog>

    </div>
  );
}