"use client";

import { useEffect, useState } from "react";
import { FREE_ENTRY_LIMIT } from "@/lib/limits";
import { composeMissedDayMessage } from "@/lib/accountability";
import { LocalStamp } from "@/components/local-date";

// Check-in states, in the entry placeholder's own words ("Where did you
// slip, or hold firm.").
const CHECKIN_STATES = ["held", "slipped", "neither"];

export default function Journal({
  initialExchanges,
  initialCount,
  subscribed,
  checkoutSuccess,
  hasAccountabilityContact,
  meditationId = null,
  missedYesterday = false,
  contactName = null,
  preferredName = null,
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

  // Micro check-in: the low-effort alternative to a full entry.
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [checkinState, setCheckinState] = useState(null);
  const [checkinNote, setCheckinNote] = useState("");

  // Missed-day note (consequence mechanic). Dismissal is remembered per
  // UTC day in localStorage, so "let it pass" holds for the whole day.
  const missedKey = `citadel-missed-${new Date().toISOString().slice(0, 10)}`;
  const [missedVisible, setMissedVisible] = useState(false);
  const [missedState, setMissedState] = useState(null); // 'sent'|'error'|null
  useEffect(() => {
    if (missedYesterday && !window.localStorage.getItem(missedKey)) {
      setMissedVisible(true);
    }
  }, [missedYesterday, missedKey]);

  function dismissMissed() {
    window.localStorage.setItem(missedKey, "1");
    setMissedVisible(false);
  }

  async function sendMissed() {
    if (sending) return;
    setSending(true);
    setMissedState(null);
    try {
      const res = await fetch("/api/accountability/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "missed" }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setMissedState("error");
        return;
      }
      setMissedState("sent");
      window.localStorage.setItem(missedKey, "1");
      setMissedVisible(false);
    } catch {
      setMissedState("error");
    } finally {
      setSending(false);
    }
  }

  async function checkIn() {
    if (waiting || !checkinState) return;
    setWaiting(true);
    setError(null);
    setNote(null);
    setNoteState(null);
    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          state: checkinState,
          note: checkinNote.trim(),
          meditationId,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Something failed. Try again.");
        return;
      }
      setExchanges((prev) => [
        ...prev,
        { entry: data.content, response: data.response, at: new Date().toISOString() },
      ]);
      setCheckinOpen(false);
      setCheckinState(null);
      setCheckinNote("");
      if (data.draft) setNote(data.draft);
    } catch {
      setError("The mentor could not be reached.");
    } finally {
      setWaiting(false);
    }
  }

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
        body: JSON.stringify({ entry, slipped, meditationId }),
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
      {/* The one scrollable region: the day's exchanges (and the drafted
          note). Header and entry form stay fixed so the mentor's answer
          can be reread without scrolling the page. */}
      <div className="min-h-0 overflow-y-auto">
      {missedVisible && (
        <section className="mt-6 animate-settle rounded-2xl bg-marble p-6 text-ink">
          <p className="font-mono text-xs text-ink/60">
            yesterday passed with nothing written
          </p>
          <p className="mt-4 whitespace-pre-wrap text-lg leading-relaxed text-ink/90">
            {composeMissedDayMessage(preferredName)}
          </p>
          <div className="mt-6 flex items-baseline gap-6">
            <button
              type="button"
              onClick={sendMissed}
              disabled={sending}
              className="font-mono text-sm tracking-wide text-patina underline decoration-1 underline-offset-4 disabled:opacity-50"
            >
              Send it to {contactName || "your contact"}
            </button>
            <button
              type="button"
              onClick={dismissMissed}
              className="font-mono text-xs text-ink/60 underline decoration-1 underline-offset-4"
            >
              let it pass
            </button>
            {missedState === "error" && (
              <span className="font-mono text-xs text-ink/60">
                couldn&apos;t send — try again
              </span>
            )}
          </div>
        </section>
      )}
      {missedState === "sent" && !missedVisible && (
        <p className="mt-6 font-mono text-xs text-ash">sent</p>
      )}
      <section className="mt-8">
        {checkoutSuccess && !subscribed && (
          <p className="mb-10 font-mono text-xs text-ash">
            subscription received — it may take a moment to register
          </p>
        )}

        {exchanges.length === 0 && !waiting ? (
          <p className="text-center text-lg leading-relaxed">Nothing written yet today.</p>
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
                  <LocalStamp iso={x.at} />
                </p>
                <p className="mt-4 whitespace-pre-wrap text-lg leading-relaxed">
                  {x.entry}
                </p>
                {x.response && (
                  <blockquote className="mt-8 animate-settle border-l border-patina pl-5 text-lg italic leading-relaxed text-parchment/90">
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
        <section className="mt-12 animate-settle rounded-2xl bg-marble p-6 text-ink">
          <p className="font-mono text-xs text-ink/60">
            a note to {note.toName || "your contact"}
          </p>
          <p className="mt-4 whitespace-pre-wrap text-lg leading-relaxed text-ink/90">
            {note.message}
          </p>
          {noteState === "sent" ? (
            <p className="mt-6 font-mono text-xs text-ink/60">sent</p>
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
                className="font-mono text-xs text-ink/60 underline decoration-1 underline-offset-4"
              >
                not now
              </button>
              {noteState === "error" && (
                <span className="font-mono text-xs text-ink/60">
                  couldn&apos;t send — try again
                </span>
              )}
            </div>
          )}
        </section>
      )}

      </div>

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
        <form onSubmit={reflect} className="mt-8 border-t border-parchment/15 pt-6">
          <label
            htmlFor="entry"
            className="block text-center font-mono text-xs tracking-[0.08em] text-ash"
          >
            what tested you today
          </label>
          <textarea
            id="entry"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={exchanges.length > 0 ? 3 : 6}
            maxLength={5000}
            disabled={waiting}
            className="mt-4 w-full resize-y rounded-xl bg-marble p-4 text-lg leading-relaxed text-ink outline-none placeholder:text-ink/70 focus:ring-1 focus:ring-patina/50 disabled:opacity-60"
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
          <div className="mt-5 flex items-center justify-between gap-4">
            <button
              type="submit"
              disabled={waiting || !draft.trim()}
              className="rounded-xl bg-cream px-6 py-3 text-lg tracking-wide text-ink disabled:text-ink/50"
            >
              Reflect
            </button>
            {!subscribed && (
              <p className="whitespace-nowrap text-right font-mono text-[10px] text-ash sm:text-xs">
                {entryCount} of {FREE_ENTRY_LIMIT} free reflections used
              </p>
            )}
          </div>
        </form>
      )}

      {/* Micro check-in: the low-effort door. Deliberately reachable even
          when the reflection paywall is up — a bad day never costs the
          habit, on any tier. */}
      {!checkinOpen ? (
        <button
          type="button"
          onClick={() => {
            setCheckinOpen(true);
            setError(null);
          }}
          disabled={waiting}
          className="mx-auto mt-4 font-mono text-xs text-ash underline decoration-1 underline-offset-4 disabled:opacity-50"
        >
          no entry in you today? just check in
        </button>
      ) : (
        <div className="mt-4 animate-settle border-t border-parchment/15 pt-5">
          <p className="text-center font-mono text-xs tracking-[0.08em] text-ash">
            how did the day go
          </p>
          <div className="mt-3 flex justify-center gap-2">
            {CHECKIN_STATES.map((s) => (
              <button
                key={s}
                type="button"
                disabled={waiting}
                onClick={() => setCheckinState(s)}
                className={
                  "rounded-xl px-5 py-2.5 text-base transition-colors " +
                  (checkinState === s
                    ? "bg-marble text-ink"
                    : "border border-parchment/20 text-parchment/80 hover:bg-parchment/10")
                }
              >
                {s}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={checkinNote}
            onChange={(e) => setCheckinNote(e.target.value)}
            maxLength={140}
            disabled={waiting}
            placeholder="one line, if you want"
            className="mt-3 w-full rounded-xl bg-marble p-3 text-base text-ink outline-none placeholder:text-ink/60 focus:ring-1 focus:ring-patina/50 disabled:opacity-60"
          />
          <div className="mt-4 flex items-center justify-center gap-6">
            <button
              type="button"
              onClick={checkIn}
              disabled={waiting || !checkinState}
              className="rounded-xl bg-cream px-6 py-2.5 text-base tracking-wide text-ink disabled:text-ink/50"
            >
              Check in
            </button>
            <button
              type="button"
              onClick={() => {
                setCheckinOpen(false);
                setCheckinState(null);
                setCheckinNote("");
              }}
              disabled={waiting}
              className="font-mono text-xs text-ash underline decoration-1 underline-offset-4"
            >
              not now
            </button>
          </div>
        </div>
      )}
    </>
  );
}
