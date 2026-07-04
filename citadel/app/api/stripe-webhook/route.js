import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";

// Stripe signs the raw body; this route must not run through middleware
// (excluded in middleware.js matcher) and must read the body as text.
export async function POST(request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!process.env.STRIPE_SECRET_KEY || !secret) {
    return new Response("Stripe not configured", { status: 503 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const signature = request.headers.get("stripe-signature");
  const payload = await request.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, secret);
  } catch (err) {
    console.error("[stripe-webhook] bad signature", err.message);
    return new Response("Invalid signature", { status: 400 });
  }

  const supabase = createAdminClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const userId = session.client_reference_id;
      if (!userId) break;
      const { error } = await supabase
        .from("profiles")
        .update({
          subscription_status: "active",
          stripe_customer_id: session.customer,
          stripe_subscription_id: session.subscription,
        })
        .eq("id", userId);
      if (error) console.error("[stripe-webhook] activate failed", error);
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object;
      const status =
        sub.status === "active" || sub.status === "trialing"
          ? "active"
          : sub.status;
      const { error } = await supabase
        .from("profiles")
        .update({ subscription_status: status })
        .eq("stripe_customer_id", sub.customer);
      if (error) console.error("[stripe-webhook] update failed", error);
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object;
      const { error } = await supabase
        .from("profiles")
        .update({ subscription_status: "canceled" })
        .eq("stripe_customer_id", sub.customer);
      if (error) console.error("[stripe-webhook] cancel failed", error);
      break;
    }

    default:
      break;
  }

  return new Response("ok", { status: 200 });
}
