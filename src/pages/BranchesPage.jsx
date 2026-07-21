import React, { useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useFormDraft } from '@/hooks/useFormDraft';

import { Card, CardContent } from '@/components/ui/card';
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
  Search,
  MapPin,
  Cpu,
  User,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Eye,
} from 'lucide-react';

const EMPTY_FORM = {
  bank_name: '',
  branch_name: '',
  location: '',
  region: '',
  assigned_engineer: '',
  assigned_engineer_name: '',
  status: 'active',
  notes: '',
};

export default function BranchesPage() {
  const { user } = useOutletContext() || {};
  const navigate = useNavigate();
  const qc = useQueryClient();

  const canManage = ['system_admin', 'super_admin', 'admin', 'admin_head', 'manager', 'operations', 'operations_manager'].includes(
    user?.role
  );

  const [search, setSearch] = useState('');
  const [filterBank, setFilterBank] = useState('all');
  const [filterRegion, setFilterRegion] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  useFormDraft({ key: editing?.id ? `admin-branch-edit:${editing.id}` : 'admin-branch-new', form, setForm, userId: user?.id || user?.email, enabled: dialogOpen, storage: 'session', maxAgeMs: 8 * 60 * 60 * 1000 });

  const { data: branches = [], isLoading } = useQuery({
    queryKey: ['branches'],
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

  const { data: devices = [] } = useQuery({
    queryKey: ['devices'],
    queryFn: async () => {
      const { data, error } = await supabase.from('devices').select('*');

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

  const { data: engineers = [] } = useQuery({
    queryKey: ['engineers-users-for-branches'],
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
    const fromBranches = branches.map((b) => b.bank_name).filter(Boolean);

    return [...new Set([...fromBanks, ...fromBranches])];
  }, [banks, branches]);

  const regions = useMemo(() => {
    return [...new Set(branches.map((b) => b.region).filter(Boolean))];
  }, [branches]);

  const filtered = useMemo(() => {
    return branches.filter((b) => {
      const q = search.toLowerCase();

      const matchSearch =
        !search ||
        b.branch_name?.toLowerCase().includes(q) ||
        b.bank_name?.toLowerCase().includes(q) ||
        b.location?.toLowerCase().includes(q) ||
        b.region?.toLowerCase().includes(q) ||
        b.assigned_engineer?.toLowerCase().includes(q) ||
        b.assigned_engineer_name?.toLowerCase().includes(q);

      const matchBank = filterBank === 'all' || b.bank_name === filterBank;
      const matchRegion = filterRegion === 'all' || b.region === filterRegion;

      return matchSearch && matchBank && matchRegion;
    });
  }, [branches, search, filterBank, filterRegion]);

  const buildBranchPayload = () => {
    const selectedEngineer = engineers.find(
      (eng) => eng.email === form.assigned_engineer
    );

    const engineerName =
      selectedEngineer?.full_name ||
      form.assigned_engineer_name ||
      form.assigned_engineer ||
      '';

    return {
      bank_name: form.bank_name || null,
      branch_name: form.branch_name || null,
      location: form.location || null,
      region: form.region || null,
      assigned_engineer: form.assigned_engineer || null,
      assigned_engineer_name: engineerName || null,
      status: form.status || 'active',
      notes: form.notes || null,
      branch_key:
        form.bank_name && form.branch_name
          ? `${form.bank_name}-${form.branch_name}`.toLowerCase().replace(/\s+/g, '-')
          : null,
      updated_at: new Date().toISOString(),
    };
  };

  const saveBranch = useMutation({
    mutationFn: async () => {
      const payload = buildBranchPayload();

      if (editing?.id) {
        const { error } = await supabase
          .from('branches')
          .update(payload)
          .eq('id', editing.id);

        if (error) throw error;
        return;
      }

      const { error } = await supabase.from('branches').insert({
        ...payload,
        created_at: new Date().toISOString(),
      });

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['branches'] });
      setDialogOpen(false);
      setEditing(null);
      setForm(EMPTY_FORM);
    },
    onError: (error) => {
      alert('Branch save failed: ' + error.message);
    },
  });

  const deleteBranch = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('branches').delete().eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['branches'] });
      setDeleteConfirm(null);
    },
    onError: (error) => {
      alert('Delete failed: ' + error.message);
    },
  });

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (branch) => {
    setEditing(branch);
    setForm({
      bank_name: branch.bank_name || '',
      branch_name: branch.branch_name || '',
      location: branch.location || '',
      region: branch.region || '',
      assigned_engineer: branch.assigned_engineer || '',
      assigned_engineer_name: branch.assigned_engineer_name || '',
      status: branch.status || 'active',
      notes: branch.notes || '',
    });
    setDialogOpen(true);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Branches</h1>

          <p className="text-muted-foreground text-sm">
            {filtered.length} of {branches.length} branches
          </p>
        </div>

        {canManage && (
          <Button onClick={openAdd}>
            <Plus className="w-4 h-4 mr-2" />
            Add Branch
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />

          <Input
            placeholder="Search branches..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Select value={filterBank} onValueChange={setFilterBank}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All Banks" />
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

        <Select value={filterRegion} onValueChange={setFilterRegion}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All Regions" />
          </SelectTrigger>

          <SelectContent>
            <SelectItem value="all">All Regions</SelectItem>

            {regions.map((region) => (
              <SelectItem key={region} value={region}>
                {region}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map((branch) => {
            const branchDevices = devices.filter(
              (d) =>
                (d.branch_name === branch.branch_name ||
                  d.branch === branch.branch_name) &&
                d.bank_name === branch.bank_name
            );

            return (
              <Card
                key={branch.id}
                className="hover:shadow-md transition-shadow"
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <MapPin className="w-4 h-4 text-primary flex-shrink-0" />

                      <span className="font-semibold text-sm leading-tight truncate">
                        {branch.branch_name}
                      </span>
                    </div>

                    <Badge variant="outline" className="text-[10px]">
                      {branch.bank_name}
                    </Badge>
                  </div>

                  {branch.region && (
                    <Badge variant="secondary" className="text-[10px]">
                      {branch.region}
                    </Badge>
                  )}

                  {branch.location && (
                    <p className="text-xs text-muted-foreground">
                      {branch.location}
                    </p>
                  )}

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Cpu className="w-3 h-3" />
                      {branchDevices.length} devices
                    </span>

                    {(branch.assigned_engineer_name ||
                      branch.assigned_engineer) && (
                      <span className="flex items-center gap-1 truncate max-w-[130px]">
                        <User className="w-3 h-3" />
                        {branch.assigned_engineer_name ||
                          branch.assigned_engineer}
                      </span>
                    )}
                  </div>

                  <Badge
                    variant={branch.status === 'active' ? 'default' : 'secondary'}
                    className="text-[10px]"
                  >
                    {branch.status || 'active'}
                  </Badge>

                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => navigate(`/branches/${branch.id}/devices`)}
                    >
                      <Eye className="w-3.5 h-3.5 mr-1" />
                      Devices
                    </Button>

                    {canManage && (
                      <>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => openEdit(branch)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>

                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-red-500"
                          onClick={() => setDeleteConfirm(branch)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {filtered.length === 0 && (
            <div className="col-span-full text-center py-16 text-muted-foreground">
              No branches found.
            </div>
          )}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Branch' : 'Add Branch'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Bank *</Label>
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
                    {bankNames.map((bank) => (
                      <SelectItem key={bank} value={bank}>
                        {bank}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Branch Name *</Label>
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

              <div className="space-y-1.5">
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

              <div className="space-y-1.5">
                <Label>Region</Label>
                <Input
                  placeholder="e.g. SW, SE, NORTH"
                  value={form.region}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      region: e.target.value,
                    }))
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
                  value={form.status}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      status: v,
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

              <div className="space-y-1.5 md:col-span-2">
                <Label>Notes</Label>
                <Input
                  value={form.notes}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      notes: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <Button
              className="w-full"
              onClick={() => {
                if (!form.bank_name || !form.branch_name) {
                  alert('Bank and Branch Name are required.');
                  return;
                }

                saveBranch.mutate();
              }}
              disabled={saveBranch.isPending}
            >
              {saveBranch.isPending
                ? 'Saving...'
                : editing
                  ? 'Update Branch'
                  : 'Add Branch'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!deleteConfirm}
        onOpenChange={() => setDeleteConfirm(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Branch</DialogTitle>
          </DialogHeader>

          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete{' '}
            <strong>{deleteConfirm?.branch_name}</strong>?
          </p>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteConfirm(null)}
            >
              Cancel
            </Button>

            <Button
              variant="destructive"
              onClick={() => deleteBranch.mutate(deleteConfirm.id)}
              disabled={deleteBranch.isPending}
            >
              Delete Branch
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
