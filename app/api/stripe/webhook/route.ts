import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getKV } from "@/lib/kv";

export const runtime = "nodejs"; // webhooks need Node runtime

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" });

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const sig = req.headers.get("stripe-signature")!;
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  const kv = getKV();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const uid = (session.metadata as any)?.uid;
      if (uid) {
        // Mark premium and attach uid to customer for portal
        await kv.set(`premium:${uid}`, true);
        if (session.customer) {
          const customerId = typeof session.customer === "string" ? session.customer : session.customer.id;
          await stripe.customers.update(customerId, { metadata: { uid } });
          await kv.set(`stripeCustomerFor:${uid}`, customerId);
          await kv.set(`uidFor:${customerId}`, uid);
        }
      }
      break;
    }
    case "customer.subscription.deleted":
    case "customer.subscription.paused": {
      // Find uid for this customer and revoke premium
      const sub = event.data.object as Stripe.Subscription;
      const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
      // Reverse lookup via KV we saved earlier
      // (In production: also store customer->uid mapping at checkout)
      // We'll scan a small set by reading kv.get with known keys if you persist them.
      // For simplicity assume you stored mapping:
      // kv.set(`uidFor:${customerId}`, uid) and kv.set(`stripeCustomerFor:${uid}`, customerId)
      // Try both directions:
      let uid = await kv.get<string>(`uidFor:${customerId}`);
      if (!uid) {
        // attempt reverse search (not efficient, but ok for MVP if not available)
        // skip expensive search; just no-op if unknown
        break;
      }
      await kv.set(`premium:${uid}`, false);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
