import Anthropic from "@anthropic-ai/sdk";

// Open loops: stated intentions, commitments, or unresolved tensions the
// mentor should follow up on in a later entry if the user doesn't bring
// them back up. Extraction runs after each reflect (cheap model, in
// after(), never blocks the reply); injection happens before the mentor
// call in /api/reflect.
//
// Subscription gate: flip this to true once the payment provider is
// decided and the paywall is live. Extraction always runs (so a user's
// loop history exists the day they subscribe); this flag gates only
// whether the loops are injected into the mentor's context.
export const OPEN_LOOPS_REQUIRE_SUBSCRIPTION = false;

// How many unresolved loops the mentor sees per entry.
export const OPEN_LOOPS_IN_CONTEXT = 3;

const LOOP_EXTRACTION_SYSTEM = `You read one journal entry and the mentor's
reply, and extract "open loops": things the writer has left genuinely
unresolved and pointed at the future — a stated intention ("I'm going to
confront him"), a commitment with a deadline ("I need to fix this by
Friday"), or a live tension they clearly haven't settled ("I still haven't
answered her message").

Rules:
- Return a JSON array of 0 to 2 short strings. Nothing else — no prose,
  no code fences, no keys.
- Each string is one loop, third person, under 20 words, concrete enough
  to follow up on later ("Said they would confront their brother about
  the loan", not "Has family issues").
- Most entries contain zero loops. Reflection, complaint, or description
  of a finished event is not a loop. Do not invent one to have output.
- You are given the loops already being tracked. Do not re-extract one
  that is already on that list, even reworded.
- Return [] when there is nothing.`;

// entry + response: the new exchange. existing: descriptions of loops
// already open, so the extractor doesn't duplicate them. Returns an array
// of 0–2 strings; [] on any failure — extraction is best-effort and must
// never affect the entry flow.
export async function extractOpenLoops(entry, response, existing = []) {
  if (process.env.CITADEL_MOCK_MENTOR === "1") return [];

  const tracked = existing.length
    ? existing.map((d) => `- ${d}`).join("\n")
    : "(none)";

  const client = new Anthropic();
  try {
    const result = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 300,
      system: LOOP_EXTRACTION_SYSTEM,
      messages: [
        {
          role: "user",
          content:
            `Already tracked:\n${tracked}\n\n` +
            `Entry:\n${entry}\n\n` +
            `Mentor's reply:\n${response}`,
        },
      ],
    });

    if (result.stop_reason === "refusal") return [];

    const text = result.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim()
      // Tolerate a fenced reply despite the instruction not to fence.
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "");

    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((d) => typeof d === "string" && d.trim())
      .map((d) => d.trim().slice(0, 200))
      .slice(0, 2);
  } catch {
    return [];
  }
}
