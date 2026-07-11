import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import RingMark from "@/components/ring-mark";
import { ArrowLeftMark } from "@/components/icons";
import { LocalDay } from "@/components/local-date";
import { gateOpen } from "@/lib/limits";

export const dynamic = "force-dynamic";

// Milestones are counted in full reflections, not days — this audience
// skips days, and a gap shouldn't push the milestone away. First look
// back at 30 entries, again at 90, then every 90.
function reachedMilestone(count) {
  if (count >= 90) return Math.floor(count / 90) * 90;
  if (count >= 30) return 30;
  return null;
}
function nextMilestone(count) {
  if (count < 30) return 30;
  if (count < 90) return 90;
  return (Math.floor(count / 90) + 1) * 90;
}

// One side of the spread: a lifted panel holding an entry and its reply.
function Facing({ label, entry }) {
  return (
    <article className="min-w-0 rounded-2xl border border-parchment/10 bg-panel p-6">
      <p className="font-mono text-xs tracking-[0.15em] text-ash">{label}</p>
      <p className="mt-1.5 font-mono text-xs text-ash/70">
        <LocalDay iso={entry.created_at} />
      </p>
      <p className="mt-4 whitespace-pre-wrap text-base leading-relaxed">
        {entry.content}
      </p>
      {entry.responses?.[0]?.content && (
        <blockquote className="mt-6 border-l border-patina pl-4 text-base italic leading-relaxed text-parchment/90">
          {entry.responses[0].content}
        </blockquote>
      )}
    </article>
  );
}

// The count writ large, a thin rule filling toward the next look back,
// and — once a milestone is reached — the first entry set beside the
// latest. The page never scrolls; only the spread does.
export default async function MilestonesPage() {
  if (!isSupabaseConfigured()) redirect("/");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const [{ data: profile }, { count }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("entries")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("entry_type", "reflection"),
  ]);

  const gated = !gateOpen("milestones", profile);
  const total = count ?? 0;
  const milestone = reachedMilestone(total);
  const next = nextMilestone(total);
  const prev = milestone ?? 0;
  const progress =
    next === prev
      ? 100
      : Math.min(100, Math.round(((total - prev) / (next - prev)) * 100));

  let first = null;
  let latest = null;
  if (!gated && milestone) {
    const [{ data: firstRows }, { data: latestRows }] = await Promise.all([
      supabase
        .from("entries")
        .select("content, created_at, responses(content)")
        .eq("user_id", user.id)
        .eq("entry_type", "reflection")
        .order("created_at", { ascending: true })
        .limit(1),
      supabase
        .from("entries")
        .select("content, created_at, responses(content)")
        .eq("user_id", user.id)
        .eq("entry_type", "reflection")
        .order("created_at", { ascending: false })
        .limit(1),
    ]);
    first = firstRows?.[0] ?? null;
    latest = latestRows?.[0] ?? null;
  }

  return (
    <main className="min-h-dvh px-3 py-3">
      <div className="mx-auto flex h-[calc(100dvh-24px)] w-full max-w-[760px] flex-col overflow-hidden rounded-[28px] border border-parchment/10 px-5 pb-6 pt-6 sm:px-8">
        <nav className="flex items-center justify-end text-parchment/80">
          <Link href="/" aria-label="back to today" title="back to today">
            <ArrowLeftMark className="h-6 w-6" />
          </Link>
        </nav>
        <header className="mt-2 shrink-0">
          <div className="flex items-center gap-3">
            <RingMark className="h-10 w-10 shrink-0 text-parchment/60" />
            <h1 className="font-display text-4xl font-normal tracking-[0.08em]">
              Citadel
            </h1>
          </div>
          <p className="mt-3 font-mono text-xs text-ash">milestones</p>
        </header>

        {gated ? (
          <div className="flex min-h-0 flex-1 items-center">
            <p className="text-lg leading-relaxed">
              Milestones are part of the subscription.
            </p>
          </div>
        ) : (
          <>
            {/* The count and the road to the next look back — fixed. */}
            <section className="mt-6 shrink-0 text-center">
              <p className="font-display text-6xl font-light leading-none text-parchment">
                {total}
              </p>
              <p className="mt-2 font-mono text-xs tracking-[0.25em] text-ash">
                {total === 1 ? "reflection" : "reflections"}
              </p>
            </section>
            <section className="mx-auto mt-6 w-full max-w-[440px] shrink-0">
              <div className="h-[2px] w-full overflow-hidden rounded-full bg-ash/20">
                <div
                  className="h-full bg-patina"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between font-mono text-[10px] text-ash">
                <span>{prev}</span>
                <span>{next}</span>
              </div>
              <p className="mt-3 text-center font-mono text-xs text-ash">
                {milestone
                  ? `next look back at ${next} — ${next - total} to go`
                  : `your first look back comes at 30 — ${next - total} to go`}
              </p>
            </section>

            {/* Only this region scrolls. */}
            {milestone ? (
              <div className="mt-6 min-h-0 flex-1 overflow-y-auto">
                <div className="grid gap-5 pb-2 sm:grid-cols-2">
                  {first && <Facing label="where you began" entry={first} />}
                  {latest && total > 1 && (
                    <Facing label="where you are" entry={latest} />
                  )}
                </div>
                <p className="mt-6 pb-1 text-center font-mono text-xs text-ash">
                  the same hand, {milestone} entries apart
                </p>
              </div>
            ) : (
              <div className="mx-auto flex min-h-0 max-w-[400px] flex-1 items-center">
                <p className="text-center text-base leading-relaxed text-ash">
                  At thirty entries, your first one is set beside your latest —
                  and the distance between them is left to speak for itself.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
