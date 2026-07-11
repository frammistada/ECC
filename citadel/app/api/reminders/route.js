import { createClient } from "@/lib/supabase/server";
import { isSubscribed } from "@/lib/limits";
import { parseHhmm } from "@/lib/reminders";

// Save the daily-reminder settings and, when enabling, register this
// browser's push subscription. Paid only — enabling requires an active
// subscription (the client hides the room from free users; this is the
// server guard). Disabling is always allowed.
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

  const enabled = body?.enabled === true;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (enabled && !isSubscribed(profile)) {
    return Response.json(
      { error: "Daily reminders require a subscription." },
      { status: 403 },
    );
  }

  const update = { reminder_enabled: enabled };

  if (enabled) {
    const minutes = parseHhmm(body?.time);
    if (minutes === null) {
      return Response.json(
        { error: "That time doesn't look right." },
        { status: 400 },
      );
    }
    update.reminder_time = body.time;
    // IANA zone from the browser; "UTC" fallback keeps a reminder firing.
    update.reminder_timezone =
      typeof body?.timezone === "string" && body.timezone.trim()
        ? body.timezone.trim().slice(0, 64)
        : "UTC";
    // Clear the guard so a same-day enable can still fire tonight.
    update.reminder_last_sent = null;

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

  return Response.json({ ok: true, enabled });
}
