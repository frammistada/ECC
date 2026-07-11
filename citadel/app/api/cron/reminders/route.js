import { createAdminClient } from "@/lib/supabase/admin";
import { sendPush, isPushConfigured } from "@/lib/push";
import {
  isReminderDue,
  isGoalReminderDue,
  quoteReminderStatus,
  localNow,
  reflectionPayload,
  goalPayload,
  quotePayload,
  pickQuote,
} from "@/lib/reminders";

// Cron endpoint (see vercel.json — runs hourly). For every user, checks all
// three reminder types (reflection, goal, quote) and sends whichever are due
// this tick, stamping each type's guard so later ticks don't repeat it.
//
// Reads across all users, so it uses the service-role client (bypasses RLS).
// Protected by CRON_SECRET: Vercel Cron sends it as a Bearer token, and we
// refuse anything else so the endpoint can't be triggered by the public.
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

  // Any user with at least one reminder type enabled.
  const { data: profiles, error } = await admin
    .from("profiles")
    .select(
      "id, aim, reminder_timezone, " +
        "reminder_enabled, reminder_time, reminder_last_sent, " +
        "goal_reminder_enabled, goal_reminder_time, goal_reminder_last_sent, " +
        "quote_reminder_enabled, quote_reminder_count, quote_reminder_last_sent, quote_reminder_slots_sent",
    )
    .or(
      "reminder_enabled.eq.true,goal_reminder_enabled.eq.true,quote_reminder_enabled.eq.true",
    );

  if (error) {
    console.error("[cron/reminders] profiles query failed", error);
    return Response.json({ error: "Query failed." }, { status: 500 });
  }

  let pushesSent = 0;
  let pruned = 0;
  const fired = { reflection: 0, goal: 0, quote: 0 };

  for (const profile of profiles ?? []) {
    const { date } = localNow(profile.reminder_timezone, now);

    // Decide what this user is due for, and the guard stamp each send earns.
    const toSend = []; // { payload, stamp }
    if (isReminderDue(profile, now)) {
      toSend.push({
        payload: reflectionPayload(),
        stamp: { reminder_last_sent: date },
        kind: "reflection",
      });
    }
    if (isGoalReminderDue(profile, now)) {
      const aim = (profile.aim || "").trim();
      // Nothing to remind of without a stated goal — skip without stamping,
      // so it can still fire later today if they add one.
      if (aim) {
        toSend.push({
          payload: goalPayload(aim),
          stamp: { goal_reminder_last_sent: date },
          kind: "goal",
        });
      }
    }
    const quoteStatus = quoteReminderStatus(profile, now);
    if (quoteStatus.due) {
      // The latest elapsed slot decides which line shows; snap slots_sent
      // forward to `elapsed` so missed slots are skipped, not replayed.
      const quote = pickQuote(date, quoteStatus.elapsed - 1);
      toSend.push({
        payload: quotePayload(quote),
        stamp: {
          quote_reminder_last_sent: date,
          quote_reminder_slots_sent: quoteStatus.elapsed,
        },
        kind: "quote",
      });
    }

    if (toSend.length === 0) continue;

    const { data: subs } = await admin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", profile.id);
    if (!subs || subs.length === 0) continue;

    const dead = new Set();
    for (const item of toSend) {
      for (const sub of subs) {
        const res = await sendPush(sub, item.payload);
        if (res.ok) pushesSent += 1;
        else if (res.gone) dead.add(sub.id);
      }
      fired[item.kind] += 1;
    }
    if (dead.size) {
      await admin.from("push_subscriptions").delete().in("id", [...dead]);
      pruned += dead.size;
    }

    // Apply every earned guard stamp in one update. Stamped even if all
    // endpoints were dead, so an expired-subscription user isn't retried
    // every hour.
    const stamp = Object.assign({}, ...toSend.map((t) => t.stamp));
    await admin.from("profiles").update(stamp).eq("id", profile.id);
  }

  return Response.json({
    ok: true,
    candidates: profiles?.length ?? 0,
    fired,
    pushesSent,
    pruned,
  });
}
