import { createClient } from "@supabase/supabase-js";

// Service-role client for the Stripe webhook only. Bypasses RLS —
// never import this from anything reachable by user requests.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
