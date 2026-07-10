import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import RingMark from "@/components/ring-mark";
import { isEmailConfigured } from "@/lib/email";
import SettingsForm from "@/components/settings-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
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
          <p className="mt-3 font-mono text-xs text-ash">settings</p>
        </div>
        <nav className="flex items-baseline gap-5 font-mono text-xs">
          <Link href="/" className="underline decoration-1 underline-offset-4">
            today
          </Link>
          <form action="/api/signout" method="post">
            <button type="submit" className="text-ash">
              sign out
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
      </section>
    </main>
  );
}
