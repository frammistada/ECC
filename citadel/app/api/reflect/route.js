import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { getMentorResponse } from "@/lib/mentor";
import { FREE_ENTRY_LIMIT, isSubscribed } from "@/lib/limits";

const MAX_ENTRY_CHARS = 5000;

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

  const entry = typeof body?.entry === "string" ? body.entry.trim() : "";
  if (!entry) {
    return Response.json({ error: "Nothing to reflect on." }, { status: 400 });
  }
  if (entry.length > MAX_ENTRY_CHARS) {
    return Response.json(
      { error: "That entry is longer than a reflection needs to be." },
      { status: 400 },
    );
  }

  const [{ data: profile }, { count: entryCount }] = await Promise.all([
    supabase
      .from("profiles")
      .select("subscription_status")
      .eq("id", user.id)
      .single(),
    supabase
      .from("entries")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id),
  ]);

  if ((entryCount ?? 0) >= FREE_ENTRY_LIMIT && !isSubscribed(profile)) {
    return Response.json(
      {
        paywall: true,
        error:
          "Continuing past your first five reflections requires a subscription.",
      },
      { status: 402 },
    );
  }

  // The mentor reads the last five exchanges so it can hold the writer
  // to their own patterns. This is the product's memory.
  const { data: recent } = await supabase
    .from("entries")
    .select("content, responses(content)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5);

  const history = (recent ?? [])
    .filter((e) => e.responses?.[0]?.content)
    .map((e) => ({ entry: e.content, response: e.responses[0].content }))
    .reverse();

  let mentorText;
  try {
    mentorText = await getMentorResponse(entry, history);
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      console.error("[reflect] missing or invalid ANTHROPIC_API_KEY");
      return Response.json(
        { error: "The mentor is not configured. Set ANTHROPIC_API_KEY." },
        { status: 503 },
      );
    }
    if (err instanceof Anthropic.RateLimitError) {
      return Response.json(
        { error: "The mentor is occupied. Wait a moment and try again." },
        { status: 429 },
      );
    }
    console.error("[reflect] api error", err);
    return Response.json(
      { error: "Something failed. Your words were not lost — try again." },
      { status: 502 },
    );
  }

  if (!mentorText) {
    return Response.json(
      { error: "The mentor was silent. Try again." },
      { status: 502 },
    );
  }

  // Save entry and response together — an entry without its response
  // would be a hole in the timeline.
  const { data: saved, error: entryError } = await supabase
    .from("entries")
    .insert({ user_id: user.id, content: entry })
    .select("id")
    .single();

  if (entryError) {
    console.error("[reflect] entry insert failed", entryError);
    return Response.json(
      { error: "Something failed. Your words were not lost — try again." },
      { status: 500 },
    );
  }

  const { error: responseError } = await supabase
    .from("responses")
    .insert({ entry_id: saved.id, content: mentorText });

  if (responseError) {
    console.error("[reflect] response insert failed", responseError);
  }

  return Response.json({
    response: mentorText,
    entryCount: (entryCount ?? 0) + 1,
  });
}
