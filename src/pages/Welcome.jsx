import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  CircleDot,
  Shield,
  Cpu,
  Radio,
  Zap,
  LogIn,
  UserPlus,
  Loader2,
  ArrowLeft
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabaseClient';

const stats = [
  { label: 'Devices Monitored', value: '2,400+' },
  { label: 'Banks Served', value: '47' },
  { label: 'Uptime SLA', value: '99.8%' },
  { label: 'Engineers Active', value: '120+' },
];

export default function Welcome() {
  const navigate = useNavigate();

  const [visible, setVisible] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [authMode, setAuthMode] = useState(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 100);
    setCheckingAuth(false);

    return () => clearTimeout(t);
  }, []);

  const handleForgotPassword = async () => {
    if (!email) {
      alert('Please enter your email address first.');
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/change-password`,
    });

    if (error) {
      alert(error.message);
    } else {
      alert('Password reset email sent successfully.');
    }
  };

  const handleAuth = async () => {
    if (!email || !password) {
      alert('Please enter email and password.');
      return;
    }

    setLoading(true);

    try {
      if (authMode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        navigate('/dashboard');
        return;
      }

      if (authMode === 'register') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            },
          },
        });

        if (error) throw error;

        if (data?.user) {
          await supabase.from('users').upsert({
            id: data.user.id,
            email,
            full_name: fullName,
            role: null,
            status: 'pending',
            department: null,
          });

          await supabase.from('notifications').insert({
            title: 'New User Registration',
            message: `${fullName || email} just registered and is waiting for admin approval.`,
            type: 'user_registration',
            read: false,
            user_email: 'admin',
          });
        }

        setEmail('');
        setPassword('');
        setFullName('');

        setAuthMode('pending');

        return;
      }
    } catch (err) {
      alert(err?.message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#08153d] via-[#0b1f5e] to-[#102969] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#ff5a00] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#08153d] via-[#0b1f5e] to-[#102969] flex flex-col items-center justify-center relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage:
            'linear-gradient(#ff5a00 1px, transparent 1px), linear-gradient(90deg, #ff5a00 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full"
        style={{
          background:
            'radial-gradient(circle, rgba(245,184,0,0.15) 0%, transparent 70%)',
        }}
      />

      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#ff5a00] to-transparent" />

      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: visible ? 1 : 0, y: visible ? 0 : 40 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="relative z-10 text-center max-w-2xl px-6"
      >
        <div className="flex items-center justify-center gap-4 mb-10">
          <div className="w-16 h-16 rounded-2xl bg-[#ff5a00] flex items-center justify-center shadow-[0_0_40px_rgba(245,184,0,0.4)]">
            <img
  src="/logo.png"
  alt="ARK Logo"
  className="w-12 h-12 object-contain"
/>
          </div>

          <div className="text-left">
            <h1 className="text-4xl font-black text-white tracking-tight">
              ARK ONE
            </h1>

            <p className="text-[#ff5a00] text-sm font-semibold uppercase tracking-[0.3em]">
              Enterprise Portal
            </p>
          </div>
        </div>

        {!authMode ? (
          <>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3 leading-tight">
              Welcome to ARK ONE Portal
            </h2>

            <p className="text-lg text-[#ff5a00] font-medium italic mb-2">
              "Where Technology Meets Need"
            </p>

            <p className="text-slate-200 text-sm max-w-md mx-auto mb-8">
              Enterprise ATM &amp; Banking Device Support Management Platform
              for ARK Technologies Group
            </p>

            <div className="flex flex-wrap justify-center gap-2 mb-10">
              {[
                { Icon: Cpu, label: 'Device Monitoring' },
                { Icon: Radio, label: 'Live Site Tracking' },
                { Icon: Shield, label: 'Secure Operations' },
                { Icon: Zap, label: 'Real-Time Alerts' },
              ].map(({ Icon, label }) => (
                <span
                  key={label}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#ff5a00]/30 bg-[#ff5a00]/5 text-[#ff5a00] text-xs font-medium"
                >
                  <Icon className="w-3 h-3" /> {label}
                </span>
              ))}
            </div>

            <div className="grid grid-cols-4 gap-3 mb-10 border border-[#ff5a00]/40 rounded-2xl p-5 bg-[#102969]/5 backdrop-blur-sm">
              {stats.map((s) => (
                <div key={s.label} className="text-center">
                  <p className="text-xl font-black text-[#ff5a00]">
                    {s.value}
                  </p>

                  <p className="text-[10px] text-slate-200 leading-tight mt-0.5">
                    {s.label}
                  </p>
                </div>
              ))}
            </div>

            <div className="flex flex-col items-center justify-center gap-6">
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Button
                  size="lg"
                  onClick={() => setAuthMode('signin')}
                  className="bg-[#ff5a00] hover:bg-[#ff5a00]/90 text-white font-bold px-10 py-6 text-base rounded-xl shadow-[0_0_30px_rgba(245,184,0,0.3)] w-full sm:w-auto"
                >
                  <LogIn className="w-5 h-5 mr-2" />
                  Sign In
                </Button>

                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => setAuthMode('register')}
                  className="border-[#ff5a00]/50 text-[#ff5a00] hover:bg-[#ff5a00]/10 font-semibold px-10 py-6 text-base rounded-xl w-full sm:w-auto"
                >
                  <UserPlus className="w-5 h-5 mr-2" />
                  Register / Sign Up
                </Button>
              </div>

              <div className="w-full max-w-2xl border border-[#ff5a00]/40 rounded-2xl p-5 bg-[#102969]/5 backdrop-blur-sm">
                <p className="text-sm text-[#ff5a00] font-semibold uppercase tracking-[0.2em] mb-4">
                  Download ARK ONE App
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Button variant="outline" className="border-[#ff5a00]/40 text-[#ff5a00]">
                    Windows
                  </Button>

                  <Button variant="outline" className="border-[#ff5a00]/40 text-[#ff5a00]">
                    macOS
                  </Button>

                  <Button variant="outline" className="border-[#ff5a00]/40 text-[#ff5a00]">
                    Android
                  </Button>

                  <Button variant="outline" className="border-[#ff5a00]/40 text-[#ff5a00]">
                    iPhone
                  </Button>
                </div>
              </div>
            </div>
          </>
        ) : authMode === 'pending' ? (
          <div className="max-w-md mx-auto border border-[#ff5a00]/40 rounded-2xl p-6 bg-[#102969]/5 backdrop-blur-sm text-center">
            <h2 className="text-2xl font-bold text-white mb-3">
              Pending Approval
            </h2>

            <p className="text-sm text-slate-200 mb-5">
              Your registration has been submitted successfully.
              Please wait for an administrator to approve your account.
            </p>

            <Button
              onClick={() => setAuthMode('signin')}
              className="w-full bg-[#ff5a00] hover:bg-[#ff5a00]/90 text-white font-bold"
            >
              Back to Sign In
            </Button>
          </div>
        ) : (
          <div className="max-w-md mx-auto border border-[#ff5a00]/40 rounded-2xl p-6 bg-[#102969]/5 backdrop-blur-sm text-left">
            <button
              onClick={() => setAuthMode(null)}
              className="text-[#ff5a00] text-sm flex items-center gap-2 mb-5"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>

            <h2 className="text-2xl font-bold text-white mb-2">
              {authMode === 'signin' ? 'Sign In' : 'Create Account'}
            </h2>

            <p className="text-sm text-slate-200 mb-5">
              {authMode === 'signin'
                ? 'Enter your ARK ONE credentials.'
                : 'Create your ARK ONE account.'}
            </p>

            <div className="space-y-4">
              {authMode === 'register' && (
                <div className="space-y-1.5">
                  <Label className="text-slate-300">Full Name</Label>

                  <Input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="bg-gradient-to-br from-[#08153d] via-[#0b1f5e] to-[#102969]/50 border-[#ff5a00]/30 text-white"
                    placeholder="Your full name"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-slate-300">Email</Label>

                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-gradient-to-br from-[#08153d] via-[#0b1f5e] to-[#102969]/50 border-[#ff5a00]/30 text-white"
                  placeholder="you@example.com"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-slate-300">Password</Label>

                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-gradient-to-br from-[#08153d] via-[#0b1f5e] to-[#102969]/50 border-[#ff5a00]/30 text-white"
                  placeholder="Password"
                />
              </div>

              {authMode === 'signin' && (
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-xs text-[#ff5a00] hover:underline"
                >
                  Forgot Password?
                </button>
              )}

              <Button
                onClick={handleAuth}
                disabled={loading}
                className="w-full bg-[#ff5a00] hover:bg-[#ff5a00]/90 text-white font-bold"
              >
                {loading && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}

                {authMode === 'signin' ? 'Sign In' : 'Register'}
              </Button>

              <button
                onClick={() =>
                  setAuthMode(
                    authMode === 'signin' ? 'register' : 'signin'
                  )
                }
                className="w-full text-center text-sm text-[#ff5a00]"
              >
                {authMode === 'signin'
                  ? 'No account? Register'
                  : 'Already have account? Sign in'}
              </button>
            </div>
          </div>
        )}

        <p className="text-[10px] text-slate-600 mt-10 text-center leading-relaxed">
          Secure access &middot; ARK Technologies Group &copy; 2026 &middot;
          v1.0.15
          <br />
          Built by Okoroafor Kingsley Chukwuma
        </p>
      </motion.div>
    </div>
  );
}