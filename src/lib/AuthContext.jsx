import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { clearBrowserDrafts } from "@/hooks/useFormDraft";
import { normalizeEmail } from "@/lib/identity";
import { reportError } from '@/lib/errorReporting';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);

  const blockAccess = (message, type = "user_not_registered", authUser = null) => {
    console.warn(message);

    // Keep the Supabase session so temporary profile/state issues do not log users out.
    setUser(
      authUser
        ? {
            id: authUser.id,
            auth_id: authUser.id,
            email: normalizeEmail(authUser.email),
            full_name:
              authUser.user_metadata?.full_name ||
              normalizeEmail(authUser.email) ||
              "Signed-in user",
          }
        : null
    );
    setIsAuthenticated(false);
    setAuthError({ type, message });
    setIsLoadingAuth(false);
  };

  const loadUserProfile = useCallback(async (authUser, { showLoading = true } = {}) => {
    if (!authUser) {
      setUser(null);
      setIsAuthenticated(false);
      setIsLoadingAuth(false);
      return;
    }

    try {
      if (showLoading) setIsLoadingAuth(true);

      const cleanEmail = normalizeEmail(authUser.email);

      let { data: profile, error } = await supabase
        .from("users")
        .select("*")
        .or(`id.eq.${authUser.id},auth_user_id.eq.${authUser.id}`)
        .maybeSingle();

      // Legacy profiles may pre-date linking their auth UUID. Email is only a
      // lookup fallback; it never grants approval or a role.
      if (!error && !profile && cleanEmail) {
        const fallback = await supabase
          .from("users")
          .select("*")
          .eq("email", cleanEmail)
          .maybeSingle();
        profile = fallback.data;
        error = fallback.error;
      }

      if (error) {
        reportError(error, { context: 'auth.profile.query', notify: false });
        blockAccess(
          "We could not verify your ARK ONE profile. Please try again or contact admin.",
          "profile_load_failed",
          authUser
        );
        return;
      }

      if (!profile) {
        blockAccess(
          "Your login is valid, but no ARK ONE user profile exists yet. Please contact admin for access.",
          "missing_profile",
          authUser
        );
        return;
      }

      const approvalStatus = profile.approval_status || profile.status;
      const isApproved =
        profile.is_approved === true ||
        approvalStatus === "approved" ||
        approvalStatus === "active";

      const hasRole = Boolean(profile.role);

      if (
        profile.status === "rejected" ||
        profile.approval_status === "rejected"
      ) {
        blockAccess(
          "Your account approval was rejected. Please contact admin.",
          "rejected",
          authUser
        );
        return;
      }

      if (!isApproved) {
        blockAccess(
          "Your account is pending admin approval.",
          "pending_approval",
          authUser
        );
        return;
      }

      if (!hasRole) {
        blockAccess(
          "Your account has been created, but no role has been assigned yet. Please contact admin.",
          "missing_role",
          authUser
        );
        return;
      }

      const finalUser = {
        ...profile,
        id: authUser.id,
        auth_id: authUser.id,
        email: cleanEmail,
        full_name:
          profile.full_name ||
          authUser.user_metadata?.full_name ||
          cleanEmail,
        role: profile.role,
        status: profile.status || "approved",
        approval_status: profile.approval_status || "approved",
        is_approved: true,
        department: profile.department || null,
      };

      setUser(finalUser);
      setIsAuthenticated(true);
      setAuthError(null);
    } catch (error) {
      reportError(error, { context: 'auth.profile.load', notify: false });
      blockAccess(
        "Authentication failed. Please contact admin.",
        "profile_load_failed",
        authUser
      );
    } finally {
      setIsLoadingAuth(false);
    }
  }, []);

  const checkUserAuth = useCallback(async ({ showLoading = true } = {}) => {
    if (showLoading) setIsLoadingAuth(true);
    setAuthError(null);

    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) throw error;

      if (session?.user) {
        await loadUserProfile(session.user, { showLoading });
      } else {
        setUser(null);
        setIsAuthenticated(false);
        setAuthError({ type: "auth_required", message: "Login required" });
        setIsLoadingAuth(false);
      }
    } catch (error) {
      reportError(error, { context: 'auth.session.check', notify: false });
      setAuthError({ type: "auth_required", message: error.message });
      setUser(null);
      setIsAuthenticated(false);
      setIsLoadingAuth(false);
    }
  }, [loadUserProfile]);

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (!mounted) return;
        if (error) throw error;

        if (session?.user) {
          await loadUserProfile(session.user, { showLoading: true });
        } else {
          setUser(null);
          setIsAuthenticated(false);
          setAuthError(null);
          setIsLoadingAuth(false);
        }
      } catch (error) {
        if (!mounted) return;

        reportError(error, { context: 'auth.session.initialize', notify: false });
        setAuthError({ type: "auth_required", message: error.message });
        setUser(null);
        setIsAuthenticated(false);
        setIsLoadingAuth(false);
      }
    };

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      if (event === "SIGNED_OUT") {
        clearBrowserDrafts();
        setUser(null);
        setIsAuthenticated(false);
        setAuthError(null);
        setIsLoadingAuth(false);
        return;
      }

      if (event === "SIGNED_IN" && session?.user) {
        loadUserProfile(session.user, { showLoading: true });
      }

      if ((event === "TOKEN_REFRESHED" || event === "USER_UPDATED") && session?.user) {
        loadUserProfile(session.user, { showLoading: false });
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    clearBrowserDrafts();
    setUser(null);
    setIsAuthenticated(false);
    setAuthError(null);
    window.location.hash = "#/welcome";
  };

  const navigateToLogin = () => {
    if (
      window.location.hash !== "#/welcome" &&
      window.location.hash !== "#/login"
    ) {
      window.location.hash = "#/welcome";
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoadingAuth,
        isLoadingPublicSettings: false,
        authError,
        appPublicSettings: null,
        authChecked: !isLoadingAuth,
        logout,
        navigateToLogin,
        checkUserAuth,
        checkAppState: async () => {},
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
};
