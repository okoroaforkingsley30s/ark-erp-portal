import React from 'react';
import { Search } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import FinanceReportToolbar from './FinanceReportToolbar';

export default function FinancePageHeader({
  title,
  description,
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search...',
  statusValue,
  onStatusChange,
  statusOptions = [],
  dateRange,
  toolbar,
  children,
}) {
  return (
    <div className="rounded-xl border bg-slate-900/50 p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">{title}</h2>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        {toolbar && <FinanceReportToolbar {...toolbar} dateRange={dateRange} />}
      </div>

      {(onSearchChange || onStatusChange || children) && (
        <div className="flex flex-wrap items-center gap-2">
          {onSearchChange && (
            <div className="relative min-w-[220px] flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9 bg-slate-950/50"
                value={searchValue || ''}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder={searchPlaceholder}
              />
            </div>
          )}

          {onStatusChange && statusOptions.length > 0 && (
            <Select value={statusValue || 'all'} onValueChange={onStatusChange}>
              <SelectTrigger className="w-[190px] bg-slate-950/50">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {children}
        </div>
      )}
    </div>
  );
}
