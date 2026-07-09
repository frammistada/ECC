"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  GoogleMark,
  PersonMark,
  LockMark,
  EyeMark,
  CheckMark,
} from "@/components/icons";

// Flip after the Apple Developer account + Supabase provider config exist.
const APPLE_ENABLED = false;

// Email flow: address → emailed code → choose a password → in.
// The code is verified in this same tab, so the session lands in the
// right browser — unlike a magic link opened from a mail app.
// "Sign Up" and "Forgot password?" both enter this same code flow — the
// emailed-code path doubles as first-time signup AND password reset.
// Code length isn't hardcoded here: it's a Supabase project setting
// (Authentication → Providers → Email → OTP length), so the input
// accepts whatever length actually gets sent.
export default function SigninForm() {
  const [mode, setMode] = useState("start"); // start | code | password-new
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
          "That email and password don't match. New here, or forgot it? Use Sign Up or Forgot password below.",
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
    if (busy || code.trim().length < 4) return;
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
      <form onSubmit={verifyCode} className="mt-12">
        <p className="text-center text-lg leading-relaxed">
          A code is on its way to {email.trim()}.
        </p>
        <label
          htmlFor="code"
          className="mt-10 block text-center font-mono text-xs tracking-[0.2em] text-ash"
        >
          the code
        </label>
        <input
          id="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={12}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          disabled={busy}
          className="mt-4 w-full rounded-2xl bg-marble p-5 text-center font-mono text-lg tracking-[0.3em] text-ink outline-none focus:ring-1 focus:ring-patina/50 disabled:opacity-60"
        />
        {error && <p className="mt-4 text-center text-sm text-ash">{error}</p>}
        <div className="mt-10 flex flex-col items-center gap-6">
          <button
            type="submit"
            disabled={busy || code.trim().length < 4}
            className="rounded-2xl bg-cream px-12 py-4 text-lg text-ink disabled:text-ink/50"
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
      <form onSubmit={setAccountPassword} className="mt-12">
        <p className="text-center text-lg leading-relaxed">
          Choose a password for next time.
        </p>
        <label
          htmlFor="new-password"
          className="mt-10 block text-center font-mono text-xs tracking-[0.15em] text-ash"
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
          className="mt-4 w-full rounded-2xl bg-marble p-5 text-lg text-ink outline-none focus:ring-1 focus:ring-patina/50 disabled:opacity-60"
        />
        {error && <p className="mt-4 text-center text-sm text-ash">{error}</p>}
        <div className="mt-10 flex justify-center">
          <button
            type="submit"
            disabled={busy || newPassword.length < 8}
            className="rounded-2xl bg-cream px-12 py-4 text-lg text-ink disabled:text-ink/50"
          >
            Set password
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <button
        type="button"
        onClick={() => withProvider("google")}
        disabled={busy}
        className="mt-12 flex w-full items-center justify-center gap-4 rounded-2xl bg-cream px-6 py-4 text-lg tracking-wide text-ink disabled:opacity-50"
      >
        <GoogleMark className="h-6 w-6" />
        Continue with Google
      </button>
      {APPLE_ENABLED && (
        <button
          type="button"
          onClick={() => withProvider("apple")}
          disabled={busy}
          className="mt-4 flex w-full items-center justify-center gap-4 rounded-2xl bg-cream px-6 py-4 text-lg tracking-wide text-ink disabled:opacity-50"
        >
          Continue with Apple
        </button>
      )}

      <div className="mt-12 flex items-center gap-5">
        <span className="h-px flex-1 bg-parchment/15" />
        <span className="font-mono text-sm tracking-[0.25em] text-ash">
          or sign in
        </span>
        <span className="h-px flex-1 bg-parchment/15" />
      </div>

      <form onSubmit={signInWithPassword} className="mt-10 flex flex-1 flex-col">
        <label
          htmlFor="email"
          className="flex items-center gap-4 rounded-2xl border border-parchment/15 px-5 py-4 focus-within:border-parchment/35"
        >
          <PersonMark className="h-6 w-6 shrink-0 text-ash" />
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
            className="w-full bg-transparent text-lg text-parchment outline-none placeholder:text-ash/70 disabled:opacity-60"
            placeholder="you@example.com"
          />
        </label>
        <label
          htmlFor="password"
          className="mt-5 flex items-center gap-4 rounded-2xl border border-parchment/15 px-5 py-4 focus-within:border-parchment/35"
        >
          <LockMark className="h-6 w-6 shrink-0 text-ash" />
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
            className="w-full bg-transparent text-lg text-parchment outline-none disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className={`shrink-0 ${showPassword ? "text-parchment" : "text-ash"}`}
          >
            <EyeMark className="h-6 w-6" />
          </button>
        </label>

        {error && <p className="mt-5 text-center text-sm text-ash">{error}</p>}

        <div className="mt-10 flex justify-center">
          <button
            type="submit"
            disabled={busy || !email.trim() || !password}
            className="flex items-center gap-3 rounded-2xl bg-cream px-10 py-4 text-lg tracking-wide text-ink disabled:text-ink/50"
          >
            <CheckMark className="h-6 w-6 text-ink" />
            Log In
          </button>
        </div>

        <div className="mx-auto mt-8 flex w-40 items-center gap-4">
          <span className="h-px flex-1 bg-parchment/15" />
          <span className="font-mono text-xs tracking-[0.2em] text-ash">or</span>
          <span className="h-px flex-1 bg-parchment/15" />
        </div>

        <button
          type="button"
          onClick={sendCode}
          disabled={busy}
          className="mx-auto mt-6 text-lg tracking-wide text-parchment underline decoration-parchment/40 decoration-1 underline-offset-[6px] disabled:opacity-50"
        >
          Sign Up
        </button>

        <button
          type="button"
          onClick={sendCode}
          disabled={busy}
          className="mx-auto mt-auto pt-12 font-mono text-sm text-ash underline decoration-1 underline-offset-4 disabled:opacity-50"
        >
          Forgot password?
        </button>
      </form>
    </div>
  );
}
