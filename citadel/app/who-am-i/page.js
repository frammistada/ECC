import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import RingMark from "@/components/ring-mark";
import { ArrowLeftMark } from "@/components/icons";
import WhoForm from "@/components/who-form";

export const dynamic = "force-dynamic";

// Static background the mentor reads on every entry. Not a journal page —
// nothing here is summarized or machine-written; it changes only when the
// user edits it. Free tier: no subscription gate.
export default async function WhoAmIPage() {
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
          <p className="mt-3 font-mono text-xs text-ash">who am i</p>
        </div>
        <nav className="flex items-center gap-5 text-parchment/80">
          <Link href="/" aria-label="back to today" title="back to today">
            <ArrowLeftMark className="h-6 w-6" />
          </Link>
        </nav>
      </header>

      <section className="mt-16">
        <p className="text-sm leading-relaxed text-ash">
          Background the mentor keeps in mind when it reads you. Not a journal
          entry — it stays exactly as you wrote it until you change it. All of
          it is optional.
        </p>
        <WhoForm
          initialName={profile?.preferred_name}
          initialAge={profile?.age}
          initialAim={profile?.aim}
          initialNote={profile?.about_note}
        />
      </section>
    </main>
  );
}
