"use client";

import { useEffect, useRef, useState } from "react";
import { FREE_ENTRY_LIMIT } from "@/lib/limits";
import { composeMissedDayMessage } from "@/lib/accountability";
import { LocalStamp } from "@/components/local-date";

// Two views. "compose": the quiet start screen — a rotating panel card
// where history used to sit, and the entry box below. "chat": the moment
// something is sent, the screen becomes the conversation — the user's
// words in marble bubbles on the right, the mentor's replies still as
// marginalia on the left (italic, patina rule — never a bubble; that
// rule survives the chat layout). Only the message region scrolls.

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
  panel = null,
  startInChat = false,
  noMentorRoom = false,
}) {
  const [view, setView] = useState(
    startInChat && initialExchanges.length > 0 ? "chat" : "compose",
  );
  const [draft, setDraft] = useState("");
  const [slipped, setSlipped] = useState(false);
  // No-mentor journaling (paid) is its own room (/journal), reached from
  // the drawer — never a toggle on the mentor's composer, which is always
  // mentor-on. In that room this whole component runs in no-mentor mode:
  // every entry is saved without a Claude call and shows no reply.
  const noMentor = noMentorRoom;
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

  // Keep the conversation pinned to its latest turn.
  const scrollRef = useRef(null);
  useEffect(() => {
    if (view === "chat" && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [view, exchanges, waiting, note]);

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

  // Shared failure path: drop the optimistic turn, restore the draft, and
  // fall back to compose if the conversation is now empty.
  function failPending(restoreDraft, message, isPaywall) {
    setExchanges((prev) => {
      const next = prev.filter((x) => !x.pending);
      if (next.length === 0) setView("compose");
      return next;
    });
    if (restoreDraft !== null) setDraft(restoreDraft);
    if (isPaywall) setPaywalled(true);
    else setError(message || "Something failed. Try again.");
  }

  async function reflect(event) {
    event.preventDefault();
    const entry = draft.trim();
    if (!entry || waiting) return;

    setWaiting(true);
    setError(null);
    setNote(null);
    setNoteState(null);
    // The moment it's sent, the screen becomes the conversation.
    setExchanges((prev) => [
      ...prev,
      {
        entry,
        response: "",
        at: new Date().toISOString(),
        pending: true,
        noMentor,
      },
    ]);
    setView("chat");
    setDraft("");

    try {
      const res = await fetch("/api/reflect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entry, slipped, meditationId, noMentor }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        failPending(entry, data.error, Boolean(data.paywall));
        return;
      }

      setExchanges((prev) =>
        prev.map((x) =>
          x.pending
            ? { ...x, response: data.response ?? "", pending: false }
            : x,
        ),
      );
      setEntryCount(data.entryCount);
      setSlipped(false);
      if (data.draft) setNote(data.draft);
      if (!subscribed && data.entryCount >= FREE_ENTRY_LIMIT) {
        setPaywalled(true);
      }
    } catch {
      failPending(entry, "The mentor could not be reached.", false);
    } finally {
      setWaiting(false);
    }
  }

  async function checkIn() {
    if (waiting || !checkinState) return;
    const state = checkinState;
    const line = checkinNote.trim();
    setWaiting(true);
    setError(null);
    setNote(null);
    setNoteState(null);
    setExchanges((prev) => [
      ...prev,
      {
        entry: line ? `${state} — ${line}` : `${state}.`,
        response: "",
        at: new Date().toISOString(),
        pending: true,
      },
    ]);
    setView("chat");
    setCheckinOpen(false);

    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state, note: line, meditationId }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        failPending(null, data.error, false);
        setCheckinOpen(true);
        return;
      }
      setExchanges((prev) =>
        prev.map((x) =>
          x.pending
            ? { ...x, entry: data.content, response: data.response, pending: false }
            : x,
        ),
      );
      setCheckinState(null);
      setCheckinNote("");
      if (data.draft) setNote(data.draft);
    } catch {
      failPending(null, "The mentor could not be reached.", false);
      setCheckinOpen(true);
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

  const paywall = (
    <section className="mt-6 border-t border-ash/30 pt-6">
      <p className="text-lg leading-relaxed">
        Continuing past your first five reflections requires a subscription.
      </p>
      <button
        type="button"
        onClick={subscribe}
        disabled={openingCheckout}
        className="mt-4 font-mono text-sm tracking-wide text-ember underline decoration-1 underline-offset-4 disabled:opacity-50"
      >
        Subscribe
      </button>
      {error && <p className="mt-4 text-sm text-ash">{error}</p>}
    </section>
  );

  const noteCard = note && (
    <section className="mt-10 animate-settle rounded-2xl bg-marble p-6 text-ink">
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
  );

  // ---------- chat view ----------
  if (view === "chat") {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div ref={scrollRef} className="mt-4 min-h-0 flex-1 overflow-y-auto">
          <ol className="flex flex-col gap-8 pb-2">
            {exchanges.map((x, i) => (
              <li key={i} className="flex flex-col gap-6">
                <div className="flex flex-col items-end">
                  <p className="font-mono text-[10px] text-ash">
                    <LocalStamp iso={x.at} />
                    {x.noMentor ? " · no mentor" : ""}
                  </p>
                  <div className="mt-1.5 max-w-[85%] rounded-2xl rounded-br-sm bg-marble px-4 py-3">
                    <p className="whitespace-pre-wrap text-base leading-relaxed text-ink">
                      {x.entry}
                    </p>
                  </div>
                </div>
                {x.response ? (
                  <blockquote className="max-w-[88%] animate-settle border-l border-patina pl-4 text-base italic leading-relaxed text-parchment/90">
                    {x.response}
                  </blockquote>
                ) : x.pending ? (
                  <p className="font-mono text-xs text-ash">
                    {x.noMentor ? "saving" : "the mentor is reading"}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
          {noteCard}
        </div>

        {paywalled ? (
          paywall
        ) : (
          <form
            onSubmit={reflect}
            className="mt-4 border-t border-parchment/15 pt-4"
          >
            <div className="flex items-end gap-3">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={2}
                maxLength={5000}
                disabled={waiting}
                aria-label={noMentorRoom ? "your journal" : "what tested you today"}
                className="min-w-0 flex-1 resize-none rounded-xl bg-marble p-3 text-base leading-relaxed text-ink outline-none placeholder:text-ink/60 focus:ring-1 focus:ring-patina/50 disabled:opacity-60"
                placeholder={
                  noMentorRoom
                    ? "Whatever you want to set down."
                    : "Where did you slip, or hold firm."
                }
              />
              <button
                type="submit"
                disabled={waiting || !draft.trim()}
                className="shrink-0 rounded-xl bg-cream px-5 py-3 text-base tracking-wide text-ink disabled:text-ink/50"
              >
                {noMentor ? "Save" : "Reflect"}
              </button>
            </div>
            <div className="mt-3 flex items-center justify-between gap-4">
              {hasAccountabilityContact ? (
                <label className="flex cursor-pointer items-center gap-2 font-mono text-[10px] text-ash">
                  <input
                    type="checkbox"
                    checked={slipped}
                    onChange={(e) => setSlipped(e.target.checked)}
                    disabled={waiting}
                    className="accent-patina"
                  />
                  I fell short today
                </label>
              ) : (
                <span />
              )}
              {!subscribed && (
                <p className="whitespace-nowrap font-mono text-[10px] text-ash">
                  {entryCount} of {FREE_ENTRY_LIMIT} free
                </p>
              )}
            </div>
            {error && <p className="mt-2 text-sm text-ash">{error}</p>}
          </form>
        )}
      </div>
    );
  }

  // ---------- compose view ----------
  return (
    <>
      {/* The panel region is fixed — it never scrolls. When the missed-day
          note is up, it takes the card's place rather than stacking. */}
      <div className="flex min-h-0 flex-1 flex-col justify-center overflow-hidden">
        {checkoutSuccess && !subscribed && (
          <p className="text-center font-mono text-xs text-ash">
            subscription received — it may take a moment to register
          </p>
        )}

        {missedVisible ? (
          <section className="animate-settle rounded-2xl bg-marble p-5 text-ink">
            <p className="font-mono text-xs text-ink/60">
              yesterday passed with nothing written
            </p>
            <p className="mt-3 whitespace-pre-wrap text-base leading-relaxed text-ink/90">
              {composeMissedDayMessage(preferredName)}
            </p>
            <div className="mt-4 flex items-baseline gap-6">
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
        ) : (
          (panel ??
            (exchanges.length === 0 && (
              <p className="text-center text-lg leading-relaxed">
                {noMentorRoom
                  ? "Your journal. Write freely — nothing here answers back."
                  : "Nothing written here yet."}
              </p>
            ))) || null
        )}
        {missedState === "sent" && !missedVisible && (
          <p className="text-center font-mono text-xs text-ash">sent</p>
        )}

        {exchanges.length > 0 && (
          <div className="mt-2 flex justify-center">
            <button
              type="button"
              onClick={() => setView("chat")}
              className="font-mono text-xs text-ash underline decoration-1 underline-offset-4"
            >
              {noMentorRoom
                ? "read your journal"
                : meditationId
                  ? "read this page's conversation"
                  : "read today's conversation"}
            </button>
          </div>
        )}
      </div>

      {/* The lower region swaps between three states — check-in controls,
          the paywall, or the entry form — so it always fits the fixed,
          non-scrolling screen. The check-in stays reachable even when the
          reflection paywall is up: a bad day never costs the habit. */}
      {checkinOpen ? (
        <div className="mt-6 animate-settle border-t border-parchment/15 pt-6">
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
          {error && <p className="mt-3 text-center text-sm text-ash">{error}</p>}
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
      ) : (
        <>
          {paywalled ? (
            paywall
          ) : (
            <form
              onSubmit={reflect}
              className="mt-4 border-t border-parchment/15 pt-5"
            >
              <label
                htmlFor="entry"
                className="block text-center font-mono text-xs tracking-[0.08em] text-ash"
              >
                {noMentorRoom ? "your journal" : "what tested you today"}
              </label>
              <textarea
                id="entry"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={3}
                maxLength={5000}
                disabled={waiting}
                className="mt-3 w-full resize-y rounded-xl bg-marble p-4 text-lg leading-relaxed text-ink outline-none placeholder:text-ink/70 focus:ring-1 focus:ring-patina/50 disabled:opacity-60"
                placeholder={
                  noMentorRoom
                    ? "Whatever you want to set down."
                    : "Where did you slip, or hold firm."
                }
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

              {error && <p className="mt-3 text-sm text-ash">{error}</p>}
              <div
                className={
                  "mt-4 flex items-center gap-4 " +
                  (subscribed ? "justify-center" : "justify-between")
                }
              >
                <button
                  type="submit"
                  disabled={waiting || !draft.trim()}
                  className="rounded-xl bg-cream px-6 py-3 text-lg tracking-wide text-ink disabled:text-ink/50"
                >
                  {noMentor ? "Save" : "Reflect"}
                </button>
                {!subscribed && (
                  <p className="whitespace-nowrap text-right font-mono text-[10px] text-ash sm:text-xs">
                    {entryCount} of {FREE_ENTRY_LIMIT} free reflections used
                  </p>
                )}
              </div>
            </form>
          )}
          {!noMentorRoom && (
            <button
              type="button"
              onClick={() => {
                setCheckinOpen(true);
                setError(null);
              }}
              disabled={waiting}
              className="mx-auto mt-3 block rounded-xl border border-parchment/20 px-5 py-2 font-mono text-xs text-ash transition-colors hover:bg-parchment/10 disabled:opacity-50"
            >
              no entry in you today? just check in
            </button>
          )}
        </>
      )}
    </>
  );
}
