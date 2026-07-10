import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { isSubscribed } from "@/lib/limits";
import { LocalDate } from "@/components/local-date";
import Journal from "@/components/journal";
import RingMark from "@/components/ring-mark";
import { BookMark, GearMark } from "@/components/icons";

export const dynamic = "force-dynamic";

function Landing({ configured }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[560px] flex-col px-4 pb-7 pt-7">
      <p className="text-center font-mono text-[11px] uppercase tracking-[0.35em] text-ash">
        <LocalDate variant="short" />
      </p>
      <section className="mt-6 flex flex-1 flex-col items-center justify-center rounded-[28px] border border-parchment/10 bg-panel px-10">
        <p className="max-w-[250px] text-center text-lg leading-relaxed text-ash">
          A private place to write, each evening, about what tested you.
        </p>
        <h1 className="mt-5 font-display text-5xl font-light tracking-[0.16em] text-parchment">
          Citadel
        </h1>
        <RingMark className="mt-9 h-44 w-44 text-parchment/60" />
      </section>
      <div className="mt-7 flex justify-center">
        {configured ? (
          <Link
            href="/signin"
            className="rounded-full bg-cream px-16 py-4 text-lg tracking-wide text-ink"
          >
            Enter
          </Link>
        ) : (
          <p className="font-mono text-xs text-ash">
            supabase is not configured — see the readme
          </p>
        )}
      </div>
    </main>
  );
}

export default async function Home({ searchParams }) {
  if (!isSupabaseConfigured()) return <Landing configured={false} />;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <Landing configured />;

  const params = await searchParams;

  const today = new Date().toISOString().slice(0, 10);
  const [{ data: profile }, { count: entryCount }, { data: todayMed }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase
        .from("entries")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id),
      supabase
        .from("meditations")
        .select("id")
        .eq("user_id", user.id)
        .eq("auto_day", today)
        .maybeSingle(),
    ]);

  // Today's writing lives on the day's automatic page (created by the
  // first reflect of the day, so it may not exist yet).
  const { data: todays } = todayMed
    ? await supabase
        .from("entries")
        .select("content, created_at, responses(content)")
        .eq("meditation_id", todayMed.id)
        .order("created_at", { ascending: true })
    : { data: [] };

  // First-run: send new users through onboarding before their first entry.
  // Guarded on an explicit `false` so a pre-migration profile (field
  // undefined) falls through to the journal rather than looping.
  if (profile && profile.onboarded === false) {
    redirect("/onboarding");
  }

  const exchanges = (todays ?? []).map((e) => ({
    entry: e.content,
    response: e.responses?.[0]?.content ?? "",
    at: e.created_at,
  }));

  return (
    <main className="min-h-dvh px-3 py-3">
      <div className="mx-auto flex h-[calc(100dvh-24px)] w-full max-w-[560px] flex-col overflow-hidden rounded-[28px] border border-parchment/10 px-5 pb-7 pt-6 sm:px-9">
        <nav className="flex items-center justify-end gap-6 text-parchment/80">
          <Link
            href="/meditations"
            aria-label="meditations"
            title="meditations"
          >
            <BookMark className="h-6 w-6" />
          </Link>
          <Link href="/settings" aria-label="settings" title="settings">
            <GearMark className="h-6 w-6" />
          </Link>
        </nav>
        <div className="flex min-h-0 flex-1 flex-col justify-center">
        <header className="mt-4 text-center">
          <RingMark className="mx-auto h-14 w-14 text-parchment/60" />
          <h1 className="mt-4 font-display text-4xl font-light tracking-[0.14em] text-parchment">
            Citadel
          </h1>
          <p className="mt-2 font-mono text-xs tracking-[0.08em] text-ash">
            <LocalDate />
          </p>
        </header>
          <Journal
            initialExchanges={exchanges}
            initialCount={entryCount ?? 0}
            subscribed={isSubscribed(profile)}
            checkoutSuccess={params?.checkout === "success"}
            hasAccountabilityContact={Boolean(profile?.accountability_email)}
          />
        </div>
      </div>
    </main>
  );
}
