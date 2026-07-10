"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LocalDay } from "@/components/local-date";
import { PlusMark, DotsMark } from "@/components/icons";

// The meditations page body: an internally-scrolling list of entry pages,
// a fixed "new page" button, and the manage/create dialogs. The page
// itself never scrolls; only this list does.

const MODES = [
  { value: "default", label: "mentor's default" },
  { value: "steady", label: "steady" },
  { value: "direct", label: "direct" },
];

function Dialog({ onClose, children }) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-night/80 p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm animate-settle rounded-2xl border border-parchment/15 bg-panel p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function ModePicker({ mode, setMode, disabled }) {
  return (
    <div className="mt-2 flex flex-col gap-2">
      {MODES.map((m) => (
        <button
          key={m.value}
          type="button"
          disabled={disabled}
          onClick={() => setMode(m.value)}
          className={
            "rounded-r-lg border-l px-4 py-2.5 text-left text-base transition-colors " +
            (mode === m.value
              ? "border-patina bg-marble text-ink"
              : "border-ash/30 text-parchment/80 hover:bg-parchment/10")
          }
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}

export default function MeditationsList({ initialMeditations }) {
  const router = useRouter();
  const [meditations, setMeditations] = useState(initialMeditations);
  const [creating, setCreating] = useState(false); // create dialog open
  const [managing, setManaging] = useState(null); // meditation being managed
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [name, setName] = useState("");
  const [mode, setMode] = useState("default");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  function openCreate() {
    setName("");
    setMode("default");
    setError(null);
    setCreating(true);
  }

  function openManage(m) {
    setName(m.name);
    setMode(m.mentor_mode ?? "default");
    setError(null);
    setConfirmingDelete(false);
    setManaging(m);
  }

  function close() {
    if (busy) return;
    setCreating(false);
    setManaging(null);
    setConfirmingDelete(false);
  }

  async function create(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/meditations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, mentorMode: mode }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Something failed. Try again.");
        return;
      }
      router.push(`/meditations/${data.id}`);
    } catch {
      setError("Something failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function saveManage(event) {
    event.preventDefault();
    if (busy || !managing) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/meditations/${managing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, mentorMode: mode }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Something failed. Try again.");
        return;
      }
      setMeditations((prev) =>
        prev.map((m) =>
          m.id === managing.id
            ? {
                ...m,
                name: name.trim() || m.name,
                mentor_mode: mode === "default" ? null : mode,
              }
            : m,
        ),
      );
      setManaging(null);
    } catch {
      setError("Something failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (busy || !managing) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/meditations/${managing.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Something failed. Try again.");
        return;
      }
      setMeditations((prev) => prev.filter((m) => m.id !== managing.id));
      setManaging(null);
      setConfirmingDelete(false);
    } catch {
      setError("Something failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="mt-6 min-h-0 flex-1 overflow-y-auto">
        {meditations.length === 0 ? (
          <p className="mt-8 text-center text-ash">Nothing written yet.</p>
        ) : (
          <ol className="flex flex-col gap-2.5 pb-2">
            {meditations.map((m) => (
              <li key={m.id} className="flex items-stretch gap-2">
                <button
                  type="button"
                  onClick={() => router.push(`/meditations/${m.id}`)}
                  className="min-w-0 flex-1 rounded-r-xl border-l border-ash/30 px-4 py-3 text-left transition-colors hover:bg-parchment/10"
                >
                  <span className="block truncate text-base leading-relaxed">
                    {m.name}
                  </span>
                  <span className="mt-1 block font-mono text-xs text-ash">
                    <LocalDay iso={m.created_at} />
                    {m.mentor_mode ? ` · ${m.mentor_mode}` : ""}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => openManage(m)}
                  aria-label={`manage ${m.name}`}
                  className="shrink-0 self-center p-2 text-ash hover:text-parchment"
                >
                  <DotsMark className="h-5 w-5" />
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="mt-5 flex justify-center">
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center gap-3 rounded-2xl bg-cream px-8 py-3.5 text-base tracking-wide text-ink"
        >
          <PlusMark className="h-5 w-5" />
          New page
        </button>
      </div>

      {creating && (
        <Dialog onClose={close}>
          <form onSubmit={create}>
            <p className="font-mono text-xs text-ash">a new page</p>
            <label htmlFor="new-name" className="mt-4 block text-base">
              its name
            </label>
            <input
              id="new-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              disabled={busy}
              placeholder="a name, or leave blank"
              className="mt-2 w-full rounded-lg bg-marble p-3 text-base text-ink outline-none placeholder:text-ash focus:ring-1 focus:ring-patina/50 disabled:opacity-60"
            />
            <p className="mt-4 text-base">how the mentor speaks here</p>
            <ModePicker mode={mode} setMode={setMode} disabled={busy} />
            {error && <p className="mt-3 text-sm text-ash">{error}</p>}
            <div className="mt-6 flex items-center gap-6">
              <button
                type="submit"
                disabled={busy}
                className="rounded-xl bg-cream px-7 py-2.5 text-base tracking-wide text-ink disabled:text-ink/50"
              >
                Create
              </button>
              <button
                type="button"
                onClick={close}
                className="font-mono text-xs text-ash underline decoration-1 underline-offset-4"
              >
                not now
              </button>
            </div>
          </form>
        </Dialog>
      )}

      {managing && !confirmingDelete && (
        <Dialog onClose={close}>
          <form onSubmit={saveManage}>
            <p className="font-mono text-xs text-ash">
              <LocalDay iso={managing.created_at} />
            </p>
            <label htmlFor="manage-name" className="mt-4 block text-base">
              its name
            </label>
            <input
              id="manage-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              disabled={busy}
              className="mt-2 w-full rounded-lg bg-marble p-3 text-base text-ink outline-none focus:ring-1 focus:ring-patina/50 disabled:opacity-60"
            />
            <p className="mt-4 text-base">how the mentor speaks here</p>
            <ModePicker mode={mode} setMode={setMode} disabled={busy} />
            {error && <p className="mt-3 text-sm text-ash">{error}</p>}
            <div className="mt-6 flex items-center gap-6">
              <button
                type="submit"
                disabled={busy || !name.trim()}
                className="rounded-xl bg-cream px-7 py-2.5 text-base tracking-wide text-ink disabled:text-ink/50"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                disabled={busy}
                className="font-mono text-xs text-ash underline decoration-1 underline-offset-4"
              >
                delete
              </button>
              <button
                type="button"
                onClick={close}
                className="font-mono text-xs text-ash underline decoration-1 underline-offset-4"
              >
                not now
              </button>
            </div>
          </form>
        </Dialog>
      )}

      {managing && confirmingDelete && (
        <Dialog onClose={close}>
          <p className="text-base leading-relaxed">
            Delete “{managing.name}” and everything written in it? This cannot
            be undone.
          </p>
          {error && <p className="mt-3 text-sm text-ash">{error}</p>}
          <div className="mt-6 flex items-center gap-6">
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className="rounded-xl bg-cream px-7 py-2.5 text-base tracking-wide text-ink disabled:text-ink/50"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              disabled={busy}
              className="font-mono text-xs text-ash underline decoration-1 underline-offset-4"
            >
              keep it
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}
