import React from "react";
import { CircleDot, Clock, LogOut, Mail, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "../../integrations/supabase/client";

export default function PendingApproval({ user }) {
  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/welcome";
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md text-center">
        <div className="flex items-center justify-center gap-3 mb-10">
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center shadow-lg">
            <CircleDot className="w-8 h-8 text-primary-foreground" />
          </div>
          <div className="text-left">
            <h1 className="text-xl font-bold">ARK ONE Portal</h1>
            <p className="text-xs text-muted-foreground">
              ARK Technologies Group · Enterprise ERP
            </p>
          </div>
        </div>

        <div className="rounded-2xl border bg-card shadow-lg p-8">
          <div className="w-16 h-16 rounded-full bg-amber-50 border-2 border-amber-200 flex items-center justify-center mx-auto mb-5">
            <Clock className="w-8 h-8 text-amber-500" />
          </div>

          <h2 className="text-xl font-bold mb-2">Account Pending Approval</h2>

          <p className="text-muted-foreground text-sm leading-relaxed mb-2">
            Hello,{" "}
            <span className="font-medium text-foreground">
              {user?.full_name || user?.email}
            </span>
            .
          </p>

          <p className="text-muted-foreground text-sm leading-relaxed mb-6">
            Your account has been registered and is currently awaiting
            administrator review. You will receive access once your account has
            been reviewed and assigned a role.
          </p>

          <div className="bg-muted/50 rounded-xl p-4 text-left space-y-3 mb-6 text-sm">
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <p className="text-muted-foreground">
                An administrator will review your account and assign the
                appropriate role and permissions.
              </p>
            </div>

            <div className="flex items-start gap-3">
              <Mail className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <p className="text-muted-foreground">
                You will be notified once access has been granted. Contact{" "}
                <span className="text-foreground font-medium">
                  support@arktechgroup.com
                </span>{" "}
                if you need assistance.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full"
              onClick={() =>
                (window.location.href = "mailto:support@arktechgroup.com")
              }
            >
              <Mail className="w-4 h-4 mr-2" /> Contact Support
            </Button>

            <Button
              variant="ghost"
              className="w-full text-muted-foreground"
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4 mr-2" /> Sign Out
            </Button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground mt-6">
          Logged in as: <span className="font-mono">{user?.email}</span>
        </p>
      </div>
    </div>
  );
}