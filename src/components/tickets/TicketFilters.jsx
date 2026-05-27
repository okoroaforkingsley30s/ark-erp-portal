import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

export default function TicketFilters({ filters = {}, onChange = () => {} }) {
  const update = (key, value) => onChange({ ...filters, [key]: value });

  return (
    <div className="flex flex-wrap gap-3">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search tickets..."
          className="pl-9"
          value={filters.search || ''}
          onChange={e => update('search', e.target.value)}
        />
      </div>
      <Select value={filters.status || 'all'} onValueChange={v => update('status', v)}>
        <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="new">New</SelectItem>
          <SelectItem value="assigned">Assigned</SelectItem>
          <SelectItem value="in_progress">In Progress</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="resolved">Resolved</SelectItem>
          <SelectItem value="closed">Closed</SelectItem>
        </SelectContent>
      </Select>
      <Select value={filters.priority || 'all'} onValueChange={v => update('priority', v)}>
        <SelectTrigger className="w-[140px]"><SelectValue placeholder="Priority" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Priority</SelectItem>
          <SelectItem value="low">Low</SelectItem>
          <SelectItem value="medium">Medium</SelectItem>
          <SelectItem value="high">High</SelectItem>
          <SelectItem value="critical">Critical</SelectItem>
        </SelectContent>
      </Select>
      <Select value={filters.category || 'all'} onValueChange={v => update('category', v)}>
        <SelectTrigger className="w-[140px]"><SelectValue placeholder="Category" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Categories</SelectItem>
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
  );
}