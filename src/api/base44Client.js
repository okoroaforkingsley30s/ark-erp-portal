import { supabase } from "../integrations/supabase/client";

export const base44 = {
  auth: {
    me: async () => {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error) throw error;

      return user;
    },

    logout: async () => {
      const { error } = await supabase.auth.signOut();

      if (error) throw error;

      window.location.href = "/login";

      return true;
    },
  },

  entities: {},
  functions: {},
};

export default base44;