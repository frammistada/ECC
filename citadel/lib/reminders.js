// Reminder logic for all three types (reflection, goal, quote), kept pure
// so the cron's "who is due" decisions are unit-testable without a database
// or a clock.
//
// A time reminder (reflection, goal) is a single wall-clock time ("HH:MM")
// in the user's IANA timezone. The cron runs hourly (see vercel.json) and
// fires at the first run at or after the local time, once per local day.
// "At or after" (not "equal to") is robust to coarse cron granularity, and
// the per-type *_last_sent date stops a second send.
//
// The quote reminder fires N times a day (default 1, max 6), evenly spaced
// across 24h from a fixed 08:00 local base. Each cron tick sends at most one
// quote — the slot counter snaps forward so missed slots are skipped, never
// replayed in a burst.

export const REMINDER_TITLE = "Citadel";
// Plain, in the mentor's register — no hype, no emoji, no exclamation.
export const REFLECTION_BODY = "Something tested you today.";

// Quote reminder bounds. Max 6 (every 4h): more reads as spam, and even
// distribution over a full day already pushes higher counts overnight.
export const MAX_QUOTE_COUNT = 6;
// Quotes start from a fixed 08:00 local base — independent of whether the
// reflection reminder is enabled (its time may be unset), so the two
// features never couple.
export const QUOTE_BASE_MINUTES = 8 * 60;

// A small curated bank in the mentor's voice: restrained, Stoic-adjacent,
// no exclamation points, and — per the mentor voice rules — no philosopher
// names or direct citations. These are original lines, not attributed
// quotes (unlike the compose-screen panel, which does attribute). Static
// config, not a table: no per-user state, versioned with the code, and read
// by the scheduled job with zero database round-trips.
export const QUOTE_BANK = [
  "The obstacle in front of you is the work, not the interruption of it.",
  "You control the effort, never the outcome. Spend yourself on the part that is yours.",
  "What you avoid today waits for you tomorrow, larger.",
  "Comfort is not the same as rest.",
  "You are not owed the result. You are only asked to act well.",
  "The day is short. Do not rent it out to other people's opinion of you.",
  "Discomfort is often the price of the thing you actually want.",
  "You have less time than you think, and more choice than you admit.",
  "Do the difficult thing while it is still small.",
  "No one is coming to make you do it. That is the whole of it.",
  "You can begin again this hour. You do not have to wait for tomorrow.",
  "Anger at what you cannot change is a tax you choose to pay.",
  "Be harder to offend and easier to move.",
  "Who you are becoming is decided by what you do when it is dull.",
  "You will not always feel ready. Readiness was never required.",
  "Say less about it. Do more of it.",
  "What you practice in private, you become in public.",
  "Let the result be indifferent. Let the effort be exact.",
];

