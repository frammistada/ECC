"use client";

import { useState, useEffect } from "react";

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

export default function RemindersForm({
  initialEnabled,
  initialTime,
  vapidPublicKey,
}) {
  const [enabled, setEnabled] = useState(Boolean(initialEnabled));
  const [time, setTime] = useState(initialTime || "21:00");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [testState, setTestState] = useState(null); // 'sending'|'sent'|'error'
  // Support depends on browser APIs, so it can only be known after mount.
  // Until then, render as if supported (the common case) so the server and
  // first client render agree — otherwise React reports a hydration
  // mismatch. If it turns out unsupported, the message appears after mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const supported = !mounted || pushSupported();

  // Turning it on: ask permission, register the SW, subscribe to push, and
  // save. Every step can fail plainly, and the toggle only sticks "on" once
  // the round-trip succeeds.
  async function enable() {
    setError(null);
    setSaved(false);
    if (!vapidPublicKey) {
      setError("Push is not configured on the server yet.");
      return;
    }
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setError(
          permission === "denied"
            ? "Notifications are blocked for this site. Allow them in your browser settings, then try again."
            : "Notification permission was not granted.",
        );
        return;
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

      const timezone =
        Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

      const res = await fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: true,
          time,
          timezone,
          subscription: sub.toJSON(),
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Something failed. Try again.");
        return;
      }
      setEnabled(true);
      setSaved(true);
    } catch (err) {
      console.error(err);
      setError("Could not turn on reminders. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setError(null);
    setSaved(false);
    setBusy(true);
    try {
      const res = await fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: false }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Something failed. Try again.");
        return;
      }
      setEnabled(false);
      setSaved(true);
    } catch {
      setError("Something failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  // Save a new time while enabled (re-subscribe not needed — same device).
  async function saveTime() {
    setError(null);
    setSaved(false);
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) {
        // The browser dropped the subscription — re-run the full enable.
        setBusy(false);
        return enable();
      }
      const timezone =
        Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const res = await fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: true,
          time,
          timezone,
          subscription: sub.toJSON(),
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Something failed. Try again.");
        return;
      }
      setSaved(true);
    } catch {
      setError("Something failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setTestState("sending");
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
        <p className="font-mono text-xs text-ash">daily reminder</p>
        <p className="mt-4 text-base leading-relaxed text-ash">
          This browser can&apos;t receive reminders. On a phone, open Citadel
          in Chrome (or add it to your home screen) and enable it there.
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="font-mono text-xs text-ash">daily reminder</p>
      <p className="mt-4 text-base leading-relaxed text-ash">
        One notification a day, at a time you choose, to sit down and write.
        Nothing else — no streak counts, no second nudges.
      </p>

      <div className="mt-8 flex items-center gap-4">
        <label className="flex cursor-pointer items-center gap-3 text-lg text-parchment">
          <input
            type="checkbox"
            checked={enabled}
            disabled={busy}
            onChange={(e) => (e.target.checked ? enable() : disable())}
            className="h-5 w-5 accent-patina"
          />
          Enable daily reminder
        </label>
      </div>

      <div className="mt-8">
        <label htmlFor="reminder-time" className="font-mono text-xs text-ash">
          time of day
        </label>
        <div className="mt-4 flex items-center gap-4">
          <input
            id="reminder-time"
            type="time"
            value={time}
            disabled={busy}
            onChange={(e) => {
              setTime(e.target.value);
              setSaved(false);
            }}
            className="rounded-xl bg-marble px-5 py-3 text-lg text-ink outline-none focus:ring-1 focus:ring-patina/50 disabled:opacity-60"
          />
          {enabled && (
            <button
              type="button"
              onClick={saveTime}
              disabled={busy}
              className="rounded-xl bg-cream px-6 py-3 text-lg tracking-wide text-ink disabled:text-ink/50"
            >
              Save time
            </button>
          )}
        </div>
        <p className="mt-3 font-mono text-[11px] text-ash">
          your device&apos;s timezone is used
        </p>
      </div>

      {error && <p className="mt-6 text-sm text-ash">{error}</p>}
      {saved && !error && (
        <p className="mt-6 font-mono text-xs text-ash">saved</p>
      )}

      {enabled && (
        <div className="mt-12 border-t border-parchment/15 pt-8">
          <button
            type="button"
            onClick={sendTest}
            disabled={testState === "sending"}
            className="font-mono text-sm tracking-wide text-patina underline decoration-1 underline-offset-4 disabled:opacity-50"
          >
            Send a test reminder now
          </button>
          {testState === "sent" && (
            <p className="mt-3 font-mono text-xs text-ash">
              sent — it should arrive on this device in a moment
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
