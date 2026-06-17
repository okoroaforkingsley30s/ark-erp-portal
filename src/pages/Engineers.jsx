import React, { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { HardHat, Plus, Search, MapPin, Cpu, Edit2, Trash2, Wifi, WifiOff } from 'lucide-react';

const REGION_COLORS = {
  NORTH: 'bg-blue-500',
  SE: 'bg-green-500',
  SW: 'bg-orange-500',
  'S/SOUTH': 'bg-purple-500',
};

const STATUS_BADGE = {
  online: 'bg-green-100 text-green-700',
  offline: 'bg-gray-100 text-gray-600',
  busy: 'bg-yellow-100 text-yellow-700',
  on_site: 'bg-blue-100 text-blue-700',
};

const defaultForm = {
  engineer_name: '',
  region: 'NORTH',
  assigned_location: '',
  status: 'active',
  phone_number: '',
  email: '',
  online_status: 'offline',
  notes: '',
};

export default function Engineers() {
  const [search, setSearch] = useState('');
  const [regionFilter, setRegionFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editEng, setEditEng] = useState(null);
  const [form, setForm] = useState(defaultForm);

  const qc = useQueryClient();

  const { data: engineers = [] } = useQuery({
    queryKey: ['engineers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('engineers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data || [];
    },
  });

  const { data: devices = [] } = useQuery({
    queryKey: ['bankdevices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('devices')
        .select('*');

      if (error) throw error;

      return data || [];
    },
  });

  const createMut = useMutation({
    mutationFn: async (d) => {
      const { error } = await supabase
        .from('engineers')
        .insert([d]);

      if (error) throw error;
    },

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['engineers'] });
      setShowForm(false);
      setForm(defaultForm);
    },
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, d }) => {
      const { error } = await supabase
        .from('engineers')
        .update(d)
        .eq('id', id);

      if (error) throw error;
    },

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['engineers'] });
      setShowForm(false);
      setEditEng(null);
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from('engineers')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['engineers'] });
    },
  });

  const regions = ['NORTH', 'SE', 'SW', 'S/SOUTH'];

  const filtered = engineers.filter((e) => {
    const matchSearch =
      e.engineer_name?.toLowerCase().includes(search.toLowerCase()) ||
      e.assigned_location?.toLowerCase().includes(search.toLowerCase());

    const matchRegion =
      regionFilter === 'all' || e.region === regionFilter;

    return matchSearch && matchRegion;
  });

  const openCreate = () => {
    setEditEng(null);
    setForm(defaultForm);
    setShowForm(true);
  };

  const openEdit = (e) => {
    setEditEng(e);

    setForm({
      engineer_name: e.engineer_name || '',
      region: e.region || 'NORTH',
      assigned_location: e.assigned_location || '',
      status: e.status || 'active',
      phone_number: e.phone_number || '',
      email: e.email || '',
      online_status: e.online_status || 'offline',
      notes: e.notes || '',
    });

    setShowForm(true);
  };

  const handleSave = () => {
    if (editEng) {
      updateMut.mutate({
        id: editEng.id,
        d: form,
      });
    } else {
      createMut.mutate(form);
    }
  };

  const regionStats = regions.map((r) => ({
    region: r,
    count: engineers.filter((e) => e.region === r).length,
  }));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Engineers</h1>
          <p className="text-muted-foreground text-sm">
            Field engineer roster and coverage
          </p>
        </div>

        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" />
          Add Engineer
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {regionStats.map(({ region, count }) => (
          <Card
            key={region}
            className="cursor-pointer hover:shadow-md"
            onClick={() =>
              setRegionFilter(regionFilter === region ? 'all' : region)
            }
          >
            <CardContent className="pt-4">
              <div
                className={`w-8 h-8 rounded-lg ${REGION_COLORS[region]} flex items-center justify-center mb-2`}
              >
                <MapPin className="w-4 h-4 text-white" />
              </div>

              <p className="text-2xl font-bold text-[#ff5a00]">{count}</p>
              <p className="text-xs text-muted-foreground">{region}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative w-64">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />

          <Input
            placeholder="Search engineers..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Select value={regionFilter} onValueChange={setRegionFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All Regions" />
          </SelectTrigger>

          <SelectContent>
            <SelectItem value="all">All Regions</SelectItem>

            {regions.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="text-sm text-muted-foreground">
          {filtered.length} engineers
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((eng) => {
          const engDevices = devices.filter(
            (d) =>
              d.assigned_engineer?.toUpperCase() ===
              eng.engineer_name?.toUpperCase()
          );

          const colorClass =
            REGION_COLORS[eng.region] || 'bg-gray-500';

          return (
            <Card
              key={eng.id}
              className="hover:shadow-md transition-shadow"
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-full ${colorClass} flex items-center justify-center text-white font-bold text-sm`}
                    >
                      {eng.engineer_name?.[0]?.toUpperCase() || 'E'}
                    </div>

                    <div>
                      <CardTitle className="text-sm">
                        {eng.engineer_name}
                      </CardTitle>

                      <p className="text-xs text-muted-foreground">
                        {eng.region} Region
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => openEdit(eng)}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => deleteMut.mutate(eng.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>{eng.assigned_location}</span>
                </div>

                <div className="flex items-center justify-between">
                  <div
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      STATUS_BADGE[eng.online_status] ||
                      STATUS_BADGE.offline
                    }`}
                  >
                    {eng.online_status === 'online' ? (
                      <Wifi className="w-3 h-3 inline mr-1" />
                    ) : (
                      <WifiOff className="w-3 h-3 inline mr-1" />
                    )}

                    {eng.online_status}
                  </div>

                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Cpu className="w-3.5 h-3.5" />
                    <span>{engDevices.length} devices</span>
                  </div>
                </div>

                {eng.phone_number && (
                  <p className="text-xs text-muted-foreground">
                    📞 {eng.phone_number}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editEng ? 'Edit Engineer' : 'Add Engineer'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Name</Label>

              <Input
                value={form.engineer_name}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    engineer_name: e.target.value,
                  }))
                }
              />
            </div>

            <div>
              <Label>Region</Label>

              <Select
                value={form.region}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    region: v,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  {regions.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
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
                  <SelectItem value="on_leave">On Leave</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2">
              <Label>Assigned Location</Label>

              <Input
                value={form.assigned_location}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    assigned_location: e.target.value,
                  }))
                }
              />
            </div>

            <div>
              <Label>Phone</Label>

              <Input
                value={form.phone_number}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    phone_number: e.target.value,
                  }))
                }
              />
            </div>

            <div>
              <Label>Email</Label>

              <Input
                value={form.email}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    email: e.target.value,
                  }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowForm(false)}
            >
              Cancel
            </Button>

            <Button onClick={handleSave}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}