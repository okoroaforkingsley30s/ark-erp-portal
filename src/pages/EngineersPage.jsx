import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useFormDraft } from '@/hooks/useFormDraft';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

import { Search, User, MapPin, Cpu, Plus, Pencil, Trash2, Loader2, Phone, Mail } from 'lucide-react';
import { toast } from 'sonner';

const REGION_COLORS = {
  NORTH: 'bg-blue-100 text-blue-800',
  SE: 'bg-green-100 text-green-800',
  SW: 'bg-yellow-100 text-yellow-800',
  'S/SOUTH': 'bg-purple-100 text-purple-800',
};

const STATUS_COLORS = {
  online: 'bg-green-100 text-green-700',
  offline: 'bg-slate-100 text-slate-500',
  busy: 'bg-amber-100 text-amber-700',
  on_site: 'bg-blue-100 text-blue-700',
  traveling: 'bg-purple-100 text-purple-700',
};

const emptyForm = {
  engineer_name: '',
  region: 'SW',
  assigned_location: '',
  phone_number: '',
  email: '',
  status: 'active',
  online_status: 'offline',
  notes: ''
};

export default function EngineersPage() {
  const { user } = useOutletContext() || {};
  const isAdmin = ['admin', 'super_admin', 'manager'].includes(user?.role);
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [filterRegion, setFilterRegion] = useState('all');
  const [detail, setDetail] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useFormDraft({ key: editing?.id ? `operations-engineer-edit:${editing.id}` : 'operations-engineer-new', form, setForm, userId: user?.id || user?.email, enabled: dialogOpen, storage: 'session', maxAgeMs: 8 * 60 * 60 * 1000 });

  const { data: engineers = [] } = useQuery({
  queryKey: ['engineers-from-users'],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'engineer')
      .order('full_name', { ascending: true });

    if (error) {
      console.error('Engineers from users error:', error);
      return [];
    }

    return (data || []).map((u) => ({
      id: u.id,
      engineer_name: u.full_name || u.email,
      email: u.email,
      phone_number: u.phone || u.phone_number || '',
      region: u.region || 'SW',
      assigned_location: u.assigned_location || u.location || '',
      status: u.status || 'active',
      online_status: 'offline',
      notes: '',
    }));
  },
});

  const { data: engineerStatuses = [] } = useQuery({
    queryKey: ['engineer-statuses'],
    queryFn: async () => {
      const { data, error } = await supabase.from('engineer_statuses').select('*');
      if (error) return [];
      return data || [];
    },
  });

  const { data: devices = [] } = useQuery({
    queryKey: ['devices'],
    queryFn: async () => {
      const { data, error } = await supabase.from('devices').select('*');
      if (error) return [];
      return data || [];
    },
  });

  const { data: tickets = [] } = useQuery({
    queryKey: ['tickets'],
    queryFn: async () => {
      const { data, error } = await supabase.from('tickets').select('*');
      if (error) return [];
      return data || [];
    },
  });

  const regions = ['NORTH', 'SE', 'SW', 'S/SOUTH'];

  const mergedEngineers = useMemo(() => {
    const map = new Map();

    engineers.forEach(e => {
      if (e.engineer_name) map.set(e.engineer_name.toLowerCase(), { ...e });
    });

    engineerStatuses.forEach(s => {
      const key = s.engineer_name?.toLowerCase();
      if (!key) return;

      const old = map.get(key) || {};
      map.set(key, {
        ...old,
        engineer_name: s.engineer_name || old.engineer_name,
        email: old.email || s.engineer_email,
        phone_number: old.phone_number || s.phone,
        online_status: s.status || old.online_status || 'offline',
        current_gps_location: `${s.current_latitude || ''},${s.current_longitude || ''}`,
        assigned_location: old.assigned_location || s.location_label,
        region: old.region || s.regions,
      });
    });

    return Array.from(map.values()).map(eng => ({
      ...eng,
      deviceCount: devices.filter(d =>
        d.assigned_engineer === eng.engineer_name ||
        d.assigned_engineer_name === eng.engineer_name
      ).length,
      activeTickets: tickets.filter(t =>
        (t.assigned_engineer === eng.engineer_name || t.assigned_to_name === eng.engineer_name) &&
        !['closed', 'resolved'].includes(t.status)
      ).length,
    }));
  }, [engineers, engineerStatuses, devices, tickets]);

  const byRegion = useMemo(() => {
    const map = {};
    regions.forEach(r => {
      map[r] = mergedEngineers.filter(e => e.region === r);
    });
    return map;
  }, [mergedEngineers]);

  const filtered = useMemo(() => {
    return mergedEngineers.filter(e => {
      const q = search.toLowerCase();
      const matchSearch =
        !search ||
        e.engineer_name?.toLowerCase().includes(q) ||
        e.assigned_location?.toLowerCase().includes(q) ||
        e.email?.toLowerCase().includes(q);

      const matchRegion = filterRegion === 'all' || e.region === filterRegion;
      return matchSearch && matchRegion;
    });
  }, [mergedEngineers, search, filterRegion]);

  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      if (editing) {
        const { error } = await supabase.from('engineers').update(payload).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('engineers').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['engineers'] });
      setDialogOpen(false);
      setEditing(null);
      setForm(emptyForm);
      toast.success(editing ? 'Engineer updated' : 'Engineer added');
    },
    onError: e => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('engineers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['engineers'] });
      setDeleteConfirm(null);
      toast.success('Engineer deleted');
    },
    onError: e => toast.error(e.message),
  });

  const openEdit = (eng) => {
    setEditing(eng);
    setForm({
      engineer_name: eng.engineer_name || '',
      region: eng.region || 'SW',
      assigned_location: eng.assigned_location || '',
      phone_number: eng.phone_number || '',
      email: eng.email || '',
      status: eng.status || 'active',
      online_status: eng.online_status || 'offline',
      notes: eng.notes || ''
    });
    setDialogOpen(true);
  };

  const handleSave = () => saveMutation.mutate(form);
  const handleDelete = () => deleteMutation.mutate(deleteConfirm.id);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Engineers</h1>
          <p className="text-muted-foreground text-sm">{mergedEngineers.length} field engineers</p>
        </div>

        {isAdmin && (
          <Button onClick={() => { setEditing(null); setForm(emptyForm); setDialogOpen(true); }}>
            <Plus className="w-4 h-4 mr-1" />
            Add Engineer
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {regions.map(r => (
          <Card key={r} className="cursor-pointer hover:shadow-md" onClick={() => setFilterRegion(filterRegion === r ? 'all' : r)}>
            <CardContent className="p-4">
              <p className={`text-xs font-bold px-2 py-0.5 rounded-full w-fit mb-2 ${REGION_COLORS[r]}`}>{r}</p>
              <p className="text-2xl font-bold">{byRegion[r]?.length || 0}</p>
              <p className="text-xs text-muted-foreground">Engineers</p>
              <p className="text-xs text-muted-foreground">
                {byRegion[r]?.reduce((s, e) => s + e.deviceCount, 0) || 0} devices
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search engineers..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <Select value={filterRegion} onValueChange={setFilterRegion}>
          <SelectTrigger className="w-36"><SelectValue placeholder="All Regions" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Regions</SelectItem>
            {regions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map(eng => (
          <Card key={eng.id || eng.engineer_name} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setDetail(eng)}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-5 h-5 text-primary" />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm leading-tight">{eng.engineer_name}</p>
                  <p className={`text-[10px] px-1.5 py-0.5 rounded-full w-fit mt-0.5 ${REGION_COLORS[eng.region] || 'bg-muted text-muted-foreground'}`}>
                    {eng.region || 'No Region'}
                  </p>
                </div>

                {isAdmin && (
                  <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(eng)}>
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => setDeleteConfirm(eng)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                )}
              </div>

              <div className="space-y-1 text-xs text-muted-foreground">
                {eng.assigned_location && (
                  <div className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {eng.assigned_location}
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Cpu className="w-3 h-3" />
                  {eng.deviceCount} devices · {eng.activeTickets} active tickets
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Badge variant={eng.status === 'active' ? 'default' : 'secondary'} className="text-[10px]">
                  {eng.status || 'active'}
                </Badge>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${STATUS_COLORS[eng.online_status] || 'bg-slate-100 text-slate-500'}`}>
                  {eng.online_status || 'offline'}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!detail} onOpenChange={() => setDetail(null)}>
        <DialogContent>
          {detail && (
            <>
              <DialogHeader><DialogTitle>{detail.engineer_name}</DialogTitle></DialogHeader>

              <div className="space-y-3 text-sm">
                <p><MapPin className="w-4 h-4 inline mr-1" /> {detail.assigned_location || 'No location'}</p>
                <p><Phone className="w-4 h-4 inline mr-1" /> {detail.phone_number || 'No phone'}</p>
                <p><Mail className="w-4 h-4 inline mr-1" /> {detail.email || 'No email'}</p>
                <p><Cpu className="w-4 h-4 inline mr-1" /> {detail.deviceCount} devices</p>

                {detail.notes && <p className="text-muted-foreground">{detail.notes}</p>}

                {isAdmin && (
                  <Button className="w-full" variant="outline" onClick={() => { setDetail(null); openEdit(detail); }}>
                    <Pencil className="w-4 h-4 mr-1" />
                    Edit Engineer
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edit' : 'Add'} Engineer</DialogTitle></DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input value={form.engineer_name} onChange={e => setForm(f => ({ ...f, engineer_name: e.target.value }))} />
            </div>

            <div className="space-y-1.5">
              <Label>Region</Label>
              <Select value={form.region} onValueChange={v => setForm(f => ({ ...f, region: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{regions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Assigned Location</Label>
              <Input value={form.assigned_location} onChange={e => setForm(f => ({ ...f, assigned_location: e.target.value }))} />
            </div>

            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={form.phone_number} onChange={e => setForm(f => ({ ...f, phone_number: e.target.value }))} />
            </div>

            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>

            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="on_leave">On Leave</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Online Status</Label>
              <Select value={form.online_status} onValueChange={v => setForm(f => ({ ...f, online_status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="online">Online</SelectItem>
                  <SelectItem value="offline">Offline</SelectItem>
                  <SelectItem value="busy">Busy</SelectItem>
                  <SelectItem value="on_site">On Site</SelectItem>
                  <SelectItem value="traveling">Traveling</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>

            <Button className="w-full" onClick={handleSave} disabled={!form.engineer_name || saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editing ? 'Update' : 'Add'} Engineer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Engineer</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Delete <strong>{deleteConfirm?.engineer_name}</strong>?
          </p>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
