import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Deletes the signed-in user's account and everything in it. Every table
// (entries, responses, meditations, open_loops, weekly_insights,
// user_activity_log, push_subscriptions) references profiles.id with
// "on delete cascade", and profiles.id references auth.users(id) the same
// way — so deleting the auth user cascades through all of it. Irreversible;
// the client requires a typed confirmation before calling this.
export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "You are signed out." }, { status: 401 });
  }

  const admin = createAdminClient();

  // Best-effort: stop billing before the row disappears. Never block the
  // deletion on Stripe — an account should always be deletable.
  if (process.env.STRIPE_SECRET_KEY) {
    const { data: profile } = await admin
      .from("profiles")
      .select("stripe_subscription_id")
      .eq("id", user.id)
      .single();
    if (profile?.stripe_subscription_id) {
      try {
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
        await stripe.subscriptions.cancel(profile.stripe_subscription_id);
      } catch (err) {
        console.error("[account] stripe cancel failed", err);
      }
    }
  }

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    console.error("[account] delete failed", error);
    return Response.json(
      { error: "Something failed. Try again." },
      { status: 500 },
    );
  }

  return Response.json({ ok: true });
}
