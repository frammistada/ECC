// Daily reminder logic, kept pure so the cron's "who is due" decision is
// unit-testable without a database or a clock.
//
// A reminder is a single wall-clock time ("HH:MM") in the user's IANA
// timezone. The cron runs hourly (see vercel.json) and fires a user's
// reminder at the first run at or after their local time, once per local
// day. "At or after" (not "equal to") makes it robust to coarse cron
// granularity: whether the cron ticks at 21:00 or 21:47, a 21:00 reminder
// still goes out that evening, and reminder_last_sent stops a second send.

export const REMINDER_TITLE = "Citadel";
// Plain, in the mentor's register — no hype, no emoji, no exclamation.
export const REMINDER_BODY = "Something tested you today.";

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
  let parts;
  try {
    parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(now);
  } catch {
    // Unknown zone — retry as UTC rather than throw.
    parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(now);
  }
  const get = (t) => parts.find((p) => p.type === t)?.value;
  // en-CA formats the hour after midnight as "24"; normalize to "00".
  const hour = get("hour") === "24" ? "00" : get("hour");
  const date = `${get("year")}-${get("month")}-${get("day")}`;
  const minutes = Number(hour) * 60 + Number(get("minute"));
  return { date, minutes };
}

// Should this user get a reminder on this cron tick? Pure decision over the
// user's stored reminder fields. `now` is injectable for tests.
export function isReminderDue(profile, now = new Date()) {
  if (!profile?.reminder_enabled) return false;
  const due = parseHhmm(profile.reminder_time);
  if (due === null) return false;
  const { date, minutes } = localNow(profile.reminder_timezone, now);
  if (profile.reminder_last_sent === date) return false; // already sent today
  return minutes >= due;
}
