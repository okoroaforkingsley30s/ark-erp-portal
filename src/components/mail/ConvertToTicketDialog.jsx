import React, { useState } from 'react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';

import {
  Ticket,
  Loader2,
  CheckCircle2
} from 'lucide-react';

import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';

const CATEGORY_TO_TICKET_CAT = {
  'Bank Support': 'atm_fault',
  'Client Request': 'software_issue',
  'Vendor / Supplier': 'other',
  'Complaint': 'other',
  'Escalation': 'other',
  'HR Matter': 'other',
  'Finance Matter': 'other',
};

export default function ConvertToTicketDialog({
  open,
  email,
  user,
  onClose,
  onRefresh
}) {

  const [title, setTitle] =
    useState(email?.subject || '');

  const [description, setDescription] =
    useState(email?.message_body || '');

  const [priority, setPriority] =
    useState(email?.priority || 'medium');

  const [category, setCategory] =
    useState(
      CATEGORY_TO_TICKET_CAT[email?.email_category]
      || 'other'
    );

  const [assignedTo, setAssignedTo] =
    useState('');

  const [relatedBranch, setRelatedBranch] =
    useState(email?.related_branch || '');

  const [loading, setLoading] =
    useState(false);

  const [done, setDone] =
    useState(false);

  const [ticketId, setTicketId] =
    useState('');

  const handleCreate = async () => {

    if (!title) {

      toast.error(
        'Title is required'
      );

      return;
    }

    try {

      setLoading(true);

      const ticketPayload = {
        title,

        description: `${description}

--- Created from Official Mail ---
From: ${email?.sender_name || ''} <${email?.sender_email || ''}>
Received: ${
  email?.received_at
    ? new Date(email.received_at).toLocaleString()
    : ''
}`,

        priority,

        category,

        status: 'open',

        client_email:
          email?.sender_email,

        assigned_to:
          assignedTo || null,

        site_name:
          relatedBranch || null,

        created_by:
          user?.email,

        created_at:
          new Date().toISOString()
      };

      const {
        data: ticket,
        error: ticketError
      } = await supabase
        .from('tickets')
        .insert(ticketPayload)
        .select()
        .single();

      if (ticketError)
        throw ticketError;

      if (email?.id) {

        await supabase
          .from('email_messages')
          .update({
            email_status:
              'Converted to Ticket',

            linked_ticket_id:
              ticket.id
          })
          .eq('id', email.id);
      }

      setTicketId(ticket.id);

      setDone(true);

      toast.success(
        'Ticket created and email linked!'
      );

      onRefresh?.();

    } catch (err) {

      toast.error(
        err.message
        || 'Failed to create ticket'
      );

    } finally {

      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}

      onOpenChange={v => {

        if (!v) {

          setDone(false);

          onClose?.();
        }
      }}
    >

      <DialogContent className="max-w-lg">

        <DialogHeader>

          <DialogTitle className="flex items-center gap-2 text-sm">

            <Ticket className="w-4 h-4" />

            Convert Email to Ticket
          </DialogTitle>
        </DialogHeader>

        {done ? (

          <div className="text-center py-6 space-y-3">

            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />

            <p className="font-semibold">
              Ticket Created Successfully!
            </p>

            <p className="text-sm text-muted-foreground">

              Email has been linked to the new ticket.
            </p>

            <p className="text-xs font-mono text-muted-foreground">

              Ticket ID: {ticketId}
            </p>

            <Button
              size="sm"

              onClick={() => {

                setDone(false);

                onClose?.();
              }}
            >
              Close
            </Button>
          </div>

        ) : (

          <div className="space-y-3">

            <div className="space-y-1">

              <Label className="text-xs">
                Ticket Title *
              </Label>

              <Input
                value={title}

                onChange={e =>
                  setTitle(e.target.value)
                }

                className="h-8 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">

              <div className="space-y-1">

                <Label className="text-xs">
                  Priority
                </Label>

                <Select
                  value={priority}

                  onValueChange={setPriority}
                >

                  <SelectTrigger className="h-8 text-xs">

                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent>

                    {[
                      'low',
                      'medium',
                      'high',
                      'critical'
                    ].map(p => (

                      <SelectItem
                        key={p}
                        value={p}
                      >
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">

                <Label className="text-xs">
                  Category
                </Label>

                <Select
                  value={category}

                  onValueChange={setCategory}
                >

                  <SelectTrigger className="h-8 text-xs">

                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent>

                    {[
                      'atm_fault',
                      'software_issue',
                      'network_issue',
                      'power_issue',
                      'card_issue',
                      'other'
                    ].map(c => (

                      <SelectItem
                        key={c}
                        value={c}
                      >
                        {c.replace('_', ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">

              <div className="space-y-1">

                <Label className="text-xs">
                  Assign Engineer
                </Label>

                <Input
                  value={assignedTo}

                  onChange={e =>
                    setAssignedTo(e.target.value)
                  }

                  placeholder="engineer@ark.com"

                  className="h-8 text-sm"
                />
              </div>

              <div className="space-y-1">

                <Label className="text-xs">
                  Related Branch
                </Label>

                <Input
                  value={relatedBranch}

                  onChange={e =>
                    setRelatedBranch(
                      e.target.value
                    )
                  }

                  placeholder="Branch name"

                  className="h-8 text-sm"
                />
              </div>
            </div>

            <div className="space-y-1">

              <Label className="text-xs">
                Description
              </Label>

              <Textarea
                value={description}

                onChange={e =>
                  setDescription(
                    e.target.value
                  )
                }

                className="text-sm resize-none h-24"
              />
            </div>

            <div className="flex justify-end gap-2">

              <Button
                variant="outline"
                size="sm"
                onClick={onClose}
              >
                Cancel
              </Button>

              <Button
                size="sm"

                onClick={handleCreate}

                disabled={loading}
              >

                {loading && (
                  <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                )}

                <Ticket className="w-3.5 h-3.5 mr-1" />

                Create Ticket
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}