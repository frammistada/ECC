import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { isSubscribed } from "@/lib/limits";
import { dateLine } from "@/lib/format";
import Journal from "@/components/journal";

export const dynamic = "force-dynamic";

function Header({ nav }) {
  return (
    <header className="flex items-baseline justify-between">
      <div>
        <h1 className="font-display text-4xl font-normal tracking-[0.08em]">
          Citadel
        </h1>
        <p className="mt-3 font-mono text-xs text-ash">
          {dateLine(new Date())}
        </p>
      </div>
      {nav}
    </header>
  );
}

function Landing({ configured }) {
  return (
    <main className="mx-auto min-h-screen max-w-[640px] px-6 py-16 sm:py-24">
      <Header />
      <section className="mt-16">
        <p className="text-lg leading-relaxed">
          A private place to write, each evening, about what tested you. A
          mentor reads it and answers with a question, not a compliment. It
          remembers what you wrote before, and holds you to it.
        </p>
        {configured ? (
          <Link
            href="/signin"
            className="mt-10 inline-block font-mono text-sm tracking-wide text-patina underline decoration-1 underline-offset-4"
          >
            Enter
          </Link>
        ) : (
          <p className="mt-10 font-mono text-xs text-ash">
            supabase is not configured — see the readme
          </p>
        )}
      </section>
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

  const nav = (
    <nav className="flex items-baseline gap-5 font-mono text-xs">
      <Link
        href="/history"
        className="text-patina underline decoration-1 underline-offset-4"
      >
        history
      </Link>
      <Link
        href="/settings"
        className="text-patina underline decoration-1 underline-offset-4"
      >
        settings
      </Link>
      <form action="/api/signout" method="post">
        <button type="submit" className="text-ash">
          sign out
        </button>
      </form>
    </nav>
  );

  return (
    <main className="mx-auto min-h-screen max-w-[640px] px-6 py-16 sm:py-24">
      <Header nav={nav} />
      <Journal
        initialExchanges={exchanges}
        initialCount={entryCount ?? 0}
        subscribed={isSubscribed(profile)}
        checkoutSuccess={params?.checkout === "success"}
      />
    </main>
  );
}
