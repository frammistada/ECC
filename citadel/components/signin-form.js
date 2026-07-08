"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Flip after the Apple Developer account + Supabase provider config exist.
const APPLE_ENABLED = false;

// Email flow: address → six-digit code → choose a password → in.
// The code is verified in this same tab, so the session lands in the
// right browser — unlike a magic link opened from a mail app.
export default function SigninForm() {
  const [mode, setMode] = useState("start"); // start | code | password-new
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  function reset() {
    setMode("start");
    setCode("");
    setNewPassword("");
    setError(null);
  }

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
    } catch {
      setError("That sign-in could not be started. Try again.");
      setBusy(false);
    }
  }

  async function signInWithPassword(event) {
    event.preventDefault();
    if (busy || !email.trim() || !password) return;
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: pwError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (pwError) {
        setError(
          "That email and password don't match. New here, or forgot it? Use a code below.",
        );
        return;
      }
      window.location.assign("/");
    } catch {
      setError("Something failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function sendCode() {
    if (busy) return;
    const address = email.trim();
    if (!address) {
      setError("Enter your email first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: address,
        options: { shouldCreateUser: true },
      });
      if (otpError) {
        setError("The code could not be sent. Check the address.");
        return;
      }
      setMode("code");
    } catch {
      setError("The code could not be sent. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(event) {
    event.preventDefault();
    if (busy || code.trim().length < 6) return;
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code.trim(),
        type: "email",
      });
      if (verifyError) {
        setError("That code didn't match. Check the email and try again.");
        return;
      }
      setMode("password-new");
    } catch {
      setError("Something failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function setAccountPassword(event) {
    event.preventDefault();
    if (busy || newPassword.length < 8) return;
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateError) {
        setError("That password was not accepted. Try a different one.");
        return;
      }
      window.location.assign("/");
    } catch {
      setError("Something failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (mode === "code") {
    return (
      <form onSubmit={verifyCode}>
        <p className="text-lg leading-relaxed">
          A six-digit code is on its way to {email.trim()}.
        </p>
        <label htmlFor="code" className="mt-8 block font-mono text-xs text-ash">
          the code
        </label>
        <input
          id="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          disabled={busy}
          className="mt-4 w-full bg-marble p-5 font-mono text-lg tracking-[0.3em] text-ink outline-none focus:ring-1 focus:ring-patina/50 disabled:opacity-60"
        />
        {error && <p className="mt-4 text-sm text-ash">{error}</p>}
        <div className="mt-6 flex items-baseline gap-6">
          <button
            type="submit"
            disabled={busy || code.trim().length < 6}
            className="font-mono text-sm tracking-wide text-patina underline decoration-1 underline-offset-4 disabled:no-underline disabled:opacity-50"
          >
            Continue
          </button>
          <button
            type="button"
            onClick={reset}
            className="font-mono text-xs text-ash underline decoration-1 underline-offset-4"
          >
            start over
          </button>
        </div>
      </form>
    );
  }

  if (mode === "password-new") {
    return (
      <form onSubmit={setAccountPassword}>
        <p className="text-lg leading-relaxed">
          Choose a password for next time.
        </p>
        <label
          htmlFor="new-password"
          className="mt-8 block font-mono text-xs text-ash"
        >
          a password — eight characters or more
        </label>
        <input
          id="new-password"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          disabled={busy}
          className="mt-4 w-full bg-marble p-5 text-lg text-ink outline-none focus:ring-1 focus:ring-patina/50 disabled:opacity-60"
        />
        {error && <p className="mt-4 text-sm text-ash">{error}</p>}
        <button
          type="submit"
          disabled={busy || newPassword.length < 8}
          className="mt-6 font-mono text-sm tracking-wide text-patina underline decoration-1 underline-offset-4 disabled:no-underline disabled:opacity-50"
        >
          Set password
        </button>
      </form>
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

      <form onSubmit={signInWithPassword} className="mt-4">
        <label htmlFor="email" className="font-mono text-xs text-ash">
          your email
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={busy}
          className="mt-4 w-full bg-marble p-5 text-lg text-ink outline-none placeholder:text-ash focus:ring-1 focus:ring-patina/50 disabled:opacity-60"
          placeholder="you@example.com"
        />
        <label
          htmlFor="password"
          className="mt-6 block font-mono text-xs text-ash"
        >
          your password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={busy}
          className="mt-4 w-full bg-marble p-5 text-lg text-ink outline-none focus:ring-1 focus:ring-patina/50 disabled:opacity-60"
        />
        {error && <p className="mt-4 text-sm text-ash">{error}</p>}
        <div className="mt-6 flex flex-wrap items-baseline gap-x-6 gap-y-3">
          <button
            type="submit"
            disabled={busy || !email.trim() || !password}
            className="font-mono text-sm tracking-wide text-patina underline decoration-1 underline-offset-4 disabled:no-underline disabled:opacity-50"
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={sendCode}
            disabled={busy}
            className="font-mono text-xs text-ash underline decoration-1 underline-offset-4 disabled:opacity-50"
          >
            first time, or forgot? email me a code
          </button>
        </div>
      </form>
    </div>
  );
}
