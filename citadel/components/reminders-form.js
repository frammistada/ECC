"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

// urlBase64 VAPID key -> Uint8Array, as PushManager.subscribe expects.
function urlBase64ToUint8Array(base64) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function pushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

const MAX_QUOTE_COUNT = 6;

export default function RemindersForm({
  initialReflectionEnabled,
  initialReflectionTime,
  initialGoalEnabled,
  initialGoalTime,
  initialQuoteEnabled,
  initialQuoteCount,
  hasAim,
  vapidPublicKey,
}) {
  const [reflectionEnabled, setReflectionEnabled] = useState(
    Boolean(initialReflectionEnabled),
  );
  const [reflectionTime, setReflectionTime] = useState(
    initialReflectionTime || "21:00",
  );
  const [goalEnabled, setGoalEnabled] = useState(Boolean(initialGoalEnabled));
  const [goalTime, setGoalTime] = useState(initialGoalTime || "09:00");
  const [quoteEnabled, setQuoteEnabled] = useState(Boolean(initialQuoteEnabled));
  const [quoteCount, setQuoteCount] = useState(
    Math.min(Math.max(Number(initialQuoteCount) || 1, 1), MAX_QUOTE_COUNT),
  );

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [testState, setTestState] = useState(null); // 'sending'|'sent'|'error'

  // Support depends on browser APIs, so it can only be known after mount.
  // Until then render as if supported (the common case) so SSR and the first
  // client render agree — otherwise React reports a hydration mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const supported = !mounted || pushSupported();

  const current = () => ({
    reflectionEnabled,
    reflectionTime,
    goalEnabled,
    goalTime,
    quoteEnabled,
    quoteCount,
  });
  const anyEnabled = reflectionEnabled || goalEnabled || quoteEnabled;

  // Ask permission, register the SW, and return this device's subscription.
  async function ensureSubscription() {
    if (!vapidPublicKey) {
      throw new Error("Push is not configured on the server yet.");
    }
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      throw new Error(
        permission === "denied"
          ? "Notifications are blocked for this site. Allow them in your browser settings, then try again."
          : "Notification permission was not granted.",
      );
    }
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
    }
    return sub.toJSON();
  }

  // Save the whole desired state in one snapshot. The toggle/time/count
  // controls each call this with the next state; it only commits to local
  // state once the round-trip succeeds, so a failed control reverts.
  async function persist(next) {
    if (busy) return;
    setError(null);
    setSaved(false);
    setBusy(true);
    try {
      const on =
        next.reflectionEnabled || next.goalEnabled || next.quoteEnabled;
      let subscription = null;
      if (on) {
        try {
          subscription = await ensureSubscription();
        } catch (err) {
          setError(err.message || "Could not turn on notifications.");
          return;
        }
      }
      const timezone =
        Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const res = await fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timezone,
          subscription,
          reflection: {
            enabled: next.reflectionEnabled,
            time: next.reflectionTime,
          },
          goal: { enabled: next.goalEnabled, time: next.goalTime },
          quote: { enabled: next.quoteEnabled, count: next.quoteCount },
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Something failed. Try again.");
        return;
      }
      setReflectionEnabled(next.reflectionEnabled);
      setReflectionTime(next.reflectionTime);
      setGoalEnabled(next.goalEnabled);
      setGoalTime(next.goalTime);
      setQuoteEnabled(next.quoteEnabled);
      setQuoteCount(next.quoteCount);
      setSaved(true);
    } catch {
      setError("Something failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setTestState("sending");
    setError(null);
    try {
      const res = await fetch("/api/reminders/test", { method: "POST" });
      const data = await res.json();
      setTestState(res.ok && !data.error ? "sent" : "error");
      if (!res.ok || data.error) setError(data.error || "Could not send.");
    } catch {
      setTestState("error");
    }
  }

  if (!supported) {
    return (
      <div>
        <p className="font-mono text-xs text-ash">reminders</p>
        <p className="mt-4 text-base leading-relaxed text-ash">
          This browser can&apos;t receive reminders. On a phone, open Citadel
          in Chrome (or add it to your home screen) and enable them there.
        </p>
      </div>
    );
  }

  const rule = "mt-14 border-t border-parchment/15 pt-14";

  return (
    <div>
      {/* --- Reflection reminder --- */}
      <section>
        <p className="font-mono text-xs text-ash">daily reminder</p>
        <p className="mt-4 text-base leading-relaxed text-ash">
          One notification a day, at a time you choose, to sit down and write.
          Nothing else — no streak counts, no second nudges.
        </p>
        <label className="mt-8 flex cursor-pointer items-center gap-3 text-lg text-parchment">
          <input
            type="checkbox"
            checked={reflectionEnabled}
            disabled={busy}
            onChange={(e) =>
              persist({ ...current(), reflectionEnabled: e.target.checked })
            }
            className="h-5 w-5 accent-patina"
          />
          Enable daily reminder
        </label>
        <div className="mt-8">
          <label htmlFor="reflection-time" className="font-mono text-xs text-ash">
            time of day
          </label>
          <div className="mt-4 flex items-center gap-4">
            <input
              id="reflection-time"
              type="time"
              value={reflectionTime}
              disabled={busy}
              onChange={(e) => {
                setReflectionTime(e.target.value);
                setSaved(false);
              }}
              className="rounded-xl bg-marble px-5 py-3 text-lg text-ink outline-none focus:ring-1 focus:ring-patina/50 disabled:opacity-60"
            />
            {reflectionEnabled && (
              <button
                type="button"
                onClick={() => persist(current())}
                disabled={busy}
                className="rounded-xl bg-cream px-6 py-3 text-lg tracking-wide text-ink disabled:text-ink/50"
              >
                Save time
              </button>
            )}
          </div>
        </div>
      </section>

      {/* --- Goal reminder --- */}
      <section className={rule}>
        <p className="font-mono text-xs text-ash">goal reminder</p>
        <p className="mt-4 text-base leading-relaxed text-ash">
          One notification a day, at a time you choose, to remind you what you
          are working toward.
        </p>
        <label className="mt-8 flex cursor-pointer items-center gap-3 text-lg text-parchment">
          <input
            type="checkbox"
            checked={goalEnabled}
            disabled={busy}
            onChange={(e) =>
              persist({ ...current(), goalEnabled: e.target.checked })
            }
            className="h-5 w-5 accent-patina"
          />
          Enable goal reminder
        </label>
        {goalEnabled && !hasAim && (
          <p className="mt-5 text-sm leading-relaxed text-ash">
            You haven&apos;t written what you&apos;re working toward yet. Set it
            in{" "}
            <Link
              href="/who-am-i"
              className="text-patina underline decoration-1 underline-offset-4"
            >
              Who am I
            </Link>{" "}
            and it will be the reminder.
          </p>
        )}
        <div className="mt-8">
          <label htmlFor="goal-time" className="font-mono text-xs text-ash">
            time of day
          </label>
          <div className="mt-4 flex items-center gap-4">
            <input
              id="goal-time"
              type="time"
              value={goalTime}
              disabled={busy}
              onChange={(e) => {
                setGoalTime(e.target.value);
                setSaved(false);
              }}
              className="rounded-xl bg-marble px-5 py-3 text-lg text-ink outline-none focus:ring-1 focus:ring-patina/50 disabled:opacity-60"
            />
            {goalEnabled && (
              <button
                type="button"
                onClick={() => persist(current())}
                disabled={busy}
                className="rounded-xl bg-cream px-6 py-3 text-lg tracking-wide text-ink disabled:text-ink/50"
              >
                Save time
              </button>
            )}
          </div>
        </div>
      </section>

      {/* --- Quote reminder --- */}
      <section className={rule}>
        <p className="font-mono text-xs text-ash">quote reminder</p>
        <p className="mt-4 text-base leading-relaxed text-ash">
          A short line to steady the day. Once a day, or more often if you
          want it.
        </p>
        <label className="mt-8 flex cursor-pointer items-center gap-3 text-lg text-parchment">
          <input
            type="checkbox"
            checked={quoteEnabled}
            disabled={busy}
            onChange={(e) =>
              persist({ ...current(), quoteEnabled: e.target.checked })
            }
            className="h-5 w-5 accent-patina"
          />
          Enable quote reminder
        </label>
        <div className="mt-8">
          <label htmlFor="quote-count" className="font-mono text-xs text-ash">
            times per day
          </label>
          <div className="mt-4 flex items-center gap-4">
            <input
              id="quote-count"
              type="number"
              min={1}
              max={MAX_QUOTE_COUNT}
              value={quoteCount}
              disabled={busy}
              onChange={(e) => {
                const n = Math.min(
                  Math.max(parseInt(e.target.value, 10) || 1, 1),
                  MAX_QUOTE_COUNT,
                );
                setQuoteCount(n);
                setSaved(false);
              }}
              className="w-24 rounded-xl bg-marble px-5 py-3 text-lg text-ink outline-none focus:ring-1 focus:ring-patina/50 disabled:opacity-60"
            />
            {quoteEnabled && (
              <button
                type="button"
                onClick={() => persist(current())}
                disabled={busy}
                className="rounded-xl bg-cream px-6 py-3 text-lg tracking-wide text-ink disabled:text-ink/50"
              >
                Save
              </button>
            )}
          </div>
          <p className="mt-3 font-mono text-[11px] text-ash">
            up to {MAX_QUOTE_COUNT} a day, spaced evenly
          </p>
        </div>
      </section>

      <p className="mt-10 font-mono text-[11px] text-ash">
        your device&apos;s timezone is used
      </p>

      {error && <p className="mt-6 text-sm text-ash">{error}</p>}
      {saved && !error && (
        <p className="mt-6 font-mono text-xs text-ash">saved</p>
      )}

      {anyEnabled && (
        <div className="mt-12 border-t border-parchment/15 pt-8">
          <button
            type="button"
            onClick={sendTest}
            disabled={testState === "sending"}
            className="font-mono text-sm tracking-wide text-patina underline decoration-1 underline-offset-4 disabled:opacity-50"
          >
            Send a test of each now
          </button>
          {testState === "sent" && (
            <p className="mt-3 font-mono text-xs text-ash">
              sent — they should arrive on this device in a moment
            </p>
          )}
          {testState === "sending" && (
            <p className="mt-3 font-mono text-xs text-ash">sending</p>
          )}
        </div>
      )}
    </div>
  );
}
