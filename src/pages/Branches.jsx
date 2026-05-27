import React, { useState, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

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
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

import {
  GitBranch,
  Plus,
  Search,
  Cpu,
  Building2,
  HardHat,
  Edit2,
  Trash2,
} from 'lucide-react';

const BANK_COLORS = {
  UBA: 'bg-red-500',
  KEYSTONE: 'bg-orange-500',
  'KEYSTONE BANK': 'bg-orange-500',
  UNITY: 'bg-blue-600',
  'UNITY BANK': 'bg-blue-600',
  ACCESS: 'bg-orange-600',
  'ACCESS BANK': 'bg-orange-600',
  POLARIS: 'bg-purple-600',
  FIDELITY: 'bg-green-600',
  'FIDELITY BANK': 'bg-green-600',
};

const defaultForm = {
  branch_name: '',
  bank_name: '',
  location: '',
  region: '',
  assigned_engineer: '',
  status: 'active',
};

const makeBranchKey = (bank, branch) =>
  `${bank || ''}-${branch || ''}`.trim();

export default function Branches() {
  const [search, setSearch] = useState('');
  const [bankFilter, setBankFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editBranch, setEditBranch] = useState(null);
  const [form, setForm] = useState(defaultForm);

  const qc = useQueryClient();

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .order('branch_name', { ascending: true });

      if (error) throw error;
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

      if (error) throw error;
      return data || [];
    },
  });

  const { data: devices = [] } = useQuery({
    queryKey: ['bankdevices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('devices')
        .select('*')
        .order('terminal_id', { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });

  const { data: engineers = [] } = useQuery({
    queryKey: ['engineers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('role', 'engineer')
        .order('full_name', { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });

  const createMut = useMutation({
    mutationFn: async (payload) => {
      const data = {
        ...payload,
        branch_key: makeBranchKey(payload.bank_name, payload.branch_name),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('branches').insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['branches'] });
      setShowForm(false);
      setForm(defaultForm);
    },
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, d }) => {
      const data = {
        ...d,
        branch_key: makeBranchKey(d.bank_name, d.branch_name),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('branches')
        .update(data)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['branches'] });
      setShowForm(false);
      setEditBranch(null);
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id) => {
      const yes = window.confirm('Delete this branch?');
      if (!yes) return;

      const { error } = await supabase
        .from('branches')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['branches'] }),
  });

  const filtered = useMemo(() => {
    return branches.filter((b) => {
      const q = search.toLowerCase();

      const matchSearch =
        !q ||
        b.branch_name?.toLowerCase().includes(q) ||
        b.location?.toLowerCase().includes(q) ||
        b.region?.toLowerCase().includes(q);

      const matchBank =
        bankFilter === 'all' ||
        b.bank_name?.toUpperCase() === bankFilter.toUpperCase();

      return matchSearch && matchBank;
    });
  }, [branches, search, bankFilter]);

  const openCreate = () => {
    setEditBranch(null);
    setForm(defaultForm);
    setShowForm(true);
  };

  const openEdit = (b) => {
    setEditBranch(b);
    setForm({
      branch_name: b.branch_name || '',
      bank_name: b.bank_name || '',
      location: b.location || '',
      region: b.region || '',
      assigned_engineer: b.assigned_engineer || b.assigned_engineer_name || '',
      status: b.status || 'active',
    });
    setShowForm(true);
  };

  const handleSave = () => {
    if (!form.branch_name || !form.bank_name) {
      alert('Branch name and bank are required');
      return;
    }

    if (editBranch) {
      updateMut.mutate({
        id: editBranch.id,
        d: form,
      });
    } else {
      createMut.mutate(form);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Branches</h1>
          <p className="text-muted-foreground text-sm">
            Bank branch management ({branches.length} total)
          </p>
        </div>

        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" />
          Add Branch
        </Button>
      </div>

      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {banks.map((bank) => {
          const name = bank.bank_name || bank.name;

          const count = branches.filter(
            (b) => b.bank_name?.toUpperCase() === name?.toUpperCase()
          ).length;

          const color = BANK_COLORS[name?.toUpperCase()] || 'bg-gray-500';

          return (
            <Card
              key={bank.id || name}
              className={`cursor-pointer transition-all ${
                bankFilter === name ? 'ring-2 ring-primary' : ''
              }`}
              onClick={() =>
                setBankFilter(bankFilter === name ? 'all' : name)
              }
            >
              <CardContent className="pt-3 pb-3 text-center">
                <div
                  className={`w-7 h-7 rounded-md ${color} flex items-center justify-center mx-auto mb-1`}
                >
                  <Building2 className="w-3.5 h-3.5 text-white" />
                </div>
                <p className="font-bold text-sm">{count}</p>
                <p className="text-[10px] text-muted-foreground">{name}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative w-64">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search branches..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Select value={bankFilter} onValueChange={setBankFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All Banks" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Banks</SelectItem>
            {banks.map((b) => {
              const name = b.bank_name || b.name;
              return (
                <SelectItem key={b.id || name} value={name}>
                  {name}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>

        <span className="text-sm text-muted-foreground">
          {filtered.length} branches shown
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map((branch) => {
          const branchDevices = devices.filter(
            (d) =>
              d.branch_name?.toUpperCase() === branch.branch_name?.toUpperCase() &&
              d.bank_name?.toUpperCase() === branch.bank_name?.toUpperCase()
          );

          const color =
            BANK_COLORS[branch.bank_name?.toUpperCase()] || 'bg-gray-500';

          return (
            <Card key={branch.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-8 h-8 rounded-md ${color} flex items-center justify-center`}
                    >
                      <GitBranch className="w-4 h-4 text-white" />
                    </div>

                    <div>
                      <CardTitle className="text-xs leading-tight">
                        {branch.branch_name}
                      </CardTitle>
                      <p className="text-[10px] text-muted-foreground">
                        {branch.bank_name}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => openEdit(branch)}
                    >
                      <Edit2 className="w-3 h-3" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive"
                      onClick={() => deleteMut.mutate(branch.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-1.5">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Cpu className="w-3 h-3" />
                  {branchDevices.length} devices
                </div>

                {(branch.assigned_engineer || branch.assigned_engineer_name) && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <HardHat className="w-3 h-3" />
                    {branch.assigned_engineer || branch.assigned_engineer_name}
                  </div>
                )}

                {branch.region && (
                  <Badge variant="outline" className="text-[10px]">
                    {branch.region}
                  </Badge>
                )}

                {branch.location && (
                  <p className="text-[10px] text-muted-foreground">
                    {branch.location}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editBranch ? 'Edit Branch' : 'Add Branch'}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Branch Name</Label>
              <Input
                value={form.branch_name}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    branch_name: e.target.value,
                  }))
                }
              />
            </div>

            <div>
              <Label>Bank</Label>
              <Select
                value={form.bank_name}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    bank_name: v,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select bank" />
                </SelectTrigger>
                <SelectContent>
                  {banks.map((b) => {
                    const name = b.bank_name || b.name;
                    return (
                      <SelectItem key={b.id || name} value={name}>
                        {name}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Region</Label>
              <Input
                value={form.region}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    region: e.target.value,
                  }))
                }
              />
            </div>

            <div className="col-span-2">
              <Label>Location</Label>
              <Input
                value={form.location}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    location: e.target.value,
                  }))
                }
              />
            </div>

            <div className="col-span-2">
              <Label>Assigned Engineer</Label>
              <Select
                value={form.assigned_engineer}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    assigned_engineer: v,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select engineer" />
                </SelectTrigger>
                <SelectContent>
                  {engineers.map((e) => (
                    <SelectItem key={e.id || e.email} value={e.full_name || e.email}>
                      {e.full_name || e.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>
              Cancel
            </Button>

            <Button
              onClick={handleSave}
              disabled={createMut.isPending || updateMut.isPending}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}