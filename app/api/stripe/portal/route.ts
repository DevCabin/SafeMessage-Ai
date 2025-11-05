import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getOrCreateUid } from "../../_session";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" });

export async function POST(req: NextRequest) {
  // For now, without webhooks, we'll provide a simple message
  // In production, you'd look up the customer via stored metadata
  return NextResponse.json({
    error: "Billing management coming soon. For now, manage subscriptions directly in Stripe.",
    stripeDashboard: "https://dashboard.stripe.com"
  }, { status: 501 });
}
