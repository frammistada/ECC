import { createClient } from "@/lib/supabase/server";
import { buildExportText } from "@/lib/export";

// Everything the user wrote, as a plain-text download. A trust feature:
// free on every tier, no rate limit, no gate — their words are theirs.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "You are signed out." }, { status: 401 });
  }

  const { data: entries, error } = await supabase
    .from("entries")
    .select("content, created_at, responses(content), meditations(name)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[export] query failed", error);
    return Response.json(
      { error: "Something failed. Try again." },
      { status: 500 },
    );
  }

  const rows = (entries ?? []).map((e) => ({
    content: e.content,
    created_at: e.created_at,
    pageName: e.meditations?.name ?? null,
    response: e.responses?.[0]?.content ?? null,
  }));

  const today = new Date().toISOString().slice(0, 10);
  return new Response(buildExportText(rows), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="citadel-export-${today}.txt"`,
      "Cache-Control": "no-store",
    },
  });
}
