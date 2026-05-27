import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Building2,
  Search,
  Plus,
  Cpu,
  GitBranch,
  Pencil,
  Trash2,
  User,
  MapPin,
  AlertCircle,
  CheckCircle2,
  Wrench,
  Loader2
} from 'lucide-react';

import { toast } from 'sonner';

const BANK_COLORS = {
  UBA: 'bg-red-500',
  KEYSTONE: 'bg-green-600',
  UNITY: 'bg-purple-600',
  ACCESS: 'bg-orange-500',
  POLARIS: 'bg-blue-600',
  FIDELITY: 'bg-teal-600',
  ZENITH: 'bg-red-700',
  GTB: 'bg-orange-600',
  FIRST: 'bg-blue-700',
  STERLING: 'bg-green-500',
  FCMB: 'bg-purple-500',
  WEMA: 'bg-teal-500',
};

const getBankColor = (name) => {
  const upper = (name || '').toUpperCase();

  for (const [key, val] of Object.entries(BANK_COLORS)) {
    if (upper.includes(key)) return val;
  }

  return 'bg-slate-500';
};

export default function BanksPage() {
  const { user } = useOutletContext() || {};

  const isAdmin = ['admin', 'super_admin', 'manager'].includes(user?.role);

  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [detail, setDetail] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const [form, setForm] = useState({
    bank_name: '',
    status: 'active',
    contact_email: '',
    notes: '',
  });

  const { data: banks = [], isLoading } = useQuery({
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

  const { data: devices = [] } = useQuery({
    queryKey: ['devices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('devices')
        .select('*');

      if (error) {
        console.error(error);
        return [];
      }

      return data || [];
    },
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('branches')
        .select('*');

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
        .select('*');

      if (error) {
        console.error(error);
        return [];
      }

      return data || [];
    },
  });

  const mergedBanks = useMemo(() => {
    const bankMap = new Map();

    banks.forEach(b => {
      bankMap.set(b.bank_name?.toUpperCase(), b);
    });

    devices.forEach(d => {
      if (d.bank_name) {
        const key = d.bank_name.toUpperCase();

        if (!bankMap.has(key)) {
          bankMap.set(key, {
            id: `virtual-${key}`,
            bank_name: d.bank_name,
            status: 'active',
            _virtual: true,
          });
        }
      }
    });

    return Array.from(bankMap.values());
  }, [banks, devices]);

  const filtered = mergedBanks.filter(b =>
    !search ||
    b.bank_name?.toLowerCase().includes(search.toLowerCase())
  );

  const addBank = useMutation({
    mutationFn: async (data) => {
      if (editing) {
        const { error } = await supabase
          .from('banks')
          .update(data)
          .eq('id', editing.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('banks')
          .insert(data);

        if (error) throw error;
      }
    },

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['banks'] });

      setShowForm(false);
      setEditing(null);

      setForm({
        bank_name: '',
        status: 'active',
        contact_email: '',
        notes: '',
      });

      toast.success(editing ? 'Bank updated' : 'Bank added');
    },

    onError: (e) => {
      toast.error(e.message);
    },
  });

  const deleteBank = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from('banks')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['banks'] });
      setDeleteConfirm(null);
      toast.success('Bank deleted');
    },

    onError: (e) => {
      toast.error(e.message);
    },
  });

  const openEdit = (bank) => {
    setEditing(bank);

    setForm({
      bank_name: bank.bank_name || '',
      status: bank.status || 'active',
      contact_email: bank.contact_email || '',
      notes: bank.notes || '',
    });

    setShowForm(true);
  };

  const openDetail = (bank) => {
    const bankDevices = devices.filter(
      d => d.bank_name?.toUpperCase() === bank.bank_name?.toUpperCase()
    );

    const bankBranches = branches.filter(
      b => b.bank_name?.toUpperCase() === bank.bank_name?.toUpperCase()
    );

    const bankEngineers = engineers.filter(
      e => bankDevices.some(
        d => d.assigned_engineer === e.engineer_name
      )
    );

    setDetail({
      bank,
      bankDevices,
      bankBranches,
      bankEngineers,
    });
  };

  return (
    <div className="p-6 space-y-6">

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Banks</h1>

          <p className="text-muted-foreground text-sm">
            {mergedBanks.length} banks registered
          </p>
        </div>

        {isAdmin && (
          <Button
            onClick={() => {
              setEditing(null);

              setForm({
                bank_name: '',
                status: 'active',
                contact_email: '',
                notes: '',
              });

              setShowForm(true);
            }}
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Bank
          </Button>
        )}
      </div>

      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />

        <Input
          placeholder="Search banks..."
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

          {filtered.map(bank => {

            const bankDevices = devices.filter(
              d => d.bank_name?.toUpperCase() === bank.bank_name?.toUpperCase()
            );

            const bankBranches = branches.filter(
              b => b.bank_name?.toUpperCase() === bank.bank_name?.toUpperCase()
            );

            const active = bankDevices.filter(
              d => d.device_status === 'Active'
            ).length;

            const faulty = bankDevices.filter(
              d => ['Faulty', 'Under Maintenance'].includes(d.device_status)
            ).length;

            const colorClass = getBankColor(bank.bank_name);

            return (
              <Card
                key={bank.id}
                className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => openDetail(bank)}
              >

                <div className={`h-2 ${colorClass}`} />

                <CardHeader className="pb-2">

                  <div className="flex items-center justify-between">

                    <div className="flex items-center gap-3">

                      <div className={`w-10 h-10 rounded-lg ${colorClass} flex items-center justify-center`}>
                        <Building2 className="w-5 h-5 text-white" />
                      </div>

                      <CardTitle className="text-base">
                        {bank.bank_name}
                      </CardTitle>

                    </div>

                    <div className="flex items-center gap-1">

                      <Badge
                        variant={bank.status === 'active' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {bank.status}
                      </Badge>

                      {isAdmin && !bank._virtual && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={e => {
                              e.stopPropagation();
                              openEdit(bank);
                            }}
                          >
                            <Pencil className="w-3 h-3" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={e => {
                              e.stopPropagation();
                              setDeleteConfirm(bank);
                            }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </>
                      )}

                    </div>

                  </div>

                </CardHeader>

                <CardContent className="pt-0">

                  <div className="grid grid-cols-3 gap-2 mt-2">

                    <div className="text-center p-2 bg-muted/50 rounded">
                      <p className="text-lg font-bold">
                        {bankBranches.length}
                      </p>

                      <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
                        <GitBranch className="w-3 h-3" />
                        Branches
                      </p>
                    </div>

                    <div className="text-center p-2 bg-muted/50 rounded">
                      <p className="text-lg font-bold">
                        {bankDevices.length}
                      </p>

                      <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
                        <Cpu className="w-3 h-3" />
                        Devices
                      </p>
                    </div>

                    <div className="text-center p-2 bg-muted/50 rounded">
                      <p className="text-lg font-bold text-red-500">
                        {faulty}
                      </p>

                      <p className="text-[10px] text-muted-foreground">
                        Faulty
                      </p>
                    </div>

                  </div>

                </CardContent>

              </Card>
            );
          })}

        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>

          <DialogHeader>
            <DialogTitle>
              {editing ? 'Edit Bank' : 'Add New Bank'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">

            <div>
              <Label>Bank Name</Label>

              <Input
                value={form.bank_name}
                onChange={e =>
                  setForm(f => ({
                    ...f,
                    bank_name: e.target.value
                  }))
                }
                placeholder="e.g. ZENITH"
              />
            </div>

            <div>
              <Label>Status</Label>

              <Select
                value={form.status}
                onValueChange={v =>
                  setForm(f => ({
                    ...f,
                    status: v
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

            <div>
              <Label>Contact Email</Label>

              <Input
                value={form.contact_email}
                onChange={e =>
                  setForm(f => ({
                    ...f,
                    contact_email: e.target.value
                  }))
                }
                placeholder="contact@bank.com"
              />
            </div>

            <div>
              <Label>Notes</Label>

              <Input
                value={form.notes}
                onChange={e =>
                  setForm(f => ({
                    ...f,
                    notes: e.target.value
                  }))
                }
              />
            </div>

            <Button
              className="w-full"
              onClick={() => addBank.mutate(form)}
              disabled={!form.bank_name || addBank.isPending}
            >
              {addBank.isPending
                ? 'Saving...'
                : editing
                  ? 'Update Bank'
                  : 'Add Bank'}
            </Button>

          </div>

        </DialogContent>
      </Dialog>

    </div>
  );
}