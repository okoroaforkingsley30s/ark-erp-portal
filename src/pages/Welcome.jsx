import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LogIn,
  UserPlus,
  Loader2,
  ArrowLeft,
  Headphones,
  Moon,
  Monitor,
  Smartphone,
  Lock,
  Mail,
  Eye,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabaseClient';

const ADMIN_EMAIL = 'iamkizmith@gmail.com';

export default function Welcome() {
  const navigate = useNavigate();

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [authMode, setAuthMode] = useState(
    typeof window !== 'undefined' && window.innerWidth >= 768 ? 'signin' : null
  );

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setCheckingAuth(false);
  }, []);

  const handleForgotPassword = async () => {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      alert('Please enter your email address first.');
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: `${window.location.origin}/change-password`,
    });

    if (error) alert(error.message);
    else alert('Password reset email sent successfully.');
  };

  const createAdminApprovalNotification = async ({ userId, userEmail, userName }) => {
    const displayName = userName || userEmail;

    await supabase.from('notifications').insert({
      user_email: ADMIN_EMAIL,
      recipient_email: ADMIN_EMAIL,
      title: 'New User Awaiting Approval',
      message: `${displayName} just registered and is awaiting admin approval.`,
      type: 'user_approval',
      read: false,
      is_read: false,
      related_user_id: userId,
      related_user_email: userEmail,
      data: {
        user_id: userId,
        email: userEmail,
        full_name: userName,
        approval_status: 'pending',
      },
      link: '/users',
      sound: 'bell',
      created_at: new Date().toISOString(),
    });
  };

  const handleAuth = async () => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = fullName.trim();

    if (!cleanEmail || !password) {
      alert('Please enter email and password.');
      return;
    }

    if (authMode === 'register' && !cleanName) {
      alert('Please enter your full name.');
      return;
    }

    setLoading(true);

    try {
      if (authMode === 'signin') {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (error) throw error;

        const userId = data?.user?.id;

        if (userId) {
          const { data: profile, error: profileError } = await supabase
            .from('users')
            .select('status, role, approval_status, is_approved')
            .or(`id.eq.${userId},email.eq.${cleanEmail}`)
            .maybeSingle();

          if (profileError) throw profileError;

          const isPending =
            profile?.status === 'pending' ||
            profile?.approval_status === 'pending' ||
            profile?.is_approved === false ||
            !profile?.role;

          if (isPending) {
            await supabase.auth.signOut();
            setAuthMode('pending');
            return;
          }

          if (
            profile?.status === 'rejected' ||
            profile?.approval_status === 'rejected'
          ) {
            await supabase.auth.signOut();
            alert('Your account approval was rejected. Please contact admin.');
            return;
          }
        }

        navigate('/dashboard');
        return;
      }

      if (authMode === 'register') {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: { full_name: cleanName },
          },
        });

        if (error) throw error;

        const authUserId = data?.user?.id;

        if (authUserId) {
          const now = new Date().toISOString();

          const { error: userError } = await supabase.from('users').upsert(
            {
              id: authUserId,
              email: cleanEmail,
              full_name: cleanName,
              role: null,
              status: 'pending',
              approval_status: 'pending',
              is_approved: false,
              department: null,
              updated_at: now,
            },
            { onConflict: 'email' }
          );

          if (userError) throw userError;

          await createAdminApprovalNotification({
            userId: authUserId,
            userEmail: cleanEmail,
            userName: cleanName,
          });
        }

        setEmail('');
        setPassword('');
        setFullName('');
        setAuthMode('pending');
      }
    } catch (err) {
      alert(err?.message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-[#06102f] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#ff5a00] animate-spin" />
      </div>
    );
  }

  const PendingApproval = () => (
    <div className="text-center">
      <h2 className="text-3xl font-bold text-white mb-3">Pending Approval</h2>
      <p className="text-slate-300 mb-6">
        Your registration has been submitted successfully. Please wait for admin approval.
      </p>
      <Button
        onClick={() => setAuthMode('signin')}
        className="w-full bg-[#ff5a00] hover:bg-[#ff5a00]/90 text-white font-bold rounded-xl"
      >
        Back to Sign In
      </Button>
    </div>
  );

  const AuthForm = ({ desktop = false }) => (
    <div className="w-full">
      {!desktop && (
        <button
          onClick={() => setAuthMode(null)}
          className="text-[#ff5a00] text-sm flex items-center gap-2 mb-5"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
      )}

      <h2 className="text-3xl xl:text-4xl font-black text-white mb-2">
        {authMode === 'register' ? 'Create Account' : 'Welcome Back'}
      </h2>

      <p className="text-slate-300 mb-8">
        {authMode === 'register'
          ? 'Register your ARK ONE account for approval'
          : 'Sign in to continue to ARK ONE Portal'}
      </p>

      <div className="space-y-5">
        {authMode === 'register' && (
          <div>
            <Label className="text-slate-200 font-semibold">Full Name</Label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your full name"
              className="mt-2 h-14 bg-[#06102f]/80 border-white/20 text-white rounded-xl"
            />
          </div>
        )}

        <div>
          <Label className="text-slate-200 font-semibold">
            {desktop ? 'Username' : 'Email'}
          </Label>
          <div className="relative mt-2">
            <Mail className="absolute left-4 top-4 w-5 h-5 text-slate-400" />
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={desktop ? 'Enter your username' : 'Enter your email'}
              className="h-14 pl-12 bg-[#06102f]/80 border-white/20 text-white rounded-xl"
            />
          </div>
        </div>

        <div>
          <Label className="text-slate-200 font-semibold">Password</Label>
          <div className="relative mt-2">
            <Lock className="absolute left-4 top-4 w-5 h-5 text-slate-400" />
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="h-14 pl-12 pr-12 bg-[#06102f]/80 border-white/20 text-white rounded-xl"
            />
            <Eye className="absolute right-4 top-4 w-5 h-5 text-slate-400" />
          </div>
        </div>

        {authMode === 'signin' && (
          <div className="flex justify-between items-center text-sm">
            <label className="flex items-center gap-2 text-slate-200">
              <input type="checkbox" className="accent-[#ff5a00]" />
              Remember me
            </label>

            <button
              type="button"
              onClick={handleForgotPassword}
              className="text-[#ff5a00] font-semibold"
            >
              Forgot Password?
            </button>
          </div>
        )}

        <Button
          onClick={handleAuth}
          disabled={loading}
          className="w-full h-16 bg-[#ff5a00] hover:bg-[#ff5a00]/90 text-white font-bold rounded-xl text-lg shadow-[0_0_35px_rgba(255,90,0,0.28)]"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
          ) : (
            <LogIn className="w-5 h-5 mr-3" />
          )}
          {authMode === 'register' ? 'Submit Registration' : 'Sign In'}
        </Button>

        <button
          type="button"
          onClick={() => setAuthMode(authMode === 'signin' ? 'register' : 'signin')}
          className="w-full h-14 rounded-xl border border-[#ff5a00]/60 text-white hover:bg-[#ff5a00]/10 font-bold"
        >
          <UserPlus className="inline w-5 h-5 mr-2 text-[#ff5a00]" />
          {authMode === 'signin'
            ? 'Register / Sign Up'
            : 'Already registered? Sign In'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#06102f] text-white overflow-hidden">
      {/* MOBILE VIEW */}
      <div className="md:hidden min-h-screen relative flex flex-col justify-center px-6 py-8 bg-gradient-to-br from-[#06102f] via-[#08153d] to-[#102969]">
        <div className="absolute top-[-120px] right-[-120px] w-80 h-80 rounded-full bg-[#123b91]/25" />
        <div className="absolute bottom-[-120px] left-[-120px] w-80 h-80 rounded-full bg-[#123b91]/20" />

        <div className="relative z-10 w-full max-w-sm mx-auto">
          {!authMode ? (
            <>
              <div className="text-center mb-20">
                <img
                  src="/logo.png"
                  alt="ARK Logo"
                  className="w-20 h-20 object-contain mx-auto mb-6"
                />

                <h1 className="text-5xl font-black tracking-tight">
                  ARK <span className="text-[#ff5a00]">ONE</span>
                </h1>

                <p className="text-sm tracking-[0.35em] uppercase text-slate-200 mt-2">
                  Enterprise Portal
                </p>

                <div className="w-12 h-1 bg-[#ff5a00] rounded-full mx-auto my-10" />

                <h2 className="text-2xl font-medium text-white mb-3">
                  Welcome to ARK ONE
                </h2>

                <p className="text-slate-400">
                  Where Technology Meets Need
                </p>
              </div>

              <div className="space-y-4">
                <Button
                  onClick={() => setAuthMode('signin')}
                  className="w-full h-16 bg-[#ff5a00] hover:bg-[#ff5a00]/90 rounded-2xl text-lg font-bold"
                >
                  <LogIn className="w-6 h-6 mr-3" />
                  Sign In
                </Button>

                <Button
                  onClick={() => setAuthMode('register')}
                  variant="outline"
                  className="w-full h-16 border-[#ff5a00] text-white hover:bg-[#ff5a00]/10 rounded-2xl text-lg font-bold"
                >
                  <UserPlus className="w-6 h-6 mr-3 text-[#ff5a00]" />
                  Register / Sign Up
                </Button>
              </div>

              <p className="text-center text-xs text-slate-400 mt-14">
                Powered by<br />
                <span className="text-[#ff5a00] tracking-[0.25em] font-semibold">
                  ARK TECHNOLOGIES GROUP
                </span>
              </p>
            </>
          ) : authMode === 'pending' ? (
            <div className="rounded-3xl border border-[#ff5a00]/30 bg-white/5 backdrop-blur-xl p-6">
              <PendingApproval />
            </div>
          ) : (
            <div className="rounded-3xl border border-[#ff5a00]/30 bg-white/5 backdrop-blur-xl p-6">
              <AuthForm />
            </div>
          )}
        </div>
      </div>

      {/* DESKTOP VIEW */}
            {/* DESKTOP VIEW */}
      <div className="hidden md:flex min-h-screen bg-[#06102f] overflow-hidden">

        {/* LEFT HERO IMAGE */}
        <div className="w-[58%] min-h-screen flex items-center justify-center overflow-hidden bg-[#06102f]">
          <img
            src="/ark-desktop-hero.png"
            alt="ARK ONE Portal"
            className="w-full h-full object-contain"
          />
        </div>

        {/* RIGHT PANEL */}
        <div className="w-[42%] min-h-screen relative bg-gradient-to-br from-[#020817] via-[#061430] to-[#071942]">

          {/* Support + Moon */}
          <div className="absolute top-8 right-10 z-20 flex items-center gap-6 text-white">
            <button
              type="button"
              onClick={() => navigate('/ark-connect')}
              className="flex items-center gap-2 font-semibold hover:text-[#ff5a00] transition"
            >
              <Headphones className="w-5 h-5" />
              Support
            </button>

            <div className="h-8 w-px bg-white/20" />

            <button
              type="button"
              className="w-10 h-10 rounded-full border border-white/20 bg-white/5 flex items-center justify-center hover:border-[#ff5a00]"
            >
              <Moon className="w-5 h-5" />
            </button>
          </div>

          {/* LOGIN AREA */}
          <div className="h-full flex items-center justify-center px-10">
            <div className="w-full max-w-[580px] rounded-[30px] border border-white/15 bg-[#071942]/90 backdrop-blur-xl p-10 shadow-[0_30px_90px_rgba(0,0,0,0.65)]">

              {authMode === 'pending' ? (
                <PendingApproval />
              ) : (
                <AuthForm desktop />
              )}

              {/* DOWNLOAD SECTION */}
              <div className="mt-10 flex items-center gap-4 text-slate-400 text-sm">
                <div className="h-px bg-white/10 flex-1" />
                Download App
                <div className="h-px bg-white/10 flex-1" />
              </div>

              <div className="grid grid-cols-2 gap-4 mt-6">
                <Button
                  variant="outline"
                  className="h-16 border-white/15 bg-white/5 text-white hover:bg-white/10 rounded-xl"
                >
                  <Monitor className="w-5 h-5 mr-3 text-[#ff5a00]" />
                  Windows
                </Button>

                <Button
                  variant="outline"
                  className="h-16 border-white/15 bg-white/5 text-white hover:bg-white/10 rounded-xl"
                >
                  <Smartphone className="w-5 h-5 mr-3 text-[#ff5a00]" />
                  Android
                </Button>
              </div>

            </div>
          </div>

        </div>
      </div>

    </div>
  );
}