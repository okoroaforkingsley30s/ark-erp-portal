import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Paperclip, Mail, MailOpen } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const STATUS_COLORS = {
  New: 'bg-blue-500/15 text-blue-200 border-blue-400/30',
  Reviewed: 'bg-slate-500/15 text-slate-200 border-slate-400/30',
  Assigned: 'bg-purple-500/15 text-purple-200 border-purple-400/30',
  'Converted to Ticket': 'bg-green-500/15 text-green-200 border-green-400/30',
  'Converted to Task': 'bg-teal-500/15 text-teal-200 border-teal-400/30',
  Replied: 'bg-cyan-500/15 text-cyan-200 border-cyan-400/30',
  Closed: 'bg-slate-500/15 text-slate-300 border-slate-400/30',
  Archived: 'bg-orange-500/15 text-orange-200 border-orange-400/30',
};

const PRIORITY_DOT = {
  critical: 'bg-red-500',
  high: 'bg-orange-400',
  medium: 'bg-yellow-400',
  low: 'bg-slate-400',
};

export default function MailList({
  emails = [],
  selectedId,
  onSelect,
  search = '',
  onSearch,
  categoryFilter = 'all',
  onCategoryFilter,
}) {
  return (
    <div className="flex flex-col h-full bg-[#08153d] text-white">
      <div className="p-3 border-b border-white/10 space-y-2 flex-shrink-0 bg-[#102969]/80">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />

          <Input
            placeholder="Search emails…"
            className="pl-8 h-8 text-sm bg-[#08153d]/80 border-white/10 text-white placeholder:text-slate-400"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
          />
        </div>

        <Select value={categoryFilter} onValueChange={onCategoryFilter}>
          <SelectTrigger className="h-8 text-xs bg-[#08153d]/80 border-white/10 text-white">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>

          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>

            {[
              'Bank Support',
              'Client Request',
              'Vendor / Supplier',
              'Staff Internal',
              'HR Matter',
              'Finance Matter',
              'Procurement Matter',
              'General Enquiry',
              'Complaint',
              'Escalation',
              'Other',
            ].map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 overflow-y-auto">
        {emails.length === 0 && (
          <div className="text-center py-16 text-slate-400">
            <Mail className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No emails found</p>
          </div>
        )}

        {emails.map((email) => {
          const isSelected = selectedId === email.id;
          const isNew = email.email_status === 'New';

          return (
            <button
              key={email.id}
              onClick={() => onSelect(email)}
              className={cn(
                'w-full text-left px-4 py-3 border-b border-white/10 transition-colors',
                'hover:bg-[#ff5a00]/10',
                isSelected && 'bg-[#ff5a00]/15 border-l-2 border-l-[#ff5a00]',
                isNew && 'font-medium'
              )}
            >
              <div className="flex items-start gap-2">
                <div className="mt-0.5 flex-shrink-0">
                  {isNew ? (
                    <Mail className="w-4 h-4 text-[#ff5a00]" />
                  ) : (
                    <MailOpen className="w-4 h-4 text-slate-400" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <span className="text-sm truncate text-white">
                      {email.sender_name || email.sender_email}
                    </span>

                    <span className="text-[10px] text-slate-400 flex-shrink-0">
                      {email.received_at
                        ? format(new Date(email.received_at), 'MMM d')
                        : ''}
                    </span>
                  </div>

                  <p className="text-sm truncate text-slate-200">
                    {email.subject}
                  </p>

                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    {email.priority && (
                      <span
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          PRIORITY_DOT[email.priority]
                        }`}
                        title={email.priority}
                      />
                    )}

                    <Badge
                      className={`text-[10px] px-1.5 py-0 h-4 border ${
                        STATUS_COLORS[email.email_status] || ''
                      }`}
                      variant="outline"
                    >
                      {email.email_status}
                    </Badge>

                    {email.email_category && (
                      <span className="text-[10px] text-slate-400 truncate">
                        {email.email_category}
                      </span>
                    )}

                    {email.attachments?.length > 0 && (
                      <Paperclip className="w-3 h-3 text-slate-400 flex-shrink-0" />
                    )}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}