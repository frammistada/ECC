import { createClient } from "@/lib/supabase/server";

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

  const update = {};

  if (body?.mentorMode !== undefined) {
    if (body.mentorMode !== "direct" && body.mentorMode !== "steady") {
      return Response.json({ error: "Unknown mentor mode." }, { status: 400 });
    }
    update.mentor_mode = body.mentorMode;
  }

  if (body?.preferredName !== undefined) {
    update.preferred_name =
      typeof body.preferredName === "string"
        ? body.preferredName.trim().slice(0, 60) || null
        : null;
  }

  if (body?.accountabilityName !== undefined) {
    update.accountability_name =
      typeof body.accountabilityName === "string"
        ? body.accountabilityName.trim().slice(0, 80) || null
        : null;
  }

  if (body?.accountabilityEmail !== undefined) {
    const raw =
      typeof body.accountabilityEmail === "string"
        ? body.accountabilityEmail.trim().slice(0, 255)
        : "";
    if (raw && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
      return Response.json(
        { error: "That doesn't look like an email address." },
        { status: 400 },
      );
    }
    update.accountability_email = raw || null;
  }

  if (Object.keys(update).length === 0) {
    return Response.json({ error: "Nothing to update." }, { status: 400 });
  }

  const { error } = await supabase
    .from("profiles")
    .update(update)
    .eq("id", user.id);

  if (error) {
    console.error("[settings] update failed", error);
    return Response.json(
      { error: "Something failed. Try again." },
      { status: 500 },
    );
  }

  return Response.json({ ok: true });
}
