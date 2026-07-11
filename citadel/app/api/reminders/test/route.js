import { createClient } from "@/lib/supabase/server";
import { isSubscribed } from "@/lib/limits";
import { sendPush, isPushConfigured } from "@/lib/push";
import { REMINDER_TITLE, REMINDER_BODY } from "@/lib/reminders";

// Send a reminder to the current user's own devices right now, so they can
// confirm delivery from the settings room. Uses the user-scoped client:
// RLS lets someone read and prune only their own subscriptions, so no
// service role is needed here.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "You are signed out." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (!isSubscribed(profile)) {
    return Response.json(
      { error: "Daily reminders require a subscription." },
      { status: 403 },
    );
  }

  if (!isPushConfigured()) {
    return Response.json(
      { error: "Push is not configured on the server yet." },
      { status: 503 },
    );
  }

  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", user.id);

  if (!subs || subs.length === 0) {
    return Response.json(
      { error: "No device is registered for reminders on this account." },
      { status: 400 },
    );
  }

  const payload = { title: REMINDER_TITLE, body: REMINDER_BODY, url: "/" };
  let sent = 0;
  const dead = [];
  for (const sub of subs) {
    const res = await sendPush(sub, payload);
    if (res.ok) sent += 1;
    else if (res.gone) dead.push(sub.id);
  }
  if (dead.length) {
    await supabase.from("push_subscriptions").delete().in("id", dead);
  }

  if (sent === 0) {
    return Response.json(
      { error: "Could not deliver to any registered device." },
      { status: 502 },
    );
  }
  return Response.json({ ok: true, sent });
}
