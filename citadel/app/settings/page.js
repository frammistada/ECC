import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import RingMark from "@/components/ring-mark";
import { ArrowLeftMark, SignOutMark } from "@/components/icons";
import { isEmailConfigured } from "@/lib/email";
import SettingsForm from "@/components/settings-form";
import OpenLoops from "@/components/open-loops";
import AccountDangerZone from "@/components/account-danger-zone";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  if (!isSupabaseConfigured()) redirect("/");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const [{ data: profile }, { data: loops }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("open_loops")
      .select("id, description, created_at")
      .eq("user_id", user.id)
      .eq("resolved", false)
      .order("created_at", { ascending: false }),
  ]);

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
          <p className="mt-3 font-mono text-xs text-ash">settings</p>
        </div>
        <nav className="flex items-center gap-5 text-parchment/80">
          <Link href="/" aria-label="back to today" title="back to today">
            <ArrowLeftMark className="h-6 w-6" />
          </Link>
          <form action="/api/signout" method="post" className="flex">
            <button type="submit" aria-label="sign out" title="sign out">
              <SignOutMark className="h-6 w-6" />
            </button>
          </form>
        </nav>
      </header>

      <section className="mt-16">
        <SettingsForm
          initialMode={profile?.mentor_mode}
          initialName={profile?.preferred_name}
          initialContactName={profile?.accountability_name}
          initialContactEmail={profile?.accountability_email}
          emailConfigured={isEmailConfigured()}
        />
        <OpenLoops initialLoops={loops ?? []} />
        <AccountDangerZone />
      </section>
    </main>
  );
}
