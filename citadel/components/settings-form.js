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

export default function SettingsForm({
  initialMode,
  initialName,
  initialContactName,
  initialContactEmail,
  emailConfigured,
}) {
  const [mode, setMode] = useState(
    initialMode === "direct" ? "direct" : "steady",
  );
  const [name, setName] = useState(initialName || "");
  const [contactName, setContactName] = useState(initialContactName || "");
  const [contactEmail, setContactEmail] = useState(initialContactEmail || "");
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
          mentorMode: mode,
          preferredName: name.trim(),
          accountabilityName: contactName.trim(),
          accountabilityEmail: contactEmail.trim(),
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
                  ? "border-patina bg-marble text-ink"
                  : "border-ash/30 text-parchment hover:bg-parchment/10")
              }
            >
              <span className="text-lg leading-relaxed">
                {m.label}
              </span>
              <span className="mt-1 block text-sm leading-relaxed opacity-70">
                {m.blurb}
              </span>
            </button>
          );
        })}
      </div>

      <label
        htmlFor="name"
        className="mt-12 block border-t border-parchment/15 pt-12 font-mono text-xs text-ash"
      >
        what the mentor calls you
      </label>
      <input
        id="name"
        type="text"
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          touch();
        }}
        maxLength={60}
        disabled={busy}
        className="mt-4 w-full rounded-xl bg-marble p-5 text-lg text-ink outline-none placeholder:text-ash focus:ring-1 focus:ring-patina/50 disabled:opacity-60"
        placeholder="a name, or leave it blank"
      />

      <div className="mt-12 border-t border-parchment/15 pt-12">
        <p className="font-mono text-xs text-ash">accountability contact</p>
        <p className="mt-4 text-sm leading-relaxed text-ash">
          One person. On a day you mark that you fell short, you&apos;ll be
          offered a short note to send them — never sent without your tap.
          Optional; leave blank to keep this off.
        </p>
        <input
          id="contact-name"
          type="text"
          value={contactName}
          onChange={(e) => {
            setContactName(e.target.value);
            touch();
          }}
          maxLength={80}
          disabled={busy}
          aria-label="their name"
          className="mt-5 w-full rounded-xl bg-marble p-5 text-lg text-ink outline-none placeholder:text-ash focus:ring-1 focus:ring-patina/50 disabled:opacity-60"
          placeholder="their name"
        />
        <input
          id="contact-email"
          type="email"
          value={contactEmail}
          onChange={(e) => {
            setContactEmail(e.target.value);
            touch();
          }}
          maxLength={255}
          disabled={busy}
          aria-label="their email"
          className="mt-4 w-full rounded-xl bg-marble p-5 text-lg text-ink outline-none placeholder:text-ash focus:ring-1 focus:ring-patina/50 disabled:opacity-60"
          placeholder="their email"
        />
        {!emailConfigured && (contactEmail || contactName) && (
          <p className="mt-4 font-mono text-xs text-ash">
            note: sending isn&apos;t configured yet, so the draft will show but
            can&apos;t be sent until it is
          </p>
        )}
      </div>

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
