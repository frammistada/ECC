"use client";

import { useState } from "react";
import { FREE_ENTRY_LIMIT } from "@/lib/limits";
import { timeLine } from "@/lib/format";

export default function Journal({
  initialExchanges,
  initialCount,
  subscribed,
  checkoutSuccess,
  hasAccountabilityContact,
}) {
  const [draft, setDraft] = useState("");
  const [slipped, setSlipped] = useState(false);
  const [exchanges, setExchanges] = useState(initialExchanges);
  const [entryCount, setEntryCount] = useState(initialCount);
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState(null);
  const [paywalled, setPaywalled] = useState(
    !subscribed && initialCount >= FREE_ENTRY_LIMIT,
  );
  const [openingCheckout, setOpeningCheckout] = useState(false);

  // Accountability draft (item 4): shown for a one-tap send, never auto-sent.
  const [note, setNote] = useState(null); // { toName, message }
  const [sending, setSending] = useState(false);
  const [noteState, setNoteState] = useState(null); // 'sent' | 'error' | null

  async function reflect(event) {
    event.preventDefault();
    const entry = draft.trim();
    if (!entry || waiting) return;

    setWaiting(true);
    setError(null);
    setNote(null);
    setNoteState(null);

    try {
      const res = await fetch("/api/reflect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entry, slipped }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        if (data.paywall) {
          setPaywalled(true);
        } else {
          setError(data.error || "Something failed. Try again.");
        }
        return;
      }

      setExchanges((prev) => [
        ...prev,
        { entry, response: data.response, at: new Date().toISOString() },
      ]);
      setEntryCount(data.entryCount);
      setDraft("");
      setSlipped(false);
      if (data.draft) setNote(data.draft);
      if (!subscribed && data.entryCount >= FREE_ENTRY_LIMIT) {
        setPaywalled(true);
      }
    } catch {
      setError("The mentor could not be reached.");
    } finally {
      setWaiting(false);
    }
  }

  async function sendNote() {
    if (sending) return;
    setSending(true);
    setNoteState(null);
    try {
      const res = await fetch("/api/accountability/send", { method: "POST" });
      const data = await res.json();
      if (!res.ok || data.error) {
        setNoteState("error");
        return;
      }
      setNoteState("sent");
    } catch {
      setNoteState("error");
    } finally {
      setSending(false);
    }
  }

  async function subscribe() {
    setOpeningCheckout(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.assign(data.url);
        return;
      }
      setError(data.error || "Something failed. Try again.");
    } catch {
      setError("Something failed. Try again.");
    } finally {
      setOpeningCheckout(false);
    }
  }

  return (
    <>
      <section className="mt-16">
        {checkoutSuccess && !subscribed && (
          <p className="mb-10 font-mono text-xs text-ash">
            subscription received — it may take a moment to register
          </p>
        )}

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
                <p className="font-mono text-xs text-ash">
                  {timeLine(new Date(x.at))}
                </p>
                <p className="mt-4 whitespace-pre-wrap text-lg leading-relaxed">
                  {x.entry}
                </p>
                {x.response && (
                  <blockquote className="mt-8 animate-settle border-l border-patina pl-5 text-lg italic leading-relaxed text-ink/90">
                    {x.response}
                  </blockquote>
                )}
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

      {note && (
        <section className="mt-12 animate-settle bg-marble p-6">
          <p className="font-mono text-xs text-ash">
            a note to {note.toName || "your contact"}
          </p>
          <p className="mt-4 whitespace-pre-wrap text-lg leading-relaxed text-ink/90">
            {note.message}
          </p>
          {noteState === "sent" ? (
            <p className="mt-6 font-mono text-xs text-ash">sent</p>
          ) : (
            <div className="mt-6 flex items-baseline gap-6">
              <button
                type="button"
                onClick={sendNote}
                disabled={sending}
                className="font-mono text-sm tracking-wide text-patina underline decoration-1 underline-offset-4 disabled:opacity-50"
              >
                Send it
              </button>
              <button
                type="button"
                onClick={() => setNote(null)}
                className="font-mono text-xs text-ash underline decoration-1 underline-offset-4"
              >
                not now
              </button>
              {noteState === "error" && (
                <span className="font-mono text-xs text-ash">
                  couldn&apos;t send — try again
                </span>
              )}
            </div>
          )}
        </section>
      )}

      {paywalled ? (
        <section className="mt-16 border-t border-ash/30 pt-12">
          <p className="text-lg leading-relaxed">
            Continuing past your first five reflections requires a
            subscription.
          </p>
          <button
            type="button"
            onClick={subscribe}
            disabled={openingCheckout}
            className="mt-6 font-mono text-sm tracking-wide text-ember underline decoration-1 underline-offset-4 disabled:opacity-50"
          >
            Subscribe
          </button>
          {error && <p className="mt-4 text-sm text-ash">{error}</p>}
        </section>
      ) : (
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

          {hasAccountabilityContact && (
            <label className="mt-4 flex cursor-pointer items-center gap-3 font-mono text-xs text-ash">
              <input
                type="checkbox"
                checked={slipped}
                onChange={(e) => setSlipped(e.target.checked)}
                disabled={waiting}
                className="accent-patina"
              />
              I fell short of what I set out to do today
            </label>
          )}

          {error && <p className="mt-4 text-sm text-ash">{error}</p>}
          <div className="mt-6 flex items-baseline justify-between">
            <button
              type="submit"
              disabled={waiting || !draft.trim()}
              className="font-mono text-sm tracking-wide text-patina underline decoration-1 underline-offset-4 disabled:no-underline disabled:opacity-50"
            >
              Reflect
            </button>
            {!subscribed && (
              <p className="font-mono text-xs text-ash">
                {entryCount} of {FREE_ENTRY_LIMIT} free reflections used
              </p>
            )}
          </div>
        </form>
      )}
    </>
  );
}
