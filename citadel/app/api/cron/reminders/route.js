import { createAdminClient } from "@/lib/supabase/admin";
import { sendPush, isPushConfigured } from "@/lib/push";
import {
  isReminderDue,
  localNow,
  REMINDER_TITLE,
  REMINDER_BODY,
} from "@/lib/reminders";

// Cron endpoint (see vercel.json — runs hourly). For every user whose
// reminder is due (their local wall-clock has reached reminder_time and
// none has gone out yet today), send a push to each registered device and
// stamp reminder_last_sent so the next hourly ticks don't repeat it.
//
// Reads across all users, so it must use the service-role client (bypasses
// RLS). It is protected by CRON_SECRET: Vercel Cron sends it as a Bearer
// token, and we refuse anything else so the endpoint can't be triggered by
// the public.
export const dynamic = "force-dynamic";

function authorized(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // fail closed if the secret isn't configured
  const header = request.headers.get("authorization") || "";
  return header === `Bearer ${secret}`;
}

export async function GET(request) {
  if (!authorized(request)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!isPushConfigured()) {
    return Response.json({ error: "Push not configured." }, { status: 503 });
  }

  const admin = createAdminClient();
  const now = new Date();

  // Only enabled reminders with a time set are candidates.
  const { data: profiles, error } = await admin
    .from("profiles")
    .select("id, reminder_enabled, reminder_time, reminder_timezone, reminder_last_sent")
    .eq("reminder_enabled", true)
    .not("reminder_time", "is", null);

  if (error) {
    console.error("[cron/reminders] profiles query failed", error);
    return Response.json({ error: "Query failed." }, { status: 500 });
  }

  const due = (profiles ?? []).filter((p) => isReminderDue(p, now));
  const payload = { title: REMINDER_TITLE, body: REMINDER_BODY, url: "/" };

  let usersNotified = 0;
  let pushesSent = 0;
  let pruned = 0;

  for (const profile of due) {
    const { data: subs } = await admin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", profile.id);
    if (!subs || subs.length === 0) continue;

    let anySent = false;
    const dead = [];
    for (const sub of subs) {
      const res = await sendPush(sub, payload);
      if (res.ok) {
        anySent = true;
        pushesSent += 1;
      } else if (res.gone) {
        dead.push(sub.id);
      }
    }
    if (dead.length) {
      await admin.from("push_subscriptions").delete().in("id", dead);
      pruned += dead.length;
    }

    // Stamp today's local date even if every endpoint was dead — otherwise
    // a user whose subscriptions all expired would be retried every hour.
    // Same helper (and same UTC fallback) the due-check used.
    const localDate = localNow(profile.reminder_timezone, now).date;
    await admin
      .from("profiles")
      .update({ reminder_last_sent: localDate })
      .eq("id", profile.id);
    if (anySent) usersNotified += 1;
  }

  return Response.json({
    ok: true,
    candidates: profiles?.length ?? 0,
    due: due.length,
    usersNotified,
    pushesSent,
    pruned,
  });
}
