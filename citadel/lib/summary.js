import Anthropic from "@anthropic-ai/sdk";
import { PATTERN_SUMMARY_SYSTEM } from "@/lib/mentor-prompt";

// Folds one new exchange into the rolling pattern summary. Cheap model —
// this is summarization, not the mentor's voice. Returns the new summary
// text, or null if it couldn't be produced (caller keeps the old one).
export async function updatePatternSummary(existingSummary, entry, response) {
  if (process.env.CITADEL_MOCK_MENTOR === "1") {
    return existingSummary || null;
  }

  const existing = (existingSummary || "").trim() || "(none yet)";
  const client = new Anthropic();

  try {
    const result = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 512,
      system: PATTERN_SUMMARY_SYSTEM,
      messages: [
        {
          role: "user",
          content:
            `Existing note:\n${existing}\n\n` +
            `Newest entry:\n${entry}\n\n` +
            `Mentor's reply:\n${response}`,
        },
      ],
    });

    if (result.stop_reason === "refusal") return null;

    const text = result.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    return text || null;
  } catch {
    // Best effort — never let summary maintenance affect the entry flow.
    return null;
  }
}
