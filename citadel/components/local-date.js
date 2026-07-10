"use client";

import { useEffect, useState } from "react";
import { dateLine, dayLine, shortDateLine, timeLine } from "@/lib/format";

// Dates rendered in the viewer's own timezone. Server components render with
// the deployment's clock (UTC on Vercel), which near midnight is a different
// calendar day than the user's evening — so these mount blank and fill in on
// the client, where Date uses the device clock. The non-breaking space
// placeholder keeps the line's height while empty.

export function LocalDate({ variant = "long" }) {
  const [text, setText] = useState("");
  useEffect(() => {
    const now = new Date();
    setText(variant === "short" ? shortDateLine(now) : dateLine(now));
  }, [variant]);
  return <>{text || " "}</>;
}

export function LocalDay({ iso }) {
  const [text, setText] = useState("");
  useEffect(() => {
    setText(dayLine(new Date(iso)));
  }, [iso]);
  return <>{text || "\u00A0"}</>;
}

export function LocalStamp({ iso, withDate = false }) {
  const [text, setText] = useState("");
  useEffect(() => {
    const d = new Date(iso);
    setText(withDate ? `${dateLine(d)} — ${timeLine(d)}` : timeLine(d));
  }, [iso, withDate]);
  return <>{text || " "}</>;
}
