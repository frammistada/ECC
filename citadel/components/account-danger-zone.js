"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// The one section in the app that breaks the "Ember is reserved for the
// paywall" rule — deliberately: account deletion is the other moment
// severe enough to warrant it. Two-step: a plain trigger, then a typed
// "delete" confirmation before the destructive action can even be
// pressed — more friction than the meditations delete dialog, since this
// is irreversible for the whole account, not one page.
export default function AccountDangerZone() {
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function deleteAccount() {
    if (busy || confirmText.trim().toLowerCase() !== "delete") return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Something failed. Try again.");
        return;
      }
      const supabase = createClient();
      await supabase.auth.signOut();
      window.location.assign("/");
    } catch {
      setError("Something failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-12 border-t border-ember/30 pt-12">
      <p className="font-mono text-xs text-ember">red zone</p>
      <p className="mt-4 text-sm leading-relaxed text-ash">
        Delete your account and everything written in it — every entry,
        every reply, every page. This cannot be undone.
      </p>

      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="mt-6 rounded-xl border border-ember/50 px-6 py-2.5 text-sm text-ember transition-colors hover:bg-ember/10"
        >
          Delete my account
        </button>
      ) : (
        <div className="mt-6">
          <label htmlFor="confirm-delete" className="font-mono text-xs text-ash">
            type delete to confirm
          </label>
          <input
            id="confirm-delete"
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            disabled={busy}
            autoComplete="off"
            className="mt-3 w-full max-w-[240px] rounded-xl bg-marble p-3 text-base text-ink outline-none focus:ring-1 focus:ring-ember/50 disabled:opacity-60"
          />
          {error && <p className="mt-3 text-sm text-ash">{error}</p>}
          <div className="mt-5 flex items-center gap-6">
            <button
              type="button"
              onClick={deleteAccount}
              disabled={busy || confirmText.trim().toLowerCase() !== "delete"}
              className="rounded-xl bg-ember px-6 py-2.5 text-sm tracking-wide text-parchment disabled:opacity-40"
            >
              Delete permanently
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirming(false);
                setConfirmText("");
                setError(null);
              }}
              disabled={busy}
              className="font-mono text-xs text-ash underline decoration-1 underline-offset-4"
            >
              keep my account
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
