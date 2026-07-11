import { dateLine } from "@/lib/format";

// Normalizes a requested mentor mode: 'direct'/'steady' stick, anything
// else (including 'default') means "use the profile's mode" → null.
export function normalizeMode(mode) {
  return mode === "direct" || mode === "steady" ? mode : null;
}

// Every entry (reflection or check-in) belongs to a meditation. A
// meditationId targets a specific page; without one, the day's automatic
// page is found or created on first write. Returns the meditation row, or
// null when a requested page doesn't exist / creation genuinely failed.
export async function resolveMeditation(supabase, userId, meditationId) {
  if (typeof meditationId === "string" && meditationId) {
    const { data: med } = await supabase
      .from("meditations")
      .select("*")
      .eq("id", meditationId)
      .maybeSingle();
    return med ?? null;
  }

  const today = new Date().toISOString().slice(0, 10);
  const { data: existing } = await supabase
    .from("meditations")
    .select("*")
    .eq("user_id", userId)
    .eq("auto_day", today)
    .maybeSingle();
  if (existing) return existing;

  const { data: created, error } = await supabase
    .from("meditations")
    .insert({ user_id: userId, name: dateLine(new Date()), auto_day: today })
    .select("*")
    .single();
  if (!error) return created;

  // A concurrent write may have created it — re-read before failing.
  const { data: raced } = await supabase
    .from("meditations")
    .select("*")
    .eq("user_id", userId)
    .eq("auto_day", today)
    .maybeSingle();
  if (!raced) console.error("[meditations] create failed", error);
  return raced ?? null;
}
