import { createClient } from "@/lib/supabase/server";
import { sendEmail, isEmailConfigured } from "@/lib/email";
import {
  composeAccountabilityMessage,
  accountabilitySubject,
} from "@/lib/accountability";

export async function POST() {
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

  const result = await sendEmail({
    to,
    toName: profile?.accountability_name || undefined,
    subject: accountabilitySubject(profile?.preferred_name),
    text: composeAccountabilityMessage(profile?.preferred_name),
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
