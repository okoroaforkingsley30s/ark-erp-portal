import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useFormDraft } from '@/hooks/useFormDraft';

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
  online: { label: 'Online', dot: 'bg-green-500', light: 'bg-green-500/15 text-green-300 border-green-500/30' },
  offline: { label: 'Offline', dot: 'bg-slate-400', light: 'bg-slate-500/15 text-slate-300 border-slate-500/30' },
  busy: { label: 'Busy', dot: 'bg-orange-500', light: 'bg-orange-500/15 text-orange-300 border-orange-500/30' },
  on_site: { label: 'On Site', dot: 'bg-blue-500', light: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
  traveling: { label: 'Traveling', dot: 'bg-purple-500', light: 'bg-purple-500/15 text-purple-300 border-purple-500/30' },
};

export default function EngineerBoard() {
  const { user } = useOutletContext();
  const role = user?.role || 'client';
  const qc = useQueryClient();

  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [search, setSearch] = useState('');

  const [form, setForm] = useState({
    staff_id: '',
    department: '',
    phone: '',
    skills: '',
    regions: '',
    status: 'offline',
    profile_photo: '',
  });

  useFormDraft({ key: 'engineer-profile-edit', form: { ...form, profile_photo: '' }, setForm, userId: user?.id || user?.email, enabled: editOpen, storage: 'session', maxAgeMs: 8 * 60 * 60 * 1000 });

  const { data: engineers = [], refetch } = useQuery({
  queryKey: ['engineers-board'],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'engineer')
      .order('full_name', { ascending: true });

    if (error) {
      console.error('Engineer users fetch error:', error);
      return [];
    }

    return (data || []).map((u) => ({
      id: u.id,
      engineer_name: u.full_name || u.email,
      engineer_email: u.email,
      email: u.email,
      phone_number: u.phone || '',
      region: u.region || 'SW',
      assigned_location: u.assigned_location || '',
      status: 'active',
      online_status: 'offline',
      profile_photo: '',
    }));
  },
  refetchInterval: 30000,
});

  const { data: devices = [] } = useQuery({
    queryKey: ['devices'],
    queryFn: async () => {
      const { data, error } = await supabase.from('devices').select('*');

      if (error) {
        console.error(error);
        return [];
      }

      return data || [];
    },
  });

  const { data: statuses = [] } = useQuery({
    queryKey: ['engineer-statuses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('engineer_statuses')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) {
        console.error(error);
        return [];
      }

      return data || [];
    },
    refetchInterval: 15000,
  });

  const { data: tickets = [] } = useQuery({
    queryKey: ['tickets-board'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error(error);
        return [];
      }

      return data || [];
    },
  });

  const myStatus = statuses.find((s) => s.engineer_email === user?.email);

  useEffect(() => {
    if (role !== 'engineer') return;

    if (myStatus) {
      setForm({
        staff_id: myStatus.staff_id || '',
        department: myStatus.department || '',
        phone: myStatus.phone || '',
        skills: myStatus.skills || '',
        regions: myStatus.regions || '',
        status: myStatus.status || 'offline',
        profile_photo: myStatus.profile_photo || '',
      });
    }
  }, [myStatus, role]);

  const upsertStatus = async (data) => {
    if (!user?.email) return;

    const existing = statuses.find((s) => s.engineer_email === user.email);

    const payload = {
      engineer_email: user.email,
      engineer_name: user.full_name || user.email,
      last_active: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...data,
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

    qc.invalidateQueries({ queryKey: ['engineer-statuses'] });
    qc.invalidateQueries({ queryKey: ['engineers-board'] });
  };

  const saveProfile = async () => {
    setSaving(true);

    try {
      await upsertStatus(form);
      await refetch();
      setEditOpen(false);
    } catch (err) {
      console.error(err);
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];

    if (!file) return;

    if (file.size > 800 * 1024) {
      alert('Please choose a smaller image below 800KB.');
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      setForm((f) => ({
        ...f,
        profile_photo: reader.result,
      }));
    };

    reader.readAsDataURL(file);
  };

  const handleGPS = () => {
    if (!navigator.geolocation) {
      alert('GPS is not supported on this device/browser.');
      return;
    }

    setTracking(true);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await upsertStatus({
            current_latitude: pos.coords.latitude,
            current_longitude: pos.coords.longitude,
            tracking_enabled: true,
            location_label:
              pos.coords.latitude.toFixed(4) +
              ', ' +
              pos.coords.longitude.toFixed(4),
          });
        } catch (err) {
          alert(err.message);
        } finally {
          setTracking(false);
        }
      },
      () => {
        setTracking(false);
        alert('Unable to get your location.');
      }
    );
  };

  const merged = engineers.map((eng) => {
    const liveStatus = statuses.find(
      (s) =>
        s.engineer_name === eng.engineer_name ||
        s.engineer_email === eng.email ||
        s.engineer_email === eng.engineer_email
    );

    const deviceCount = devices.filter(
      (d) =>
        d.assigned_engineer === eng.engineer_name ||
        d.assigned_engineer_name === eng.engineer_name ||
        d.assigned_engineer_email === eng.email ||
        d.assigned_engineer_email === eng.engineer_email
    ).length;

    const activeTickets = tickets.filter(
      (t) =>
        (
          t.assigned_to_name === eng.engineer_name ||
          t.assigned_to === eng.email ||
          t.assigned_to === eng.engineer_email
        ) &&
        !['closed', 'resolved'].includes(t.status)
    ).length;

    return {
      ...eng,
      ...liveStatus,
      profile_photo:
        liveStatus?.profile_photo ||
        eng.profile_photo ||
        '',
      deviceCount,
      activeTickets,
    };
  });

  const REGION_COLORS = {
    NORTH: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    SE: 'bg-green-500/15 text-green-300 border-green-500/30',
    SW: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
    'S/SOUTH': 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  };

  const filtered = search
    ? merged.filter((e) =>
        e.engineer_name?.toLowerCase().includes(search.toLowerCase()) ||
        e.region?.toLowerCase().includes(search.toLowerCase()) ||
        e.assigned_location?.toLowerCase().includes(search.toLowerCase()) ||
        e.location_label?.toLowerCase().includes(search.toLowerCase())
      )
    : merged;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-white">
            <Radio className="w-6 h-6 text-[#ff5a00]" />
            Engineer Live Board
          </h1>

          <p className="text-sm text-slate-300 mt-0.5">
            {engineers.length} engineers across all regions
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="border-white/10 text-white hover:bg-white/10"
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            Refresh
          </Button>

          {role === 'engineer' && (
            <Button
              onClick={() => setEditOpen(true)}
              className="bg-[#ff5a00] hover:bg-[#ff5a00]/90 text-white"
            >
              <User className="w-4 h-4 mr-2" />
              My Profile
            </Button>
          )}
        </div>
      </div>

      {role === 'engineer' && (
        <Card className="p-4 bg-[#102969]/90 border border-white/10 text-white">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {Object.entries(ENG_STATUS).map(([key, val]) => (
              <Button
                key={key}
                size="sm"
                variant={form.status === key ? 'default' : 'outline'}
                className={
                  form.status === key
                    ? 'bg-[#ff5a00] hover:bg-[#ff5a00]/90 text-white'
                    : 'border-white/10 text-white hover:bg-white/10'
                }
                onClick={async () => {
                  setForm((f) => ({
                    ...f,
                    status: key,
                  }));

                  await upsertStatus({
                    status: key,
                  });
                }}
              >
                {val.label}
              </Button>
            ))}

            <Button
              size="sm"
              variant="outline"
              onClick={handleGPS}
              disabled={tracking}
              className="border-white/10 text-white hover:bg-white/10"
            >
              <Navigation className="w-4 h-4 mr-1" />
              {tracking ? 'Updating...' : 'Update Location'}
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditOpen(true)}
              className="border-white/10 text-white hover:bg-white/10"
            >
              <Camera className="w-4 h-4 mr-1" />
              Photo
            </Button>
          </div>

          {form.profile_photo && (
            <div className="flex items-center gap-3 mb-3">
              <img
                src={form.profile_photo}
                alt="My profile"
                className="w-14 h-14 rounded-full object-cover border-2 border-[#ff5a00]/40"
              />
              <div>
                <p className="text-sm font-semibold">
                  {user?.full_name || user?.email}
                </p>
                <p className="text-xs text-slate-300">Field Engineer</p>
              </div>
            </div>
          )}

          {myStatus?.location_label && (
            <div className="text-xs text-slate-300">
              Last GPS: {myStatus.location_label}
              {myStatus?.last_active
                ? ` · ${format(new Date(myStatus.last_active), 'MMM d, h:mm a')}`
                : ''}
            </div>
          )}
        </Card>
      )}

      <Input
        placeholder="Search engineer, region, location..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-xs bg-[#102969]/80 border-white/10 text-white placeholder:text-slate-400"
      />

      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((eng) => {
          const sc =
            ENG_STATUS[eng.status || 'offline'] ||
            ENG_STATUS.offline;

          return (
            <Card
              key={eng.id || eng.engineer_email || eng.engineer_name}
              className="p-4 bg-[#102969]/90 border border-white/10 hover:border-[#ff5a00]/30 hover:shadow-[0_0_20px_rgba(255,90,0,0.15)] transition-all text-white"
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="relative flex-shrink-0">
                  <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-[#ff5a00]/40 bg-[#08153d] flex items-center justify-center">
                    {eng.profile_photo ? (
                      <img
                        src={eng.profile_photo}
                        alt={eng.engineer_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="font-bold text-[#ff5a00] text-lg">
                        {(eng.engineer_name || '?')[0]}
                      </span>
                    )}
                  </div>

                  <span
                    className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-[#102969] ${sc.dot}`}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-white">
                    {eng.engineer_name}
                  </p>

                  <p className="text-xs text-slate-300">
                    Field Engineer
                  </p>

                  <div className="flex items-center gap-1.5 mt-1">
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${
                        REGION_COLORS[eng.region] ||
                        'bg-white/10 text-slate-300 border-white/10'
                      }`}
                    >
                      {eng.region || 'No Region'}
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

              <div className="space-y-1.5 text-xs text-slate-300">
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3 h-3 flex-shrink-0 text-[#ff5a00]" />
                  <span className="truncate">
                    {eng.assigned_location ||
                      eng.location_label ||
                      'No location'}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <Wrench className="w-3 h-3 flex-shrink-0 text-[#ff5a00]" />
                  <span>{eng.deviceCount} assigned devices</span>
                </div>

                {eng.activeTickets > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 flex-shrink-0 text-orange-400">
                      !
                    </span>

                    <span className="text-orange-300">
                      {eng.activeTickets} active ticket(s)
                    </span>
                  </div>
                )}

                {(eng.phone_number || eng.phone) && (
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3 h-3 flex-shrink-0 text-[#ff5a00]" />
                    <span>{eng.phone_number || eng.phone}</span>
                  </div>
                )}

                {eng.last_active && (
                  <div className="flex items-center gap-1.5 pt-1 border-t border-white/10">
                    <Clock className="w-3 h-3 flex-shrink-0 text-[#ff5a00]" />
                    <span>
                      Active:{' '}
                      {format(new Date(eng.last_active), 'MMM d, h:mm a')}
                    </span>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg bg-[#102969] border border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>My Engineer Profile</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {form.profile_photo && (
              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#08153d]/60 p-3">
                <img
                  src={form.profile_photo}
                  alt="Profile preview"
                  className="w-16 h-16 rounded-full object-cover border-2 border-[#ff5a00]/40"
                />
                <div>
                  <p className="text-sm font-semibold">Current Photo</p>
                  <p className="text-xs text-slate-300">
                    This photo will show on Engineer Live Board after saving.
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Staff ID</Label>
                <Input
                  value={form.staff_id}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, staff_id: e.target.value }))
                  }
                  className="bg-[#08153d]/80 border-white/10 text-white"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Department</Label>
                <Input
                  value={form.department}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, department: e.target.value }))
                  }
                  className="bg-[#08153d]/80 border-white/10 text-white"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input
                value={form.phone}
                onChange={(e) =>
                  setForm((f) => ({ ...f, phone: e.target.value }))
                }
                className="bg-[#08153d]/80 border-white/10 text-white"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Profile Photo</Label>
              <Input
                type="file"
                accept="image/*"
                className="bg-[#08153d]/80 border-white/10 text-white"
                onChange={handlePhotoSelect}
              />
              <p className="text-[11px] text-slate-400">
                Choose a photo below 800KB.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Skills</Label>
              <Input
                value={form.skills}
                onChange={(e) =>
                  setForm((f) => ({ ...f, skills: e.target.value }))
                }
                className="bg-[#08153d]/80 border-white/10 text-white"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, status: v }))
                }
              >
                <SelectTrigger className="bg-[#08153d]/80 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  {Object.entries(ENG_STATUS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              className="w-full bg-[#ff5a00] hover:bg-[#ff5a00]/90 text-white"
              onClick={saveProfile}
              disabled={saving}
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Profile
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
