import React, { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';

import {
  Reply,
  Forward,
  UserPlus,
  Ticket,
  Archive,
  CheckCircle2,
  X,
  Paperclip,
  Mail,
  Clock,
  Loader2
} from 'lucide-react';

import { format } from 'date-fns';
import { toast } from 'sonner';

import { supabase } from '@/lib/supabaseClient';

const STATUS_COLORS = {
  'New': 'bg-blue-100 text-blue-800',
  'Reviewed': 'bg-gray-100 text-gray-700',
  'Assigned': 'bg-purple-100 text-purple-800',
  'Converted to Ticket': 'bg-green-100 text-green-800',
  'Converted to Task': 'bg-teal-100 text-teal-800',
  'Replied': 'bg-cyan-100 text-cyan-800',
  'Closed': 'bg-gray-200 text-gray-600',
  'Archived': 'bg-orange-100 text-orange-700',
};

const DEPARTMENTS = [
  'Helpdesk',
  'Operations',
  'Finance',
  'HR',
  'Inventory',
  'Procurement',
  'Management',
  'Admin'
];

export default function MailDetail({
  email,
  onClose,
  onRefresh,
  onCompose,
  onConvert
}) {

  const [notes, setNotes] =
    useState(email?.internal_notes || '');

  const [savingNotes, setSavingNotes] =
    useState(false);

  const [assignDept, setAssignDept] =
    useState(email?.assigned_department || '');

  const [assignStaff, setAssignStaff] =
    useState(email?.assigned_staff || '');

  if (!email) {

    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">

        <div className="text-center">

          <Mail className="w-12 h-12 mx-auto mb-3 opacity-20" />

          <p className="text-sm">
            Select an email to view
          </p>
        </div>
      </div>
    );
  }

  const updateEmail = async payload => {

    const { error } = await supabase
      .from('email_messages')
      .update(payload)
      .eq('id', email.id);

    if (error)
      throw error;
  };

  const handleArchive = async () => {

    try {

      await updateEmail({
        archived_status: true,
        email_status: 'Archived'
      });

      toast.success('Email archived');

      onRefresh?.();

      onClose?.();

    } catch (err) {

      toast.error(
        err.message || 'Archive failed'
      );
    }
  };

  const handleMarkReviewed = async () => {

    try {

      if (email.email_status === 'New') {

        await updateEmail({
          email_status: 'Reviewed'
        });

        toast.success('Marked reviewed');

        onRefresh?.();
      }

    } catch (err) {

      toast.error(
        err.message || 'Failed'
      );
    }
  };

  const handleSaveNotes = async () => {

    try {

      setSavingNotes(true);

      await updateEmail({
        internal_notes: notes
      });

      toast.success('Notes saved');

      onRefresh?.();

    } catch (err) {

      toast.error(
        err.message || 'Save failed'
      );

    } finally {

      setSavingNotes(false);
    }
  };

  const handleAssign = async () => {

    try {

      if (!assignDept && !assignStaff)
        return;

      await updateEmail({
        assigned_department: assignDept,
        assigned_staff: assignStaff,
        email_status: 'Assigned'
      });

      toast.success('Email assigned');

      onRefresh?.();

    } catch (err) {

      toast.error(
        err.message || 'Assign failed'
      );
    }
  };

  const handlePriority = async priority => {

    try {

      await updateEmail({
        priority
      });

      toast.success(
        `Priority set to ${priority}`
      );

      onRefresh?.();

    } catch (err) {

      toast.error(
        err.message || 'Priority update failed'
      );
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">

      <div className="px-4 py-3 border-b flex items-start justify-between gap-3 flex-shrink-0 bg-slate-900/50">

        <div className="flex-1 min-w-0">

          <h2 className="font-semibold text-sm leading-tight">

            {email.subject}
          </h2>

          <div className="flex items-center gap-2 mt-1 flex-wrap">

            <Badge
              className={`text-[10px] ${
                STATUS_COLORS[email.email_status] || ''
              }`}

              variant="secondary"
            >
              {email.email_status}
            </Badge>

            {email.priority && (

              <Badge
                variant="outline"
                className="text-[10px]"
              >
                {email.priority}
              </Badge>
            )}

            {email.email_category && (

              <span className="text-xs text-muted-foreground">

                {email.email_category}
              </span>
            )}
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"

          className="h-7 w-7 flex-shrink-0"

          onClick={onClose}
        >

          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">

        <div className="px-4 py-3 border-b bg-muted/20 space-y-1">

          <div className="flex items-center gap-2 text-sm">

            <span className="font-medium">

              {email.sender_name || email.sender_email}
            </span>

            <span className="text-muted-foreground">

              &lt;{email.sender_email}&gt;
            </span>
          </div>

          {email.recipient_email && (

            <p className="text-xs text-muted-foreground">

              To: {email.recipient_email}
            </p>
          )}

          {email.cc && (

            <p className="text-xs text-muted-foreground">

              CC: {email.cc}
            </p>
          )}

          {email.received_at && (

            <p className="text-xs text-muted-foreground flex items-center gap-1">

              <Clock className="w-3 h-3" />

              {format(
                new Date(email.received_at),
                'PPP p'
              )}
            </p>
          )}

          {email.attachments?.length > 0 && (

            <div className="flex items-center gap-1 flex-wrap pt-1">

              <Paperclip className="w-3 h-3 text-muted-foreground" />

              {email.attachments.map((att, i) => (

                <a
                  key={i}
                  href={att}
                  target="_blank"
                  rel="noreferrer"

                  className="text-xs text-primary underline"
                >
                  Attachment {i + 1}
                </a>
              ))}
            </div>
          )}
        </div>

        <div className="px-4 py-4 text-sm whitespace-pre-wrap leading-relaxed border-b">

          {email.message_body || (

            <span className="text-muted-foreground italic">

              No message body
            </span>
          )}
        </div>

        <div className="px-4 py-3 border-b space-y-3">

          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">

            Actions
          </p>

          <div className="flex flex-wrap gap-2">

            <Button
              size="sm"
              variant="outline"

              className="gap-1.5 text-xs"

              onClick={() =>
                onCompose?.({
                  type: 'reply',
                  email
                })
              }
            >

              <Reply className="w-3.5 h-3.5" />

              Reply
            </Button>

            <Button
              size="sm"
              variant="outline"

              className="gap-1.5 text-xs"

              onClick={() =>
                onCompose?.({
                  type: 'forward',
                  email
                })
              }
            >

              <Forward className="w-3.5 h-3.5" />

              Forward
            </Button>

            <Button
              size="sm"
              variant="outline"

              className="gap-1.5 text-xs"

              onClick={() =>
                onConvert?.(email)
              }
            >

              <Ticket className="w-3.5 h-3.5" />

              Convert to Ticket
            </Button>

            <Button
              size="sm"
              variant="outline"

              className="gap-1.5 text-xs"

              onClick={handleMarkReviewed}
            >

              <CheckCircle2 className="w-3.5 h-3.5" />

              Mark Reviewed
            </Button>

            <Button
              size="sm"
              variant="outline"

              className="gap-1.5 text-xs text-red-600 hover:bg-red-50"

              onClick={handleArchive}
            >

              <Archive className="w-3.5 h-3.5" />

              Archive
            </Button>
          </div>

          <div className="flex items-center gap-2">

            <span className="text-xs text-muted-foreground w-16">

              Priority:
            </span>

            <div className="flex gap-1">

              {[
                'low',
                'medium',
                'high',
                'critical'
              ].map(p => (

                <button
                  key={p}

                  onClick={() =>
                    handlePriority(p)
                  }

                  className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                    email.priority === p
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border hover:bg-muted'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="px-4 py-3 border-b space-y-2">

          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">

            <UserPlus className="w-3.5 h-3.5" />

            Assign Email
          </p>

          <div className="grid grid-cols-2 gap-2">

            <Select
              value={assignDept}

              onValueChange={setAssignDept}
            >

              <SelectTrigger className="h-8 text-xs">

                <SelectValue placeholder="Department" />
              </SelectTrigger>

              <SelectContent>

                {DEPARTMENTS.map(d => (

                  <SelectItem
                    key={d}
                    value={d}
                  >
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <input
              className="h-8 text-xs border border-input rounded-md px-3 bg-transparent"

              placeholder="Staff name / email"

              value={assignStaff}

              onChange={e =>
                setAssignStaff(
                  e.target.value
                )
              }
            />
          </div>

          <Button
            size="sm"
            className="text-xs h-7"

            onClick={handleAssign}
          >

            <UserPlus className="w-3.5 h-3.5 mr-1" />

            Assign
          </Button>
        </div>

        {(email.related_bank
          || email.related_branch
          || email.linked_ticket_id) && (

          <div className="px-4 py-3 border-b space-y-1">

            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">

              Linked Records
            </p>

            {email.related_bank && (

              <p className="text-xs">

                🏦 Bank:
                {' '}
                {email.related_bank}
              </p>
            )}

            {email.related_branch && (

              <p className="text-xs">

                📍 Branch:
                {' '}
                {email.related_branch}
              </p>
            )}

            {email.linked_ticket_id && (

              <p className="text-xs">

                🎫 Ticket:
                {' '}
                {email.linked_ticket_id}
              </p>
            )}
          </div>
        )}

        <div className="px-4 py-3 space-y-2">

          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">

            Internal Notes
          </p>

          <Textarea
            value={notes}

            onChange={e =>
              setNotes(e.target.value)
            }

            placeholder="Add private internal notes…"

            className="text-sm resize-none h-20"
          />

          <Button
            size="sm"
            className="text-xs h-7"

            onClick={handleSaveNotes}

            disabled={savingNotes}
          >

            {savingNotes && (
              <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
            )}

            Save Notes
          </Button>
        </div>
      </div>
    </div>
  );
}