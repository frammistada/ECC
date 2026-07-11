import { after } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMentorResponse } from "@/lib/mentor";
import { updatePatternSummary } from "@/lib/summary";
import {
  extractOpenLoops,
  OPEN_LOOPS_REQUIRE_SUBSCRIPTION,
  OPEN_LOOPS_IN_CONTEXT,
} from "@/lib/loops";
import { composeAccountabilityMessage } from "@/lib/accountability";
import { isEmailConfigured } from "@/lib/email";
import { FREE_ENTRY_LIMIT, isSubscribed } from "@/lib/limits";
import { resolveMeditation } from "@/lib/meditations";

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
  // The paywall counts full reflections only — micro check-ins are free
  // on every tier and never spend the allowance.
  const [{ data: profile }, { count: entryCount }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("entries")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("entry_type", "reflection"),
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

  // No-mentor journaling: the entry is saved like any other, but no
  // mentor call is made and no response exists. Paid only — the client
  // never shows the toggle to free users, so this is belt-and-braces.
  const noMentor = body?.noMentor === true;
  if (noMentor && !isSubscribed(profile)) {
    return Response.json(
      { error: "Journaling without the mentor requires a subscription." },
      { status: 403 },
    );
  }

  // Each entry belongs to a meditation (an entry page). A meditationId in
  // the body targets a specific page; otherwise the day's automatic page
  // is found or created on first write.
  const meditation = await resolveMeditation(
    supabase,
    user.id,
    body?.meditationId,
  );
  if (!meditation) {
    if (typeof body?.meditationId === "string" && body.meditationId) {
      return Response.json({ error: "That page is gone." }, { status: 404 });
    }
    return Response.json(
      { error: "Something failed. Your words were not lost — try again." },
      { status: 500 },
    );
  }

  // Page-level mode wins; the profile's mode is the default.
  const mentorMode =
    (meditation?.mentor_mode ?? profile?.mentor_mode) === "direct"
      ? "direct"
      : "steady";
  const patternSummary = profile?.pattern_summary ?? null;
  const preferredName = profile?.preferred_name ?? null;
  // "Who am I" static background — read-only context for the mentor,
  // alongside the short-term (last 5) and long-term (summary) layers.
  const background = {
    age: profile?.age ?? null,
    aim: profile?.aim ?? null,
    note: profile?.about_note ?? null,
  };
  const slipped = body?.slipped === true;

  // Open loops: intentions/commitments from earlier entries, followed up
  // if the user goes quiet on them. Injection is behind the subscription
  // flag (off until the paywall lands); extraction below always runs so
  // the history exists the day it flips on.
  const loopsInContext =
    !OPEN_LOOPS_REQUIRE_SUBSCRIPTION || isSubscribed(profile);

  // The mentor reads this page's last five exchanges so each page stays
  // its own conversation. This is the product's short-term memory; the
  // rolling pattern_summary above is the long-term memory. A no-mentor
  // entry needs neither — nothing will be asked.
  const [{ data: recent }, { data: openLoops }] = noMentor
    ? [{ data: null }, { data: null }]
    : await Promise.all([
        supabase
          .from("entries")
          .select("content, responses(content)")
          .eq("user_id", user.id)
          .eq("meditation_id", meditation.id)
          .order("created_at", { ascending: false })
          .limit(5),
        loopsInContext
          ? supabase
              .from("open_loops")
              .select("description, created_at")
              .eq("user_id", user.id)
              .eq("resolved", false)
              .order("created_at", { ascending: false })
              .limit(OPEN_LOOPS_IN_CONTEXT)
          : Promise.resolve({ data: null }),
      ]);

  const history = (recent ?? [])
    .filter((e) => e.responses?.[0]?.content)
    .map((e) => ({ entry: e.content, response: e.responses[0].content }))
    .reverse();

  let mentorText = null;
  if (!noMentor) {
    try {
      mentorText = await getMentorResponse(
        entry,
        history,
        mentorMode,
        patternSummary,
        preferredName,
        background,
        openLoops ?? null,
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
  }

  // Save entry and response together — an entry without its response
  // would be a hole in the timeline. A 'journal' entry is the exception:
  // there, the absence of a response is the chosen mode, not a hole.
  const { data: saved, error: entryError } = await supabase
    .from("entries")
    .insert({
      user_id: user.id,
      content: entry,
      meditation_id: meditation.id,
      ...(noMentor ? { entry_type: "journal" } : {}),
    })
    .select("id")
    .single();

  if (entryError) {
    console.error("[reflect] entry insert failed", entryError);
    return Response.json(
      { error: "Something failed. Your words were not lost — try again." },
      { status: 500 },
    );
  }

  if (!noMentor) {
    const { error: responseError } = await supabase
      .from("responses")
      .insert({ entry_id: saved.id, content: mentorText });

    if (responseError) {
      console.error("[reflect] response insert failed", responseError);
    }
  }

  // Everything below runs after the response is sent to the user, so it
  // adds no latency. All best-effort: failures (incl. a not-yet-applied
  // migration) are logged and swallowed, never surfaced to the writer.
  after(async () => {
    try {
      const admin = createAdminClient();

      // Item 1: fold this exchange into the rolling pattern summary.
      // Runs for no-mentor entries too (mentorText null) — the mentor
      // should know what was written even when it didn't reply; the
      // memory is the moat regardless of the mode the entry was written
      // in.
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
      // mentor_mode 'none' marks a no-mentor entry — no mode replied.
      await admin.from("user_activity_log").insert({
        user_id: user.id,
        entry_id: saved.id,
        goal_status: slipped ? "missed" : null,
        mentor_mode: noMentor ? "none" : mentorMode,
        entry_length: entry.length,
      });

      // Open loops: extract 0–2 from this exchange. The extractor sees
      // everything currently unresolved so it doesn't re-track a loop.
      const { data: allOpen } = await admin
        .from("open_loops")
        .select("description")
        .eq("user_id", user.id)
        .eq("resolved", false)
        .order("created_at", { ascending: false })
        .limit(10);
      const found = await extractOpenLoops(
        entry,
        mentorText,
        (allOpen ?? []).map((l) => l.description),
      );
      if (found.length) {
        await admin.from("open_loops").insert(
          found.map((description) => ({
            user_id: user.id,
            entry_id: saved.id,
            description,
          })),
        );
      }
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
    noMentor,
    // The free allowance counts reflections only; a 'journal' entry
    // (subscriber-only anyway) doesn't spend it.
    entryCount: noMentor ? (entryCount ?? 0) : (entryCount ?? 0) + 1,
    draft,
  });
}
