import { after } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMentorResponse } from "@/lib/mentor";
import { updatePatternSummary } from "@/lib/summary";
import { composeAccountabilityMessage } from "@/lib/accountability";
import { isEmailConfigured } from "@/lib/email";
import { gateOpen } from "@/lib/limits";
import { resolveMeditation } from "@/lib/meditations";

// The micro check-in: one tap (held / slipped / neither), at most a
// sentence with it. Free on every tier and exempt from the reflection
// paywall — the point is that a bad day never costs the habit. Counts
// toward short-term memory and the pattern summary like any entry, but
// the mentor's reply is deliberately short and light (kind: 'checkin'),
// and no open-loop extraction runs on one line of text.
const STATES = ["held", "slipped", "neither"];
const MAX_NOTE_CHARS = 140;

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

  const state = STATES.includes(body?.state) ? body.state : null;
  if (!state) {
    return Response.json({ error: "Nothing to log." }, { status: 400 });
  }
  const note =
    typeof body?.note === "string"
      ? body.note.trim().slice(0, MAX_NOTE_CHARS)
      : "";
  const content = note ? `${state} — ${note}` : `${state}.`;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const meditation = await resolveMeditation(
    supabase,
    user.id,
    body?.meditationId,
  );
  if (!meditation) {
    const status =
      typeof body?.meditationId === "string" && body.meditationId ? 404 : 500;
    return Response.json(
      {
        error:
          status === 404
            ? "That page is gone."
            : "Something failed. Try again.",
      },
      { status },
    );
  }

  const mentorMode =
    (meditation?.mentor_mode ?? profile?.mentor_mode) === "direct"
      ? "direct"
      : "steady";

  const { data: recent } = await supabase
    .from("entries")
    .select("content, responses(content)")
    .eq("user_id", user.id)
    .eq("meditation_id", meditation.id)
    .order("created_at", { ascending: false })
    .limit(5);
  const history = (recent ?? [])
    .filter((e) => e.responses?.[0]?.content)
    .map((e) => ({ entry: e.content, response: e.responses[0].content }))
    .reverse();

  let mentorText;
  try {
    mentorText = await getMentorResponse(
      content,
      history,
      mentorMode,
      profile?.pattern_summary ?? null,
      profile?.preferred_name ?? null,
      {
        age: profile?.age ?? null,
        aim: profile?.aim ?? null,
        note: profile?.about_note ?? null,
      },
      null, // open loops stay out of check-in replies — too light to press
      "checkin",
    );
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return Response.json(
        { error: "The mentor is occupied. Wait a moment and try again." },
        { status: 429 },
      );
    }
    console.error("[checkin] api error", err);
    return Response.json(
      { error: "Something failed. Try again." },
      { status: 502 },
    );
  }
  if (!mentorText) {
    return Response.json(
      { error: "The mentor was silent. Try again." },
      { status: 502 },
    );
  }

  const { data: saved, error: entryError } = await supabase
    .from("entries")
    .insert({
      user_id: user.id,
      content,
      meditation_id: meditation.id,
      entry_type: "checkin",
      checkin_state: state,
    })
    .select("id")
    .single();
  if (entryError) {
    console.error("[checkin] entry insert failed", entryError);
    return Response.json(
      { error: "Something failed. Try again." },
      { status: 500 },
    );
  }
  const { error: responseError } = await supabase
    .from("responses")
    .insert({ entry_id: saved.id, content: mentorText });
  if (responseError) {
    console.error("[checkin] response insert failed", responseError);
  }

  after(async () => {
    try {
      const admin = createAdminClient();
      const nextSummary = await updatePatternSummary(
        profile?.pattern_summary ?? null,
        content,
        mentorText,
      );
      if (nextSummary && nextSummary !== profile?.pattern_summary) {
        await admin
          .from("profiles")
          .update({ pattern_summary: nextSummary })
          .eq("id", user.id);
      }
      await admin.from("user_activity_log").insert({
        user_id: user.id,
        entry_id: saved.id,
        goal_status:
          state === "held" ? "complete" : state === "slipped" ? "missed" : null,
        mentor_mode: mentorMode,
        entry_length: content.length,
      });
    } catch (err) {
      console.error("[checkin] post-response work failed", err);
    }
  });

  // Consequence mechanic: a slipped check-in offers the accountability
  // draft, same as the "I fell short" toggle on a full entry. Deliberate
  // cross-over — it is the same signal. Draft-and-tap only, never
  // auto-sent; gated by the consequence premium flag.
  const draft =
    state === "slipped" &&
    profile?.accountability_email &&
    isEmailConfigured() &&
    gateOpen("consequence", profile)
      ? {
          toName: profile.accountability_name || null,
          message: composeAccountabilityMessage(profile?.preferred_name),
        }
      : null;

  return Response.json({ response: mentorText, content, draft });
}
