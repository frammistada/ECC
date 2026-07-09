// Scenario-based onboarding. Behavioral questions predict tone-fit better
// than asking "do you want a direct or gentle mentor" — people don't
// forecast their own reaction to confrontation well before they've felt it.
//
// Each option carries a weight: +1 leans direct, -1 leans steady, 0 neutral.
// The sum decides mentor_mode, with steady as the safer tie/mixed default
// (easier to escalate tone later than to walk it back after a bad start).

export const ONBOARDING_QUESTIONS = [
  {
    id: "miss_goal",
    prompt: "When you miss a goal, what usually happens next?",
    options: [
      { value: "tomorrow", label: "I tell myself I'll do better tomorrow and move on", weight: 0 },
      { value: "stop", label: "I stop tracking or trying for a while", weight: -1 },
      { value: "harder", label: "I get frustrated with myself and push harder immediately", weight: 1 },
      { value: "excuses", label: "I make excuses for why it wasn't really my fault", weight: 1 },
    ],
  },
  {
    id: "pattern_pointed_out",
    prompt: "When someone points out you're repeating a pattern, how do you react?",
    options: [
      { value: "plainly", label: "I want to hear it plainly, even if it stings", weight: 1 },
      { value: "carefully", label: "I need it framed carefully or I shut down", weight: -1 },
      { value: "mood", label: "It depends heavily on my mood that day", weight: 0 },
      { value: "already_know", label: "I already know and don't need it pointed out", weight: 0 },
    ],
  },
  {
    id: "recent_structure",
    prompt: "What's been true for you most in the last few months?",
    options: [
      { value: "had_lost", label: "I've had structure before and lost it", weight: 0 },
      { value: "never", label: "I've never really had structure to begin with", weight: -1 },
      { value: "partial", label: "I have structure in some parts of life, not others", weight: 0 },
    ],
  },
  {
    id: "bigger_risk",
    prompt: "For the thing you're trying to build or change, what's the bigger risk?",
    options: [
      { value: "give_up", label: "Giving up too early", weight: 1 },
      { value: "burnout", label: "Being too harsh on myself and burning out", weight: -1 },
      { value: "inconsistent", label: "Not being consistent enough to see if it's working", weight: 0 },
    ],
  },
  {
    id: "bad_day",
    prompt: "How do you want to be talked to on a bad day?",
    options: [
      { value: "straight", label: "Tell me straight, don't soften it", weight: 1 },
      { value: "meet", label: "Meet me where I am first, then push", weight: -1 },
      { value: "unsure", label: "I'm not sure yet — figure it out as you go", weight: 0 },
    ],
  },
  {
    id: "motivation",
    prompt: "Historically, what's gotten you to follow through more often?",
    options: [
      { value: "external", label: "External pressure — competition, deadlines, other people", weight: 1 },
      { value: "internal", label: "Internal drive, mostly", weight: 0 },
      { value: "neither", label: "Honestly, neither has worked consistently", weight: 0 },
    ],
  },
  {
    id: "two_days_missed",
    prompt: "If you miss two days in a row, what do you need most?",
    options: [
      { value: "call_out", label: "A direct call-out so I don't spiral into a third", weight: 1 },
      { value: "reassure", label: "Reassurance that it's not over, then a nudge", weight: -1 },
      { value: "space", label: "Space, then a check-in later", weight: -1 },
    ],
  },
];

// answers: { [questionId]: optionValue }. Returns 'direct' | 'steady'.
export function scoreMentorMode(answers) {
  let score = 0;
  for (const q of ONBOARDING_QUESTIONS) {
    const chosen = q.options.find((o) => o.value === answers?.[q.id]);
    if (chosen) score += chosen.weight;
  }
  return score > 0 ? "direct" : "steady";
}

export function isCompleteAnswerSet(answers) {
  return ONBOARDING_QUESTIONS.every((q) =>
    q.options.some((o) => o.value === answers?.[q.id]),
  );
}
