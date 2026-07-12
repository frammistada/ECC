import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

// Reads the two public Supabase env vars directly (not via the shared
// lib/supabase/env.js "@/" alias). Vercel packages middleware.js as its
// own isolated Edge Function — separate from the rest of the app bundle —
// and in this repo's layout (Root Directory = citadel, a subfolder of the
// monorepo) that isolated packaging step fails to resolve the "@/" path
// alias, deploy-time, with "The Edge Function 'middleware' is referencing
// unsupported modules: .../middleware.js: @/lib/supabase/env" — a hard
// failure distinct from (and easy to mistake for) the unrelated Node-API
// warning below. Inlining the two-line lookup removes the cross-module
// import entirely, so there is nothing for that step to fail to resolve.
function supabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL;
}
function supabaseAnonKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
  );
}

export async function middleware(request) {
  const url = supabaseUrl();
  const key = supabaseAnonKey();
  if (!url || !key) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // Refreshes the auth token if expired; keeps server components in sync.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  // Edge Runtime (Next's default for middleware) — matches every
  // deployment that worked before this session. @supabase/supabase-js's
  // constants.ts reads process.version behind a
  // `typeof process !== 'undefined'` guard, just to build a debug header
  // string; it safely evaluates to undefined on Edge (process.version
  // doesn't exist there) and is never on a path this middleware exercises.
  // Next's own build only warns about it ("Compiled with warnings"), but
  // it's allow-listed below in case a stricter validation pass ever turns
  // it into a hard error — the documented escape hatch for this exact
  // false-positive class, scoped to only the one package.
  unstable_allowDynamic: ["/node_modules/@supabase/supabase-js/**"],
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/stripe-webhook|api/cron).*)",
  ],
};
