import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

import {
  Loader2,
  Save,
  Info,
  User,
  Mail,
  ShieldCheck,
  Phone,
  Building2,
  Wrench,
  CheckCircle,
} from 'lucide-react';

import useCurrentUser from '@/hooks/useCurrentUser';

export default function Settings() {
  const { user: outletUser } = useOutletContext();
  const { user, updateUser } = useCurrentUser();

  const currentUser = user || outletUser;

  const [form, setForm] = useState({
    phone: '',
    department: '',
    specialization: '',
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!currentUser) return;

    setForm({
      phone: currentUser.phone || '',
      department: currentUser.department || '',
      specialization: currentUser.specialization || '',
    });
  }, [currentUser]);

  const handleSave = async () => {
    if (!currentUser?.email) return;

    try {
      setSaving(true);

      if (typeof updateUser === 'function') {
        await updateUser(form);
      } else {
        const { error } = await supabase
          .from('users')
          .update({
            phone: form.phone,
            department: form.department,
            specialization: form.specialization,
            updated_at: new Date().toISOString(),
          })
          .eq('email', currentUser.email);

        if (error) throw error;
      }

      alert('Profile updated successfully.');
    } catch (error) {
      console.error('Profile update failed:', error);
      alert(`Profile update failed: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const profileInitial =
    currentUser?.full_name?.[0]?.toUpperCase() ||
    currentUser?.email?.[0]?.toUpperCase() ||
    'A';

  const displayName =
    currentUser?.full_name ||
    currentUser?.name ||
    currentUser?.email ||
    'ARK ONE User';

  const displayRole =
    currentUser?.role ||
    'User';

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white">
          Settings
        </h1>

        <p className="text-sm text-slate-300 mt-0.5">
          Manage your profile, account details and ARK ONE system information.
        </p>
      </div>

      <Card className="bg-slate-900/95 border border-slate-700 text-white shadow-xl">
        <CardContent className="p-5">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-2xl bg-orange-500/15 border border-orange-500/40 flex items-center justify-center shadow-[0_0_25px_rgba(249,115,22,0.18)]">
              <span className="text-3xl font-bold text-orange-400">
                {profileInitial}
              </span>
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-xs text-orange-400 font-semibold uppercase tracking-widest">
                Current Account
              </p>

              <h2 className="text-2xl font-bold text-white truncate mt-1">
                {displayName}
              </h2>

              <p className="text-sm text-slate-300 truncate mt-1">
                {currentUser?.email || 'No email found'}
              </p>

              <div className="flex flex-wrap gap-2 mt-3">
                <span className="text-xs px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-300 capitalize">
                  {displayRole}
                </span>

                <span className="text-xs px-3 py-1 rounded-full bg-green-500/10 border border-green-500/30 text-green-300">
                  Active
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-slate-900/95 border border-slate-700 text-white shadow-xl">
        <CardHeader className="border-b border-slate-800">
          <CardTitle className="text-base text-white flex items-center gap-2">
            <User className="w-4 h-4 text-orange-400" />
            Profile Information
          </CardTitle>

          <CardDescription className="text-slate-400">
            Update your personal details.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5 p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ReadOnlyField
              label="Name"
              value={displayName}
              icon={<User className="w-4 h-4" />}
            />

            <ReadOnlyField
              label="Email"
              value={currentUser?.email || 'Not set'}
              icon={<Mail className="w-4 h-4" />}
            />

            <ReadOnlyField
              label="Role"
              value={displayRole}
              icon={<ShieldCheck className="w-4 h-4" />}
              capitalize
            />

            <EditableField
              label="Phone"
              value={form.phone}
              onChange={(value) =>
                setForm((f) => ({
                  ...f,
                  phone: value,
                }))
              }
              placeholder="+234 000 000 0000"
              icon={<Phone className="w-4 h-4" />}
            />

            <EditableField
              label="Department"
              value={form.department}
              onChange={(value) =>
                setForm((f) => ({
                  ...f,
                  department: value,
                }))
              }
              placeholder="e.g., IT Operations"
              icon={<Building2 className="w-4 h-4" />}
            />

            {String(currentUser?.role || '').toLowerCase() === 'engineer' && (
              <EditableField
                label="Specialization"
                value={form.specialization}
                onChange={(value) =>
                  setForm((f) => ({
                    ...f,
                    specialization: value,
                  }))
                }
                placeholder="e.g., ATM Field Support"
                icon={<Wrench className="w-4 h-4" />}
              />
            )}
          </div>

          <Separator className="bg-slate-800" />

          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-orange-500 hover:bg-orange-600 text-white font-semibold"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Save Changes
          </Button>
        </CardContent>
      </Card>

      <Card className="bg-slate-900/95 border border-slate-700 text-white shadow-xl">
        <CardHeader className="border-b border-slate-800">
          <CardTitle className="text-base flex items-center gap-2 text-white">
            <Info className="w-4 h-4 text-orange-400" />
            About ARK ONE
          </CardTitle>

          <CardDescription className="text-slate-400">
            Application version and system information.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5 p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            {[
              ['App Name', 'ARK ONE Portal'],
              ['Version', 'v1.0.0'],
              ['Platform', 'ARK Technologies Group'],
              ['Build Date', '2026'],
              ['Database', 'Live — Supabase Cloud Hosted'],
              ['Updates', 'Over-The-Air (OTA)'],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl bg-slate-950 border border-slate-800 p-3"
              >
                <p className="text-xs text-slate-500">
                  {label}
                </p>

                <p className="font-medium text-sm text-slate-100 mt-1">
                  {value}
                </p>
              </div>
            ))}
          </div>

          <Separator className="bg-slate-800" />

          <div className="rounded-2xl bg-slate-950 border border-slate-800 p-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-white">
                System Status
              </p>

              <p className="text-xs text-slate-400 mt-1">
                All systems operational
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />

              <span className="text-xs text-green-400 font-semibold">
                Online
              </span>
            </div>
          </div>

          <div className="rounded-2xl bg-orange-500/10 border border-orange-500/30 p-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-orange-400 mt-0.5 flex-shrink-0" />

              <p className="text-xs text-slate-300 leading-relaxed">
                ARK ONE automatically syncs data in real time. Frontend updates
                are delivered instantly via the cloud. Mobile app updates are
                pushed via the respective app stores.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="text-center pb-4">
        <p className="text-xs text-slate-500">
          Logged in as
        </p>

        <p className="text-sm font-semibold text-slate-300">
          {displayName}
        </p>

        <p className="text-xs text-slate-500 mt-1">
          {currentUser?.email || ''}
        </p>
      </div>
    </div>
  );
}

function ReadOnlyField({ label, value, icon, capitalize = false }) {
  return (
    <div className="space-y-2">
      <Label className="text-slate-300 flex items-center gap-2">
        <span className="text-orange-400">
          {icon}
        </span>
        {label}
      </Label>

      <Input
        value={value || ''}
        disabled
        className={`bg-slate-950 border-slate-700 text-slate-300 disabled:opacity-100 ${
          capitalize ? 'capitalize' : ''
        }`}
      />
    </div>
  );
}

function EditableField({
  label,
  value,
  onChange,
  placeholder,
  icon,
}) {
  return (
    <div className="space-y-2">
      <Label className="text-slate-300 flex items-center gap-2">
        <span className="text-orange-400">
          {icon}
        </span>
        {label}
      </Label>

      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-slate-950 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-orange-500"
      />
    </div>
  );
}
