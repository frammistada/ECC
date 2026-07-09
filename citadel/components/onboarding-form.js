"use client";

import { useState } from "react";
import { ONBOARDING_QUESTIONS, isCompleteAnswerSet } from "@/lib/onboarding";

// One question per screen — kinder on a phone than a long scroll. Tapping an
// option records it and advances; "back" retraces without losing answers.
// The final step asks the preferred name and submits. Scoring and the API
// call are unchanged.
const TOTAL_STEPS = ONBOARDING_QUESTIONS.length + 1; // + the name step

function stepLabel(step) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(step + 1)} / ${pad(TOTAL_STEPS)}`;
}

export default function OnboardingForm() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const ready = isCompleteAnswerSet(answers);
  const onNameStep = step === TOTAL_STEPS - 1;
  const question = onNameStep ? null : ONBOARDING_QUESTIONS[step];
  const answered = question ? answers[question.id] !== undefined : false;

  function choose(questionId, value) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
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
      {step === 0 && (
        <p className="text-lg leading-relaxed">
          A few questions first, so the mentor knows how to speak to you. There
          are no right answers. It takes about a minute.
        </p>
      )}

      <div key={step} className="mt-10 animate-settle">
        <p className="font-mono text-xs text-ash">{stepLabel(step)}</p>

        {question ? (
          <>
            <p className="mt-3 text-lg leading-relaxed">{question.prompt}</p>
            <div className="mt-6 flex flex-col gap-3">
              {question.options.map((o) => {
                const selected = answers[question.id] === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => choose(question.id, o.value)}
                    className={
                      "rounded-r-xl border-l px-5 py-4 text-left text-lg leading-relaxed transition-colors " +
                      (selected
                        ? "border-patina bg-marble text-ink"
                        : "border-ash/30 text-parchment/80 hover:bg-parchment/10")
                    }
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <label
              htmlFor="name"
              className="mt-3 block text-lg leading-relaxed"
            >
              What should I call you?
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              disabled={busy}
              className="mt-5 w-full rounded-xl bg-marble p-5 text-lg text-ink outline-none placeholder:text-ash focus:ring-1 focus:ring-patina/50 disabled:opacity-60"
              placeholder="a name, or leave it blank"
            />
          </>
        )}

        {error && <p className="mt-6 text-sm text-ash">{error}</p>}

        <div className="mt-10 flex items-center gap-7">
          {onNameStep && (
            <button
              type="submit"
              disabled={!ready || busy}
              className="rounded-xl bg-cream px-8 py-3 text-lg tracking-wide text-ink disabled:text-ink/50"
            >
              Begin
            </button>
          )}
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="font-mono text-xs text-ash underline decoration-1 underline-offset-4"
            >
              back
            </button>
          )}
          {!onNameStep && answered && (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              className="font-mono text-xs text-ash underline decoration-1 underline-offset-4"
            >
              keep this answer
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
