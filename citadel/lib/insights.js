import Anthropic from "@anthropic-ai/sdk";
import { dayLine } from "@/lib/format";

// "To Myself": once a week, a short user-facing note on the week that
// just closed — distinct from the mentor's rolling pattern_summary.
// Weeks are calendar-aligned, Monday-start, UTC: bounded periods that
// don't drift with account age, and a natural uniqueness key.
//
// Generation is lazy: when the user opens /to-myself and the last
// completed week has no note yet, it is written then (at most one model
// call per visit, at most one note per week, race-safe on the unique
// key). A week with fewer than MIN_ITEMS entries+check-ins is skipped —
// no awkward note built from almost nothing.
export const MIN_ITEMS_FOR_INSIGHT = 3;

// The note is user-facing prose in the product's voice, so it uses the
// mentor's model — it runs at most once a week per user.
const INSIGHT_MODEL = "claude-opus-4-8";

// Monday 00:00 UTC of the week containing `date`, as YYYY-MM-DD.
export function weekStartOf(date) {
  const d = new Date(date);
  const day = d.getUTCDay(); // 0 Sun .. 6 Sat
  const back = (day + 6) % 7; // days since Monday
  const monday = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - back),
  );
  return monday.toISOString().slice(0, 10);
}

export function weekLabel(weekStart) {
  const start = new Date(`${weekStart}T00:00:00Z`);
  const end = new Date(start.getTime() + 6 * 86400000);
  return `${dayLine(start)} – ${dayLine(end)}`;
}

// The voice rules here restate the mentor prompt's — this note must not
// drift into a different, chattier register.
const WEEKLY_INSIGHT_SYSTEM = `You write the weekly note in Citadel, a
private journaling app grounded in Stoic philosophy. Once a week the app
shows the person a short reflection on the week that just ended, drawn
from what they wrote. The section is called "To Myself" — the note should
read like something a clear-eyed version of themselves might have written.

Voice — these rules are the product; do not drift from them:
- Calm, unhurried, spare. Short sentences. No exclamation points, ever.
- Second person, plain and direct.
- Never praise. No "good job," no "great progress," no cheering. Warmth
  is shown through attention and precision, not encouragement.
- No advice they didn't already give themselves. No clinical language.

What to write:
- 3 to 5 sentences. A note, not a report.
- Name what showed up repeatedly this week — a theme, a habit, a word
  they kept reaching for. Only patterns actually present in the material;
  never invent one to have something to say.
- If the background note or the previous week's note shows a shift, name
  the shift plainly. If there is no clear shift, don't manufacture one.
- If the week was mostly one-tap check-ins with little writing, say less.
  Two sentences that hold are better than five that guess.
- End on the observation. No summary, no moral, no motivational close.

Output only the note. No headers, no preamble.`;

// All inputs are plain data; returns the note text, or null on any
// failure — the caller simply tries again on a later visit.
export async function generateWeeklyInsight({
  weekStart,
  entries = [], // [{ content, created_at }] full reflections, oldest first
  checkins = [], // [{ checkin_state, content, created_at }]
  patternSummary = null,
  priorInsight = null, // last week's note, if any
  loopsOpened = [], // descriptions opened this week
  loopsResolved = [], // descriptions resolved this week
}) {
  if (process.env.CITADEL_MOCK_MENTOR === "1") return null;

  const lines = [`Week: ${weekLabel(weekStart)}`];

  if (entries.length) {
    lines.push("", "Entries this week:");
    for (const e of entries) {
      lines.push(`- [${String(e.created_at).slice(0, 10)}] ${e.content}`);
    }
  }
  if (checkins.length) {
    lines.push("", "Check-ins this week (one-tap, minimal writing):");
    for (const c of checkins) {
      lines.push(`- [${String(c.created_at).slice(0, 10)}] ${c.content}`);
    }
  }
  if (!entries.length && checkins.length) {
    lines.push(
      "",
      "Note: this week was check-ins only — no full entries. Keep the note short and don't force depth.",
    );
  }
  if (loopsOpened.length) {
    lines.push("", "Left open this week:");
    for (const d of loopsOpened) lines.push(`- ${d}`);
  }
  if (loopsResolved.length) {
    lines.push("", "Settled this week:");
    for (const d of loopsResolved) lines.push(`- ${d}`);
  }
  const summary = (patternSummary || "").trim();
  if (summary) {
    lines.push("", "Background (the mentor's running note on them):", summary);
  }
  const prior = (priorInsight || "").trim();
  if (prior) {
    lines.push("", "Previous week's note:", prior);
  }

  const client = new Anthropic();
  try {
    const result = await client.messages.create({
      model: INSIGHT_MODEL,
      max_tokens: 400,
      system: WEEKLY_INSIGHT_SYSTEM,
      messages: [{ role: "user", content: lines.join("\n") }],
    });
    if (result.stop_reason === "refusal") return null;
    const text = result.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    return text || null;
  } catch {
    return null;
  }
}
