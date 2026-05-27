import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function useCurrentUser() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCurrentUser();
  }, []);

  const loadCurrentUser = async () => {
    setLoading(true);

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    const authUser = sessionData?.session?.user;

    console.log('SUPABASE SESSION ERROR:', sessionError);
    console.log('AUTH USER:', authUser);
    console.log('AUTH USER EMAIL:', authUser?.email);

    if (!authUser?.email) {
      setUser(null);
      setLoading(false);
      return;
    }

    const cleanEmail = authUser.email.trim().toLowerCase();

    const { data: profile, error } = await supabase
      .from('users')
      .select('*')
      .ilike('email', cleanEmail)
      .maybeSingle();

    console.log('CLEAN EMAIL:', cleanEmail);
    console.log('SUPABASE PROFILE:', profile);
    console.log('SUPABASE ERROR:', error);

    if (error || !profile || !profile.role) {
      setUser({
        email: cleanEmail,
        full_name: authUser.user_metadata?.full_name || cleanEmail,
        role: null,
        account_status: 'pending',
        must_change_password: false,
      });
    } else {
      setUser({
        ...profile,
        email: cleanEmail,
        must_change_password: false,
      });
    }

    setLoading(false);
  };

  const updateUser = async (data) => {
    if (!user?.email) return;

    const cleanEmail = user.email.trim().toLowerCase();

    const { data: updated, error } = await supabase
      .from('users')
      .update(data)
      .ilike('email', cleanEmail)
      .select()
      .maybeSingle();

    console.log('UPDATE USER RESULT:', updated);
    console.log('UPDATE USER ERROR:', error);

    if (!error && updated) {
      setUser({
        ...updated,
        email: cleanEmail,
        must_change_password: false,
      });
    }
  };

  return { user, loading, updateUser };
}