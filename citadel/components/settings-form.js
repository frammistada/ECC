"use client";

import { useState } from "react";

const MODES = [
  {
    value: "steady",
    label: "Steady",
    blurb: "Meets what you wrote before it turns the harder question.",
  },
  {
    value: "direct",
    label: "Direct",
    blurb: "Leads with what you're avoiding. No warm-up.",
  },
];

export default function SettingsForm({ initialMode, initialName }) {
  const [mode, setMode] = useState(
    initialMode === "direct" ? "direct" : "steady",
  );
  const [name, setName] = useState(initialName || "");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

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
        body: JSON.stringify({ mentorMode: mode, preferredName: name.trim() }),
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
    <form onSubmit={save}>
      <p className="font-mono text-xs text-ash">how the mentor speaks to you</p>
      <div className="mt-5 flex flex-col gap-3">
        {MODES.map((m) => {
          const selected = mode === m.value;
          return (
            <button
              key={m.value}
              type="button"
              onClick={() => {
                setMode(m.value);
                setSaved(false);
              }}
              className={
                "border-l px-5 py-4 text-left transition-colors " +
                (selected
                  ? "border-patina bg-marble"
                  : "border-ash/30 hover:bg-marble/60")
              }
            >
              <span className="text-lg leading-relaxed text-ink">
                {m.label}
              </span>
              <span className="mt-1 block text-sm leading-relaxed text-ash">
                {m.blurb}
              </span>
            </button>
          );
        })}
      </div>

      <label
        htmlFor="name"
        className="mt-12 block border-t border-ash/30 pt-12 font-mono text-xs text-ash"
      >
        what the mentor calls you
      </label>
      <input
        id="name"
        type="text"
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setSaved(false);
        }}
        maxLength={60}
        disabled={busy}
        className="mt-4 w-full bg-marble p-5 text-lg text-ink outline-none placeholder:text-ash focus:ring-1 focus:ring-patina/50 disabled:opacity-60"
        placeholder="a name, or leave it blank"
      />

      {error && <p className="mt-6 text-sm text-ash">{error}</p>}

      <div className="mt-8 flex items-baseline gap-6">
        <button
          type="submit"
          disabled={busy}
          className="font-mono text-sm tracking-wide text-patina underline decoration-1 underline-offset-4 disabled:opacity-50"
        >
          Save
        </button>
        {saved && <span className="font-mono text-xs text-ash">saved</span>}
      </div>
    </form>
  );
}
