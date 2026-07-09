import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
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
          <h1 className="font-display text-4xl font-normal tracking-[0.08em]">
            Citadel
          </h1>
          <p className="mt-3 font-mono text-xs text-ash">settings</p>
        </div>
        <nav className="font-mono text-xs">
          <Link
            href="/"
            className="text-patina underline decoration-1 underline-offset-4"
          >
            today
          </Link>
        </nav>
      </header>

      <section className="mt-16">
        <SettingsForm
          initialMode={profile?.mentor_mode}
          initialName={profile?.preferred_name}
        />
      </section>
    </main>
  );
}
