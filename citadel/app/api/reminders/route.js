import { createClient } from "@/lib/supabase/server";
import { isSubscribed } from "@/lib/limits";
import { parseHhmm, clampQuoteCount } from "@/lib/reminders";

// Save all three reminder types in one snapshot and, when any is enabled,
// register this browser's push subscription. The client always posts the
// full desired state:
//   { timezone, subscription, reflection:{enabled,time}, goal:{enabled,time},
//     quote:{enabled,count} }
// Paid only — enabling anything requires an active subscription (the client
// hides the room from free users; this is the server guard). Disabling is
// always allowed.
export async function POST(request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "You are signed out." }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const reflection = body?.reflection || {};
  const goal = body?.goal || {};
  const quote = body?.quote || {};
  const reflectionOn = reflection.enabled === true;
  const goalOn = goal.enabled === true;
  const quoteOn = quote.enabled === true;
  const anyOn = reflectionOn || goalOn || quoteOn;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (anyOn && !isSubscribed(profile)) {
    return Response.json(
      { error: "Reminders require a subscription." },
      { status: 403 },
    );
  }

  const update = {
    reminder_enabled: reflectionOn,
    goal_reminder_enabled: goalOn,
    quote_reminder_enabled: quoteOn,
  };

  // Validate + set each enabled type, resetting its one-per-day guard so a
  // same-day enable/change can still fire today. Disabled types keep their
  // stored time/count so re-enabling remembers the last choice.
  if (reflectionOn) {
    if (parseHhmm(reflection.time) === null) {
      return Response.json(
        { error: "That reflection time doesn't look right." },
        { status: 400 },
      );
    }
    update.reminder_time = reflection.time;
    update.reminder_last_sent = null;
  }
  if (goalOn) {
    if (parseHhmm(goal.time) === null) {
      return Response.json(
        { error: "That goal-reminder time doesn't look right." },
        { status: 400 },
      );
    }
    update.goal_reminder_time = goal.time;
    update.goal_reminder_last_sent = null;
  }
  if (quoteOn) {
    update.quote_reminder_count = clampQuoteCount(quote.count);
    update.quote_reminder_last_sent = null;
    update.quote_reminder_slots_sent = 0;
  }

  if (anyOn) {
    // IANA zone from the browser; "UTC" fallback keeps a reminder firing.
    update.reminder_timezone =
      typeof body?.timezone === "string" && body.timezone.trim()
        ? body.timezone.trim().slice(0, 64)
        : "UTC";

    // Store this device's push subscription. Upsert on the unique endpoint
    // so re-enabling on the same device doesn't duplicate rows.
    const sub = body?.subscription;
    if (
      !sub ||
      typeof sub.endpoint !== "string" ||
      !sub.keys ||
      typeof sub.keys.p256dh !== "string" ||
      typeof sub.keys.auth !== "string"
    ) {
      return Response.json(
        { error: "The browser did not provide a valid push subscription." },
        { status: 400 },
      );
    }
    const { error: subError } = await supabase
      .from("push_subscriptions")
      .upsert(
        {
          user_id: user.id,
          endpoint: sub.endpoint,
          p256dh: sub.keys.p256dh,
          auth: sub.keys.auth,
        },
        { onConflict: "endpoint" },
      );
    if (subError) {
      console.error("[reminders] subscription upsert failed", subError);
      return Response.json(
        { error: "Something failed. Try again." },
        { status: 500 },
      );
    }
  }

  const { error } = await supabase
    .from("profiles")
    .update(update)
    .eq("id", user.id);

  if (error) {
    console.error("[reminders] profile update failed", error);
    return Response.json(
      { error: "Something failed. Try again." },
      { status: 500 },
    );
  }

  return Response.json({
    ok: true,
    reflection: reflectionOn,
    goal: goalOn,
    quote: quoteOn,
  });
}
