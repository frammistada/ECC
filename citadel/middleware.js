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
  // Run on the Node.js runtime, not Edge. The Supabase client this uses to
  // refresh the auth token pulls in process.version, which the Edge Runtime
  // rejects at build ("Edge Function middleware is referencing unsupported
  // modules"). Node middleware (Next 15.2+) has no such restriction.
  runtime: "nodejs",
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/stripe-webhook|api/cron).*)",
  ],
};
