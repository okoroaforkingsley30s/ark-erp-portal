import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Navigation, MapPin, Clock, Loader2, Play, StopCircle, Wrench, Building2, CalendarDays, Cpu, AlertTriangle, Users } from 'lucide-react';
import { format, differenceInMinutes } from 'date-fns';

const REGION_COLORS = {
  NORTH: 'bg-blue-100 text-blue-800',
  SE: 'bg-green-100 text-green-800',
  SW: 'bg-yellow-100 text-yellow-800',
  'S/SOUTH': 'bg-purple-100 text-purple-800',
};

export default function FieldOperations() {
  const { user } = useOutletContext();
  const role = user?.role || 'engineer';
  const qc = useQueryClient();

  const [checkingIn, setCheckingIn] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutForm, setCheckoutForm] = useState({ work_done: '', parts_used: '' });
  const [saving, setSaving] = useState(false);
  const [filterRegion, setFilterRegion] = useState('all');
  const [filterEngineer, setFilterEngineer] = useState('all');

  const { data: engineers = [] } = useQuery({
    queryKey: ['engineers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('engineers')
        .select('*')
        .order('engineer_name', { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });

  const { data: devices = [] } = useQuery({
    queryKey: ['devices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('devices')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  const { data: visits = [] } = useQuery({
    queryKey: ['site-visits'],
    queryFn: async () => {
      let query = supabase
        .from('site_visits')
        .select('*')
        .order('created_at', { ascending: false });

      if (role === 'engineer' && user?.email) {
        query = query.eq('engineer_email', user.email);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000,
  });

  const { data: engineerStatuses = [] } = useQuery({
    queryKey: ['engineer-statuses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('engineer_statuses')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  const { data: tickets = [] } = useQuery({
    queryKey: ['tickets-fieldops'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  const activeVisits = visits.filter(v => v.status === 'active');
  const myActiveVisit = visits.find(v => v.engineer_email === user?.email && v.status === 'active');

  const regionalData = useMemo(() => {
    const regions = ['NORTH', 'SE', 'SW', 'S/SOUTH'];

    return regions.map(region => {
      const regionEngineers = engineers.filter(e => e.region === region);

      const assignedDevices = devices.filter(d =>
        regionEngineers.some(e => e.engineer_name === d.assigned_engineer)
      );

      const activeDevices = assignedDevices.filter(d =>
        d.device_status === 'Active' || d.status === 'operational' || d.status === 'active'
      ).length;

      const faultyDevices = assignedDevices.filter(d =>
        d.device_status === 'Faulty' ||
        d.device_status === 'Under Maintenance' ||
        d.status === 'faulty' ||
        d.status === 'under_maintenance'
      ).length;

      const openTickets = tickets.filter(t =>
        regionEngineers.some(e => e.engineer_name === t.assigned_to_name) &&
        !['closed', 'resolved'].includes(t.status)
      ).length;

      const slaRisk = assignedDevices.filter(d =>
        ['Warning', 'Breached', 'Critical'].includes(d.sla_status)
      ).length;

      return {
        region,
        engineers: regionEngineers,
        deviceCount: assignedDevices.length,
        activeDevices,
        faultyDevices,
        openTickets,
        slaRisk,
      };
    });
  }, [engineers, devices, tickets]);

  const engineerWorkloads = useMemo(() => {
    return engineers
      .filter(e => filterEngineer === 'all' || e.engineer_name === filterEngineer)
      .filter(e => filterRegion === 'all' || e.region === filterRegion)
      .map(eng => {
        const assignedDevices = devices.filter(d => d.assigned_engineer === eng.engineer_name);

        const faultyDevices = assignedDevices.filter(d =>
          d.device_status === 'Faulty' ||
          d.device_status === 'Under Maintenance' ||
          d.status === 'faulty' ||
          d.status === 'under_maintenance'
        );

        const openTickets = tickets.filter(t =>
          t.assigned_to_name === eng.engineer_name &&
          !['closed', 'resolved'].includes(t.status)
        );

        const slaRisk = assignedDevices.filter(d =>
          ['Warning', 'Breached', 'Critical'].includes(d.sla_status)
        ).length;

        return {
          ...eng,
          assignedDevices,
          faultyDevices,
          openTickets,
          slaRisk,
        };
      });
  }, [engineers, devices, tickets, filterRegion, filterEngineer]);

  const getGPS = () =>
    new Promise(resolve => {
      if (!navigator.geolocation) return resolve(null);

      navigator.geolocation.getCurrentPosition(
        pos => resolve(pos.coords),
        () => resolve(null),
        { timeout: 5000 }
      );
    });

  const handleCheckIn = async branchKey => {
    setCheckingIn(true);

    try {
      const coords = await getGPS();
      const now = new Date().toISOString();

      const { error: visitError } = await supabase
        .from('site_visits')
        .insert([
          {
            engineer_email: user.email,
            engineer_name: user.full_name || user.name || user.email,
            site_name: branchKey,
            checkin_time: now,
            checkin_lat: coords?.latitude || null,
            checkin_lng: coords?.longitude || null,
            status: 'active',
          },
        ]);

      if (visitError) throw visitError;

      const myStatusRec = engineerStatuses.find(s => s.engineer_email === user.email);

      const statusData = {
        engineer_email: user.email,
        engineer_name: user.full_name || user.name || user.email,
        status: 'on_site',
        current_site_name: branchKey,
        checkin_time: now,
        last_active: now,
        current_latitude: coords?.latitude || null,
        current_longitude: coords?.longitude || null,
      };

      if (myStatusRec) {
        const { error } = await supabase
          .from('engineer_statuses')
          .update(statusData)
          .eq('id', myStatusRec.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('engineer_statuses')
          .insert([statusData]);

        if (error) throw error;
      }

      qc.invalidateQueries({ queryKey: ['site-visits'] });
      qc.invalidateQueries({ queryKey: ['engineer-statuses'] });
    } catch (err) {
      console.error('Check-in failed:', err);
      alert('Check-in failed: ' + (err?.message || 'Unknown error'));
    } finally {
      setCheckingIn(false);
    }
  };

  const handleCheckOut = async () => {
    if (!myActiveVisit) return;

    setSaving(true);

    try {
      const now = new Date();

      const duration = differenceInMinutes(
        now,
        new Date(myActiveVisit.checkin_time)
      );

      const { error: visitError } = await supabase
        .from('site_visits')
        .update({
          checkout_time: now.toISOString(),
          duration_minutes: duration,
          work_done: checkoutForm.work_done,
          parts_used: checkoutForm.parts_used,
          status: 'completed',
        })
        .eq('id', myActiveVisit.id);

      if (visitError) throw visitError;

      const myStatusRec = engineerStatuses.find(s => s.engineer_email === user.email);

      if (myStatusRec) {
        const { error } = await supabase
          .from('engineer_statuses')
          .update({
            status: 'online',
            current_site_name: null,
            checkin_time: null,
            last_active: now.toISOString(),
          })
          .eq('id', myStatusRec.id);

        if (error) throw error;
      }

      qc.invalidateQueries({ queryKey: ['site-visits'] });
      qc.invalidateQueries({ queryKey: ['engineer-statuses'] });

      setCheckoutOpen(false);
      setCheckoutForm({ work_done: '', parts_used: '' });
    } catch (err) {
      console.error('Check-out failed:', err);
      alert('Check-out failed: ' + (err?.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const fmt = mins => {
    if (!mins) return '-';

    const h = Math.floor(mins / 60);
    const m = mins % 60;

    return h > 0 ? h + 'h ' + m + 'm' : m + 'm';
  };

  const myBranches = useMemo(() => {
    const myEng = engineers.find(
      e => e.email === user?.email || e.engineer_name === user?.full_name
    );

    if (!myEng) return [];

    return [
      ...new Set(
        devices
          .filter(d => d.assigned_engineer === myEng.engineer_name)
          .map(d => d.branch_name || d.branch_location || d.site_name)
          .filter(Boolean)
      ),
    ];
  }, [engineers, devices, user]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2 text-white">
          <Navigation className="w-6 h-6 text-primary" />
          Field Operations
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Regional coverage, engineer workloads, and field activity
        </p>
      </div>

      {myActiveVisit && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse" />
            <div>
              <p className="font-semibold text-blue-800">
                Currently On Site: {myActiveVisit.site_name}
              </p>
              <p className="text-xs text-blue-600">
                Checked in at {format(new Date(myActiveVisit.checkin_time), 'h:mm a')} · {differenceInMinutes(new Date(), new Date(myActiveVisit.checkin_time))} min ago
              </p>
            </div>
          </div>

          <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={() => setCheckoutOpen(true)}>
            <StopCircle className="w-4 h-4 mr-2" />
            Check Out
          </Button>
        </div>
      )}

      {(role === 'admin' || role === 'helpdesk' || role === 'manager') && activeVisits.length > 0 && (
        <Card className="p-4">
          <h2 className="font-semibold mb-3 flex items-center gap-2 text-sm">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            Active Field Operations ({activeVisits.length})
          </h2>

          <div className="space-y-3">
            {activeVisits.map(v => (
              <div key={v.id} className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-green-700">
                    {(v.engineer_name || '?')[0]}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{v.engineer_name}</p>
                  <p className="text-xs text-muted-foreground">
                    @ {v.site_name} · Since {format(new Date(v.checkin_time), 'h:mm a')}
                  </p>
                </div>

                <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300 text-[10px]">
                  {differenceInMinutes(new Date(), new Date(v.checkin_time))} min
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {role !== 'engineer' && (
        <div>
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-muted-foreground" />
            Regional Coverage
          </h2>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {regionalData.map(r => (
              <Card key={r.region} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${REGION_COLORS[r.region] || 'bg-muted text-muted-foreground'}`}>
                    {r.region}
                  </span>

                  {r.slaRisk > 0 && (
                    <Badge variant="destructive" className="text-[9px]">
                      {r.slaRisk} SLA
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-1 text-center text-xs">
                  <div>
                    <p className="font-bold text-base">{r.engineers.length}</p>
                    <p className="text-muted-foreground">Engineers</p>
                  </div>

                  <div>
                    <p className="font-bold text-base">{r.deviceCount}</p>
                    <p className="text-muted-foreground">Devices</p>
                  </div>

                  <div>
                    <p className="font-bold text-base text-green-600">{r.activeDevices}</p>
                    <p className="text-muted-foreground">Active</p>
                  </div>

                  <div>
                    <p className={`font-bold text-base ${r.openTickets > 0 ? 'text-orange-600' : ''}`}>
                      {r.openTickets}
                    </p>
                    <p className="text-muted-foreground">Tickets</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {role !== 'engineer' && (
        <div>
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <h2 className="font-semibold flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              Engineer Work Orders
            </h2>

            <Select value={filterRegion} onValueChange={setFilterRegion}>
              <SelectTrigger className="w-32 h-8 text-xs">
                <SelectValue placeholder="Region" />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="all">All Regions</SelectItem>
                {['NORTH', 'SE', 'SW', 'S/SOUTH'].map(r => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterEngineer} onValueChange={setFilterEngineer}>
              <SelectTrigger className="w-44 h-8 text-xs">
                <SelectValue placeholder="Engineer" />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="all">All Engineers</SelectItem>
                {engineers.map(e => (
                  <SelectItem key={e.id} value={e.engineer_name}>
                    {e.engineer_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            {engineerWorkloads.map(eng => (
              <Card key={eng.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="font-bold text-primary text-sm">
                        {(eng.engineer_name || '?')[0]}
                      </span>
                    </div>

                    <div>
                      <p className="font-semibold text-sm">{eng.engineer_name}</p>

                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${REGION_COLORS[eng.region] || 'bg-muted text-muted-foreground'}`}>
                          {eng.region}
                        </span>

                        <span className="text-xs text-muted-foreground">
                          {eng.assigned_location}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="flex items-center gap-1 bg-muted px-2 py-1 rounded">
                      <Cpu className="w-3 h-3" />
                      {eng.assignedDevices.length} devices
                    </span>

                    {eng.faultyDevices.length > 0 && (
                      <span className="flex items-center gap-1 bg-red-500/15 text-red-300 px-2 py-1 rounded border border-red-200">
                        <AlertTriangle className="w-3 h-3" />
                        {eng.faultyDevices.length} faulty
                      </span>
                    )}

                    {eng.openTickets.length > 0 && (
                      <span className="flex items-center gap-1 bg-orange-50 text-orange-700 px-2 py-1 rounded border border-orange-200">
                        <Wrench className="w-3 h-3" />
                        {eng.openTickets.length} open tickets
                      </span>
                    )}

                    {eng.slaRisk > 0 && (
                      <span className="flex items-center gap-1 bg-red-100 text-red-800 px-2 py-1 rounded border border-red-300 font-medium">
                        {eng.slaRisk} SLA risk
                      </span>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {role === 'engineer' && !myActiveVisit && (
        <Card className="p-4">
          <h2 className="font-semibold mb-3">Check In to a Branch</h2>

          {myBranches.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No assigned branches found. Contact admin.
            </p>
          ) : (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {myBranches.map(branch => (
                <div key={branch} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{branch}</p>
                  </div>

                  <Button size="sm" className="ml-2 flex-shrink-0" onClick={() => handleCheckIn(branch)} disabled={checkingIn}>
                    {checkingIn ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Play className="w-3 h-3 mr-1" />
                    )}
                    Check In
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      <div>
        <h2 className="font-semibold mb-3 flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-muted-foreground" />
          Visit History
        </h2>

        <div className="space-y-3">
          {visits.filter(v => v.status === 'completed').map(v => (
            <Card key={v.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                  </div>

                  <div>
                    <p className="font-semibold text-sm">{v.site_name}</p>

                    {role !== 'engineer' && (
                      <p className="text-xs text-muted-foreground">
                        Engineer: {v.engineer_name}
                      </p>
                    )}

                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {format(new Date(v.checkin_time), 'MMM d, h:mm a')}
                      </span>

                      {v.duration_minutes && (
                        <span className="flex items-center gap-1">
                          <Wrench className="w-3 h-3" />
                          {fmt(v.duration_minutes)}
                        </span>
                      )}
                    </div>

                    {v.work_done && (
                      <p className="text-xs mt-1 text-muted-foreground">
                        Work: {v.work_done}
                      </p>
                    )}

                    {v.parts_used && (
                      <p className="text-xs text-muted-foreground">
                        Parts: {v.parts_used}
                      </p>
                    )}
                  </div>
                </div>

                {v.checkin_lat && v.checkin_lng && (
                  <a href={`https://www.google.com/maps?q=${v.checkin_lat},${v.checkin_lng}`} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm">
                      <MapPin className="w-3 h-3 mr-1" />
                      Map
                    </Button>
                  </a>
                )}
              </div>
            </Card>
          ))}

          {visits.filter(v => v.status === 'completed').length === 0 && (
            <div className="text-center py-10 text-muted-foreground">
              <Navigation className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No completed visits yet</p>
            </div>
          )}
        </div>
      </div>

      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Check Out from Site</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Work Performed *</Label>

              <Textarea
                value={checkoutForm.work_done}
                onChange={e => setCheckoutForm(f => ({ ...f, work_done: e.target.value }))}
                placeholder="Describe work completed..."
                className="h-24"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Parts Used</Label>

              <Input
                value={checkoutForm.parts_used}
                onChange={e => setCheckoutForm(f => ({ ...f, parts_used: e.target.value }))}
                placeholder="e.g. Thermal paste, USB module"
              />
            </div>

            <Button className="w-full bg-red-600 hover:bg-red-700 text-white" onClick={handleCheckOut} disabled={!checkoutForm.work_done || saving}>
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <StopCircle className="w-4 h-4 mr-2" />
              )}
              Confirm Check Out
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}