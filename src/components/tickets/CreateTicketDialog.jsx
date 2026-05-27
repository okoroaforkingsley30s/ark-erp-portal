import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { Loader2, Upload } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

const STAFF_ROLES = [
  'admin',
  'helpdesk',
  'manager',
  'agm',
  'repair_head',
  'ceo',
  'engineer',
  'supervisor',
  'hr',
  'inventory',
  'procurement',
];

const EMPTY_FORM = {
  bank_name: '',
  branch_name: '',
  terminal_id: '',
  device_name: '',
  assigned_to_name: '',
  assigned_to: '',
  sla_level: 'standard',

  title: '',
  description: '',
  category: 'hardware',
  priority: 'medium',
};

const generateTicketId = () => {
  const date = new Date();
  const stamp = date.toISOString().slice(0, 10).replaceAll('-', '');
  const random = Math.floor(1000 + Math.random() * 9000);
  return `TCK-${stamp}-${random}`;
};

const getDeviceBranch = (device) => device.branch_name || device.branch || device.location || '';
const getDeviceTerminalId = (device) => (
  device.atm_terminal_id ||
  device.terminal_id ||
  device.device_id ||
  device.id ||
  ''
).toString();
const getDeviceName = (device) => device.device_name || device.machine_name || device.name || device.branch_name || 'Device';
const getAssignedEngineer = (device, engineers) => {
  const assigned = device.assigned_engineer_email || device.assigned_to || device.assigned_engineer || '';
  if (!assigned) return null;

  const match = engineers.find((engineer) => (
    engineer.email === assigned ||
    engineer.full_name === assigned ||
    engineer.engineer_name === assigned
  ));

  return {
    email: match?.email || (assigned.includes('@') ? assigned : ''),
    name: match?.full_name || match?.engineer_name || assigned,
  };
};

