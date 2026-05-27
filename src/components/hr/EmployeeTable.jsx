import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Pencil, Eye, Plus } from 'lucide-react';

const STATUS_COLOR = { Active: 'bg-green-50 text-green-700', 'On Leave': 'bg-amber-50 text-amber-700', Suspended: 'bg-red-50 text-red-700', Terminated: 'bg-gray-100 text-gray-600', Resigned: 'bg-gray-100 text-gray-600' };
const COUNTRIES = ["Nigeria","Ghana","Cameroon","Benin Republic","Sierra Leone","Liberia","Ivory Coast","Senegal","Gambia","Guinea","Congo Brazzaville"];

export default function EmployeeTable({ employees, canManage, onEdit, onView, onAdd }) {
  const [search, setSearch] = useState('');
  const [filterCountry, setFilterCountry] = useState('all');
  const [filterDept, setFilterDept] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  const departments = [...new Set(employees.map(e => e.department).filter(Boolean))];

  const filtered = employees.filter(e => {
    const q = search.toLowerCase();
    const matchSearch = !q || (e.full_name||'').toLowerCase().includes(q) || (e.staff_id||'').toLowerCase().includes(q) || (e.job_title||'').toLowerCase().includes(q) || (e.email_address||'').toLowerCase().includes(q);
    const matchCountry = filterCountry === 'all' || e.country === filterCountry;
    const matchDept = filterDept === 'all' || e.department === filterDept;
    const matchStatus = filterStatus === 'all' || e.employment_status === filterStatus;
    return matchSearch && matchCountry && matchDept && matchStatus;
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-2 flex-1">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search name, ID, role…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={filterCountry} onValueChange={setFilterCountry}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Country" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Countries</SelectItem>
              {COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterDept} onValueChange={setFilterDept}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Department" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Depts</SelectItem>
              {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-32"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {['Active','On Leave','Suspended','Terminated','Resigned'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {canManage && (
          <Button onClick={onAdd}><Plus className="w-4 h-4 mr-1" />Add Employee</Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{filtered.length} of {employees.length} employees</p>
      <div className="border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 border-b text-xs text-muted-foreground uppercase tracking-wide">
              <tr>
                <th className="text-left px-3 py-2.5 font-medium">Staff ID</th>
                <th className="text-left px-3 py-2.5 font-medium">Name</th>
                <th className="text-left px-3 py-2.5 font-medium hidden md:table-cell">Job Title</th>
                <th className="text-left px-3 py-2.5 font-medium hidden sm:table-cell">Department</th>
                <th className="text-left px-3 py-2.5 font-medium hidden lg:table-cell">Country</th>
                <th className="text-left px-3 py-2.5 font-medium hidden lg:table-cell">Email</th>
                <th className="text-center px-3 py-2.5 font-medium">Status</th>
                <th className="px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="text-center py-12 text-muted-foreground text-sm">No employees found.</td></tr>
              )}
              {filtered.map(emp => (
                <tr key={emp.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{emp.staff_id}</td>
                  <td className="px-3 py-2.5 font-medium">{emp.title ? `${emp.title} ` : ''}{emp.full_name}</td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground hidden md:table-cell">{emp.job_title || '—'}</td>
                  <td className="px-3 py-2.5 text-xs hidden sm:table-cell">{emp.department || '—'}</td>
                  <td className="px-3 py-2.5 text-xs hidden lg:table-cell">{emp.country || '—'}</td>
                  <td className="px-3 py-2.5 text-xs hidden lg:table-cell">{emp.email_address || '—'}</td>
                  <td className="px-3 py-2.5 text-center">
                    <Badge variant="outline" className={`text-[10px] ${STATUS_COLOR[emp.employment_status] || ''}`}>{emp.employment_status || 'Active'}</Badge>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex gap-1 justify-end">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onView(emp)}><Eye className="w-3 h-3" /></Button>
                      {canManage && <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(emp)}><Pencil className="w-3 h-3" /></Button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}