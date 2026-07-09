import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { dateLine, timeLine } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  if (!isSupabaseConfigured()) redirect("/");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: entries } = await supabase
    .from("entries")
    .select("content, created_at, responses(content)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const exchanges = entries ?? [];

  return (
    <main className="mx-auto min-h-screen max-w-[640px] px-6 py-16 sm:py-24">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="font-display text-4xl font-normal tracking-[0.08em]">
            Citadel
          </h1>
          <p className="mt-3 font-mono text-xs text-ash">history</p>
        </div>
        <nav className="font-mono text-xs">
          <Link
            href="/"
            className="underline decoration-1 underline-offset-4"
          >
            today
          </Link>
        </nav>
      </header>

      <section className="mt-16">
        {exchanges.length === 0 ? (
          <p className="text-ash">Nothing written yet.</p>
        ) : (
          <ol>
            {exchanges.map((x, i) => {
              const at = new Date(x.created_at);
              return (
                <li
                  key={i}
                  className={
                    i === 0 ? undefined : "mt-12 border-t border-ash/30 pt-12"
                  }
                >
                  <p className="font-mono text-xs text-ash">
                    {dateLine(at)} — {timeLine(at)}
                  </p>
                  <p className="mt-4 whitespace-pre-wrap text-lg leading-relaxed">
                    {x.content}
                  </p>
                  {x.responses?.[0]?.content && (
                    <blockquote className="mt-8 border-l border-patina pl-5 text-lg italic leading-relaxed text-parchment/90">
                      {x.responses[0].content}
                    </blockquote>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </main>
  );
}
