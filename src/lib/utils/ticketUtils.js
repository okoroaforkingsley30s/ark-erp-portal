export function generateTicketId() {
  const prefix = 'ARK';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `${prefix}-${timestamp.slice(-4)}${random}`;
}

export const statusColors = {
  new: 'bg-blue-500/10 text-blue-600 border-blue-200',
  assigned: 'bg-purple-500/10 text-purple-600 border-purple-200',
  in_progress: 'bg-primary/10 text-primary border-primary/20',
  pending: 'bg-orange-500/10 text-orange-600 border-orange-200',
  resolved: 'bg-green-500/10 text-green-600 border-green-200',
  closed: 'bg-muted text-muted-foreground border-border',
};

export const priorityColors = {
  low: 'bg-slate-100 text-slate-600 border-slate-200',
  medium: 'bg-blue-100 text-blue-700 border-blue-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  critical: 'bg-red-100 text-red-700 border-red-200',
};

export const statusLabels = {
  new: 'New',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  pending: 'Pending',
  resolved: 'Resolved',
  closed: 'Closed',
};

export const priorityLabels = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

export const categoryLabels = {
  hardware: 'Hardware',
  software: 'Software',
  network: 'Network',
  security: 'Security',
  maintenance: 'Maintenance',
  installation: 'Installation',
  consultation: 'Consultation',
  other: 'Other',
};