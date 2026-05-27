import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../integrations/supabase/client";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);

  const loadUserProfile = async (authUser) => {
    if (!authUser) {
      setUser(null);
      setIsAuthenticated(false);
      setIsLoadingAuth(false);
      return;
    }

    try {
      const { data: profile, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", authUser.id)
        .maybeSingle();

      if (error) {
        console.warn("Profile load warning:", error.message);
      }

      setUser({
        id: authUser.id,
        email: authUser.email,
        full_name:
          profile?.full_name ||
          authUser.user_metadata?.full_name ||
          authUser.email,
        role: profile?.role || "admin",
        status: profile?.status || "approved",
        department: profile?.department || "IT",
        ...profile,
      });

      setIsAuthenticated(true);
      setAuthError(null);
    } catch (error) {
      console.error("Profile load failed:", error);

      setUser({
        id: authUser.id,
        email: authUser.email,
        full_name: authUser.user_metadata?.full_name || authUser.email,
        role: "admin",
        status: "approved",
        department: "IT",
      });

      setIsAuthenticated(true);
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
    window.location.href = "/welcome";
  };

  const navigateToLogin = () => {
    window.location.href = "/welcome";
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