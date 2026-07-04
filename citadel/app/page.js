"use client";

import { useState } from "react";

function todayLine() {
  return new Date()
    .toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    })
    .toLowerCase();
}

function timeLine(date) {
  return date
    .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    .toLowerCase();
}

export default function Home() {
  const [draft, setDraft] = useState("");
  const [exchanges, setExchanges] = useState([]);
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState(null);

  async function reflect(event) {
    event.preventDefault();
    const entry = draft.trim();
    if (!entry || waiting) return;

    setWaiting(true);
    setError(null);

    try {
      const res = await fetch("/api/reflect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entry,
          history: exchanges.map(({ entry, response }) => ({
            entry,
            response,
          })),
        }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error || "Something failed. Try again.");
        return;
      }

      setExchanges((prev) => [
        ...prev,
        { entry, response: data.response, at: new Date() },
      ]);
      setDraft("");
    } catch {
      setError("The mentor could not be reached.");
    } finally {
      setWaiting(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-[640px] px-6 py-16 sm:py-24">
      <header>
        <h1 className="font-display text-4xl font-normal tracking-[0.08em]">
          Citadel
        </h1>
        <p className="mt-3 font-mono text-xs text-ash">{todayLine()}</p>
      </header>

      <section className="mt-16">
        {exchanges.length === 0 && !waiting ? (
          <p className="text-ash">Nothing written yet today.</p>
        ) : (
          <ol>
            {exchanges.map((x, i) => (
              <li
                key={i}
                className={
                  i === 0 ? undefined : "mt-12 border-t border-ash/30 pt-12"
                }
              >
                <p className="font-mono text-xs text-ash">{timeLine(x.at)}</p>
                <p className="mt-4 whitespace-pre-wrap text-lg leading-relaxed">
                  {x.entry}
                </p>
                <blockquote className="mt-8 animate-settle border-l border-patina pl-5 text-lg italic leading-relaxed text-ink/90">
                  {x.response}
                </blockquote>
              </li>
            ))}
          </ol>
        )}

        {waiting && (
          <p className="mt-10 font-mono text-xs text-ash">
            the mentor is reading
          </p>
        )}
      </section>

      <form onSubmit={reflect} className="mt-16 border-t border-ash/30 pt-12">
        <label htmlFor="entry" className="font-mono text-xs text-ash">
          what tested you today
        </label>
        <textarea
          id="entry"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={6}
          maxLength={5000}
          disabled={waiting}
          className="mt-4 w-full resize-y bg-marble p-5 text-lg leading-relaxed text-ink outline-none placeholder:text-ash focus:ring-1 focus:ring-patina/50 disabled:opacity-60"
          placeholder="Where did you slip, or hold firm."
        />
        {error && <p className="mt-4 text-sm text-ash">{error}</p>}
        <button
          type="submit"
          disabled={waiting || !draft.trim()}
          className="mt-6 font-mono text-sm tracking-wide text-patina underline decoration-1 underline-offset-4 disabled:no-underline disabled:opacity-50"
        >
          Reflect
        </button>
      </form>
    </main>
  );
}
