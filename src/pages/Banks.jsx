import React, { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Building2, Plus, Search, Cpu, GitBranch, Edit2, Trash2, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';

const BANK_COLORS = {
  UBA: 'bg-red-500',
  KEYSTONE: 'bg-orange-500',
  UNITY: 'bg-blue-600',
  ACCESS: 'bg-orange-600',
  POLARIS: 'bg-purple-600',
  FIDELITY: 'bg-green-600',
};

export default function Banks() {
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editBank, setEditBank] = useState(null);
  const [form, setForm] = useState({
    bank_name: '',
    status: 'active'
  });

  const qc = useQueryClient();

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

  const createMut = useMutation({
    mutationFn: async (d) => {
      const { error } = await supabase
        .from('banks')
        .insert(d);

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['banks'] });
      setShowForm(false);
      setForm({
        bank_name: '',
        status: 'active'
      });
    },
    onError: (error) => {
      alert('Error creating bank: ' + error.message);
    }
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, d }) => {
      const { error } = await supabase
        .from('banks')
        .update(d)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['banks'] });
      setShowForm(false);
      setEditBank(null);
    },
    onError: (error) => {
      alert('Error updating bank: ' + error.message);
    }
  });

  const deleteMut = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from('banks')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['banks'] });
    },
    onError: (error) => {
      alert('Error deleting bank: ' + error.message);
    }
  });

  const filtered = banks.filter(b =>
    b.bank_name?.toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => {
    setEditBank(null);
    setForm({
      bank_name: '',
      status: 'active'
    });
    setShowForm(true);
  };

  const openEdit = (b) => {
    setEditBank(b);
    setForm({
      bank_name: b.bank_name,
      status: b.status || 'active'
    });
    setShowForm(true);
  };

  const handleSave = () => {
    if (!form.bank_name?.trim()) {
      alert('Bank name is required');
      return;
    }

    if (editBank) {
      updateMut.mutate({
        id: editBank.id,
        d: form
      });
    } else {
      createMut.mutate(form);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Banks</h1>
          <p className="text-muted-foreground text-sm">
            Manage supported banking partners
          </p>
        </div>

        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" />
          Add Bank
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Total Banks</p>
            <p className="text-2xl font-bold">{banks.length}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Total Branches</p>
            <p className="text-2xl font-bold">{branches.length}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Total Devices</p>
            <p className="text-2xl font-bold">{devices.length}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Active Banks</p>
            <p className="text-2xl font-bold">
              {banks.filter(b => b.status === 'active').length}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="relative w-full md:w-80">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />

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

            const colorClass =
              BANK_COLORS[bank.bank_name?.toUpperCase()] || 'bg-gray-500';

            return (
              <Card key={bank.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg ${colorClass} flex items-center justify-center`}>
                        <Building2 className="w-5 h-5 text-white" />
                      </div>

                      <div>
                        <CardTitle className="text-base">
                          {bank.bank_name}
                        </CardTitle>

                        <Badge
                          variant={bank.status === 'active' ? 'default' : 'secondary'}
                          className="text-[10px] mt-0.5"
                        >
                          {bank.status}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => openEdit(bank)}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => deleteMut.mutate(bank.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-secondary/50 rounded-lg p-3 text-center">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <GitBranch className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>

                      <p className="text-xl font-bold">
                        {bankBranches.length}
                      </p>

                      <p className="text-xs text-muted-foreground">
                        Branches
                      </p>
                    </div>

                    <div className="bg-secondary/50 rounded-lg p-3 text-center">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <Cpu className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>

                      <p className="text-xl font-bold">
                        {bankDevices.length}
                      </p>

                      <p className="text-xs text-muted-foreground">
                        Devices
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
              {editBank ? 'Edit Bank' : 'Add Bank'}
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
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowForm(false)}
            >
              Cancel
            </Button>

            <Button
              onClick={handleSave}
              disabled={createMut.isPending || updateMut.isPending}
            >
              {(createMut.isPending || updateMut.isPending) && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}

              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}