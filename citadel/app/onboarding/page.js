import { redirect } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import OnboardingForm from "@/components/onboarding-form";

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
    <main className="mx-auto min-h-screen max-w-[640px] px-6 py-16 sm:py-24">
      <header>
        <h1 className="font-display text-4xl font-normal tracking-[0.08em]">
          Citadel
        </h1>
        <p className="mt-3 font-mono text-xs text-ash">before you begin</p>
      </header>
      <section className="mt-16">
        <OnboardingForm />
      </section>
    </main>
  );
}
