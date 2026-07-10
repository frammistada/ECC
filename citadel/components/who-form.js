"use client";

import { useState } from "react";

// The "Who am I" form. Name is the same profiles.preferred_name collected
// at onboarding — pre-filled here, never asked twice. Saves through the
// same /api/settings profile updater the settings form uses.
export default function WhoForm({
  initialName,
  initialAge,
  initialAim,
  initialNote,
}) {
  const [name, setName] = useState(initialName || "");
  const [age, setAge] = useState(
    initialAge === null || initialAge === undefined ? "" : String(initialAge),
  );
  const [aim, setAim] = useState(initialAim || "");
  const [note, setNote] = useState(initialNote || "");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  function touch() {
    setSaved(false);
  }

  async function save(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preferredName: name.trim(),
          age: age.trim(),
          aim: aim.trim(),
          aboutNote: note.trim(),
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

  return (
    <form onSubmit={save} className="mt-10">
      <label htmlFor="who-name" className="block font-mono text-xs text-ash">
        what the mentor calls you
      </label>
      <input
        id="who-name"
        type="text"
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          touch();
        }}
        maxLength={60}
        disabled={busy}
        placeholder="a name, or leave it blank"
        className="mt-4 w-full rounded-xl bg-marble p-5 text-lg text-ink outline-none placeholder:text-ash focus:ring-1 focus:ring-patina/50 disabled:opacity-60"
      />

      <label
        htmlFor="who-age"
        className="mt-10 block font-mono text-xs text-ash"
      >
        your age
      </label>
      <input
        id="who-age"
        inputMode="numeric"
        value={age}
        onChange={(e) => {
          setAge(e.target.value.replace(/\D/g, "").slice(0, 3));
          touch();
        }}
        disabled={busy}
        placeholder="a number, or leave it blank"
        className="mt-4 w-full rounded-xl bg-marble p-5 text-lg text-ink outline-none placeholder:text-ash focus:ring-1 focus:ring-patina/50 disabled:opacity-60"
      />

      <label
        htmlFor="who-aim"
        className="mt-10 block font-mono text-xs text-ash"
      >
        what you are trying to accomplish
      </label>
      <textarea
        id="who-aim"
        value={aim}
        onChange={(e) => {
          setAim(e.target.value);
          touch();
        }}
        maxLength={1000}
        rows={4}
        disabled={busy}
        placeholder="in your own words"
        className="mt-4 w-full resize-none rounded-xl bg-marble p-5 text-lg leading-relaxed text-ink outline-none placeholder:text-ash focus:ring-1 focus:ring-patina/50 disabled:opacity-60"
      />

      <label
        htmlFor="who-note"
        className="mt-10 block font-mono text-xs text-ash"
      >
        anything else the mentor should know about you
      </label>
      <textarea
        id="who-note"
        value={note}
        onChange={(e) => {
          setNote(e.target.value);
          touch();
        }}
        maxLength={2000}
        rows={6}
        disabled={busy}
        placeholder="whatever matters"
        className="mt-4 w-full resize-none rounded-xl bg-marble p-5 text-lg leading-relaxed text-ink outline-none placeholder:text-ash focus:ring-1 focus:ring-patina/50 disabled:opacity-60"
      />

      {error && <p className="mt-6 text-sm text-ash">{error}</p>}

      <div className="mt-8 flex items-baseline gap-6">
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-cream px-8 py-3 text-lg tracking-wide text-ink disabled:text-ink/50"
        >
          Save
        </button>
        {saved && <span className="font-mono text-xs text-ash">saved</span>}
      </div>
    </form>
  );
}
