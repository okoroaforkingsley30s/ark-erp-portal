import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Paperclip, AlertCircle, Mail, MailOpen } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

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

const PRIORITY_DOT = {
  critical: 'bg-red-600',
  high: 'bg-orange-500',
  medium: 'bg-yellow-400',
  low: 'bg-gray-300',
};

export default function MailList({
  emails = [],
  selectedId,
  onSelect,
  search = '',
  onSearch,
  categoryFilter = 'all',
  onCategoryFilter
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Filters */}
      <div className="p-3 border-b space-y-2 flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search emails…"
            className="pl-8 h-8 text-sm"
            value={search}
            onChange={e => onSearch(e.target.value)}
          />
        </div>
        <Select value={categoryFilter} onValueChange={onCategoryFilter}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {['Bank Support','Client Request','Vendor / Supplier','Staff Internal','HR Matter','Finance Matter','Procurement Matter','General Enquiry','Complaint','Escalation','Other'].map(c => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {emails.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Mail className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm">No emails found</p>
          </div>
        )}
        {emails.map(email => (
          <button
            key={email.id}
            onClick={() => onSelect(email)}
            className={cn(
              'w-full text-left px-4 py-3 border-b hover:bg-muted/50 transition-colors',
              selectedId === email.id && 'bg-primary/5 border-l-2 border-l-primary',
              email.email_status === 'New' && 'font-medium'
            )}
          >
            <div className="flex items-start gap-2">
              <div className="mt-0.5 flex-shrink-0">
                {email.email_status === 'New'
                  ? <Mail className="w-4 h-4 text-primary" />
                  : <MailOpen className="w-4 h-4 text-muted-foreground" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1 mb-0.5">
                  <span className="text-sm truncate">{email.sender_name || email.sender_email}</span>
                  <span className="text-[10px] text-muted-foreground flex-shrink-0">
                    {email.received_at ? format(new Date(email.received_at), 'MMM d') : ''}
                  </span>
                </div>
                <p className="text-sm truncate">{email.subject}</p>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  {email.priority && (
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${PRIORITY_DOT[email.priority]}`} title={email.priority} />
                  )}
                  <Badge className={`text-[10px] px-1.5 py-0 h-4 ${STATUS_COLORS[email.email_status] || ''}`} variant="secondary">
                    {email.email_status}
                  </Badge>
                  {email.email_category && (
                    <span className="text-[10px] text-muted-foreground truncate">{email.email_category}</span>
                  )}
                  {email.attachments?.length > 0 && <Paperclip className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}