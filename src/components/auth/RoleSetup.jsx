import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CircleDot, Shield, Headphones, Wrench, User, BarChart3, UserCheck, DollarSign, TrendingUp, ShoppingCart, Crown, Star, HardHat, Boxes } from 'lucide-react';
import { cn } from '@/lib/utils';

const roles = [
  // Executive Management
  { value: 'admin',       label: 'Administrator',           icon: Shield,      desc: 'Full system control and management',                   color: 'border-red-200 bg-red-50',      activeColor: 'border-red-500',    group: 'Administration' },
  { value: 'ceo',         label: 'CEO',                     icon: Crown,       desc: 'Executive visibility and company-wide analytics',      color: 'border-yellow-200 bg-yellow-50',activeColor: 'border-yellow-500', group: 'Executive Management' },
  { value: 'ceo_pa',      label: 'CEO Personal Assistant',  icon: Star,        desc: 'Executive reporting and schedule coordination',         color: 'border-yellow-100 bg-yellow-50',activeColor: 'border-yellow-400', group: 'Executive Management' },
  { value: 'agm',         label: 'Asst. General Manager',   icon: BarChart3,   desc: 'Operational oversight and department coordination',     color: 'border-purple-200 bg-purple-50',activeColor: 'border-purple-500', group: 'Executive Management' },
  // Operations
  { value: 'manager',     label: 'Operational Manager',     icon: BarChart3,   desc: 'Approve assignments, monitor engineers, review SLA',    color: 'border-indigo-200 bg-indigo-50',activeColor: 'border-indigo-500', group: 'Operations' },
  { value: 'repair_head', label: 'Head of Repair & Refurb.',icon: HardHat,     desc: 'Manage repair center workflow and refurbishment ops',   color: 'border-orange-200 bg-orange-50',activeColor: 'border-orange-500', group: 'Operations' },
  { value: 'helpdesk',    label: 'Help Desk',               icon: Headphones,  desc: 'Ticket management, engineer dispatch and client support',color: 'border-blue-200 bg-blue-50',    activeColor: 'border-blue-500',   group: 'Operations' },
  { value: 'engineer',    label: 'Field Engineer',           icon: Wrench,      desc: 'Field operations, site check-in and device maintenance',color: 'border-amber-200 bg-amber-50',  activeColor: 'border-amber-500',  group: 'Operations' },
  // Administration
  { value: 'hr',          label: 'Human Resources',         icon: UserCheck,   desc: 'Staff management, leave approval and onboarding',       color: 'border-pink-200 bg-pink-50',    activeColor: 'border-pink-500',   group: 'Administration' },
  { value: 'finance',     label: 'Finance',                 icon: DollarSign,  desc: 'Income, expenses and financial reporting',              color: 'border-green-200 bg-green-50',  activeColor: 'border-green-500',  group: 'Administration' },
  // Supply Chain
  { value: 'inventory',   label: 'Inventory',               icon: Boxes,       desc: 'Stock management, part dispatch and supply chain',      color: 'border-teal-200 bg-teal-50',    activeColor: 'border-teal-500',   group: 'Supply Chain' },
  { value: 'procurement', label: 'Procurement',             icon: ShoppingCart,desc: 'Purchase orders, vendor tracking and procurement',      color: 'border-cyan-200 bg-cyan-50',    activeColor: 'border-cyan-500',   group: 'Supply Chain' },
  { value: 'crm',         label: 'CRM / Marketing',         icon: TrendingUp,  desc: 'Lead management and client relations',                  color: 'border-violet-200 bg-violet-50',activeColor: 'border-violet-500', group: 'Administration' },
  { value: 'client',      label: 'Client / Bank',           icon: User,        desc: 'Submit tickets and track your services',                color: 'border-slate-200 bg-slate-50',  activeColor: 'border-slate-400',  group: 'External' },
];

const groups = ['Executive Management', 'Operations', 'Administration', 'Supply Chain', 'External'];

export default function RoleSetup({ user, onSetup }) {
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleSetup = async () => {
    if (!selected) return;
    setSaving(true);
    await onSetup({ role: selected });
    setSaving(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-3xl">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center shadow-lg">
            <CircleDot className="w-7 h-7 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold">ARK ONE Portal</h1>
            <p className="text-xs text-muted-foreground">ARK Technologies Group · Enterprise ERP</p>
          </div>
        </div>

        <Card>
          <CardHeader className="text-center pb-3">
            <CardTitle>Welcome, {user?.full_name?.split(' ')[0] || 'User'}!</CardTitle>
            <CardDescription>Select your role to access your portal. Contact your administrator if unsure.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 mb-5">
              {groups.map(group => {
                const groupRoles = roles.filter(r => r.group === group);
                if (!groupRoles.length) return null;
                return (
                  <div key={group}>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 px-1">{group}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {groupRoles.map(role => (
                        <button
                          key={role.value}
                          onClick={() => setSelected(role.value)}
                          className={cn(
                            'flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left',
                            selected === role.value
                              ? role.activeColor + ' ' + role.color
                              : 'border-border hover:border-primary/30 hover:bg-muted/30'
                          )}
                        >
                          <div className={cn(
                            'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0',
                            selected === role.value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                          )}>
                            <role.icon className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="font-semibold text-sm">{role.label}</p>
                            <p className="text-xs text-muted-foreground leading-tight">{role.desc}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <Button className="w-full" disabled={!selected || saving} onClick={handleSetup}>
              {saving ? 'Setting up your portal...' : selected ? `Continue as ${roles.find(r => r.value === selected)?.label}` : 'Select a role to continue'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}