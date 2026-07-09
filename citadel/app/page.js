import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { isSubscribed } from "@/lib/limits";
import { LocalDate } from "@/components/local-date";
import Journal from "@/components/journal";
import RingMark from "@/components/ring-mark";

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

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [{ data: profile }, { count: entryCount }, { data: todays }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase
        .from("entries")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id),
      supabase
        .from("entries")
        .select("content, created_at, responses(content)")
        .eq("user_id", user.id)
        .gte("created_at", startOfDay.toISOString())
        .order("created_at", { ascending: true }),
    ]);

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
      <div className="mx-auto flex min-h-[calc(100dvh-24px)] w-full max-w-[560px] flex-col rounded-[28px] border border-parchment/10 px-5 pb-12 pt-7 sm:px-9">
        <nav className="flex items-baseline justify-end gap-6 font-mono text-sm text-parchment">
          <Link
            href="/history"
            className="underline decoration-1 underline-offset-4"
          >
            history
          </Link>
          <Link href="/settings">settings</Link>
        </nav>
        <header className="mt-6 text-center">
          <RingMark className="mx-auto h-[70px] w-[70px] text-parchment/60" />
          <h1 className="mt-5 font-display text-4xl font-light tracking-[0.14em] text-parchment">
            Citadel
          </h1>
          <p className="mt-3 font-mono text-sm tracking-[0.08em] text-ash">
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
    </main>
  );
}
