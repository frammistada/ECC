import { createClient } from "@/lib/supabase/server";
import { sendEmail, isEmailConfigured } from "@/lib/email";
import {
  composeAccountabilityMessage,
  composeMissedDayMessage,
  accountabilitySubject,
} from "@/lib/accountability";
import { gateOpen } from "@/lib/limits";

export async function POST(request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "You are signed out." }, { status: 401 });
  }

  if (!isEmailConfigured()) {
    return Response.json(
      { error: "Sending is not configured yet." },
      { status: 503 },
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  // Recipient comes only from the user's own stored contact — never from
  // the request — so this can't be turned into a relay to arbitrary people.
  const to = profile?.accountability_email;
  if (!to) {
    return Response.json(
      { error: "No accountability contact set." },
      { status: 400 },
    );
  }

  // kind 'missed' = the consequence mechanic's missed-day note; anything
  // else is the original slip note. Only the kind comes from the request —
  // both messages are composed entirely server-side.
  let kind = "slip";
  try {
    const body = await request.json();
    if (body?.kind === "missed") kind = "missed";
  } catch {
    // No body — the original slip flow sends none.
  }
  if (kind === "missed" && !gateOpen("consequence", profile)) {
    return Response.json(
      { error: "This is part of the subscription." },
      { status: 402 },
    );
  }

  const result = await sendEmail({
    to,
    toName: profile?.accountability_name || undefined,
    subject: accountabilitySubject(profile?.preferred_name),
    text:
      kind === "missed"
        ? composeMissedDayMessage(profile?.preferred_name)
        : composeAccountabilityMessage(profile?.preferred_name),
    replyTo: user.email,
    fromName: profile?.preferred_name || "Citadel",
  });

  if (!result.ok) {
    return Response.json(
      { error: "The note could not be sent. Try again." },
      { status: 502 },
    );
  }

  return Response.json({ ok: true });
}
