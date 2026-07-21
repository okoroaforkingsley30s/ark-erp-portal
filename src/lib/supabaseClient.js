import { createClient } from "@supabase/supabase-js";
import { resolveFrontendEnvironment } from '@/lib/environment';

const runtimeEnvironment = resolveFrontendEnvironment(import.meta.env);

export const supabase = createClient(
  runtimeEnvironment.supabaseUrl,
  runtimeEnvironment.supabaseAnonKey,
  {
  auth: {
    flowType: "pkce",
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  }
);

export { runtimeEnvironment };
