"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function SigninForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  async function sendLink(event) {
    event.preventDefault();
    const address = email.trim();
    if (!address || sending) return;

    setSending(true);
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
      setSending(false);
    }
  }

  if (sent) {
    return (
      <p className="text-lg leading-relaxed">
        Check your email. The link will sign you in.
      </p>
    );
  }

  return (
    <form onSubmit={sendLink}>
      <label htmlFor="email" className="font-mono text-xs text-ash">
        your email
      </label>
      <input
        id="email"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={sending}
        className="mt-4 w-full bg-marble p-5 text-lg text-ink outline-none placeholder:text-ash focus:ring-1 focus:ring-patina/50 disabled:opacity-60"
        placeholder="you@example.com"
      />
      {error && <p className="mt-4 text-sm text-ash">{error}</p>}
      <button
        type="submit"
        disabled={sending || !email.trim()}
        className="mt-6 font-mono text-sm tracking-wide text-patina underline decoration-1 underline-offset-4 disabled:no-underline disabled:opacity-50"
      >
        Send link
      </button>
    </form>
  );
}
