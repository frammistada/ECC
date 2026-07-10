import Anthropic from "@anthropic-ai/sdk";
import { buildMentorSystem } from "@/lib/mentor-prompt";

// history: [{ entry, response }] oldest-first, at most 5.
// mentorMode: 'direct' | 'steady'. patternSummary: rolling note or null.
// background: { age, aim, note } from "Who am I", or null.
// openLoops: [{ description, created_at }] unresolved, newest first, or null.
// Returns the mentor's text, or throws (Anthropic errors bubble to the route).
export async function getMentorResponse(
  entry,
  history,
  mentorMode = "steady",
  patternSummary = null,
  preferredName = null,
  background = null,
  openLoops = null,
) {
  if (process.env.CITADEL_MOCK_MENTOR === "1") {
    return "[mock mentor — set ANTHROPIC_API_KEY for the real one] You wrote it down, which is more than most manage. What part of this were you hoping I wouldn't notice?";
  }

  const messages = history.flatMap((x) => [
    { role: "user", content: x.entry },
    { role: "assistant", content: x.response },
  ]);
  messages.push({ role: "user", content: entry });

  const client = new Anthropic();
  const result = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 2048,
    thinking: { type: "adaptive" },
    system: buildMentorSystem(
      mentorMode,
      patternSummary,
      preferredName,
      background,
      openLoops,
    ),
    messages,
  });

  if (result.stop_reason === "refusal") {
    return null;
  }

  return (
    result.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim() || null
  );
}
