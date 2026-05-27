import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Plus,
  Search,
  Monitor,
  Server,
  Printer,
  Laptop,
  Wifi,
  Zap,
  HelpCircle,
  Pencil,
  Trash2,
  Loader2,
  MapPin,
  Building2,
  Tag,
  Cpu,
  User,
} from 'lucide-react';

import { toast } from 'sonner';

const categoryIcons = {
  server: Server,
  workstation: Monitor,
  laptop: Laptop,
  printer: Printer,
  network_device: Wifi,
  ups: Zap,
  other: HelpCircle,
  atm: Cpu,
  card_printer: Printer,
  kiosk: Monitor,
  pos_terminal: Tag,
  deposit_machine: Building2,
  cash_recycler: Building2,
};

const statusColors = {
  operational: 'bg-green-100 text-green-700 border-green-200',
  under_maintenance: 'bg-amber-100 text-amber-700 border-amber-200',
  faulty: 'bg-red-100 text-red-700 border-red-200',
  decommissioned: 'bg-slate-100 text-slate-500 border-slate-200',
  Active: 'bg-green-100 text-green-700 border-green-200',
  'Under Maintenance': 'bg-amber-100 text-amber-700 border-amber-200',
  Faulty: 'bg-red-100 text-red-700 border-red-200',
  Inactive: 'bg-slate-100 text-slate-500 border-slate-200',
};

const emptyForm = {
  name: '',
  brand: '',
  serial_number: '',
  model: '',
  category: 'workstation',
  location: '',
  department: '',
  status: 'operational',
  ip_address: '',
  purchase_date: '',
  warranty_expiry: '',
  notes: '',
};

export default function Machines() {
  const { user } = useOutletContext() || {};

  const isAdmin = ['admin', 'super_admin', 'manager'].includes(user?.role);

  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const { data: machines = [], isLoading: loadingMachines } = useQuery({
    queryKey: ['machines'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('machines')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data || [];
    },
  });

  const { data: devices = [], isLoading: loadingDevices } = useQuery({
    queryKey: ['devices-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('devices')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data || [];
    },
  });

  const { data: engineers = [] } = useQuery({
    queryKey: ['engineers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('engineers')
        .select('*');

      if (error) throw error;

      return data || [];
    },
  });

  const allMachines = useMemo(() => {
    const fromMachines = machines.map((m) => ({
      ...m,
      _source: 'machine',
    }));

    const serialsInMachines = new Set(
      machines.map((m) => m.serial_number).filter(Boolean)
    );

    const fromDevices = devices
      .filter((d) => !serialsInMachines.has(d.serial_number))
      .map((d) => ({
        ...d,
        _source: 'device',
        location: d.branch_location || d.site_name || '',
        department: d.client_name || '',
      }));

    return [...fromMachines, ...fromDevices];
  }, [machines, devices]);

  const filtered = allMachines.filter((m) => {
    if (categoryFilter !== 'all' && m.category !== categoryFilter) {
      return false;
    }

    if (statusFilter !== 'all' && m.status !== statusFilter) {
      return false;
    }

    if (search) {
      const s = search.toLowerCase();

      return (
        m.name?.toLowerCase().includes(s) ||
        m.brand?.toLowerCase().includes(s) ||
        m.serial_number?.toLowerCase().includes(s) ||
        m.location?.toLowerCase().includes(s) ||
        m.department?.toLowerCase().includes(s) ||
        m.model?.toLowerCase().includes(s)
      );
    }

    return true;
  });

  const handleSave = async () => {
    setSaving(true);

    try {
      if (editing) {
        const table = editing._source === 'device'
          ? 'devices'
          : 'machines';

        const { error } = await supabase
          .from(table)
          .update(form)
          .eq('id', editing.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('machines')
          .insert([form]);

        if (error) throw error;
      }

      queryClient.invalidateQueries({
        queryKey: ['machines'],
      });

      queryClient.invalidateQueries({
        queryKey: ['devices-all'],
      });

      setForm(emptyForm);
      setEditing(null);
      setDialogOpen(false);

      toast.success(
        editing ? 'Machine updated' : 'Machine added'
      );
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (m) => {
    setEditing(m);

    setForm({
      name: m.name || '',
      brand: m.brand || '',
      serial_number: m.serial_number || '',
      model: m.model || '',
      category: m.category || 'workstation',
      location: m.location || '',
      department: m.department || '',
      status: m.status || 'operational',
      ip_address: m.ip_address || '',
      purchase_date:
        m.purchase_date || m.installation_date || '',
      warranty_expiry: m.warranty_expiry || '',
      notes: m.notes || '',
    });

    setDialogOpen(true);
  };

  const handleDelete = async (m) => {
    try {
      const table =
        m._source === 'device'
          ? 'devices'
          : 'machines';

      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', m.id);

      if (error) throw error;

      queryClient.invalidateQueries({
        queryKey: ['machines'],
      });

      queryClient.invalidateQueries({
        queryKey: ['devices-all'],
      });

      setDeleteConfirm(null);

      toast.success('Machine deleted');
    } catch (e) {
      toast.error(e.message);
    }
  };

  const isLoading = loadingMachines || loadingDevices;

  const operationalCount = allMachines.filter(
    (m) => m.status === 'operational'
  ).length;

  const faultyCount = allMachines.filter(
    (m) => m.status === 'faulty'
  ).length;

  const maintenanceCount = allMachines.filter(
    (m) => m.status === 'under_maintenance'
  ).length;

  return (
    <div className="space-y-5">
      {/* keep the rest of your existing JSX exactly the same */}
    </div>
  );
}