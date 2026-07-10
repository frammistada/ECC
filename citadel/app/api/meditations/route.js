import { createClient } from "@/lib/supabase/server";
import { dayLine } from "@/lib/format";
import { normalizeMode } from "@/lib/meditations";

const MAX_NAME_CHARS = 80;

// Creates a standalone entry page. The day's automatic page is never
// created here — /api/reflect makes that one on first write.
export async function POST(request) {
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

  const name =
    (typeof body?.name === "string" ? body.name.trim() : "").slice(
      0,
      MAX_NAME_CHARS,
    ) || dayLine(new Date());

  const { data: created, error } = await supabase
    .from("meditations")
    .insert({
      user_id: user.id,
      name,
      mentor_mode: normalizeMode(body?.mentorMode),
    })
    .select("id")
    .single();

  if (error) {
    console.error("[meditations] create failed", error);
    return Response.json(
      { error: "The page could not be created. Try again." },
      { status: 500 },
    );
  }

  return Response.json({ id: created.id });
}
