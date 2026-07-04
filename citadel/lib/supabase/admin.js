import { createClient } from "@supabase/supabase-js";
import { supabaseUrl, supabaseSecretKey } from "@/lib/supabase/env";

// Secret-key client for the Stripe webhook only. Bypasses RLS —
// never import this from anything reachable by user requests.
export function createAdminClient() {
  return createClient(supabaseUrl(), supabaseSecretKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
