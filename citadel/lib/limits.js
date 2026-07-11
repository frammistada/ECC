export const FREE_ENTRY_LIMIT = 5;

export function isSubscribed(profile) {
  return profile?.subscription_status === "active";
}

// Premium gates for features built ahead of the payment wall. All false
// until a provider is chosen (Stripe unavailable in Turkey); flip one to
// true to require a subscription for that feature. Same pattern as
// OPEN_LOOPS_REQUIRE_SUBSCRIPTION in lib/loops.js.
export const GATES = {
  // Consequence mechanic: missed-day draft + check-in slip draft.
  // (The original "I fell short" toggle on full entries predates this
  // and stays ungated either way.)
  consequence: false,
  // Milestone reflection (first entry beside the latest).
  milestones: false,
  // "To Myself" — weekly insights (+ the milestone timeline).
  toMyself: false,
};

export function gateOpen(gate, profile) {
  return !GATES[gate] || isSubscribed(profile);
}
