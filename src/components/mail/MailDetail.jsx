import React, { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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
  Loader2,
  ReplyAll,
} from 'lucide-react';

import { format } from 'date-fns';
import { toast } from 'sonner';

import { supabase } from '@/lib/supabaseClient';

const STATUS_COLORS = {
  New: 'bg-blue-100 text-blue-800',
  Reviewed: 'bg-gray-100 text-gray-700',
  Assigned: 'bg-purple-100 text-purple-800',
  'Converted to Ticket': 'bg-green-100 text-green-800',
  'Converted to Task': 'bg-teal-100 text-teal-800',
  Replied: 'bg-cyan-100 text-cyan-800',
  Closed: 'bg-gray-200 text-gray-600',
  Archived: 'bg-orange-100 text-orange-700',
  Sent: 'bg-emerald-100 text-emerald-800',
};

const DEPARTMENTS = [
  'Helpdesk',
  'Operations',
  'Finance',
  'HR',
  'Inventory',
  'Procurement',
  'Management',
  'Admin',
];

function getBody(email) {
  return (
    email?.message_body ||
    email?.body ||
    email?.html_body ||
    email?.text_body ||
    email?.snippet ||
    ''
  );
}

function stripHtml(html = '') {
  return String(html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

export default function MailDetail({
  email,
  onClose,
  onRefresh,
  onCompose,
  onConvert,
}) {
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [assignDept, setAssignDept] = useState('');
  const [assignStaff, setAssignStaff] = useState('');

  useEffect(() => {
    setNotes(email?.internal_notes || '');
    setAssignDept(email?.assigned_department || '');
    setAssignStaff(email?.assigned_staff || '');
  }, [email?.id]);

  const readableBody = useMemo(() => {
    const body = getBody(email);
    return /<\/?[a-z][\s\S]*>/i.test(body) ? stripHtml(body) : body;
  }, [email]);

  if (!email) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <Mail className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="text-sm">Select an email to view</p>
        </div>
      </div>
    );
  }

  const updateEmail = async (payload) => {
    const { error } = await supabase
      .from('email_messages')
      .update(payload)
      .eq('id', email.id);

    if (error) throw error;
  };

  const handleArchive = async () => {
    try {
      await updateEmail({
        archived_status: true,
        email_status: 'Archived',
        folder: 'archived',
      });

      toast.success('Email archived');
      onRefresh?.();
      onClose?.();
    } catch (err) {
      toast.error(err.message || 'Archive failed');
    }
  };

  const handleMarkReviewed = async () => {
    try {
      await updateEmail({
        email_status: 'Reviewed',
        is_read: true,
      });

      toast.success('Marked reviewed');
      onRefresh?.();
    } catch (err) {
      toast.error(err.message || 'Failed');
    }
  };

  const handleSaveNotes = async () => {
    try {
      setSavingNotes(true);

      await updateEmail({
        internal_notes: notes,
      });

      toast.success('Notes saved');
      onRefresh?.();
    } catch (err) {
      toast.error(err.message || 'Save failed');
    } finally {
      setSavingNotes(false);
    }
  };

  const handleAssign = async () => {
    try {
      if (!assignDept && !assignStaff) return;

      await updateEmail({
        assigned_department: assignDept,
        assigned_staff: assignStaff,
        email_status: 'Assigned',
      });

      toast.success('Email assigned');
      onRefresh?.();
    } catch (err) {
      toast.error(err.message || 'Assign failed');
    }
  };

  const handlePriority = async (priority) => {
    try {
      await updateEmail({ priority });
      toast.success(`Priority set to ${priority}`);
      onRefresh?.();
    } catch (err) {
      toast.error(err.message || 'Priority update failed');
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white text-slate-900">
      <div className="px-5 py-4 border-b flex items-start justify-between gap-3 flex-shrink-0 bg-slate-100">
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-lg leading-tight text-slate-950">
            {email.subject || '(No Subject)'}
          </h2>

          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Badge
              className={`text-[10px] ${
                STATUS_COLORS[email.email_status] || 'bg-gray-100 text-gray-700'
              }`}
              variant="secondary"
            >
              {email.email_status || 'received'}
            </Badge>

            {email.priority && (
              <Badge variant="outline" className="text-[10px] border-slate-300 text-slate-700">
                {email.priority}
              </Badge>
            )}

            {email.email_category && (
              <span className="text-xs text-slate-500">{email.email_category}</span>
            )}
          </div>
        </div>

        <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-5 py-4 border-b bg-white space-y-1">
          <div className="flex items-center gap-2 text-sm flex-wrap">
            <span className="font-semibold text-slate-900">
              {email.sender_name || email.sender_email || 'Unknown sender'}
            </span>

            {email.sender_email && (
              <span className="text-slate-500">&lt;{email.sender_email}&gt;</span>
            )}
          </div>

          {email.recipient_email && (
            <p className="text-xs text-slate-600">
              <b>To:</b> {email.recipient_email}
            </p>
          )}

          {email.cc && (
            <p className="text-xs text-slate-600">
              <b>CC:</b> {email.cc}
            </p>
          )}

          {email.bcc && (
            <p className="text-xs text-slate-600">
              <b>BCC:</b> {email.bcc}
            </p>
          )}

          {email.received_at && (
            <p className="text-xs text-slate-500 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {format(new Date(email.received_at), 'PPP p')}
            </p>
          )}

          {Array.isArray(email.attachments) && email.attachments.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap pt-1">
              <Paperclip className="w-3 h-3 text-slate-500" />
              {email.attachments.map((att, i) => (
                <span key={i} className="text-xs text-slate-700 border rounded px-2 py-1">
                  {att.filename || `Attachment ${i + 1}`}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="px-5 py-5 text-sm leading-relaxed border-b bg-white text-slate-900 min-h-[120px]">
          {readableBody ? (
            <div className="whitespace-pre-wrap break-words">{readableBody}</div>
          ) : (
            <span className="text-slate-500 italic">No message body</span>
          )}
        </div>

        <div className="px-5 py-4 border-b space-y-3 bg-orange-50/40">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</p>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs border-orange-200 text-orange-700"
              onClick={() => onCompose?.({ type: 'reply', email })}
            >
              <Reply className="w-3.5 h-3.5" />
              Reply
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs border-orange-200 text-orange-700"
              onClick={() => onCompose?.({ type: 'reply_all', email })}
            >
              <ReplyAll className="w-3.5 h-3.5" />
              Reply All
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs border-orange-200 text-orange-700"
              onClick={() => onCompose?.({ type: 'forward', email })}
            >
              <Forward className="w-3.5 h-3.5" />
              Forward
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs"
              onClick={() => onConvert?.(email)}
            >
              <Ticket className="w-3.5 h-3.5" />
              Convert to Ticket
            </Button>

            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={handleMarkReviewed}>
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
            <span className="text-xs text-slate-500 w-16">Priority:</span>

            <div className="flex gap-1">
              {['low', 'medium', 'high', 'critical'].map((p) => (
                <button
                  key={p}
                  onClick={() => handlePriority(p)}
                  className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                    email.priority === p
                      ? 'bg-orange-600 text-white border-orange-600'
                      : 'border-slate-300 hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-b space-y-2 bg-white">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1">
            <UserPlus className="w-3.5 h-3.5" />
            Assign Email
          </p>

          <div className="grid grid-cols-2 gap-2">
            <Select value={assignDept} onValueChange={setAssignDept}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Department" />
              </SelectTrigger>

              <SelectContent>
                {DEPARTMENTS.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <input
              className="h-8 text-xs border border-slate-300 rounded-md px-3 bg-white text-slate-900"
              placeholder="Staff name / email"
              value={assignStaff}
              onChange={(e) => setAssignStaff(e.target.value)}
            />
          </div>

          <Button size="sm" className="text-xs h-7 bg-orange-600 hover:bg-orange-700" onClick={handleAssign}>
            <UserPlus className="w-3.5 h-3.5 mr-1" />
            Assign
          </Button>
        </div>

        {(email.related_bank || email.related_branch || email.linked_ticket_id) && (
          <div className="px-5 py-4 border-b space-y-1 bg-white">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Linked Records</p>

            {email.related_bank && <p className="text-xs">🏦 Bank: {email.related_bank}</p>}
            {email.related_branch && <p className="text-xs">📍 Branch: {email.related_branch}</p>}
            {email.linked_ticket_id && <p className="text-xs">🎫 Ticket: {email.linked_ticket_id}</p>}
          </div>
        )}

        <div className="px-5 py-4 space-y-2 bg-white">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Internal Notes</p>

          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add private internal notes…"
            className="text-sm resize-none h-20 bg-white text-slate-900"
          />

          <Button
            size="sm"
            className="text-xs h-7 bg-orange-600 hover:bg-orange-700"
            onClick={handleSaveNotes}
            disabled={savingNotes}
          >
            {savingNotes && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}
            Save Notes
          </Button>
        </div>
      </div>
    </div>
  );
}