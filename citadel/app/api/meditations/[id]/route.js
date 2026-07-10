import { createClient } from "@/lib/supabase/server";
import { normalizeMode } from "@/lib/meditations";

const MAX_NAME_CHARS = 80;

// Rename a page or change its mentor mode. RLS restricts the update to the
// caller's own rows, so a foreign id simply matches nothing.
export async function PATCH(request, { params }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "You are signed out." }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const { id } = await params;
  const patch = {};
  if (typeof body?.name === "string" && body.name.trim()) {
    patch.name = body.name.trim().slice(0, MAX_NAME_CHARS);
  }
  if (body?.mentorMode !== undefined) {
    patch.mentor_mode = normalizeMode(body.mentorMode);
  }
  if (Object.keys(patch).length === 0) {
    return Response.json({ error: "Nothing to change." }, { status: 400 });
  }

  const { data: updated, error } = await supabase
    .from("meditations")
    .update(patch)
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error || !updated) {
    if (error) console.error("[meditations] update failed", error);
    return Response.json(
      { error: "The page could not be updated." },
      { status: error ? 500 : 404 },
    );
  }
  return Response.json({ ok: true });
}

// Deleting a page cascades to its entries and responses. The client shows
// a confirmation before calling this.
export async function DELETE(request, { params }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "You are signed out." }, { status: 401 });
  }

  const { id } = await params;
  const { data: deleted, error } = await supabase
    .from("meditations")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error || !deleted) {
    if (error) console.error("[meditations] delete failed", error);
    return Response.json(
      { error: "The page could not be deleted." },
      { status: error ? 500 : 404 },
    );
  }
  return Response.json({ ok: true });
}
