import React from "react";
import { Clock, LogOut, Mail, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "../../integrations/supabase/client";

export default function PendingApproval({ user }) {
  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/welcome";
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#08153d] via-[#0b1f5e] to-[#102969] p-4">
      <div className="w-full max-w-md text-center">
        <div className="flex items-center justify-center gap-3 mb-10">
          <div className="w-16 h-16 rounded-2xl bg-[#ff5a00]/10 border border-[#ff5a00]/30 flex items-center justify-center shadow-[0_0_25px_rgba(255,90,0,0.25)]">
            <img
              src="/logo.png"
              alt="ARK Technologies Logo"
              className="w-12 h-12 object-contain"
            />
          </div>

          <div className="text-left">
            <h1 className="text-xl font-bold text-white">
              ARK ONE Portal
            </h1>

            <p className="text-xs text-slate-200">
              ARK Technologies Group · Enterprise ERP
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-[#ff5a00]/30 bg-[#102969] shadow-2xl p-8">
          <div className="w-16 h-16 rounded-full bg-[#ff5a00]/10 border-2 border-[#ff5a00]/30 flex items-center justify-center mx-auto mb-5">
            <Clock className="w-8 h-8 text-[#ff5a00]" />
          </div>

          <h2 className="text-2xl font-bold text-white mb-2">
            Account Pending Approval
          </h2>

          <p className="text-slate-200 text-sm leading-relaxed mb-2">
            Hello,{" "}
            <span className="font-semibold text-white">
              {user?.full_name || user?.email}
            </span>
            .
          </p>

          <p className="text-slate-200 text-sm leading-relaxed mb-6">
            Your account has been registered and is currently awaiting
            administrator review. You will receive access once your account has
            been reviewed and assigned a role.
          </p>

          <div className="bg-[#0b1f5e] border border-[#ff5a00]/20 rounded-xl p-4 text-left space-y-4 mb-6 text-sm">
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-4 h-4 text-[#ff5a00] mt-0.5 flex-shrink-0" />

              <p className="text-slate-200">
                An administrator will review your account and assign the
                appropriate role and permissions.
              </p>
            </div>

            <div className="flex items-start gap-3">
              <Mail className="w-4 h-4 text-[#ff5a00] mt-0.5 flex-shrink-0" />

              <p className="text-slate-200">
                You will be notified once access has been granted. Contact{" "}
                <span className="text-white font-semibold">
                  support@arktechgroup.com
                </span>{" "}
                if you need assistance.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <Button
              variant="outline"
              className="w-full border-[#ff5a00]/40 text-[#ff5a00] hover:bg-[#ff5a00]/10 hover:text-[#ff5a00]"
              onClick={() =>
                (window.location.href = "mailto:support@arktechgroup.com")
              }
            >
              <Mail className="w-4 h-4 mr-2" />
              Contact Support
            </Button>

            <Button
              variant="ghost"
              className="w-full text-slate-300 hover:text-white hover:bg-white/5"
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>

        <p className="text-xs text-slate-300 mt-6">
          Logged in as:{" "}
          <span className="font-mono text-white">
            {user?.email}
          </span>
        </p>
      </div>
    </div>
  );
}