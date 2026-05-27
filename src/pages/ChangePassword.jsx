import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Shield,
  CheckCircle2,
  Loader2,
  Eye,
  EyeOff
} from 'lucide-react';

const PASSWORD_RE =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

function getDashboardPath(u) {
  const role = u?.role;

  if (role === 'engineer') return '/ark-connect';
  if (role === 'hr') return '/hr';
  if (role === 'finance') return '/finance';
  if (role === 'inventory' || role === 'procurement') return '/spare-parts';
  if (role === 'manager' || role === 'agm' || role === 'ceo') return '/manager';
  if (role === 'helpdesk') return '/tickets';

  return '/';
}

export default function ChangePassword() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);

  const [current, setCurrent] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirm, setConfirm] = useState('');

  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadUser = async () => {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (!session?.user) return;

      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('email', session.user.email)
        .single();

      setUser(data || session.user);
    };

    loadUser();
  }, []);

  const handleSubmit = async () => {
    setError('');

    if (!current) {
      setError('Current password is required.');
      return;
    }

    if (!newPass) {
      setError('New password is required.');
      return;
    }

    if (!confirm) {
      setError('Please confirm your new password.');
      return;
    }

    if (newPass !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    if (!PASSWORD_RE.test(newPass)) {
      setError(
        'Password must be at least 8 characters and contain uppercase, lowercase, number, and special character.'
      );
      return;
    }

    if (newPass === current) {
      setError('New password must be different from your current password.');
      return;
    }

    setSaving(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPass
      });

      if (updateError) {
        throw updateError;
      }

      if (user?.id) {
        await supabase
          .from('users')
          .update({
            must_change_password: false
          })
          .eq('id', user.id);
      }

      setSuccess(true);

      setTimeout(() => {
        navigate(getDashboardPath(user));
      }, 2000);

    } catch (err) {
      console.error(err);

      setError(
        err?.message ||
        'Password update failed. Please try again.'
      );

      setSaving(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#08153d] via-[#0b1f5e] to-[#102969] p-4">
        <Card className="p-8 max-w-sm w-full text-center space-y-4">

          <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto" />

          <h2 className="text-xl font-bold">
            Password Updated!
          </h2>

          <p className="text-sm text-muted-foreground">
            Password updated successfully. Redirecting…
          </p>

        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#08153d] via-[#0b1f5e] to-[#102969] p-4">

      <Card className="p-8 max-w-md w-full space-y-6">

        <div className="text-center space-y-2">

          <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto">
            <Shield className="w-7 h-7 text-amber-600" />
          </div>

          <h1 className="text-xl font-bold">
            Change Your Password
          </h1>

          {user?.must_change_password && (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
              Your password is temporary. Please create a new password to continue.
            </p>
          )}

        </div>

        <div className="space-y-4">

          <div className="space-y-1.5">

            <Label>Current Password</Label>

            <Input
              type="password"
              placeholder="Enter current password"
              value={current}
              onChange={e => setCurrent(e.target.value)}
            />

          </div>

          <div className="space-y-1.5">

            <Label>New Password</Label>

            <div className="relative">

              <Input
                type={showNew ? 'text' : 'password'}
                placeholder="Min 8 chars, upper, lower, number, special"
                value={newPass}
                onChange={e => setNewPass(e.target.value)}
                className="pr-10"
              />

              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                onClick={() => setShowNew(v => !v)}
              >
                {showNew
                  ? <EyeOff className="w-4 h-4" />
                  : <Eye className="w-4 h-4" />}
              </button>

            </div>

          </div>

          <div className="space-y-1.5">

            <Label>Confirm New Password</Label>

            <div className="relative">

              <Input
                type={showConfirm ? 'text' : 'password'}
                placeholder="Re-enter new password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                className="pr-10"
              />

              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                onClick={() => setShowConfirm(v => !v)}
              >
                {showConfirm
                  ? <EyeOff className="w-4 h-4" />
                  : <Eye className="w-4 h-4" />}
              </button>

            </div>

          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={!current || !newPass || !confirm || saving}
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Updating password...
              </>
            ) : (
              'Update Password'
            )}
          </Button>

          {!user?.must_change_password && (
            <Button
              variant="ghost"
              className="w-full text-muted-foreground"
              onClick={() => navigate(-1)}
            >
              Cancel
            </Button>
          )}

        </div>

      </Card>

    </div>
  );
}