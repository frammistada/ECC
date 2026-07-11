import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import RingMark from "@/components/ring-mark";
import { ArrowLeftMark } from "@/components/icons";
import { LocalDay } from "@/components/local-date";
import { gateOpen } from "@/lib/limits";
import {
  weekStartOf,
  weekLabel,
  generateWeeklyInsight,
  MIN_ITEMS_FOR_INSIGHT,
} from "@/lib/insights";

export const dynamic = "force-dynamic";

// Milestone thresholds, matching /milestones: 30, 90, then every 90.
function milestonesUpTo(count) {
  const marks = [];
  if (count >= 30) marks.push(30);
  for (let m = 90; m <= count; m += 90) marks.push(m);
  return marks;
}

// Lazy weekly generation: if the last completed week (Mon–Sun, UTC) has
// no note yet and enough material (>= MIN_ITEMS entries+check-ins), write
// it now — at most one model call per visit, race-safe on the unique
// (user_id, week_start) key. Failures are silent; a later visit retries.
async function maybeGenerateLastWeek(supabase, user, profile, insights) {
  const thisMonday = weekStartOf(new Date());
  const lastMonday = weekStartOf(new Date(Date.parse(thisMonday) - 86400000));
  if (insights.some((i) => i.week_start === lastMonday)) return null;

  const weekEnd = new Date(Date.parse(`${lastMonday}T00:00:00Z`) + 7 * 86400000)
    .toISOString();
  const weekStartIso = `${lastMonday}T00:00:00Z`;

  try {
    const [{ data: weekEntries }, { data: opened }, { data: resolved }, { data: prior }] =
      await Promise.all([
        supabase
          .from("entries")
          .select("content, created_at, entry_type, checkin_state")
          .eq("user_id", user.id)
          .gte("created_at", weekStartIso)
          .lt("created_at", weekEnd)
          .order("created_at", { ascending: true }),
        supabase
          .from("open_loops")
          .select("description")
          .eq("user_id", user.id)
          .gte("created_at", weekStartIso)
          .lt("created_at", weekEnd),
        supabase
          .from("open_loops")
          .select("description")
          .eq("user_id", user.id)
          .eq("resolved", true)
          .gte("resolved_at", weekStartIso)
          .lt("resolved_at", weekEnd),
        supabase
          .from("weekly_insights")
          .select("content")
          .eq("user_id", user.id)
          .eq(
            "week_start",
            weekStartOf(new Date(Date.parse(lastMonday) - 86400000)),
          )
          .maybeSingle(),
      ]);

    const all = weekEntries ?? [];
    if (all.length < MIN_ITEMS_FOR_INSIGHT) return null;

    const entries = all.filter((e) => e.entry_type !== "checkin");
    const checkins = all.filter((e) => e.entry_type === "checkin");

    const content = await generateWeeklyInsight({
      weekStart: lastMonday,
      entries,
      checkins,
      patternSummary: profile?.pattern_summary ?? null,
      priorInsight: prior?.content ?? null,
      loopsOpened: (opened ?? []).map((l) => l.description),
      loopsResolved: (resolved ?? []).map((l) => l.description),
    });
    if (!content) return null;

    const admin = createAdminClient();
    const { data: inserted } = await admin
      .from("weekly_insights")
      .insert({
        user_id: user.id,
        week_start: lastMonday,
        content,
        entry_count: entries.length,
        checkin_count: checkins.length,
      })
      .select("*")
      .maybeSingle();
    return inserted ?? null;
  } catch (err) {
    console.error("[to-myself] weekly generation failed", err);
    return null;
  }
}

// "To Myself": past weekly notes and milestone markers, one timeline,
// newest first. Qualitative and written by design — no streaks, no
// charts, no scores. The page never scrolls; only the list does.
export default async function ToMyselfPage() {
  if (!isSupabaseConfigured()) redirect("/");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const [{ data: profile }, { data: insightRows }, { data: reflectionDates }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase
        .from("weekly_insights")
        .select("*")
        .eq("user_id", user.id)
        .order("week_start", { ascending: false }),
      supabase
        .from("entries")
        .select("created_at")
        .eq("user_id", user.id)
        .eq("entry_type", "reflection")
        .order("created_at", { ascending: true })
        .limit(2000),
    ]);

  const gated = !gateOpen("toMyself", profile);

  let insights = insightRows ?? [];
  if (!gated) {
    const fresh = await maybeGenerateLastWeek(supabase, user, profile, insights);
    if (fresh) insights = [fresh, ...insights];
  }

  // One timeline: weekly notes stamped at their week's end, milestone
  // markers stamped on the day the Nth reflection was written.
  const dates = (reflectionDates ?? []).map((r) => r.created_at);
  const items = [
    ...insights.map((i) => ({
      kind: "week",
      at: new Date(Date.parse(`${i.week_start}T00:00:00Z`) + 6 * 86400000)
        .toISOString(),
      key: `w-${i.week_start}`,
      label: `the week of ${weekLabel(i.week_start)}`,
      body: i.content,
    })),
    ...milestonesUpTo(dates.length).map((m) => ({
      kind: "milestone",
      at: dates[m - 1],
      key: `m-${m}`,
      milestone: m,
    })),
  ].sort((a, b) => (a.at < b.at ? 1 : -1));

  return (
    <main className="min-h-dvh px-3 py-3">
      <div className="mx-auto flex h-[calc(100dvh-24px)] w-full max-w-[560px] flex-col overflow-hidden rounded-[28px] border border-parchment/10 px-5 pb-7 pt-6 sm:px-9">
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
          <p className="mt-3 font-mono text-xs text-ash">to myself</p>
        </header>

        {gated ? (
          <div className="flex min-h-0 flex-1 items-center">
            <p className="text-lg leading-relaxed">
              To Myself requires a subscription.
            </p>
          </div>
        ) : items.length === 0 ? (
          <div className="mx-auto flex min-h-0 max-w-[380px] flex-1 items-center">
            <p className="text-center text-base leading-relaxed text-ash">
              Once a week, what you wrote comes back to you as a short note —
              what kept showing up, what shifted. The first one arrives after
              a week with a few entries in it.
            </p>
          </div>
        ) : (
          <div className="mt-6 min-h-0 flex-1 overflow-y-auto">
            <ol className="flex flex-col gap-8 pb-2">
              {items.map((item) =>
                item.kind === "week" ? (
                  <li key={item.key}>
                    <p className="font-mono text-xs text-ash">{item.label}</p>
                    <p className="mt-3 whitespace-pre-wrap text-base leading-relaxed">
                      {item.body}
                    </p>
                  </li>
                ) : (
                  <li key={item.key}>
                    <Link
                      href="/milestones"
                      className="block border-l border-patina py-1 pl-4 transition-colors hover:bg-parchment/5"
                    >
                      <p className="font-mono text-xs text-ash">
                        milestone · <LocalDay iso={item.at} />
                      </p>
                      <p className="mt-1.5 text-base leading-relaxed">
                        {item.milestone} entries — your first, beside your
                        latest
                      </p>
                    </Link>
                  </li>
                ),
              )}
            </ol>
          </div>
        )}
      </div>
    </main>
  );
}
