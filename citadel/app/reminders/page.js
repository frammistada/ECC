import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { isSubscribed } from "@/lib/limits";
import RingMark from "@/components/ring-mark";
import { ArrowLeftMark } from "@/components/icons";
import RemindersForm from "@/components/reminders-form";

export const dynamic = "force-dynamic";

// The Reminders room, reached from the drawer and only by subscribers (a
// direct visit by a non-subscriber redirects to /). Three paid reminder
// types — reflection, goal, quote — sharing the same push infrastructure.
// This is a scrolling settings-style page, not a fixed primary screen.
export default async function RemindersPage() {
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
  if (!isSubscribed(profile)) redirect("/");

  return (
    <main className="mx-auto min-h-screen max-w-[640px] px-6 py-16 sm:py-24">
      <header className="flex items-baseline justify-between">
        <div>
          <div className="flex items-center gap-3">
            <RingMark className="h-10 w-10 shrink-0 text-parchment/60" />
            <h1 className="font-display text-4xl font-normal tracking-[0.08em]">
              Citadel
            </h1>
          </div>
          <p className="mt-3 font-mono text-xs text-ash">reminders</p>
        </div>
        <nav className="flex items-center gap-5 text-parchment/80">
          <Link href="/" aria-label="back to today" title="back to today">
            <ArrowLeftMark className="h-6 w-6" />
          </Link>
        </nav>
      </header>

      <section className="mt-16">
        <RemindersForm
          initialReflectionEnabled={profile?.reminder_enabled}
          initialReflectionTime={profile?.reminder_time}
          initialGoalEnabled={profile?.goal_reminder_enabled}
          initialGoalTime={profile?.goal_reminder_time}
          initialQuoteEnabled={profile?.quote_reminder_enabled}
          initialQuoteCount={profile?.quote_reminder_count}
          hasAim={Boolean((profile?.aim || "").trim())}
          vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ""}
        />
      </section>
    </main>
  );
}
