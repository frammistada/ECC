"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// OAuth providers shown as buttons. Apple stays hidden until the Apple
// Developer account exists — flip to true after enabling it in Supabase.
const APPLE_ENABLED = false;

export default function SigninForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function withProvider(provider) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (oauthError) {
        setError("That sign-in could not be started. Try again.");
        setBusy(false);
      }
      // On success the browser navigates away; no state to reset.
    } catch {
      setError("That sign-in could not be started. Try again.");
      setBusy(false);
    }
  }

  async function sendLink(event) {
    event.preventDefault();
    const address = email.trim();
    if (!address || busy) return;

    setBusy(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: address,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (otpError) {
        setError("The link could not be sent. Check the address.");
        return;
      }
      setSent(true);
    } catch {
      setError("The link could not be sent. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div>
        <p className="text-lg leading-relaxed">
          Check your email. The link signs in the browser that opens it, so
          open it here on this device.
        </p>
        <button
          type="button"
          onClick={() => setSent(false)}
          className="mt-8 font-mono text-xs text-ash underline decoration-1 underline-offset-4"
        >
          start over
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col items-start gap-5">
        <button
          type="button"
          onClick={() => withProvider("google")}
          disabled={busy}
          className="font-mono text-sm tracking-wide text-patina underline decoration-1 underline-offset-4 disabled:opacity-50"
        >
          Continue with Google
        </button>
        {APPLE_ENABLED && (
          <button
            type="button"
            onClick={() => withProvider("apple")}
            disabled={busy}
            className="font-mono text-sm tracking-wide text-patina underline decoration-1 underline-offset-4 disabled:opacity-50"
          >
            Continue with Apple
          </button>
        )}
      </div>

      <p className="mt-10 border-t border-ash/30 pt-8 font-mono text-xs text-ash">
        or by email
      </p>

      <form onSubmit={sendLink} className="mt-4">
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={busy}
          aria-label="your email"
          className="w-full bg-marble p-5 text-lg text-ink outline-none placeholder:text-ash focus:ring-1 focus:ring-patina/50 disabled:opacity-60"
          placeholder="you@example.com"
        />
        {error && <p className="mt-4 text-sm text-ash">{error}</p>}
        <button
          type="submit"
          disabled={busy || !email.trim()}
          className="mt-6 font-mono text-sm tracking-wide text-patina underline decoration-1 underline-offset-4 disabled:no-underline disabled:opacity-50"
        >
          Send link
        </button>
      </form>
    </div>
  );
}
