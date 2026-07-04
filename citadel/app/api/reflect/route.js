import Anthropic from "@anthropic-ai/sdk";
import { MENTOR_SYSTEM_PROMPT } from "@/lib/mentor-prompt";

const MAX_ENTRY_CHARS = 5000;
const MAX_HISTORY = 5;

export async function POST(request) {
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

  // Prior exchanges from this sitting (persistence arrives on day two).
  // The mentor reads the recent past so it can hold the writer to it.
  const history = Array.isArray(body?.history)
    ? body.history
        .filter(
          (x) =>
            typeof x?.entry === "string" && typeof x?.response === "string",
        )
        .slice(-MAX_HISTORY)
    : [];

  if (process.env.CITADEL_MOCK_MENTOR === "1") {
    return Response.json({
      response:
        "[mock mentor — set ANTHROPIC_API_KEY for the real one] You wrote it down, which is more than most manage. What part of this were you hoping I wouldn't notice?",
    });
  }

  const messages = history.flatMap((x) => [
    { role: "user", content: x.entry },
    { role: "assistant", content: x.response },
  ]);
  messages.push({ role: "user", content: entry });

  const client = new Anthropic();

  try {
    const result = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 2048,
      thinking: { type: "adaptive" },
      system: MENTOR_SYSTEM_PROMPT,
      messages,
    });

    if (result.stop_reason === "refusal") {
      return Response.json(
        { error: "The mentor has nothing to say to that." },
        { status: 200 },
      );
    }

    const text = result.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();

    if (!text) {
      return Response.json(
        { error: "The mentor was silent. Try again." },
        { status: 502 },
      );
    }

    return Response.json({ response: text });
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
    if (err instanceof Anthropic.APIConnectionError) {
      console.error("[reflect] connection error", err);
      return Response.json(
        { error: "The mentor could not be reached." },
        { status: 502 },
      );
    }
    console.error("[reflect] api error", err);
    return Response.json(
      { error: "Something failed. Your words were not lost — try again." },
      { status: 502 },
    );
  }
}
