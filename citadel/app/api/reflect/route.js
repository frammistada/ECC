import { after } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMentorResponse } from "@/lib/mentor";
import { updatePatternSummary } from "@/lib/summary";
import { composeAccountabilityMessage } from "@/lib/accountability";
import { isEmailConfigured } from "@/lib/email";
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

  // select("*") rather than naming new columns, so this still works if the
  // 002 migration hasn't been applied yet — the fields just come back
  // undefined and the mentor falls back to its default voice.
  const [{ data: profile }, { count: entryCount }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
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

  const mentorMode = profile?.mentor_mode === "direct" ? "direct" : "steady";
  const patternSummary = profile?.pattern_summary ?? null;
  const preferredName = profile?.preferred_name ?? null;
  const slipped = body?.slipped === true;

  // The mentor reads the last five exchanges so it can hold the writer
  // to their own patterns. This is the product's short-term memory; the
  // rolling pattern_summary above is the long-term memory.
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
    mentorText = await getMentorResponse(
      entry,
      history,
      mentorMode,
      patternSummary,
      preferredName,
    );
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

  // Everything below runs after the response is sent to the user, so it
  // adds no latency. All best-effort: failures (incl. a not-yet-applied
  // migration) are logged and swallowed, never surfaced to the writer.
  after(async () => {
    try {
      const admin = createAdminClient();

      // Item 1: fold this exchange into the rolling pattern summary.
      const nextSummary = await updatePatternSummary(
        patternSummary,
        entry,
        mentorText,
      );
      if (nextSummary && nextSummary !== patternSummary) {
        await admin
          .from("profiles")
          .update({ pattern_summary: nextSummary })
          .eq("id", user.id);
      }

      // Item 3: behavioral instrumentation. goal_status carries the slip
      // signal from item 4's toggle ('missed' when checked, else null).
      await admin.from("user_activity_log").insert({
        user_id: user.id,
        entry_id: saved.id,
        goal_status: slipped ? "missed" : null,
        mentor_mode: mentorMode,
        entry_length: entry.length,
      });
    } catch (err) {
      console.error("[reflect] post-response work failed", err);
    }
  });

  // Item 4: only when they marked a slip AND have set a contact AND sending
  // is configured. The draft is shown for a one-tap send — never auto-sent.
  const draft =
    slipped && profile?.accountability_email && isEmailConfigured()
      ? {
          toName: profile.accountability_name || null,
          message: composeAccountabilityMessage(preferredName),
        }
      : null;

  return Response.json({
    response: mentorText,
    entryCount: (entryCount ?? 0) + 1,
    draft,
  });
}
