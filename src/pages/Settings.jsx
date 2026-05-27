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
    } catch (error) {
      console.error('Profile update failed:', error);
      alert(`Profile update failed: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">
          Settings
        </h1>

        <p className="text-sm text-muted-foreground mt-0.5">
          Manage your profile
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Profile Information
          </CardTitle>

          <CardDescription>
            Update your personal details
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>

            <Input
              value={currentUser?.full_name || ''}
              disabled
              className="bg-muted"
            />
          </div>

          <div className="space-y-2">
            <Label>Email</Label>

            <Input
              value={currentUser?.email || ''}
              disabled
              className="bg-muted"
            />
          </div>

          <div className="space-y-2">
            <Label>Role</Label>

            <Input
              value={currentUser?.role || ''}
              disabled
              className="bg-muted capitalize"
            />
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Phone</Label>

            <Input
              value={form.phone}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  phone: e.target.value,
                }))
              }
              placeholder="+1 (555) 000-0000"
            />
          </div>

          <div className="space-y-2">
            <Label>Department</Label>

            <Input
              value={form.department}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  department: e.target.value,
                }))
              }
              placeholder="e.g., IT Operations"
            />
          </div>

          {currentUser?.role === 'engineer' && (
            <div className="space-y-2">
              <Label>Specialization</Label>

              <Input
                value={form.specialization}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    specialization: e.target.value,
                  }))
                }
                placeholder="e.g., Network Engineering"
              />
            </div>
          )}

          <Button
            onClick={handleSave}
            disabled={saving}
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="w-4 h-4" />
            About ARK ONE
          </CardTitle>

          <CardDescription>
            Application version and system information
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              ['App Name', 'ARK ONE Portal'],
              ['Version', 'v1.0.0'],
              ['Platform', 'ARK Technologies Group'],
              ['Build Date', '2025'],
              ['Database', 'Live — Supabase Cloud Hosted'],
              ['Updates', 'Over-The-Air (OTA)'],
            ].map(([label, value]) => (
              <div
                key={label}
                className="space-y-0.5"
              >
                <p className="text-xs text-muted-foreground">
                  {label}
                </p>

                <p className="font-medium text-sm">
                  {value}
                </p>
              </div>
            ))}
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">
                System Status
              </p>

              <p className="text-xs text-muted-foreground">
                All systems operational
              </p>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />

              <span className="text-xs text-green-600 font-medium">
                Online
              </span>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            ARK ONE automatically syncs data in real-time. Frontend updates are delivered instantly via the cloud — no reinstall required for web users. Mobile app updates are pushed via the respective app stores.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}