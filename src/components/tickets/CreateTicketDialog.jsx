import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { Loader2, Upload } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { createNotification } from '@/lib/createNotification';

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

const getDeviceBranch = (device) =>
  device.branch_name || device.branch || device.location || '';

const getDeviceTerminalId = (device) =>
  (
    device.atm_terminal_id ||
    device.terminal_id ||
    device.device_id ||
    device.id ||
    ''
  ).toString();

const getDeviceName = (device) =>
  device.device_name ||
  device.machine_name ||
  device.name ||
  device.branch_name ||
  'Device';

const getAssignedEngineer = (device, engineers) => {
  const assigned =
    device.assigned_engineer_email ||
    device.assigned_to ||
    device.assigned_engineer ||
    '';

  if (!assigned) return null;

  const match = engineers.find(
    (engineer) =>
      engineer.email === assigned ||
      engineer.full_name === assigned ||
      engineer.engineer_name === assigned
  );

  return {
    email: match?.email || (assigned.includes('@') ? assigned : ''),
    name: match?.full_name || match?.engineer_name || assigned,
  };
};

export default function CreateTicketDialog({ open, onOpenChange, user, initialDraft, onCreated }) {
  const draftKey = `ark_one_create_ticket_draft_${user?.email || 'guest'}`;

  const [form, setForm] = useState(EMPTY_FORM);
  const [files, setFiles] = useState([]);
  const [fileNames, setFileNames] = useState([]);
  const [saving, setSaving] = useState(false);
  const [branchSearch, setBranchSearch] = useState('');

  const queryClient = useQueryClient();
  const isStaff = STAFF_ROLES.includes(user?.role);

  useEffect(() => {
    if (!open) return;

    if (initialDraft?.form) {
      setForm({ ...EMPTY_FORM, ...initialDraft.form });
      setBranchSearch(initialDraft.form.branch_name || '');
      setFileNames(
        Array.isArray(initialDraft.attachments)
          ? initialDraft.attachments.map((attachment) => attachment.filename || attachment.name).filter(Boolean)
          : [],
      );
      return;
    }

    try {
      localStorage.removeItem(draftKey);
      const saved = sessionStorage.getItem(draftKey);
      if (!saved) return;

      const parsed = JSON.parse(saved);

      const savedAt = new Date(parsed?.savedAt || 0).getTime();
      if (!savedAt || Date.now() - savedAt > 2 * 60 * 60 * 1000) {
        sessionStorage.removeItem(draftKey);
        return;
      }

      if (parsed?.form) setForm({ ...EMPTY_FORM, ...parsed.form });
      if (parsed?.branchSearch) setBranchSearch(parsed.branchSearch);
      if (Array.isArray(parsed?.fileNames)) setFileNames(parsed.fileNames);
    } catch (error) {
      console.warn('Could not restore ticket draft:', error);
    }
  }, [open, draftKey, initialDraft]);

  useEffect(() => {
    if (!open) return;

    const payload = {
      form,
      branchSearch,
      fileNames,
      savedAt: new Date().toISOString(),
    };

    sessionStorage.setItem(draftKey, JSON.stringify(payload));
  }, [open, draftKey, form, branchSearch, fileNames]);

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
    const unique = [...new Set(devices.map((d) => d.bank_name).filter(Boolean))];
    return unique.map((name) => ({ id: name, bank_name: name }));
  }, [devices]);

  const branches = useMemo(() => {
    const filtered = form.bank_name
      ? devices.filter((d) => d.bank_name === form.bank_name)
      : devices;

    const unique = [...new Set(filtered.map(getDeviceBranch).filter(Boolean))];

    return unique.map((name) => ({
      id: name,
      branch_name: name,
      bank_name: form.bank_name,
    }));
  }, [devices, form.bank_name]);

  const filteredBranches = useMemo(() => {
    const q = branchSearch.trim().toLowerCase();

    if (!q) return branches.slice(0, 30);

    return branches
      .filter((branch) => branch.branch_name?.toLowerCase().includes(q))
      .slice(0, 30);
  }, [branches, branchSearch]);

  const filteredDevices = useMemo(() => {
    return devices.filter((d) => {
      const deviceBranch = getDeviceBranch(d);

      if (form.bank_name && d.bank_name !== form.bank_name) return false;
      if (form.branch_name && deviceBranch !== form.branch_name) return false;

      return true;
    });
  }, [devices, form.bank_name, form.branch_name]);

  const f = (key, value) => {
    setForm((previous) => ({ ...previous, [key]: value }));
  };

  const clearDraft = () => {
    sessionStorage.removeItem(draftKey);
    localStorage.removeItem(draftKey);
    setForm(EMPTY_FORM);
    setBranchSearch('');
    setFiles([]);
    setFileNames([]);
  };

  const handleCancel = () => {
    const hasDraft =
      form.title ||
      form.description ||
      form.bank_name ||
      form.branch_name ||
      form.terminal_id ||
      form.assigned_to ||
      files.length > 0;

    if (hasDraft) {
      const ok = window.confirm(
        'You have unsaved ticket details. Do you want to close and clear this draft?'
      );

      if (!ok) return;
    }

    clearDraft();
    onOpenChange(false);
  };

  const handleDialogOpenChange = (nextOpen) => {
    if (nextOpen) {
      onOpenChange(true);
      return;
    }

    // Prevent parent/dialog from closing accidentally.
    // Only Cancel button or successful ticket creation can close it.
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!user?.email) {
      alert('You must be logged in to create a ticket.');
      return;
    }

    if (!form.title.trim()) {
      alert('Please enter ticket title.');
      return;
    }

    if (!form.description.trim()) {
      alert('Please enter ticket description.');
      return;
    }

    setSaving(true);

    try {
      const now = new Date().toISOString();
      const ticketNumber = generateTicketId();

      const attachments = [
        ...files.map((file) => ({ name: file.name, type: file.type, size: file.size })),
        ...(Array.isArray(initialDraft?.attachments)
          ? initialDraft.attachments.map((attachment) => ({
              name: attachment.filename || attachment.name,
              type: attachment.mime_type || attachment.type,
              size: attachment.size || 0,
              source: 'official_mail',
              source_email_id: initialDraft.emailId,
              source_attachment_id: attachment.attachment_id,
            }))
          : []),
      ];

      const ticketData = {
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category,
        priority: form.priority,
        ticket_id: ticketNumber,
        ticket_number: ticketNumber,
        client_email: user.email,
        client_name: user.full_name || user.name || user.email,
        status: form.assigned_to ? 'assigned' : 'new',
        attachments,
        department: user.department || '',
        created_at: now,
        updated_at: now,
        last_action_at: now,
      };

      if (isStaff) {
        ticketData.bank_name = form.bank_name || null;
        ticketData.branch_name = form.branch_name || null;
        ticketData.terminal_id = form.terminal_id || null;
        ticketData.device_name = form.device_name || null;
        ticketData.assigned_to_name = form.assigned_to_name || null;
        ticketData.assigned_to = form.assigned_to || null;
        ticketData.assigned_engineer_email = form.assigned_to || null;
        ticketData.sla_level = form.sla_level || 'standard';

        if (form.assigned_to) {
          ticketData.assigned_at = now;
        }
      }

      const { data: insertedTicket, error } = await supabase
        .from('tickets')
        .insert(ticketData)
        .select()
        .single();

      if (error) {
        alert('Ticket creation failed: ' + error.message);
        return;
      }

      if (form.assigned_to) {
        await createNotification({
          userEmail: form.assigned_to,
          title: 'New Ticket Assigned',
          message: `You have been assigned ticket ${ticketNumber}.`,
          type: 'ticket_assigned',
          link: `/tickets/${insertedTicket.id}`,
          sound: 'bell',
          data: {
            ticket_id: insertedTicket?.id,
            ticket_number: ticketNumber,
            bank_name: form.bank_name,
            branch_name: form.branch_name,
          },
        });
      }

      await createNotification({
        userEmail: user.email,
        title: 'Ticket Created',
        message: `Your support ticket ${ticketNumber} was created successfully.`,
        type: 'ticket_created',
        link: '/tickets',
        sound: 'bell',
        data: {
          ticket_id: insertedTicket?.id,
          ticket_number: ticketNumber,
        },
      });

      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['tickets-dashboard'] });

      alert('Ticket created successfully');

      if (initialDraft?.emailId) {
        const { error: linkError } = await supabase.rpc('ark_link_email_to_ticket', {
          p_email_id: initialDraft.emailId,
          p_ticket_id: insertedTicket.id,
        });

        if (linkError) {
          console.warn('Ticket created but email linkage failed:', linkError);
        }
      }

      onCreated?.(insertedTicket);

      clearDraft();
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      alert('Unexpected error creating ticket.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent
        className="sm:max-w-2xl max-h-[90vh] overflow-y-auto"
        onInteractOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
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
                    onValueChange={(value) => {
                      f('bank_name', value);
                      f('branch_name', '');
                      f('terminal_id', '');
                      f('device_name', '');
                      setBranchSearch('');
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select bank..." />
                    </SelectTrigger>

                    <SelectContent>
                      {banks.map((bank) => (
                        <SelectItem key={bank.id} value={bank.bank_name}>
                          {bank.bank_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5 relative">
                  <Label>Branch / Location</Label>

                  <Input
                    value={branchSearch}
                    disabled={!form.bank_name}
                    placeholder={
                      form.bank_name
                        ? 'Type full branch/location name...'
                        : 'Select bank first...'
                    }
                    onChange={(event) => {
                      const value = event.target.value;

                      setBranchSearch(value);
                      f('branch_name', value);
                      f('terminal_id', '');
                      f('device_name', '');
                    }}
                  />

                  {form.bank_name && branchSearch && filteredBranches.length > 0 && (
                    <div className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 text-white shadow-2xl">
                      {filteredBranches.map((branch) => (
                        <button
                          key={branch.id || branch.branch_name}
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm text-white bg-slate-900 hover:bg-slate-800 border-b border-slate-700 last:border-b-0"
                          onClick={() => {
                            setBranchSearch(branch.branch_name);
                            f('branch_name', branch.branch_name);
                            f('terminal_id', '');
                            f('device_name', '');
                          }}
                        >
                          {branch.branch_name}
                        </button>
                      ))}
                    </div>
                  )}

                  {form.bank_name && branchSearch && filteredBranches.length === 0 && (
                    <p className="text-xs text-amber-500">
                      No matching branch found. You can still keep typing the full location.
                    </p>
                  )}

                  {form.branch_name && (
                    <p className="text-xs text-green-500">
                      Selected / typed: {form.branch_name}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Device / Terminal</Label>
                <Select
                  value={form.terminal_id}
                  onValueChange={(value) => {
                    const dev = filteredDevices.find(
                      (device) => getDeviceTerminalId(device) === value
                    );
                    const assignedEngineer = dev
                      ? getAssignedEngineer(dev, engineers)
                      : null;

                    f('terminal_id', value);
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
                    {filteredDevices.map((device) => {
                      const value = getDeviceTerminalId(device);
                      const label = `${getDeviceName(device)} ${
                        value ? `(${value})` : ''
                      }`;

                      return (
                        <SelectItem key={device.id} value={value}>
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
              onChange={(event) => f('title', event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Description *</Label>
            <Textarea
              required
              placeholder="Provide detailed information about the issue..."
              className="h-24"
              value={form.description}
              onChange={(event) => f('description', event.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={form.category}
                onValueChange={(value) => f('category', value)}
              >
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
              <Select
                value={form.priority}
                onValueChange={(value) => f('priority', value)}
              >
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
                  onValueChange={(value) => {
                    const engineer = engineers.find((item) => item.email === value);
                    f('assigned_to', value);
                    f('assigned_to_name', engineer?.full_name || value);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select engineer..." />
                  </SelectTrigger>

                  <SelectContent>
                    {engineers.map((engineer) => (
                      <SelectItem key={engineer.id} value={engineer.email}>
                        {engineer.full_name || engineer.email} —{' '}
                        {engineer.department || 'Engineer'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>SLA Level</Label>
                <Select
                  value={form.sla_level}
                  onValueChange={(value) => f('sla_level', value)}
                >
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
                {files.length > 0
                  ? `${files.length} file(s) selected`
                  : fileNames.length > 0
                    ? `${fileNames.length} previous file name(s) saved. Please reselect files before submitting.`
                    : 'Click to upload files or photos'}
              </span>

              <input
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx"
                className="hidden"
                onChange={(event) => {
                  const selected = Array.from(event.target.files || []);
                  setFiles(selected);
                  setFileNames(selected.map((file) => file.name));
                }}
              />
            </label>

            {fileNames.length > 0 && files.length === 0 && (
              <p className="text-xs text-amber-500">
                Browser security does not restore selected files after refresh. Please reselect attachments before creating ticket.
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={handleCancel}>
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
