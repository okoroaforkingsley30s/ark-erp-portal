import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';

const COUNTRIES = ["Nigeria","Ghana","Cameroon","Benin Republic","Sierra Leone","Liberia","Ivory Coast","Senegal","Gambia","Guinea","Congo Brazzaville"];

// Defined OUTSIDE component — prevents remount/focus-loss on every keystroke
function Field({ label, k, type = 'text', placeholder, value, onChange }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {type === 'textarea' ? (
        <Textarea value={value || ''} onChange={e => onChange(k, e.target.value)} className="h-16 text-sm" placeholder={placeholder} />
      ) : (
        <Input type={type} value={value || ''} onChange={e => onChange(k, e.target.value)} className="h-8 text-sm" placeholder={placeholder} />
      )}
    </div>
  );
}

function Sel({ label, k, options, value, onChange }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Select value={value || ''} onValueChange={v => onChange(k, v)}>
        <SelectTrigger className="h-8 text-sm"><SelectValue placeholder={`Select ${label}`} /></SelectTrigger>
        <SelectContent>{options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}

export default function EmployeeFormDialog({ open, onOpenChange, form, setForm, editing, onSave, saving }) {
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const f = (k) => ({ k, value: form[k], onChange: set });
  const s = (k) => ({ k, value: form[k], onChange: set });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editing ? 'Edit' : 'Add'} Employee</DialogTitle></DialogHeader>
        <Tabs defaultValue="personal">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="personal" className="text-xs">Personal</TabsTrigger>
            <TabsTrigger value="employment" className="text-xs">Employment</TabsTrigger>
            <TabsTrigger value="kin" className="text-xs">Next of Kin</TabsTrigger>
            <TabsTrigger value="guarantors" className="text-xs">Guarantors</TabsTrigger>
          </TabsList>

          <TabsContent value="personal" className="space-y-3 mt-3">
            <div className="grid grid-cols-2 gap-3">
              <Sel label="Title" options={["Mr","Mrs","Miss","Ms","Dr","Engr","Prof"]} {...s('title')} />
              <Field label="Full Name *" placeholder="Full legal name" {...f('full_name')} />
              <Sel label="Gender" options={["Male","Female"]} {...s('gender')} />
              <Sel label="Marital Status" options={["Single","Married","Divorced","Widowed"]} {...s('marital_status')} />
              <Field label="Date of Birth" type="date" {...f('date_of_birth')} />
              <Field label="Phone Number" placeholder="+234..." {...f('phone_number')} />
              <Field label="Email Address" type="email" {...f('email_address')} />
              <Sel label="Religion" options={["Christianity","Islam","Traditional","Other"]} {...s('religion')} />
              <Field label="State of Origin" {...f('state_of_origin')} />
              <Field label="LGA" {...f('local_government_area')} />
              <Field label="Nationality" {...f('nationality')} />
              <Sel label="Country *" options={COUNTRIES} {...s('country')} />
            </div>
            <Field label="Home Address" type="textarea" {...f('home_address')} />
            <div className="grid grid-cols-2 gap-3">
              <Sel label="ID Type" options={["NIN","Passport","Voter Card","Driver License","Staff ID"]} {...s('national_id_type')} />
              <Field label="ID Number" {...f('national_id_number')} />
            </div>
          </TabsContent>

          <TabsContent value="employment" className="space-y-3 mt-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Staff ID *" placeholder="e.g. ARK-001" {...f('staff_id')} />
              <Field label="Job Title" {...f('job_title')} />
              <Field label="Department *" placeholder="e.g. Engineering" {...f('department')} />
              <Field label="Current Level" placeholder="e.g. L3, Senior" {...f('current_level')} />
              <Field label="Date of Employment" type="date" {...f('date_of_employment')} />
              <Field label="Current Pay (₦)" type="number" {...f('current_pay')} />
              <Sel label="Employment Status" options={["Active","On Leave","Suspended","Terminated","Resigned"]} {...s('employment_status')} />
            </div>
          </TabsContent>

          <TabsContent value="kin" className="space-y-3 mt-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Full Name" {...f('next_of_kin_full_name')} />
              <Field label="Relationship" placeholder="e.g. Spouse, Parent" {...f('next_of_kin_relationship')} />
              <Field label="Phone" {...f('next_of_kin_phone_number')} />
              <Field label="Email" type="email" {...f('next_of_kin_email_address')} />
              <Field label="Occupation" {...f('next_of_kin_occupation')} />
              <Sel label="ID Type" options={["NIN","Passport","Voter Card","Driver License"]} {...s('next_of_kin_id_type')} />
              <Field label="ID Number" {...f('next_of_kin_id_number')} />
            </div>
            <Field label="Address" type="textarea" {...f('next_of_kin_address')} />
          </TabsContent>

          <TabsContent value="guarantors" className="space-y-4 mt-3">
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase">Guarantor 1</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Full Name" {...f('guarantor_1_full_name')} />
                <Field label="Phone" {...f('guarantor_1_phone_number')} />
                <Field label="Email" type="email" {...f('guarantor_1_email_address')} />
                <Field label="Occupation" {...f('guarantor_1_occupation')} />
                <Sel label="ID Type" options={["NIN","Passport","Voter Card","Driver License"]} {...s('guarantor_1_id_type')} />
                <Field label="ID Number" {...f('guarantor_1_id_number')} />
              </div>
              <div className="grid grid-cols-2 gap-3 mt-2">
                <Field label="Home Address" type="textarea" {...f('guarantor_1_home_address')} />
                <Field label="Office Address" type="textarea" {...f('guarantor_1_office_address')} />
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase">Guarantor 2</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Full Name" {...f('guarantor_2_full_name')} />
                <Field label="Phone" {...f('guarantor_2_phone_number')} />
                <Field label="Email" type="email" {...f('guarantor_2_email_address')} />
                <Field label="Occupation" {...f('guarantor_2_occupation')} />
                <Sel label="ID Type" options={["NIN","Passport","Voter Card","Driver License"]} {...s('guarantor_2_id_type')} />
                <Field label="ID Number" {...f('guarantor_2_id_number')} />
              </div>
              <div className="grid grid-cols-2 gap-3 mt-2">
                <Field label="Home Address" type="textarea" {...f('guarantor_2_home_address')} />
                <Field label="Office Address" type="textarea" {...f('guarantor_2_office_address')} />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Create Login Account section */}
        <div className="mt-3 border rounded-lg p-3 space-y-3 bg-muted/30">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="w-4 h-4 rounded"
              checked={!!form.create_login}
              onChange={e => set('create_login', e.target.checked)}
            />
            <span className="text-sm font-medium">Create user login account</span>
          </label>
          {form.create_login && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Login Email *" type="email" placeholder="user@company.com" {...f('login_email')} />
              <Sel label="Login Role" options={['admin','hr','engineer','helpdesk','manager','finance','inventory','procurement','crm','client']} {...s('login_role')} />
            </div>
          )}
          {form.create_login && <p className="text-xs text-muted-foreground">User will be invited by email and forced to set a password on first login.</p>}
        </div>

        <Button className="w-full mt-2" onClick={onSave} disabled={!form.full_name || saving}>
          {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {editing ? 'Update' : 'Create'} Employee
        </Button>
      </DialogContent>
    </Dialog>
  );
}