import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../integrations/supabase/client";

const AuthContext = createContext();

const ADMIN_EMAIL = "okoroaforkingsley30s@gmail.com";

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);

  const signOutAndBlock = async (message) => {
    console.warn(message);
    await supabase.auth.signOut();
    setUser(null);
    setIsAuthenticated(false);
    setAuthError(message);
    setIsLoadingAuth(false);
  };

  const loadUserProfile = async (authUser) => {
    if (!authUser) {
      setUser(null);
      setIsAuthenticated(false);
      setIsLoadingAuth(false);
      return;
    }

    try {
      const cleanEmail = authUser.email?.trim().toLowerCase();

      const { data: profile, error } = await supabase
        .from("users")
        .select("*")
        .or(`id.eq.${authUser.id},email.eq.${cleanEmail}`)
        .maybeSingle();

      if (error) {
        console.error("Profile load failed:", error.message);
        await signOutAndBlock("Unable to load your user profile. Please contact admin.");
        return;
      }

      if (!profile) {
        await signOutAndBlock("Your user profile was not found. Please contact admin.");
        return;
      }

      const isMainAdmin = cleanEmail === ADMIN_EMAIL;

      const approvalStatus = profile.approval_status || profile.status;
      const isApproved =
        isMainAdmin ||
        profile.is_approved === true ||
        approvalStatus === "approved";

      const hasRole = Boolean(profile.role);

      if (!isApproved || !hasRole) {
        await signOutAndBlock("Your account is pending admin approval.");
        return;
      }

      if (
        profile.status === "rejected" ||
        profile.approval_status === "rejected"
      ) {
        await signOutAndBlock("Your account approval was rejected. Please contact admin.");
        return;
      }

      setUser({
        id: authUser.id,
        email: cleanEmail,
        full_name:
          profile.full_name ||
          authUser.user_metadata?.full_name ||
          cleanEmail,
        role: isMainAdmin ? profile.role || "admin" : profile.role,
        status: profile.status || "approved",
        approval_status: profile.approval_status || "approved",
        is_approved: true,
        department: profile.department || null,
        ...profile,
      });

      setIsAuthenticated(true);
      setAuthError(null);
    } catch (error) {
      console.error("Profile load failed:", error);
      await signOutAndBlock("Authentication failed. Please contact admin.");
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const checkUserAuth = async () => {
    setIsLoadingAuth(true);
    setAuthError(null);

    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) throw error;

      if (session?.user) {
        await loadUserProfile(session.user);
      } else {
        setUser(null);
        setIsAuthenticated(false);
        setIsLoadingAuth(false);
      }
    } catch (error) {
      console.error("Auth check failed:", error);
      setAuthError(error.message);
      setUser(null);
      setIsAuthenticated(false);
      setIsLoadingAuth(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!mounted) return;

        if (session?.user) {
          await loadUserProfile(session.user);
        } else {
          setUser(null);
          setIsAuthenticated(false);
          setIsLoadingAuth(false);
        }
      } catch (error) {
        if (!mounted) return;

        console.error("Initial auth failed:", error);
        setAuthError(error.message);
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
        setUser(null);
        setIsAuthenticated(false);
        setIsLoadingAuth(false);
        return;
      }

      if (session?.user) {
        loadUserProfile(session.user);
      } else {
        setUser(null);
        setIsAuthenticated(false);
        setIsLoadingAuth(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setIsAuthenticated(false);
    window.location.href = "/#/welcome";
  };

  const navigateToLogin = () => {
  if (window.location.hash !== '#/welcome') {
    window.location.hash = '#/welcome';
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