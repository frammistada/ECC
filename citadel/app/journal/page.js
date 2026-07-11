import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { isSubscribed } from "@/lib/limits";
import Journal from "@/components/journal";
import RingMark from "@/components/ring-mark";
import { ArrowLeftMark } from "@/components/icons";

export const dynamic = "force-dynamic";

// No-mentor journaling — its own room, reached only from the drawer and
// only by subscribers. One continuous log of entries written without the
// mentor: saved like any entry (they still feed pattern_summary and the
// activity log), but no Claude call is made and no reply is shown. This
// is deliberately secondary to the mentor experience — a separate place
// you choose to enter, never the default and never on the today screen.
export default async function JournalPage() {
  if (!isSupabaseConfigured()) redirect("/");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  // Paid only. The drawer link is already subscriber-gated; this guards a
  // direct visit. Free users are sent back to the mentor, not shown an
  // upsell — the core experience stays uncluttered.
  if (!isSubscribed(profile)) redirect("/");

  // The journal is one continuous room: every no-mentor entry the user has
  // written, oldest first. These belong to no meditation, so they are
  // selected by type, not by page.
  const { data: entries } = await supabase
    .from("entries")
    .select("content, created_at")
    .eq("user_id", user.id)
    .eq("entry_type", "journal")
    .order("created_at", { ascending: true });

  const exchanges = (entries ?? []).map((e) => ({
    entry: e.content,
    response: "",
    at: e.created_at,
    noMentor: true,
  }));

  return (
    <main className="min-h-dvh px-3 py-3">
      <div className="mx-auto flex h-[calc(100dvh-24px)] w-full max-w-[560px] flex-col overflow-hidden rounded-[28px] border border-parchment/10 px-5 pb-7 pt-6 sm:px-9">
        <nav className="flex items-center justify-end text-parchment/80">
          <Link href="/" aria-label="back to today" title="back to today">
            <ArrowLeftMark className="h-6 w-6" />
          </Link>
        </nav>
        <header className="mt-2 text-center">
          <RingMark className="mx-auto h-12 w-12 text-parchment/60" />
          <h1 className="mt-3 font-display text-4xl font-light tracking-[0.14em] text-parchment">
            Citadel
          </h1>
          <p className="mt-2 font-mono text-xs tracking-[0.08em] text-ash">
            no-mentor journal
          </p>
        </header>
        <div className="flex min-h-0 flex-1 flex-col">
          <Journal
            initialExchanges={exchanges}
            initialCount={exchanges.length}
            subscribed
            checkoutSuccess={false}
            hasAccountabilityContact={false}
            noMentorRoom
            startInChat
          />
        </div>
      </div>
    </main>
  );
}