// "HH:MM" -> minutes since local midnight, or null if malformed.
export function parseHhmm(value) {
  if (typeof value !== "string") return null;
  const m = value.match(/^(\d{2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

// The user's local date ("YYYY-MM-DD") and minutes-since-midnight right
// now, computed for an IANA timezone. Falls back to UTC for a missing or
// unrecognized zone so a reminder still fires rather than silently never
// firing. `now` is injectable for tests.
export function localNow(timezone, now = new Date()) {
  const tz = timezone || "UTC";
  const fmt = (zone) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(now);
  let parts;
  try {
    parts = fmt(tz);
  } catch {
    parts = fmt("UTC"); // unknown zone — retry as UTC rather than throw
  }
  const get = (t) => parts.find((p) => p.type === t)?.value;
  // en-CA formats the hour after midnight as "24"; normalize to "00".
  const hour = get("hour") === "24" ? "00" : get("hour");
  const date = `${get("year")}-${get("month")}-${get("day")}`;
  const minutes = Number(hour) * 60 + Number(get("minute"));
  return { date, minutes };
}

// Generic "is a single-time reminder due now?" over one type's fields.
function timeDue({ enabled, time, lastSent, timezone }, now) {
  if (!enabled) return false;
  const due = parseHhmm(time);
  if (due === null) return false;
  const { date, minutes } = localNow(timezone, now);
  if (lastSent === date) return false; // already sent today
  return minutes >= due;
}

// Reflection reminder due-check.
export function isReminderDue(profile, now = new Date()) {
  return timeDue(
    {
      enabled: profile?.reminder_enabled,
      time: profile?.reminder_time,
      lastSent: profile?.reminder_last_sent,
      timezone: profile?.reminder_timezone,
    },
    now,
  );
}

// Goal reminder due-check (shares reminder_timezone).
export function isGoalReminderDue(profile, now = new Date()) {
  return timeDue(
    {
      enabled: profile?.goal_reminder_enabled,
      time: profile?.goal_reminder_time,
      lastSent: profile?.goal_reminder_last_sent,
      timezone: profile?.reminder_timezone,
    },
    now,
  );
}

// Clamp a requested quote count to [1, MAX_QUOTE_COUNT].
export function clampQuoteCount(count) {
  const n = Number.isInteger(count) ? count : parseInt(count, 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, MAX_QUOTE_COUNT);
}

// The times-of-day (minutes since local midnight) a quote fires, given a
// count and base. Evenly spaced by 24h/count and wrapped into a single day,
// sorted ascending. e.g. count 3, base 08:00 -> [0, 480, 960] (00:00, 08:00,
// 16:00) — 8h apart.
export function quoteSlots(count, baseMinutes = QUOTE_BASE_MINUTES) {
  const n = clampQuoteCount(count);
  const step = 1440 / n;
  const slots = [];
  for (let k = 0; k < n; k++) {
    slots.push(Math.round((baseMinutes + k * step)) % 1440);
  }
  return slots.sort((a, b) => a - b);
}

// How many of today's quote slots have elapsed by `nowMinutes` (0..count).
export function quoteSlotsElapsed(
  count,
  nowMinutes,
  baseMinutes = QUOTE_BASE_MINUTES,
) {
  return quoteSlots(count, baseMinutes).filter((s) => nowMinutes >= s).length;
}

// Quote reminder due-check. Returns { due, elapsed, date } — `elapsed` is
// how many slots should have fired by now today; the cron sends one quote
// when the stored slots_sent is behind `elapsed`, then snaps it forward.
export function quoteReminderStatus(profile, now = new Date()) {
  const { date, minutes } = localNow(profile?.reminder_timezone, now);
  if (!profile?.quote_reminder_enabled) return { due: false, elapsed: 0, date };
  const count = clampQuoteCount(profile.quote_reminder_count);
  const sentSlots =
    profile.quote_reminder_last_sent === date
      ? profile.quote_reminder_slots_sent || 0
      : 0;
  const elapsed = quoteSlotsElapsed(count, minutes);
  return { due: sentSlots < elapsed, elapsed, date };
}

// Deterministic quote pick for a given local date + slot index, so the same
// slot always shows the same line (testable) while varying day to day.
export function pickQuote(date, slotIndex = 0) {
  const ordinal = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86400000);
  const idx = (((ordinal + slotIndex) % QUOTE_BANK.length) + QUOTE_BANK.length) %
    QUOTE_BANK.length;
  return QUOTE_BANK[idx];
}

// Notification payloads. Distinct `tag` per type so several can coexist —
// the service worker collapses only same-tag notifications. All open the
// main entry screen on tap.
export function reflectionPayload() {
  return { title: REMINDER_TITLE, body: REFLECTION_BODY, url: "/", tag: "citadel-reflection" };
}
export function goalPayload(aim) {
  return { title: REMINDER_TITLE, body: aim, url: "/", tag: "citadel-goal" };
}
export function quotePayload(quote) {
  return { title: REMINDER_TITLE, body: quote, url: "/", tag: "citadel-quote" };
}
