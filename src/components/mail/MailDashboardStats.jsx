import React from 'react';
import { Card } from '@/components/ui/card';
import { Mail, MailOpen, Clock, AlertTriangle, CheckCircle2, Ticket, Users, BarChart3 } from 'lucide-react';
import { format, isToday } from 'date-fns';

const CATEGORY_COLORS = {
  'Bank Support': 'bg-blue-100 text-blue-800',
  'Client Request': 'bg-purple-100 text-purple-800',
  'Vendor / Supplier': 'bg-orange-100 text-orange-800',
  'Staff Internal': 'bg-gray-100 text-gray-800',
  'HR Matter': 'bg-pink-100 text-pink-800',
  'Finance Matter': 'bg-green-100 text-green-800',
  'Procurement Matter': 'bg-yellow-100 text-yellow-800',
  'General Enquiry': 'bg-cyan-100 text-cyan-800',
  'Complaint': 'bg-red-100 text-red-800',
  'Escalation': 'bg-red-200 text-red-900',
  'Other': 'bg-gray-100 text-gray-600',
};

function StatTile({ icon: Icon, label, value, color = 'text-primary' }) {
  return (
    <Card className="p-4 flex items-center gap-4">
      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <div>
        <p className="text-2xl font-bold text-[#ff5a00]">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </Card>
  );
}

export default function MailDashboardStats({ emails = [] }) {
  const today = emails.filter(e => e.received_at && isToday(new Date(e.received_at)));
  const unread = emails.filter(e => e.email_status === 'New');
  const assigned = emails.filter(e => e.email_status === 'Assigned');
  const converted = emails.filter(e => e.email_status === 'Converted to Ticket' || e.email_status === 'Converted to Task');
  const pendingReply = emails.filter(e => !e.replied_status && ['New', 'Reviewed', 'Assigned'].includes(e.email_status));
  const highPriority = emails.filter(e => ['high', 'critical'].includes(e.priority) && e.email_status !== 'Archived');

  // Category breakdown
  const byCategory = emails.reduce((acc, e) => {
    const cat = e.email_category || 'Other';
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {});

  // Department workload
  const byDept = emails.filter(e => e.assigned_department).reduce((acc, e) => {
    acc[e.assigned_department] = (acc[e.assigned_department] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile icon={Mail} label="New Today" value={today.length} color="text-blue-600" />
        <StatTile icon={MailOpen} label="Unread" value={unread.length} color="text-amber-600" />
        <StatTile icon={AlertTriangle} label="High Priority" value={highPriority.length} color="text-red-600" />
        <StatTile icon={Clock} label="Pending Reply" value={pendingReply.length} color="text-orange-600" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile icon={Users} label="Assigned" value={assigned.length} color="text-purple-600" />
        <StatTile icon={Ticket} label="Converted to Tickets" value={converted.length} color="text-green-600" />
        <StatTile icon={CheckCircle2} label="Total Emails" value={emails.filter(e => !e.archived_status).length} />
        <StatTile icon={BarChart3} label="Categories Active" value={Object.keys(byCategory).length} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <p className="text-sm font-semibold mb-3">Emails by Category</p>
          <div className="space-y-2">
            {Object.entries(byCategory).sort((a, b) => b[1] - a[1]).map(([cat, count]) => (
              <div key={cat} className="flex items-center justify-between">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[cat] || 'bg-gray-100 text-gray-600'}`}>{cat}</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${Math.round((count / emails.length) * 100)}%` }} />
                  </div>
                  <span className="text-xs font-medium w-6 text-right">{count}</span>
                </div>
              </div>
            ))}
            {Object.keys(byCategory).length === 0 && <p className="text-sm text-muted-foreground">No emails yet</p>}
          </div>
        </Card>

        <Card className="p-4">
          <p className="text-sm font-semibold mb-3">Department Email Workload</p>
          <div className="space-y-2">
            {Object.entries(byDept).sort((a, b) => b[1] - a[1]).map(([dept, count]) => (
              <div key={dept} className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{dept}</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(100, count * 20)}%` }} />
                  </div>
                  <span className="text-xs font-medium w-6 text-right">{count}</span>
                </div>
              </div>
            ))}
            {Object.keys(byDept).length === 0 && <p className="text-sm text-muted-foreground">No assignments yet</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}