import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Mail, Settings, Zap, Shield, Clock, MessageSquare, Plus, Trash2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const INTEGRATION_CARDS = [
  {
    id: 'gmail',
    name: 'Gmail / Google Workspace',
    icon: '📧',
    description: 'Connect via Gmail API (OAuth 2.0). Supports full sync, labels, and threads.',
    fields: ['Client Email', 'OAuth App Client ID', 'OAuth App Secret'],
  },
  {
    id: 'outlook',
    name: 'Microsoft 365 / Outlook',
    icon: '📮',
    description: 'Connect via Microsoft Graph API. Supports Exchange Online and Outlook accounts.',
    fields: ['Account Email', 'Tenant ID', 'Client ID', 'Client Secret'],
  },
  {
    id: 'imap',
    name: 'IMAP / POP3 (Generic)',
    icon: '🔌',
    description: 'Connect any email server using standard IMAP/POP3 protocol.',
    fields: ['IMAP Host', 'IMAP Port', 'Username', 'Password'],
  },
  {
    id: 'smtp',
    name: 'SMTP Outgoing Mail',
    icon: '📤',
    description: 'Configure outgoing SMTP server for sending replies and new emails.',
    fields: ['SMTP Host', 'SMTP Port', 'Username', 'Password'],
  },
];

const ROUTING_DEFAULTS = [
  { keyword: 'ATM, fault, device, terminal', department: 'Helpdesk / Operations', category: 'Bank Support' },
  { keyword: 'spare parts, vendor, supplier', department: 'Inventory / Procurement', category: 'Vendor / Supplier' },
  { keyword: 'invoice, payment, billing', department: 'Finance', category: 'Finance Matter' },
  { keyword: 'leave, HR, complaint, appraisal', department: 'HR', category: 'HR Matter' },
  { keyword: 'urgent, escalation, management', department: 'Management', category: 'Escalation' },
];

export default function MailSettingsPanel({ user = {} }) {
  const [syncInterval, setSyncInterval] = useState('5');
  const [autoAck, setAutoAck] = useState(true);
  const [ackTemplate, setAckTemplate] = useState(
    'Dear {sender_name},\n\nThank you for your email. We have received your message and will respond within 24 hours.\n\nBest regards,\nARK Technologies Support Team'
  );
  const [accounts, setAccounts] = useState(['support@ark-technologies.com']);
  const [newAccount, setNewAccount] = useState('');
  const [expandedCard, setExpandedCard] = useState(null);

 const ADMIN_VARIANTS = [
  'admin',
  'administrator',
  'super_admin',
  'Administrator',
  'SUPER_ADMIN'
];

const isAdmin = ADMIN_VARIANTS.includes(user?.role);

  const addAccount = () => {
    if (newAccount && !accounts.includes(newAccount)) {
      setAccounts([...accounts, newAccount]);
      setNewAccount('');
      toast.success('Official email account added');
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-base font-semibold">Official Mail Settings</h2>
        <p className="text-sm text-muted-foreground">Configure email integrations, routing rules, and automation.</p>
      </div>

      {/* Email Integrations */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2"><Mail className="w-4 h-4" /> Email Integrations</h3>
        <div className="grid gap-3">
          {INTEGRATION_CARDS.map(card => (
            <Card key={card.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{card.icon}</span>
                  <div>
                    <p className="text-sm font-medium">{card.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{card.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge variant="outline" className="text-[10px] gap-1">
                    <AlertCircle className="w-3 h-3" /> Not Connected
                  </Badge>
                  {isAdmin && (
                    <Button size="sm" variant="outline" className="text-xs h-7"
                      onClick={() => setExpandedCard(expandedCard === card.id ? null : card.id)}>
                      Configure
                    </Button>
                  )}
                </div>
              </div>
              {expandedCard === card.id && (
                <div className="mt-4 pt-4 border-t space-y-3">
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                    Live email integration requires API credentials. Configure your credentials below. Contact your system administrator to complete the OAuth setup or IMAP connection via the ARK backend.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {card.fields.map(field => (
                      <div key={field} className="space-y-1">
                        <Label className="text-xs">{field}</Label>
                        <Input
                          type={field.toLowerCase().includes('secret') || field.toLowerCase().includes('password') ? 'password' : 'text'}
                          placeholder={field}
                          className="h-8 text-sm"
                        />
                      </div>
                    ))}
                  </div>
                  <Button size="sm" className="text-xs" disabled>Save and Test Connection (Backend Required)</Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>

      {/* Official Email Accounts */}
      <Card className="p-4 space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2"><Shield className="w-4 h-4" /> Official Email Accounts</h3>
        <div className="space-y-2">
          {accounts.map((acc, i) => (
            <div key={i} className="flex items-center justify-between bg-muted/50 rounded px-3 py-1.5">
              <span className="text-sm">{acc}</span>
              {isAdmin && (
                <button onClick={() => setAccounts(accounts.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Input value={newAccount} onChange={e => setNewAccount(e.target.value)} placeholder="Add official email account" className="h-8 text-sm" />
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={addAccount}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Add
            </Button>
          </div>
        )}
      </Card>

      {/* Sync Settings */}
      <Card className="p-4 space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2"><Clock className="w-4 h-4" /> Sync Settings</h3>
        <div className="flex items-center gap-4">
          <div className="space-y-1">
            <Label className="text-xs">Sync Frequency (minutes)</Label>
            <Input type="number" value={syncInterval} onChange={e => setSyncInterval(e.target.value)} className="h-8 text-sm w-28" min="1" max="60" />
          </div>
          <div className="flex items-center gap-2 pt-4">
            <Switch checked={autoAck} onCheckedChange={setAutoAck} />
            <Label className="text-xs">Auto-Acknowledgement</Label>
          </div>
        </div>
      </Card>

      {/* Auto-Acknowledgement Template */}
      {autoAck && (
        <Card className="p-4 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2"><MessageSquare className="w-4 h-4" /> Auto-Acknowledgement Template</h3>
          <p className="text-xs text-muted-foreground">Use sender_name and subject as placeholders wrapped in curly braces.</p>
          <Textarea value={ackTemplate} onChange={e => setAckTemplate(e.target.value)} className="text-sm resize-none h-28" />
          <Button size="sm" className="text-xs" onClick={() => toast.success('Template saved')}>Save Template</Button>
        </Card>
      )}

      {/* Department Routing Rules */}
      <Card className="p-4 space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2"><Zap className="w-4 h-4" /> Department Routing Rules</h3>
        <p className="text-xs text-muted-foreground">Default routing logic based on email keywords and categories.</p>
        <div className="divide-y rounded border overflow-hidden">
          <div className="grid grid-cols-3 gap-2 px-3 py-1.5 bg-muted text-xs font-medium text-muted-foreground">
            <span>Keywords / Trigger</span>
            <span>Routes to</span>
            <span>Category</span>
          </div>
          {ROUTING_DEFAULTS.map((rule, i) => (
            <div key={i} className="grid grid-cols-3 gap-2 px-3 py-2 text-xs">
              <span className="text-muted-foreground">{rule.keyword}</span>
              <span className="font-medium">{rule.department}</span>
              <Badge variant="outline" className="text-[10px] w-fit">{rule.category}</Badge>
            </div>
          ))}
        </div>
        {isAdmin && (
          <Button size="sm" variant="outline" className="text-xs" onClick={() => toast.info('Custom routing rules — coming soon')}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Add Custom Rule
          </Button>
        )}
      </Card>

      {isAdmin && (
        <Button onClick={() => toast.success('Settings saved')} className="text-sm">Save All Settings</Button>
      )}
    </div>
  );
}