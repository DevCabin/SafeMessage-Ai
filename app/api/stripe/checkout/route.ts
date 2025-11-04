import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getOrCreateUid } from "../../_session";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" });

export async function POST(req: NextRequest) {
  const { email, fingerprint } = await req.json().catch(() => ({}));
  const uid = await getOrCreateUid(fingerprint);

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: email || undefined,
    line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/?status=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/?status=cancel`,
    metadata: { uid },
  });

  return NextResponse.json({ url: session.url });
}