export default function CreateTicketDialog({ open, onOpenChange, user }) {
  const [form, setForm] = useState(EMPTY_FORM);

  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const isStaff = STAFF_ROLES.includes(user?.role);

  const { data: devices = [] } = useQuery({
    queryKey: ['devices-for-ticket'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('devices')
        .select('*')
        .order('bank_name', { ascending: true });

      if (error) {
        console.error('DEVICES LOAD ERROR:', error);
        return [];
      }

      return data || [];
    },
    enabled: isStaff,
  });

  const { data: engineers = [] } = useQuery({
    queryKey: ['engineers-for-ticket'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'engineer')
        .order('full_name', { ascending: true });

      if (error) {
        console.error('ENGINEERS LOAD ERROR:', error);
        return [];
      }

      return data || [];
    },
    enabled: isStaff,
  });

  const banks = useMemo(() => {
    const unique = [...new Set(devices.map(d => d.bank_name).filter(Boolean))];
    return unique.map(name => ({ id: name, bank_name: name }));
  }, [devices]);

  const branches = useMemo(() => {
    const filtered = form.bank_name
      ? devices.filter(d => d.bank_name === form.bank_name)
      : devices;

    const unique = [...new Set(filtered.map(getDeviceBranch).filter(Boolean))];

    return unique.map(name => ({
      id: name,
      branch_name: name,
      bank_name: form.bank_name,
    }));
  }, [devices, form.bank_name]);

  const filteredDevices = useMemo(() => {
    return devices.filter(d => {
      const deviceBranch = getDeviceBranch(d);

      if (form.bank_name && d.bank_name !== form.bank_name) return false;
      if (form.branch_name && deviceBranch !== form.branch_name) return false;

      return true;
    });
  }, [devices, form.bank_name, form.branch_name]);

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
  e.preventDefault();

  if (!user?.email) {
    alert('You must be logged in to create a ticket.');
    return;
  }

  setSaving(true);

  try {
    const ticketNumber = generateTicketId();

    const attachments = files.map(file => ({
      name: file.name,
      type: file.type,
      size: file.size,
    }));

    const ticketData = {
      title: form.title.trim(),
      description: form.description.trim(),

      category: form.category,
      priority: form.priority,

      ticket_id: ticketNumber,
      ticket_number: ticketNumber,

      client_email: user.email,
      client_name: user.full_name || user.email,

      status: form.assigned_to ? 'assigned' : 'new',

      attachments,

      department: user.department || '',

      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (isStaff) {
      ticketData.bank_name = form.bank_name || null;
      ticketData.branch_name = form.branch_name || null;
      ticketData.terminal_id = form.terminal_id || null;
      ticketData.device_name = form.device_name || null;
      ticketData.assigned_to_name = form.assigned_to_name || null;
      ticketData.assigned_to = form.assigned_to || null;
      ticketData.sla_level = form.sla_level || 'standard';
    }

    const { error } = await supabase
      .from('tickets')
      .insert(ticketData)
      .select('id')
      .single();

    if (error) {
      alert('Ticket creation failed: ' + error.message);
      return;
    }

    queryClient.invalidateQueries({ queryKey: ['tickets'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['tickets-dashboard'] });

    alert('Ticket created successfully');

    setForm(EMPTY_FORM);
    setFiles([]);
    onOpenChange(false);

  } catch (err) {
    console.error(err);
    alert('Unexpected error creating ticket.');
  } finally {
    setSaving(false);
  }
};

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Support Ticket</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isStaff && (
            <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Device Information
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Bank</Label>
                  <Select
                    value={form.bank_name}
                    onValueChange={(v) => {
                      f('bank_name', v);
                      f('branch_name', '');
                      f('terminal_id', '');
                      f('device_name', '');
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select bank..." />
                    </SelectTrigger>
                    <SelectContent>
                      {banks.map((b) => (
                        <SelectItem key={b.id} value={b.bank_name}>
                          {b.bank_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Branch / Location</Label>
                  <Select
                    value={form.branch_name}
                    onValueChange={(v) => {
                      f('branch_name', v);
                      f('terminal_id', '');
                      f('device_name', '');
                    }}
                    disabled={!form.bank_name}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select branch..." />
                    </SelectTrigger>
                    <SelectContent>
                      {branches.map((b) => (
                        <SelectItem key={b.id} value={b.branch_name}>
                          {b.branch_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Device / Terminal</Label>
                <Select
                  value={form.terminal_id}
                  onValueChange={(v) => {
                    const dev = filteredDevices.find(d => getDeviceTerminalId(d) === v);
                    const assignedEngineer = dev ? getAssignedEngineer(dev, engineers) : null;

                    f('terminal_id', v);
                    f('device_name', dev ? getDeviceName(dev) : '');

                    if (assignedEngineer) {
                      f('assigned_to', assignedEngineer.email);
                      f('assigned_to_name', assignedEngineer.name);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select device..." />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredDevices.map((d) => {
                      const value = getDeviceTerminalId(d);
                      const label = `${getDeviceName(d)} ${value ? `(${value})` : ''}`;

                      return (
                        <SelectItem key={d.id} value={value}>
                          {label}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Title *</Label>
            <Input
              required
              placeholder="Brief description of the issue"
              value={form.title}
              onChange={(e) => f('title', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Description *</Label>
            <Textarea
              required
              placeholder="Provide detailed information about the issue..."
              className="h-24"
              value={form.description}
              onChange={(e) => f('description', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => f('category', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hardware">Hardware</SelectItem>
                  <SelectItem value="software">Software</SelectItem>
                  <SelectItem value="network">Network</SelectItem>
                  <SelectItem value="security">Security</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="installation">Installation</SelectItem>
                  <SelectItem value="consultation">Consultation</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => f('priority', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {isStaff && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Assign Engineer</Label>
                <Select
                  value={form.assigned_to}
                  onValueChange={(v) => {
                    const eng = engineers.find(e => e.email === v);
                    f('assigned_to', v);
                    f('assigned_to_name', eng?.full_name || v);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select engineer..." />
                  </SelectTrigger>
                  <SelectContent>
                    {engineers.map((e) => (
                      <SelectItem key={e.id} value={e.email}>
                        {e.full_name || e.email} — {e.department || 'Engineer'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>SLA Level</Label>
                <Select value={form.sla_level} onValueChange={(v) => f('sla_level', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Attachments / Photos</Label>
            <label className="flex items-center gap-2 p-3 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary/50 transition-colors">
              <Upload className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {files.length > 0 ? `${files.length} file(s) selected` : 'Click to upload files or photos'}
              </span>
              <input
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx"
                className="hidden"
                onChange={(e) => setFiles(Array.from(e.target.files))}
              />
            </label>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>

            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Ticket
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
