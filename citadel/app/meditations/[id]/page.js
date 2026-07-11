import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { isSubscribed } from "@/lib/limits";
import { LocalDay } from "@/components/local-date";
import Journal from "@/components/journal";
import { ArrowLeftMark } from "@/components/icons";

export const dynamic = "force-dynamic";

// One entry page: its full chat history plus the entry box, writing into
// this page with its own mentor mode.
export default async function MeditationPage({ params }) {
  if (!isSupabaseConfigured()) redirect("/");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { id } = await params;
  const [{ data: meditation }, { data: profile }, { count: entryCount }] =
    await Promise.all([
      supabase.from("meditations").select("*").eq("id", id).maybeSingle(),
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase
        .from("entries")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id),
    ]);
  if (!meditation) redirect("/meditations");

  const { data: entries } = await supabase
    .from("entries")
    .select("content, created_at, entry_type, responses(content)")
    .eq("meditation_id", meditation.id)
    .order("created_at", { ascending: true });

  const exchanges = (entries ?? []).map((e) => ({
    entry: e.content,
    response: e.responses?.[0]?.content ?? "",
    at: e.created_at,
    noMentor: e.entry_type === "journal",
  }));

  return (
    <main className="min-h-dvh px-3 py-3">
      <div className="mx-auto flex h-[calc(100dvh-24px)] w-full max-w-[560px] flex-col overflow-hidden rounded-[28px] border border-parchment/10 px-5 pb-7 pt-6 sm:px-9">
        <nav className="flex items-center justify-end text-parchment/80">
          <Link href="/meditations" aria-label="meditations" title="meditations">
            <ArrowLeftMark className="h-6 w-6" />
          </Link>
        </nav>
        <header className="mt-2 text-center">
          <h1 className="mx-auto max-w-full truncate font-display text-3xl font-light tracking-[0.06em] text-parchment">
            {meditation.name}
          </h1>
          <p className="mt-2 font-mono text-xs tracking-[0.08em] text-ash">
            <LocalDay iso={meditation.created_at} />
            {meditation.mentor_mode ? ` · ${meditation.mentor_mode}` : ""}
          </p>
        </header>
        <div className="flex min-h-0 flex-1 flex-col">
          <Journal
            initialExchanges={exchanges}
            initialCount={entryCount ?? 0}
            subscribed={isSubscribed(profile)}
            checkoutSuccess={false}
            hasAccountabilityContact={Boolean(profile?.accountability_email)}
            meditationId={meditation.id}
            startInChat
          />
        </div>
      </div>
    </main>
  );
}
