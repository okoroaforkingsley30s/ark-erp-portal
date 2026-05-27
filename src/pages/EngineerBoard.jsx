import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';

import { Card } from '@/components/ui/card';
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
  User,
  MapPin,
  Clock,
  Loader2,
  RefreshCw,
  Phone,
  Wrench,
  Navigation,
  Radio,
  Camera
} from 'lucide-react';

import { format } from 'date-fns';

const ENG_STATUS = {
  online: {
    label: 'Online',
    color: 'bg-green-500',
    light: 'bg-green-50 text-green-700 border-green-200',
    dot: 'bg-green-500'
  },

  offline: {
    label: 'Offline',
    color: 'bg-slate-400',
    light: 'bg-slate-50 text-slate-600 border-slate-200',
    dot: 'bg-slate-400'
  },

  busy: {
    label: 'Busy',
    color: 'bg-amber-500',
    light: 'bg-amber-50 text-amber-700 border-amber-200',
    dot: 'bg-amber-400'
  },

  on_site: {
    label: 'On Site',
    color: 'bg-blue-500',
    light: 'bg-blue-50 text-blue-700 border-blue-200',
    dot: 'bg-blue-500'
  },

  traveling: {
    label: 'Traveling',
    color: 'bg-purple-500',
    light: 'bg-purple-50 text-purple-700 border-purple-200',
    dot: 'bg-purple-400'
  },
};

