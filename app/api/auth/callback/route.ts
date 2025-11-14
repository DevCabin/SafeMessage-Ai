import { NextRequest, NextResponse } from 'next/server';
import { OAuth2Client } from 'google-auth-library';
import { getKV } from '@/lib/kv';

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
        new URL(`/?auth_error=${error}`, request.url)
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/?auth_error=missing_code_or_state', request.url)
      );
    }

    const kv = getKV();

    // Verify state parameter for CSRF protection
    const storedState = await kv.get(`oauth_state:${state}`);
    if (!storedState) {
      return NextResponse.redirect(
        new URL('/?auth_error=invalid_state', request.url)
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
        new URL('/?auth_error=invalid_token', request.url)
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
      };
      await kv.set(`user:${googleId}`, newUser);
    }

    // Create a session token (simple JWT-like structure)
    const sessionToken = Buffer.from(JSON.stringify({
      google_id: googleId,
      email: email,
      exp: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
    })).toString('base64');

    // Store session
    await kv.set(`session:${sessionToken}`, {
      google_id: googleId,
      created_at: new Date().toISOString(),
    }, { ex: 86400 }); // 24 hours

    // Redirect back to frontend with session token
    const redirectUrl = new URL('/', request.url);
    redirectUrl.searchParams.set('auth_success', 'true');
    redirectUrl.searchParams.set('session_token', sessionToken);

    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error('Callback error:', error);
    return NextResponse.redirect(
      new URL('/?auth_error=server_error', request.url)
    );
  }
}
