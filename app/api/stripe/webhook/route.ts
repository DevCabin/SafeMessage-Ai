import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getKV } from '@/lib/kv';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const sig = request.headers.get('stripe-signature')!;

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
    } catch (err: any) {
      console.error(`Webhook signature verification failed.`, err.message);
      return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 });
    }

    const kv = getKV();

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log('💳 Checkout session completed:', session.id);

        const customerId = session.customer as string;
        const customerEmail = session.customer_details?.email;

        // Try to find user by customer mapping first
        let userKey = await kv.get(`customer:${customerId}`) as string;

        if (!userKey) {
          // Check temporary mapping from checkout
          userKey = await kv.get(`temp_customer:${customerId}`) as string;
        }

        if (!userKey && customerEmail) {
          // Fallback: lookup user by email mapping
          console.log('No customer mapping found, looking up user by email...');
          const googleId = await kv.get(`email:${customerEmail}`) as string;
          if (googleId) {
            userKey = `user:${googleId}`;
            // Store the mapping for future use
            await kv.set(`customer:${customerId}`, userKey);
            console.log('Found user by email lookup, stored customer mapping');
          }
        }

        if (!userKey) {
          console.error('User lookup failed - no mapping available and email search failed');
          break;
        }

        const user = await kv.get(userKey) as any;
        if (!user) {
          console.error('User not found for key:', userKey);
          break;
        }

        // Update user with Stripe customer ID and customer details
        user.stripe_customer_id = customerId;

        // Update user info from Stripe if more complete than what we have
        if (customerEmail && (!user.email || user.email !== customerEmail)) {
          user.email = customerEmail;
          console.log('Updated user email from Stripe:', customerEmail);
        }

        if (session.customer_details?.name && (!user.name || user.name !== session.customer_details.name)) {
          user.name = session.customer_details.name;
          console.log('Updated user name from Stripe:', session.customer_details.name);
        }

        // Determine plan type from session metadata or line items
        const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
        let planType = 'monthly'; // default

        if (lineItems.data.length > 0) {
          const priceId = lineItems.data[0].price?.id;
          // Check if it's the annual plan
          if (priceId && priceId.includes('annual')) {
            planType = 'annual';
          }
        }

        user.subscription_plan = planType;
        user.is_premium = true;
        user.subscription_status = 'active';

        // Add to payment history
        const paymentRecord = {
          type: 'subscription_created',
          stripe_session_id: session.id,
          amount: session.amount_total,
          currency: session.currency,
          plan_type: planType,
          timestamp: new Date().toISOString(),
        };

        user.payment_history = user.payment_history || [];
        user.payment_history.push(paymentRecord);
        user.lifetime_value = (user.lifetime_value || 0) + (session.amount_total || 0);

        await kv.set(userKey, user);
        console.log('✅ User subscription activated:', user.email || customerEmail, planType);

        // Clean up temporary mapping
        await kv.del(`temp_customer:${customerId}`);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        console.log('💰 Invoice payment succeeded:', invoice.id, 'Customer:', invoice.customer);

        // TODO: Implement user lookup when we have proper indexing
        // For now, just log the event
        console.log('Invoice payment recorded (user lookup TBD):', {
          invoice_id: invoice.id,
          customer_id: invoice.customer,
          amount: invoice.amount_paid,
          currency: invoice.currency
        });
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        console.log('🔄 Subscription updated:', subscription.id, 'Customer:', subscription.customer);

        // TODO: Implement user lookup when we have proper indexing
        console.log('Subscription update recorded (user lookup TBD):', {
          subscription_id: subscription.id,
          customer_id: subscription.customer,
          status: subscription.status,
          current_period_end: subscription.current_period_end
        });
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        console.log('❌ Subscription canceled:', subscription.id, 'Customer:', subscription.customer);

        // TODO: Implement user lookup when we have proper indexing
        console.log('Subscription cancellation recorded (user lookup TBD):', {
          subscription_id: subscription.id,
          customer_id: subscription.customer
        });
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        console.log('❌ Invoice payment failed:', invoice.id, 'Customer:', invoice.customer);

        // TODO: Implement user lookup when we have proper indexing
        console.log('Payment failure recorded (user lookup TBD):', {
          invoice_id: invoice.id,
          customer_id: invoice.customer,
          amount_due: invoice.amount_due
        });
        break;
      }

      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}
