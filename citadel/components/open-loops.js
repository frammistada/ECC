"use client";

import { useState } from "react";
import { LocalDay } from "@/components/local-date";

// The open threads the mentor is holding onto, shown in settings. Each can
// be dismissed ("let it go") — v1 resolution is manual; the mentor never
// closes one itself.
export default function OpenLoops({ initialLoops }) {
  const [loops, setLoops] = useState(initialLoops);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);

  async function dismiss(id) {
    if (busyId) return;
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/loops/${id}`, { method: "PATCH" });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Something failed. Try again.");
        return;
      }
      setLoops((prev) => prev.filter((l) => l.id !== id));
    } catch {
      setError("Something failed. Try again.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mt-12 border-t border-parchment/15 pt-12">
      <p className="font-mono text-xs text-ash">
        what the mentor is holding onto
      </p>
      <p className="mt-4 text-sm leading-relaxed text-ash">
        Things you said you would do, or left unresolved, noticed in your
        entries. The mentor may ask about one if you go quiet on it. Settled
        it, or never meant it? Let it go.
      </p>
      {loops.length === 0 ? (
        <p className="mt-6 font-mono text-xs text-ash">nothing open</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {loops.map((l) => (
            <li
              key={l.id}
              className="flex items-start justify-between gap-4 border-l border-ash/30 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-base leading-relaxed">{l.description}</p>
                <p className="mt-1 font-mono text-xs text-ash">
                  <LocalDay iso={l.created_at} />
                </p>
              </div>
              <button
                type="button"
                onClick={() => dismiss(l.id)}
                disabled={busyId !== null}
                className="shrink-0 font-mono text-xs text-ash underline decoration-1 underline-offset-4 disabled:opacity-50"
              >
                let it go
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="mt-4 text-sm text-ash">{error}</p>}
    </div>
  );
}
