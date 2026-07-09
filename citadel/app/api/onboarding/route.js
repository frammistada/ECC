import { createClient } from "@/lib/supabase/server";
import { scoreMentorMode, isCompleteAnswerSet } from "@/lib/onboarding";

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

  const answers = body?.answers;
  if (!isCompleteAnswerSet(answers)) {
    return Response.json(
      { error: "Please answer each question." },
      { status: 400 },
    );
  }

  const mentorMode = scoreMentorMode(answers);
  const preferredName =
    typeof body?.preferredName === "string"
      ? body.preferredName.trim().slice(0, 60) || null
      : null;

  const { error } = await supabase
    .from("profiles")
    .update({
      mentor_mode: mentorMode,
      onboarding_answers: answers,
      preferred_name: preferredName,
      onboarded: true,
    })
    .eq("id", user.id);

  if (error) {
    console.error("[onboarding] save failed", error);
    return Response.json(
      { error: "Something failed. Try again." },
      { status: 500 },
    );
  }

  return Response.json({ mentorMode });
}
