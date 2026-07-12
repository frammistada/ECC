import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { supabaseUrl, supabaseAnonKey } from "@/lib/supabase/env";

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
  // Edge Runtime (Next's default for middleware) — matches every prior
  // working deployment. @supabase/supabase-js's constants.ts reads
  // process.version behind a `typeof process !== 'undefined'` guard, just
  // to build a debug header string; it safely evaluates to undefined on
  // Edge (process.version doesn't exist there) and is never on a path this
  // middleware exercises. Vercel's Edge build validator still flags the
  // bare token via static analysis, so it's explicitly allow-listed below
  // — the documented escape hatch for exactly this false positive class.
  // (Node.js middleware was tried instead: it hits a separate, harder
  // problem — Next's own "next/server" import has no package.json
  // "exports" entry, so Node's strict ESM resolver can't find it outside
  // Next's own bundler. Edge + allow-list is the more mature path.)
  unstable_allowDynamic: ["/node_modules/@supabase/supabase-js/**"],
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/stripe-webhook|api/cron).*)",
  ],
};
