"use client";

import { useState } from "react";
import { ONBOARDING_QUESTIONS, isCompleteAnswerSet } from "@/lib/onboarding";

export default function OnboardingForm() {
  const [answers, setAnswers] = useState({});
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const ready = isCompleteAnswerSet(answers);

  function choose(questionId, value) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers, preferredName: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Something failed. Try again.");
        return;
      }
      window.location.assign("/");
    } catch {
      setError("Something failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <p className="text-lg leading-relaxed">
        A few questions first, so the mentor knows how to speak to you. There
        are no right answers. It takes about a minute.
      </p>

      <ol className="mt-12">
        {ONBOARDING_QUESTIONS.map((q, i) => (
          <li
            key={q.id}
            className={i === 0 ? undefined : "mt-12 border-t border-ash/30 pt-12"}
          >
            <p className="font-mono text-xs text-ash">{`0${i + 1}`.slice(-2)}</p>
            <p className="mt-3 text-lg leading-relaxed">{q.prompt}</p>
            <div className="mt-5 flex flex-col gap-3">
              {q.options.map((o) => {
                const selected = answers[q.id] === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => choose(q.id, o.value)}
                    className={
                      "border-l px-5 py-3 text-left text-lg leading-relaxed transition-colors " +
                      (selected
                        ? "border-patina bg-marble text-ink"
                        : "border-ash/30 text-ink/80 hover:bg-marble/60")
                    }
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          </li>
        ))}

        <li className="mt-12 border-t border-ash/30 pt-12">
          <p className="font-mono text-xs text-ash">08</p>
          <label htmlFor="name" className="mt-3 block text-lg leading-relaxed">
            What should I call you?
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            disabled={busy}
            className="mt-5 w-full bg-marble p-5 text-lg text-ink outline-none placeholder:text-ash focus:ring-1 focus:ring-patina/50 disabled:opacity-60"
            placeholder="a name, or leave it blank"
          />
        </li>
      </ol>

      {error && <p className="mt-8 text-sm text-ash">{error}</p>}

      <button
        type="submit"
        disabled={!ready || busy}
        className="mt-10 font-mono text-sm tracking-wide text-patina underline decoration-1 underline-offset-4 disabled:no-underline disabled:opacity-50"
      >
        Begin
      </button>
    </form>
  );
}
