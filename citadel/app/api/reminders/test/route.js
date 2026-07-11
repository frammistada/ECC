import { createClient } from "@/lib/supabase/server";
import { isSubscribed } from "@/lib/limits";
import { sendPush, isPushConfigured } from "@/lib/push";
import {
  reflectionPayload,
  goalPayload,
  quotePayload,
  pickQuote,
} from "@/lib/reminders";

// Send a sample of each ENABLED reminder type to the current user's own
// devices right now, so they can confirm delivery and see the content from
// the settings room. User-scoped client: RLS lets someone read and prune
// only their own subscriptions.
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
      { error: "Reminders require a subscription." },
      { status: 403 },
    );
  }
  if (!isPushConfigured()) {
    return Response.json(
      { error: "Push is not configured on the server yet." },
      { status: 503 },
    );
  }

  // Which payloads to preview — one per enabled type.
  const today = new Date().toISOString().slice(0, 10);
  const payloads = [];
  if (profile.reminder_enabled) payloads.push(reflectionPayload());
  if (profile.goal_reminder_enabled) {
    const aim = (profile.aim || "").trim();
    payloads.push(
      goalPayload(aim || "Set what you're working toward in Who am I."),
    );
  }
  if (profile.quote_reminder_enabled) payloads.push(quotePayload(pickQuote(today, 0)));

  if (payloads.length === 0) {
    return Response.json(
      { error: "No reminder is enabled to test." },
      { status: 400 },
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

  let sent = 0;
  const dead = new Set();
  for (const sub of subs) {
    for (const payload of payloads) {
      const res = await sendPush(sub, payload);
      if (res.ok) sent += 1;
      else if (res.gone) dead.add(sub.id);
    }
  }
  if (dead.size) {
    await supabase.from("push_subscriptions").delete().in("id", [...dead]);
  }

  if (sent === 0) {
    return Response.json(
      { error: "Could not deliver to any registered device." },
      { status: 502 },
    );
  }
  return Response.json({ ok: true, sent, kinds: payloads.length });
}
