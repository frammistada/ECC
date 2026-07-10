import { redirect } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import OnboardingForm from "@/components/onboarding-form";
import RingMark from "@/components/ring-mark";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  if (!isSupabaseConfigured()) redirect("/");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  // Already onboarded? Don't make them do it twice.
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (profile?.onboarded) redirect("/");

  return (
    <main className="mx-auto flex min-h-dvh max-w-[640px] flex-col px-6 pb-6 pt-6">
      <header>
        <div className="flex items-center gap-3">
          <RingMark className="h-10 w-10 shrink-0 text-parchment/60" />
          <h1 className="font-display text-4xl font-normal tracking-[0.08em]">
            Citadel
          </h1>
        </div>
        <p className="mt-3 font-mono text-xs text-ash">before you begin</p>
      </header>
      <section className="flex flex-1 flex-col justify-center py-3">
        <OnboardingForm />
      </section>
    </main>
  );
}
