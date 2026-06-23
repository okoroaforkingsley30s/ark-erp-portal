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
  EyeOff,
  User,
  Phone,
  BadgeCheck
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

  return '/dashboard';
}

export default function ChangePassword() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [staffId, setStaffId] = useState('');

  const [newPass, setNewPass] = useState('');
  const [confirm, setConfirm] = useState('');

  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const [loadingSession, setLoadingSession] = useState(true);

  const [error, setError] = useState('');

useEffect(() => {
  const setupInviteSession = async () => {
    try {
      setError('');

      const hash = window.location.hash || '';
      const search = window.location.search || '';

      const hashParams = new URLSearchParams(
  hash
  .replace(/^#\/create-password\??/, '')
  .replace(/^#\/reset-password\??/, '')
  .replace(/^#\/change-password\??/, '')
  .replace(/^#/, '')
);
      const searchParams = new URLSearchParams(search.replace(/^\?/, ''));

      const errorCode =
        hashParams.get('error_code') ||
        searchParams.get('error_code');

      const errorDescription =
        hashParams.get('error_description') ||
        searchParams.get('error_description');

      if (errorCode) {
  setError(
    'This password link has expired or has already been used. Please request a new password reset link.'
  );
  setLoadingSession(false);
  return;
}

      const accessToken =
        hashParams.get('access_token') ||
        searchParams.get('access_token');

      const refreshToken =
        hashParams.get('refresh_token') ||
        searchParams.get('refresh_token');

      const code =
  searchParams.get('code') ||
  hashParams.get('code') ||
  new URLSearchParams(window.location.href.split('?')[1]?.split('#')[0] || '').get('code');

if (accessToken && refreshToken) {
  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (error) throw error;

  window.history.replaceState({}, document.title, '/#/create-password');
}

if (code) {
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) throw error;

  window.history.replaceState({}, document.title, '/#/create-password');
}

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        setError('Auth session missing. Please open the newest invite email link once, or request a new invite.');
        setLoadingSession(false);
        return;
      }

      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('email', session.user.email)
        .maybeSingle();

      const currentUser = profile || {
        id: session.user.id,
        email: session.user.email,
        full_name: session.user.user_metadata?.full_name || '',
        phone: '',
        employee_id: '',
        role: session.user.user_metadata?.role || null,
      };

      setUser(currentUser);
      setFullName(currentUser?.full_name || '');
      setPhone(currentUser?.phone || '');
      setStaffId(currentUser?.employee_id || '');
    } catch (err) {
      console.error('Invite/session setup failed:', err);
      setError(err?.message || 'Invalid or expired invitation link.');
    } finally {
      setLoadingSession(false);
    }
  };

  setupInviteSession();
}, [navigate]);

  const handleSubmit = async () => {
    setError('');

    if (!fullName) {
      setError('Full name is required.');
      return;
    }

    if (!phone) {
      setError('Phone number is required.');
      return;
    }

    if (!staffId) {
      setError('Staff ID is required.');
      return;
    }

    if (!newPass) {
      setError('New password is required.');
      return;
    }

    if (!confirm) {
      setError('Please confirm your password.');
      return;
    }

    if (newPass !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    if (!PASSWORD_RE.test(newPass)) {
      setError(
        'Password must contain uppercase, lowercase, number and special character.'
      );
      return;
    }

    setSaving(true);

    try {
      const { error: updateError } =
        await supabase.auth.updateUser({
          password: newPass,
          data: {
            full_name: fullName,
          }
        });

      if (updateError) {
        throw updateError;
      }

      if (user?.id) {
        await supabase
          .from('users')
          .update({
            full_name: fullName,
            phone,
            employee_id: staffId,
            must_change_password: false,
            is_approved: true,
            updated_at: new Date().toISOString(),
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
        'Account setup failed.'
      );

      setSaving(false);
    }
  };

  if (loadingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#08153d] via-[#0b1f5e] to-[#102969]">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen overflow-y-auto bg-gradient-to-br from-[#08153d] via-[#0b1f5e] to-[#102969] p-4">

        <Card className="p-8 max-w-sm w-full text-center space-y-4">

          <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto" />

          <h2 className="text-xl font-bold">
            Account Setup Complete
          </h2>

          <p className="text-sm text-muted-foreground">
            Redirecting to ARK ONE Portal...
          </p>

        </Card>

      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-y-auto bg-gradient-to-br from-[#08153d] via-[#0b1f5e] to-[#102969] p-4">

      <Card className="p-8 max-w-md w-full mx-auto my-8 space-y-6 border-0 shadow-2xl">

        <div className="text-center space-y-3">

          <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto">
            <Shield className="w-8 h-8 text-amber-600" />
          </div>

          <div>
            <h1 className="text-2xl font-bold">
              Complete Your Account
            </h1>

            <p className="text-sm text-muted-foreground mt-1">
              Finish setting up your ARK ONE ERP Portal access
            </p>
          </div>

        </div>

        <div className="space-y-4">

          <div className="space-y-1.5">
            <Label>Full Name</Label>

            <div className="relative">
              <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />

              <Input
                className="pl-10"
                placeholder="Enter full name"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Phone Number</Label>

            <div className="relative">
              <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />

              <Input
                className="pl-10"
                placeholder="Enter phone number"
                value={phone}
                onChange={e => setPhone(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Staff ID</Label>

            <div className="relative">
              <BadgeCheck className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />

              <Input
                className="pl-10"
                placeholder="Enter staff ID"
                value={staffId}
                onChange={e => setStaffId(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">

            <Label>Create Password</Label>

            <div className="relative">

              <Input
                type={showNew ? 'text' : 'password'}
                placeholder="Create secure password"
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

            <Label>Confirm Password</Label>

            <div className="relative">

              <Input
                type={showConfirm ? 'text' : 'password'}
                placeholder="Confirm password"
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
            className="w-full h-11 text-base"
            onClick={handleSubmit}
            disabled={
              !fullName ||
              !phone ||
              !staffId ||
              !newPass ||
              !confirm ||
              saving
            }
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Setting up account...
              </>
            ) : (
              'Complete Setup'
            )}
          </Button>

        </div>

      </Card>

    </div>
  );
}