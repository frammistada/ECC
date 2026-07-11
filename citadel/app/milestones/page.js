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
    <article className="min-w-0 rounded-2xl border border-parchment/10 bg-panel p-6 sm:p-7">
      <p className="font-mono text-xs tracking-[0.15em] text-ash">{label}</p>
      <p className="mt-1.5 font-mono text-xs text-ash/70">
        <LocalDay iso={entry.created_at} />
      </p>
      <p className="mt-5 whitespace-pre-wrap text-lg leading-relaxed">
        {entry.content}
      </p>
      {entry.responses?.[0]?.content && (
        <blockquote className="mt-7 border-l border-patina pl-5 text-lg italic leading-relaxed text-parchment/90">
          {entry.responses[0].content}
        </blockquote>
      )}
    </article>
  );
}

// The count writ large, a thin rule filling toward the next look back,
// and — once a milestone is reached — the first entry set beside the
// latest as facing pages. Revisitable by design; never a popup.
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
    <main className="mx-auto min-h-screen max-w-[760px] px-6 py-16 sm:py-24">
      <header className="flex items-baseline justify-between">
        <div>
          <div className="flex items-center gap-3">
            <RingMark className="h-10 w-10 shrink-0 text-parchment/60" />
            <h1 className="font-display text-4xl font-normal tracking-[0.08em]">
              Citadel
            </h1>
          </div>
          <p className="mt-3 font-mono text-xs text-ash">milestones</p>
        </div>
        <nav className="flex items-center gap-5 text-parchment/80">
          <Link href="/" aria-label="back to today" title="back to today">
            <ArrowLeftMark className="h-6 w-6" />
          </Link>
        </nav>
      </header>

      {gated ? (
        <section className="mt-16">
          <p className="text-lg leading-relaxed">
            Milestones are part of the subscription.
          </p>
        </section>
      ) : (
        <>
          {/* The count, writ large. */}
          <section className="mt-16 text-center">
            <p className="font-display text-8xl font-light leading-none text-parchment">
              {total}
            </p>
            <p className="mt-3 font-mono text-xs tracking-[0.25em] text-ash">
              {total === 1 ? "reflection" : "reflections"}
            </p>
          </section>

          {/* The road to the next look back. */}
          <section className="mx-auto mt-12 max-w-[440px]">
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
            <p className="mt-5 text-center font-mono text-xs text-ash">
              {milestone
                ? `next look back at ${next} — ${next - total} to go`
                : `your first look back comes at 30 — ${next - total} to go`}
            </p>
          </section>

          {milestone ? (
            <section className="mt-16">
              <div className="grid gap-6 sm:grid-cols-2">
                {first && <Facing label="where you began" entry={first} />}
                {latest && total > 1 && (
                  <Facing label="where you are" entry={latest} />
                )}
              </div>
              <p className="mt-10 text-center font-mono text-xs text-ash">
                the same hand, {milestone === 30 ? "thirty" : milestone}{" "}
                entries apart
              </p>
            </section>
          ) : (
            <section className="mx-auto mt-16 max-w-[440px]">
              <p className="text-center text-lg leading-relaxed text-ash">
                At thirty entries, your first one is set beside your latest —
                and the distance between them is left to speak for itself.
              </p>
            </section>
          )}
        </>
      )}
    </main>
  );
}
