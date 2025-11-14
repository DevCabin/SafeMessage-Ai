import { NextRequest, NextResponse } from 'next/server';
import { OAuth2Client } from 'google-auth-library';
import { v4 as uuidv4 } from 'uuid';
import { getKV } from '@/lib/kv';

const oauth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/callback`
);

export async function POST(request: NextRequest) {
  try {
    const kv = getKV();

    // Generate a state parameter for CSRF protection
    const state = uuidv4();

    // Store state in KV with expiration (5 minutes)
    await kv.set(`oauth_state:${state}`, { createdAt: Date.now() }, { ex: 300 });

    // Generate the authorization URL
    const authorizeUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['openid', 'email', 'profile'],
      state: state,
      prompt: 'consent', // Force consent screen to get refresh token
    });

    return NextResponse.json({ url: authorizeUrl });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate authorization URL' },
      { status: 500 }
    );
  }
}
