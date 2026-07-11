// The compose-screen panel: one quiet card at a time where the day's
// history used to sit. Built server-side from data already at hand —
// no extra model calls. Only cards with real data are included; the
// client rotates through them slowly.

// Short, public-domain lines from the Stoics.
const QUOTES = [
  { text: "You could leave life right now. Let that determine what you do and say and think.", by: "Marcus Aurelius" },
  { text: "It is not that we have a short time to live, but that we waste a lot of it.", by: "Seneca" },
  { text: "No man is free who is not master of himself.", by: "Epictetus" },
  { text: "The impediment to action advances action. What stands in the way becomes the way.", by: "Marcus Aurelius" },
  { text: "We suffer more often in imagination than in reality.", by: "Seneca" },
  { text: "It's not what happens to you, but how you react to it that matters.", by: "Epictetus" },
  { text: "Waste no more time arguing about what a good man should be. Be one.", by: "Marcus Aurelius" },
  { text: "He who fears death will never do anything worthy of a man who is alive.", by: "Seneca" },
  { text: "First say to yourself what you would be; and then do what you have to do.", by: "Epictetus" },
  { text: "Confine yourself to the present.", by: "Marcus Aurelius" },
  { text: "Difficulties strengthen the mind, as labor does the body.", by: "Seneca" },
  { text: "Man is not worried by real problems so much as by his imagined anxieties about real problems.", by: "Epictetus" },
];

// Evening practices, in the mentor's register — suggestions, not homework.
const PRACTICES = [
  "Tonight, before sleep: what did you do well, what poorly, what was left undone?",
  "Name one thing today that was outside your control. Notice how much of the day it took.",
  "Pick the hardest moment of the day. Retell it to yourself without the word “they.”",
  "What did you avoid today by staying busy?",
  "Say the thing you are putting off out loud, once. Just the words.",
  "Find the smallest promise you kept today. That is the muscle.",
  "If a friend had your day, what would you tell them? Now say it to yourself.",
  "What would today have looked like if you had done it tired anyway?",
];

function utcDay(iso) {
  return String(iso).slice(0, 10);
}

// Streak of consecutive UTC days with any entry, counting back from today
// or yesterday (a streak isn't broken until a full day has passed).
function streakFrom(recentDays, today) {
  const days = new Set(recentDays);
  const start = new Date(`${today}T00:00:00Z`);
  let cursor = days.has(today)
    ? start
    : new Date(start.getTime() - 86400000);
  let run = 0;
  while (days.has(cursor.toISOString().slice(0, 10))) {
    run += 1;
    cursor = new Date(cursor.getTime() - 86400000);
  }
  return run;
}

function nextMilestone(count) {
  if (count < 30) return 30;
  if (count < 90) return 90;
  return (Math.floor(count / 90) + 1) * 90;
}

// Extracts the mentor's last question from its most recent reply.
function lastQuestion(text) {
  if (!text) return null;
  const parts = String(text).match(/[^.!?]+\?/g);
  const q = parts?.[parts.length - 1]?.trim();
  return q && q.length >= 12 ? q : null;
}

// All inputs optional; every card guards its own data. Returns
// [{ kind, label, body, by? }] — 8–12 cards for an active account.
export function buildPanelCards({
  profile,
  reflectionCount = 0,
  totalEntries = 0,
  pageCount = 0,
  recentEntries = [], // [{ created_at, checkin_state }] newest first, ~45 days
  firstEntryAt = null,
  lastResponse = null,
  openLoop = null, // { description } | null
}) {
  const cards = [];
  const today = new Date().toISOString().slice(0, 10);
  const dayIndex = Math.floor(Date.parse(today) / 86400000);

  // 1. A line from the Stoics — changes daily.
  const q = QUOTES[dayIndex % QUOTES.length];
  cards.push({ kind: "quote", label: "from the stoics", body: `“${q.text}”`, by: q.by });

  // 2. An evening practice — offset so it never pairs with the same quote.
  cards.push({
    kind: "practice",
    label: "an evening practice",
    body: PRACTICES[(dayIndex + 3) % PRACTICES.length],
  });

  // 3. What the mentor has noticed — the rolling pattern note, shown to
  // its subject. It is about them; they should get to read it.
  const summary = (profile?.pattern_summary || "").trim();
  if (summary) {
    cards.push({ kind: "pattern", label: "what the mentor has noticed", body: summary });
  }

  // 4. The mentor's standing question — the last one it asked.
  const question = lastQuestion(lastResponse);
  if (question) {
    cards.push({ kind: "question", label: "the mentor's last question", body: question });
  }

  // 5. An open thread.
  if (openLoop?.description) {
    cards.push({ kind: "loop", label: "still open", body: openLoop.description });
  }

  // 6. Cadence — streak, or the honest gap. Bare values; the terseness
  // is the voice.
  const recentDays = recentEntries.map((e) => utcDay(e.created_at));
  const run = streakFrom(recentDays, today);
  if (run >= 2) {
    cards.push({ kind: "cadence", label: "cadence", body: `${run} days in a row` });
  } else if (recentDays.length > 0 && !recentDays.includes(today)) {
    const last = new Date(`${recentDays[0]}T00:00:00Z`);
    const gap = Math.round((Date.parse(`${today}T00:00:00Z`) - last.getTime()) / 86400000);
    if (gap >= 2) {
      cards.push({ kind: "cadence", label: "cadence", body: `${gap} days quiet` });
    }
  }

  // 7. The ledger — how much is here now.
  if (totalEntries > 0) {
    cards.push({
      kind: "ledger",
      label: "the ledger",
      body: `${totalEntries} ${totalEntries === 1 ? "entry" : "entries"} · ${pageCount} ${pageCount === 1 ? "page" : "pages"}`,
    });
  }

  // 8. Day count since the first entry.
  if (firstEntryAt) {
    const days =
      Math.floor(
        (Date.parse(`${today}T00:00:00Z`) -
          Date.parse(`${utcDay(firstEntryAt)}T00:00:00Z`)) /
          86400000,
      ) + 1;
    if (days > 1) {
      cards.push({ kind: "since", label: "the count", body: `day ${days}` });
    }
  }

  // 9. Held / slipped balance from the last 30 days of check-ins.
  const cutoff = Date.parse(`${today}T00:00:00Z`) - 30 * 86400000;
  const held = recentEntries.filter(
    (e) => e.checkin_state === "held" && Date.parse(e.created_at) >= cutoff,
  ).length;
  const slipped = recentEntries.filter(
    (e) => e.checkin_state === "slipped" && Date.parse(e.created_at) >= cutoff,
  ).length;
  if (held + slipped > 0) {
    cards.push({
      kind: "balance",
      label: "this month's check-ins",
      body: `held ${held} · slipped ${slipped}`,
    });
  }

  // 10. Milestone progress.
  const next = nextMilestone(reflectionCount);
  if (reflectionCount > 0) {
    cards.push({
      kind: "milestone",
      label: "milestones",
      body: `${reflectionCount} of ${next} · next look back`,
    });
  }

  // 11. Their own stated aim, handed back.
  const aim = (profile?.aim || "").trim();
  if (aim) {
    cards.push({ kind: "aim", label: "what you said you're after", body: aim });
  }

  return cards;
}
