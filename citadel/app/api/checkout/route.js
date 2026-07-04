import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "You are signed out." }, { status: 401 });
  }

  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_PRICE_ID) {
    console.error("[checkout] Stripe env vars missing");
    return Response.json(
      { error: "Subscriptions are not configured yet." },
      { status: 503 },
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .single();

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      client_reference_id: user.id,
      ...(profile?.stripe_customer_id
        ? { customer: profile.stripe_customer_id }
        : { customer_email: user.email }),
      success_url: `${appUrl}/?checkout=success`,
      cancel_url: `${appUrl}/`,
    });
    return Response.json({ url: session.url });
  } catch (err) {
    console.error("[checkout] stripe error", err);
    return Response.json(
      { error: "The subscription page could not be opened. Try again." },
      { status: 502 },
    );
  }
}
