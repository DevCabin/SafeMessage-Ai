import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getOrCreateUid } from "../../_session";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" });

export async function POST(req: NextRequest) {
  try {
    // Check required environment variables
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: "Stripe secret key not configured" }, { status: 500 });
    }
    if (!process.env.STRIPE_PRICE_ID) {
      return NextResponse.json({ error: "Stripe price ID not configured" }, { status: 500 });
    }
    if (!process.env.NEXT_PUBLIC_SITE_URL) {
      return NextResponse.json({ error: "Site URL not configured" }, { status: 500 });
    }

    const { email, fingerprint, productId, plan } = await req.json().catch(() => ({}));
    console.log('Checkout request:', { email: email ? 'provided' : 'not provided', fingerprint: fingerprint ? 'provided' : 'not provided', productId, plan });
    console.log('Environment variables:', {
      STRIPE_PRICE_ID: process.env.STRIPE_PRICE_ID ? 'set' : 'not set',
      STRIPE_ANNUAL_PRICE_ID: process.env.STRIPE_ANNUAL_PRICE_ID ? 'set' : 'not set'
    });
    const uid = await getOrCreateUid(fingerprint);

    // Determine price ID based on plan or provided productId
    let priceId = productId;
    if (!priceId) {
      if (plan === 'annual' && process.env.STRIPE_ANNUAL_PRICE_ID) {
        priceId = process.env.STRIPE_ANNUAL_PRICE_ID;
        console.log('Using annual price ID:', priceId);
      } else {
        priceId = process.env.STRIPE_PRICE_ID;
        console.log('Using monthly price ID:', priceId);
      }
    } else {
      console.log('Using provided productId:', priceId);
    }

    if (!priceId) {
      return NextResponse.json({ error: "No price ID available" }, { status: 500 });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: email || undefined,
      line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/?status=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/?status=cancel`,
    metadata: { uid },
    // For now, we'll handle premium status manually via Stripe dashboard
    // Webhooks can be added later for automatic updates
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Stripe checkout error:", error);

    // Return specific error messages
    if (error instanceof Error && 'type' in error && typeof error.type === 'string') {
      if (error.type === "StripeAuthenticationError") {
        return NextResponse.json({ error: "Invalid Stripe API key" }, { status: 500 });
      }
      if (error.type === "StripeInvalidRequestError") {
        return NextResponse.json({ error: `Invalid request: ${error.message}` }, { status: 400 });
      }
    }

    return NextResponse.json({ error: "Payment setup failed" }, { status: 500 });
  }
}
