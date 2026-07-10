import { createClient } from "@/lib/supabase/server";

// Dismiss an open loop — v1 resolution is manual. RLS restricts the
// update to the caller's own rows.
export async function PATCH(request, { params }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "You are signed out." }, { status: 401 });
  }

  const { id } = await params;
  const { data, error } = await supabase
    .from("open_loops")
    .update({ resolved: true, resolved_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[loops] resolve failed", error);
    return Response.json(
      { error: "Something failed. Try again." },
      { status: 500 },
    );
  }
  if (!data) {
    return Response.json({ error: "That thread is gone." }, { status: 404 });
  }

  return Response.json({ ok: true });
}
