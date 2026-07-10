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

function Exchange({ label, entry }) {
  return (
    <div className="min-w-0">
      <p className="font-mono text-xs text-ash">
        {label} · <LocalDay iso={entry.created_at} />
      </p>
      <p className="mt-4 whitespace-pre-wrap text-lg leading-relaxed">
        {entry.content}
      </p>
      {entry.responses?.[0]?.content && (
        <blockquote className="mt-6 border-l border-patina pl-5 text-lg italic leading-relaxed text-parchment/90">
          {entry.responses[0].content}
        </blockquote>
      )}
    </div>
  );
}

// Revisitable by design — a page in the drawer, not a one-time popup.
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
    <main className="mx-auto min-h-screen max-w-[720px] px-6 py-16 sm:py-24">
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

      <section className="mt-16">
        {gated ? (
          <p className="text-lg leading-relaxed">
            Milestones are part of the subscription.
          </p>
        ) : !milestone ? (
          <>
            <p className="text-lg leading-relaxed">
              You have written here {total === 0 ? "no" : total}{" "}
              {total === 1 ? "time" : "times"}. At thirty entries, your first
              one is shown beside your latest.
            </p>
            <p className="mt-4 font-mono text-xs text-ash">
              {nextMilestone(total) - total} to go
            </p>
          </>
        ) : (
          <>
            <p className="text-lg leading-relaxed">
              You have written here {total} times.
            </p>
            <div className="mt-12 grid gap-12 sm:grid-cols-2 sm:gap-10">
              {first && <Exchange label="entry one" entry={first} />}
              {latest && total > 1 && (
                <Exchange label={`entry ${total}`} entry={latest} />
              )}
            </div>
            <p className="mt-14 font-mono text-xs text-ash">
              next look back at {nextMilestone(total)} entries
            </p>
          </>
        )}
      </section>
    </main>
  );
}
