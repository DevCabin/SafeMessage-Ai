import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getOrCreateUid } from "../../_session";
import { getKV } from "@/lib/kv";
import { verifyJWT, isLegacyToken, verifyLegacyToken } from "@/lib/jwt";

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

    const kv = getKV();
    const uid = await getOrCreateUid(fingerprint);

    // Check if user is authenticated
    const authHeader = req.headers.get('authorization');
    let sessionToken = null;
    let userKey = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      sessionToken = authHeader.substring(7);

      let payload = null;

      // Try to verify as JWT first
      try {
        payload = await verifyJWT(sessionToken);
      } catch (error) {
        // If JWT verification fails, try legacy token
        if (isLegacyToken(sessionToken)) {
          payload = verifyLegacyToken(sessionToken);
          if (!payload) {
            // Invalid/expired legacy token, treat as unauthenticated
            sessionToken = null;
          }
        } else {
          // Neither JWT nor legacy token, treat as unauthenticated
          sessionToken = null;
        }
      }

      if (payload) {
        // Verify session exists in KV (for JWT tokens, we store by google_id)
        const sessionKey = `session:${payload.google_id}`;
        const session = await kv.get(sessionKey) as any;
        if (session) {
          userKey = `user:${payload.google_id}`;
        }
      }
    }

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

    // Create checkout session
    const sessionConfig: Stripe.Checkout.SessionCreateParams = {
      mode: "subscription",
      customer_email: email || undefined,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/?status=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/?status=cancel`,
      metadata: { uid },
    };

    // If user is authenticated, add their user key to metadata for webhook processing
    if (userKey) {
      sessionConfig.metadata = { ...sessionConfig.metadata, user_key: userKey };
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);

    // If user is authenticated, store a temporary mapping for webhook processing
    if (userKey && session.customer) {
      await kv.set(`temp_customer:${session.customer}`, userKey, { ex: 3600 }); // 1 hour expiry
    }

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
