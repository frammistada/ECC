// The accountability note. Composed the same way on client (to preview the
// draft) and server (to actually send), so what the user sees is exactly
// what goes out. First person, plain, low-shame — per the audience note.

export function composeAccountabilityMessage(preferredName) {
  const name = (preferredName || "").trim();
  const signoff = name ? `\n\n— ${name}` : "";
  return (
    "I didn't do what I set out to do today. " +
    "I'm telling you because I asked to be held to it." +
    signoff
  );
}

// The missed-day variant (consequence mechanic): offered when yesterday
// passed with no entry and no check-in. Same register — plain, first
// person, no self-flagellation.
export function composeMissedDayMessage(preferredName) {
  const name = (preferredName || "").trim();
  const signoff = name ? `\n\n— ${name}` : "";
  return (
    "I went quiet yesterday — no entry, no check-in. " +
    "I'm telling you because I asked to be held to it." +
    signoff
  );
}

export function accountabilitySubject(preferredName) {
  const name = (preferredName || "").trim();
  return name ? `A note from ${name}` : "A note";
}
