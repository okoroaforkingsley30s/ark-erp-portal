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
  MoreVertical,
  ChevronDown,
  ChevronUp,
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
    email?.snippet ||
    ''
  );
}

function stripHtml(html = '') {
  return String(html)
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
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
  const [showManage, setShowManage] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    setNotes(email?.internal_notes || '');
    setAssignDept(email?.assigned_department || '');
    setAssignStaff(email?.assigned_staff || '');
    setShowManage(false);
    setShowDetails(false);
  }, [email?.id]);

  const readableBody = useMemo(() => {
    const body = getBody(email);
    return /<\/?[a-z][\s\S]*>/i.test(body) ? stripHtml(body) : body;
  }, [email]);

  if (!email) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500 bg-white">
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
    <div className="h-full flex flex-col overflow-hidden bg-white text-slate-900">
      <div className="h-12 px-4 border-b bg-white flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => onCompose?.({ type: 'reply', email })}
            title="Reply"
          >
            <Reply className="w-4 h-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => onCompose?.({ type: 'reply_all', email })}
            title="Reply all"
          >
            <ReplyAll className="w-4 h-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => onCompose?.({ type: 'forward', email })}
            title="Forward"
          >
            <Forward className="w-4 h-4" />
          </Button>

          <div className="w-px h-5 bg-slate-200 mx-1" />

          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={handleMarkReviewed}
            title="Mark reviewed"
          >
            <CheckCircle2 className="w-4 h-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-red-600 hover:text-red-700"
            onClick={handleArchive}
            title="Archive"
          >
            <Archive className="w-4 h-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => setShowManage((v) => !v)}
            title="Manage"
          >
            <MoreVertical className="w-4 h-4" />
          </Button>
        </div>

        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto bg-white">
        <div className="max-w-5xl mx-auto px-6 lg:px-10 py-7">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold leading-tight text-slate-950">
              {email.subject || '(No Subject)'}
            </h2>

            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <Badge
                className={`text-[11px] ${
                  STATUS_COLORS[email.email_status] || 'bg-gray-100 text-gray-700'
                }`}
                variant="secondary"
              >
                {email.email_status || 'received'}
              </Badge>

              {email.priority && (
                <Badge variant="outline" className="text-[11px] border-slate-300 text-slate-700">
                  {email.priority}
                </Badge>
              )}

              {email.email_category && (
                <span className="text-xs text-slate-500">{email.email_category}</span>
              )}
            </div>
          </div>

          <div className="flex items-start gap-4 mb-6">
            <div className="h-10 w-10 rounded-full bg-[#102969] text-white flex items-center justify-center font-bold shrink-0">
              {(email.sender_name || email.sender_email || 'M').slice(0, 1).toUpperCase()}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 truncate">
                    {email.sender_name || email.sender_email || 'Unknown sender'}
                  </p>

                  <button
                    onClick={() => setShowDetails((v) => !v)}
                    className="text-xs text-slate-500 hover:text-slate-900 flex items-center gap-1 mt-0.5"
                  >
                    to me
                    {showDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                </div>

                {email.received_at && (
                  <p className="text-xs text-slate-500 flex items-center gap-1 shrink-0">
                    <Clock className="w-3 h-3" />
                    {format(new Date(email.received_at), 'PP p')}
                  </p>
                )}
              </div>

              {showDetails && (
                <div className="mt-3 rounded-xl border bg-slate-50 p-3 text-xs text-slate-700 space-y-1">
                  {email.sender_email && <p><b>From:</b> {email.sender_email}</p>}
                  {email.recipient_email && <p><b>To:</b> {email.recipient_email}</p>}
                  {email.cc && <p><b>CC:</b> {email.cc}</p>}
                  {email.bcc && <p><b>BCC:</b> {email.bcc}</p>}
                  {email.gmail_thread_id && <p><b>Thread:</b> {email.gmail_thread_id}</p>}
                </div>
              )}

              {Array.isArray(email.attachments) && email.attachments.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap pt-3">
                  <Paperclip className="w-3.5 h-3.5 text-slate-500" />
                  {email.attachments.map((att, i) => (
                    <span key={i} className="text-xs text-slate-700 border rounded-lg px-2 py-1 bg-slate-50">
                      {att.filename || `Attachment ${i + 1}`}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {showManage && (
            <div className="mb-6 rounded-2xl border bg-orange-50/50 p-4">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Workflow
                  </p>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-xs"
                      onClick={() => onConvert?.(email)}
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
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-slate-500">Priority:</span>

                    {['low', 'medium', 'high', 'critical'].map((p) => (
                      <button
                        key={p}
                        onClick={() => handlePriority(p)}
                        className={`text-xs px-2 py-1 rounded-lg border transition-colors ${
                          email.priority === p
                            ? 'bg-orange-600 text-white border-orange-600'
                            : 'bg-white border-slate-300 hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                    <UserPlus className="w-3.5 h-3.5" />
                    Assign Email
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <Select value={assignDept} onValueChange={setAssignDept}>
                      <SelectTrigger className="h-9 text-xs bg-white">
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
                      className="h-9 text-xs border border-slate-300 rounded-md px-3 bg-white text-slate-900"
                      placeholder="Staff name / email"
                      value={assignStaff}
                      onChange={(e) => setAssignStaff(e.target.value)}
                    />
                  </div>

                  <Button
                    size="sm"
                    className="text-xs h-8 bg-orange-600 hover:bg-orange-700"
                    onClick={handleAssign}
                  >
                    <UserPlus className="w-3.5 h-3.5 mr-1" />
                    Assign
                  </Button>
                </div>
              </div>

              {(email.related_bank || email.related_branch || email.linked_ticket_id) && (
                <div className="mt-4 pt-4 border-t space-y-1">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Linked Records
                  </p>

                  {email.related_bank && <p className="text-xs">🏦 Bank: {email.related_bank}</p>}
                  {email.related_branch && <p className="text-xs">📍 Branch: {email.related_branch}</p>}
                  {email.linked_ticket_id && <p className="text-xs">🎫 Ticket: {email.linked_ticket_id}</p>}
                </div>
              )}

              <div className="mt-4 pt-4 border-t space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Internal Notes
                </p>

                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add private internal notes…"
                  className="text-sm resize-none h-20 bg-white text-slate-900"
                />

                <Button
                  size="sm"
                  className="text-xs h-8 bg-orange-600 hover:bg-orange-700"
                  onClick={handleSaveNotes}
                  disabled={savingNotes}
                >
                  {savingNotes && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}
                  Save Notes
                </Button>
              </div>
            </div>
          )}

          <div className="text-[15px] leading-7 text-slate-900 whitespace-pre-wrap break-words min-h-[300px]">
            {readableBody ? readableBody : (
              <span className="text-slate-500 italic">No message body</span>
            )}
          </div>

          <div className="mt-10 pt-6 border-t flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => onCompose?.({ type: 'reply', email })}
            >
              <Reply className="w-4 h-4" />
              Reply
            </Button>

            <Button
              variant="outline"
              className="gap-2"
              onClick={() => onCompose?.({ type: 'reply_all', email })}
            >
              <ReplyAll className="w-4 h-4" />
              Reply all
            </Button>

            <Button
              variant="outline"
              className="gap-2"
              onClick={() => onCompose?.({ type: 'forward', email })}
            >
              <Forward className="w-4 h-4" />
              Forward
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}