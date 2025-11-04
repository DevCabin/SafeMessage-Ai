import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getOrCreateUid } from "../../_session";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" });

export async function POST(req: NextRequest) {
  const { fingerprint } = await req.json().catch(() => ({}));
  const uid = await getOrCreateUid(fingerprint);

  // Find a customer by metadata.uid (requires you attach it when creating/subscribing)
  const customers = await stripe.customers.list({ limit: 100 }); // naive; fine for small scale
  const customer = customers.data.find(c => (c.metadata as any)?.uid === uid);

  if (!customer) return NextResponse.json({ error: "No customer found" }, { status: 404 });

  const portal = await stripe.billingPortal.sessions.create({
    customer: customer.id,
    return_url: process.env.NEXT_PUBLIC_SITE_URL!,
  });

  return NextResponse.json({ url: portal.url });
}
