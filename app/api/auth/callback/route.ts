import { NextRequest, NextResponse } from 'next/server';
import { OAuth2Client } from 'google-auth-library';
import { getKV } from '@/lib/kv';
import { signJWT } from '@/lib/jwt';

const oauth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/callback`
);

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Handle OAuth errors
    if (error) {
      console.error('OAuth error:', error);
      return NextResponse.redirect(
        new URL(`/?auth_error=${error}`, process.env.FRONTEND_URL || 'http://localhost:3001')
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/?auth_error=missing_code_or_state', process.env.FRONTEND_URL || 'http://localhost:3001')
      );
    }

    const kv = getKV();

    // Verify state parameter for CSRF protection
    const storedState = await kv.get(`oauth_state:${state}`);
    if (!storedState) {
      return NextResponse.redirect(
        new URL('/?auth_error=invalid_state', process.env.FRONTEND_URL || 'http://localhost:3001')
      );
    }

    // Clean up the used state
    await kv.del(`oauth_state:${state}`);

    // Exchange authorization code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user info from Google
    const ticket = await oauth2Client.verifyIdToken({
      idToken: tokens.id_token!,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      return NextResponse.redirect(
        new URL('/?auth_error=invalid_token', process.env.FRONTEND_URL || 'http://localhost:3001')
      );
    }

    const { sub: googleId, email, name, picture } = payload;

    // Check if user already exists
    const existingUser = await kv.get(`user:${googleId}`);

    if (existingUser) {
      // Update last active time
      await kv.set(`user:${googleId}`, {
        ...existingUser,
        last_active: new Date().toISOString(),
      });
    } else {
      // Create new user record
      const newUser = {
        google_id: googleId,
        email: email || null,
        name: name || null,
        picture: picture || null,
        total_scans: 0,
        total_bombs: 0,
        free_uses_remaining: 5,
        created_at: new Date().toISOString(),
        last_active: new Date().toISOString(),
        is_premium: false,
        // Payment tracking fields
        stripe_customer_id: null,
        stripe_subscription_id: null,
        subscription_plan: null, // 'monthly' | 'annual' | null
        subscription_status: null, // 'active' | 'canceled' | 'past_due' | 'incomplete' | 'unpaid' | null
        subscription_current_period_end: null,
        subscription_cancel_at_period_end: false,
        payment_history: [], // Array of payment objects
        lifetime_value: 0, // Total amount paid in cents
      };
      await kv.set(`user:${googleId}`, newUser);
    }

    // Store email -> google_id mapping for Stripe webhook lookups
    if (email) {
      await kv.set(`email:${email}`, googleId);
    }

    // Create a secure JWT session token
    const sessionToken = await signJWT({
      google_id: googleId,
      email: email || undefined,
    });

    // Store session metadata (for logout/invalidation if needed)
    await kv.set(`session:${googleId}`, {
      token_jti: 'current', // Could be enhanced with JWT ID for invalidation
      created_at: new Date().toISOString(),
    }, { ex: 86400 }); // 24 hours

    // Redirect back to frontend with session token
    const redirectUrl = new URL('/', process.env.FRONTEND_URL || 'http://localhost:3001');
    redirectUrl.searchParams.set('auth_success', 'true');
    redirectUrl.searchParams.set('session_token', sessionToken);

    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error('Callback error:', error);
    return NextResponse.redirect(
      new URL('/?auth_error=server_error', process.env.FRONTEND_URL || 'http://localhost:3001')
    );
  }
}