export default function EngineerBoard() {

  const { user } = useOutletContext();

  const role = user?.role || 'client';

  const qc = useQueryClient();

  const [editOpen, setEditOpen] = useState(false);

  const [form, setForm] = useState({
    staff_id: '',
    department: '',
    phone: '',
    skills: '',
    regions: '',
    status: 'offline'
  });

  const [saving, setSaving] = useState(false);

  const [tracking, setTracking] = useState(false);

  const [search, setSearch] = useState('');

  const {
    data: engineers = [],
    refetch
  } = useQuery({
    queryKey: ['engineers-board'],

    queryFn: async () => {

      const { data, error } = await supabase
        .from('engineers')
        .select('*')
        .order('engineer_name', {
          ascending: true
        });

      if (error) {
        console.error(error);
        return [];
      }

      return data || [];
    },

    refetchInterval: 30000,
  });

  const {
    data: devices = []
  } = useQuery({
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

  const {
    data: statuses = []
  } = useQuery({
    queryKey: ['engineer-statuses'],

    queryFn: async () => {

      const { data, error } = await supabase
        .from('engineer_statuses')
        .select('*')
        .order('updated_at', {
          ascending: false
        });

      if (error) {
        console.error(error);
        return [];
      }

      return data || [];
    },

    refetchInterval: 15000,
  });

  const {
    data: tickets = []
  } = useQuery({
    queryKey: ['tickets-board'],

    queryFn: async () => {

      const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .order('created_at', {
          ascending: false
        });

      if (error) {
        console.error(error);
        return [];
      }

      return data || [];
    },
  });

  useEffect(() => {

    if (role === 'engineer') {

      const mine = statuses.find(
        s => s.engineer_email === user.email
      );

      if (mine) {

        setForm({
          staff_id: mine.staff_id || '',
          department: mine.department || '',
          phone: mine.phone || '',
          skills: mine.skills || '',
          regions: mine.regions || '',
          status: mine.status || 'offline'
        });
      }
    }

  }, [statuses, role, user]);

  const merged = engineers.map(eng => {

    const liveStatus = statuses.find(
      s =>
        s.engineer_name === eng.engineer_name ||
        s.engineer_email === eng.email
    );

    const deviceCount = devices.filter(
      d =>
        d.assigned_engineer === eng.engineer_name ||
        d.assigned_engineer_name === eng.engineer_name
    ).length;

    const activeTickets = tickets.filter(
      t =>
        t.assigned_to_name === eng.engineer_name &&
        !['closed', 'resolved'].includes(t.status)
    ).length;

    return {
      ...eng,
      ...liveStatus,
      deviceCount,
      activeTickets
    };
  });

  const myStatus = statuses.find(
    s => s.engineer_email === user?.email
  );

  const upsertStatus = async (data) => {

    const existing = statuses.find(
      s => s.engineer_email === user.email
    );

    const payload = {
      engineer_email: user.email,
      engineer_name: user.full_name,
      last_active: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...data
    };

    if (existing) {

      const { error } = await supabase
        .from('engineer_statuses')
        .update(payload)
        .eq('id', existing.id);

      if (error) throw error;

    } else {

      const { error } = await supabase
        .from('engineer_statuses')
        .insert(payload);

      if (error) throw error;
    }

    qc.invalidateQueries({
      queryKey: ['engineer-statuses']
    });
  };

  const saveProfile = async () => {

    setSaving(true);

    try {

      await upsertStatus(form);

      setEditOpen(false);

    } catch (err) {

      console.error(err);

      alert(err.message);

    } finally {

      setSaving(false);
    }
  };

  const handleGPS = () => {

    if (!navigator.geolocation) return;

    setTracking(true);

    navigator.geolocation.getCurrentPosition(

      async pos => {

        await upsertStatus({
          current_latitude: pos.coords.latitude,
          current_longitude: pos.coords.longitude,
          tracking_enabled: true,
          location_label:
            pos.coords.latitude.toFixed(4) +
            ', ' +
            pos.coords.longitude.toFixed(4)
        });

        setTracking(false);
      },

      () => setTracking(false)
    );
  };

  const REGION_COLORS = {
    NORTH: 'bg-blue-100 text-blue-800',
    SE: 'bg-green-100 text-green-800',
    SW: 'bg-yellow-100 text-yellow-800',
    'S/SOUTH': 'bg-purple-100 text-purple-800'
  };

  const counters = {
    online: 0,
    on_site: 0,
    busy: 0,
    offline: 0
  };

  merged.forEach(e => {

    const st = e.status || 'offline';

    counters[st] !== undefined
      ? counters[st]++
      : counters.offline++;
  });

  const filtered = search

    ? merged.filter(e =>
        e.engineer_name?.toLowerCase().includes(search.toLowerCase()) ||
        e.region?.toLowerCase().includes(search.toLowerCase()) ||
        e.assigned_location?.toLowerCase().includes(search.toLowerCase())
      )

    : merged;

  return (
    <div className="space-y-5">

      <div className="flex flex-wrap items-center justify-between gap-3">

        <div>

          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Radio className="w-6 h-6 text-primary" />
            Engineer Live Board
          </h1>

          <p className="text-sm text-muted-foreground mt-0.5">
            {engineers.length} engineers across all regions
          </p>

        </div>

        <div className="flex gap-2">

          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            Refresh
          </Button>

          {role === 'engineer' && (
            <Button onClick={() => setEditOpen(true)}>
              <User className="w-4 h-4 mr-2" />
              My Profile
            </Button>
          )}

        </div>

      </div>

      <Input
        placeholder="Search engineer, region, location..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="max-w-xs"
      />

      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">

        {filtered.map(eng => {

          const sc =
            ENG_STATUS[eng.status || 'offline'] ||
            ENG_STATUS.offline;

          return (

            <Card
              key={eng.id}
              className="p-4 hover:shadow-lg transition-all"
            >

              <div className="flex items-start gap-3 mb-3">

                <div className="relative flex-shrink-0">

                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center border-2 border-border">
                    <span className="font-bold text-primary">
                      {(eng.engineer_name || '?')[0]}
                    </span>
                  </div>

                  <span
                    className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white ${sc.dot}`}
                  />

                </div>

                <div className="flex-1 min-w-0">

                  <p className="font-semibold text-sm">
                    {eng.engineer_name}
                  </p>

                  <div className="flex items-center gap-1.5 mt-0.5">

                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                        REGION_COLORS[eng.region] ||
                        'bg-muted text-muted-foreground'
                      }`}
                    >
                      {eng.region}
                    </span>

                  </div>

                </div>

                <Badge
                  variant="outline"
                  className={`${sc.light} text-[10px] flex-shrink-0`}
                >
                  {sc.label}
                </Badge>

              </div>

              <div className="space-y-1.5 text-xs text-muted-foreground">

                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">
                    {eng.assigned_location ||
                      eng.location_label ||
                      'No location'}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <Wrench className="w-3 h-3 flex-shrink-0" />
                  <span>
                    {eng.deviceCount} assigned devices
                  </span>
                </div>

                {eng.activeTickets > 0 && (

                  <div className="flex items-center gap-1.5">

                    <span className="w-3 h-3 flex-shrink-0 text-orange-500">
                      !
                    </span>

                    <span className="text-orange-600">
                      {eng.activeTickets} active ticket(s)
                    </span>

                  </div>
                )}

                {eng.phone_number && (

                  <div className="flex items-center gap-1.5">

                    <Phone className="w-3 h-3 flex-shrink-0" />

                    <span>{eng.phone_number}</span>

                  </div>
                )}

                {eng.last_active && (

                  <div className="flex items-center gap-1.5 pt-1 border-t border-border">

                    <Clock className="w-3 h-3 flex-shrink-0" />

                    <span>
                      Active:{' '}
                      {format(
                        new Date(eng.last_active),
                        'MMM d, h:mm a'
                      )}
                    </span>

                  </div>
                )}

              </div>

            </Card>
          );
        })}

      </div>

      <Dialog
        open={editOpen}
        onOpenChange={setEditOpen}
      >

        <DialogContent className="sm:max-w-lg">

          <DialogHeader>
            <DialogTitle>
              My Engineer Profile
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">

            <div className="grid grid-cols-2 gap-3">

              <div className="space-y-1.5">

                <Label>Staff ID</Label>

                <Input
                  value={form.staff_id}
                  onChange={e =>
                    setForm(f => ({
                      ...f,
                      staff_id: e.target.value
                    }))
                  }
                />

              </div>

              <div className="space-y-1.5">

                <Label>Department</Label>

                <Input
                  value={form.department}
                  onChange={e =>
                    setForm(f => ({
                      ...f,
                      department: e.target.value
                    }))
                  }
                />

              </div>

            </div>

            <div className="space-y-1.5">

              <Label>Phone</Label>

              <Input
                value={form.phone}
                onChange={e =>
                  setForm(f => ({
                    ...f,
                    phone: e.target.value
                  }))
                }
              />

            </div>

            <div className="space-y-1.5">

              <Label>Skills</Label>

              <Input
                value={form.skills}
                onChange={e =>
                  setForm(f => ({
                    ...f,
                    skills: e.target.value
                  }))
                }
              />

            </div>

            <div className="space-y-1.5">

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

                  {Object.entries(ENG_STATUS).map(([k, v]) => (

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

            <Button
              className="w-full"
              onClick={saveProfile}
              disabled={saving}
            >

              {saving && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}

              Save Profile

            </Button>

          </div>

        </DialogContent>

      </Dialog>

    </div>
  );
}