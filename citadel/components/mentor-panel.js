"use client";

import { useEffect, useRef, useState } from "react";

// One card at a time where the history box used to sit. Rotates every
// 90 seconds with a slow crossfade — the one sanctioned motion beyond
// animate-settle, and it is barely that. Starts on a day-seeded card so
// the panel doesn't open on the same face every visit.
const ROTATE_MS = 90 * 1000;
const FADE_MS = 700;

export default function MentorPanel({ cards }) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const timer = useRef(null);

  useEffect(() => {
    if (!cards || cards.length < 2) return undefined;
    // Seed by day so consecutive visits start differently.
    setIndex(Math.floor(Date.now() / 86400000) % cards.length);
    timer.current = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex((i) => (i + 1) % cards.length);
        setVisible(true);
      }, FADE_MS);
    }, ROTATE_MS);
    return () => clearInterval(timer.current);
  }, [cards]);

  if (!cards?.length) return null;
  const card = cards[index % cards.length];

  return (
    <div className="flex min-h-[180px] flex-col justify-center">
      <div
        className={
          "mx-auto max-w-[420px] text-center transition-opacity ease-in-out " +
          (visible ? "opacity-100" : "opacity-0")
        }
        style={{ transitionDuration: `${FADE_MS}ms` }}
      >
        <p className="font-mono text-xs tracking-[0.15em] text-ash">
          {card.label}
        </p>
        <p
          className={
            "mt-4 text-lg leading-relaxed " +
            (card.kind === "quote" || card.kind === "question"
              ? "italic text-parchment/90"
              : "text-parchment")
          }
        >
          {card.body}
        </p>
        {card.by && (
          <p className="mt-3 font-mono text-xs text-ash">— {card.by}</p>
        )}
      </div>
    </div>
  );
}
