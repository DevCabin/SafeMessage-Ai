import { NextRequest, NextResponse } from 'next/server';
import { getKV } from '@/lib/kv';
import { verifyJWT, isLegacyToken, verifyLegacyToken } from '@/lib/jwt';

// Helper function to get user from session token (supports both JWT and legacy tokens)
async function getUserFromSession(request: NextRequest) {
  const kv = getKV();

  // Try to get session token from Authorization header first
  const authHeader = request.headers.get('authorization');
  let sessionToken = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    sessionToken = authHeader.substring(7);
  } else {
    // Fallback to cookie or query parameter
    const cookieToken = request.cookies.get('session_token')?.value;
    const queryToken = request.nextUrl.searchParams.get('session_token');
    sessionToken = cookieToken || queryToken;
  }

  if (!sessionToken) {
    return null;
  }

  let payload = null;

  // Try to verify as JWT first
  try {
    payload = await verifyJWT(sessionToken);
  } catch (error) {
    // If JWT verification fails, try legacy token
    if (isLegacyToken(sessionToken)) {
      payload = verifyLegacyToken(sessionToken);
      if (!payload) {
        return null; // Legacy token expired or invalid
      }
    } else {
      return null; // Neither JWT nor legacy token
    }
  }

  // Verify session exists in KV (for JWT tokens, we store by google_id)
  const sessionKey = `session:${payload.google_id}`;
  const session = await kv.get(sessionKey) as any;
  if (!session) {
    return null;
  }

  // Get user data
  const user = await kv.get(`user:${payload.google_id}`) as any;
  if (!user) {
    return null;
  }

  return { user, session, payload };
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await getUserFromSession(request);

    if (!authResult) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { user } = authResult;

    // Calculate safety score
    const totalActions = user.total_scans + user.total_bombs;
    const safetyScore = totalActions > 0
      ? Math.round((user.total_scans / totalActions) * 100)
      : 0;

    // Return user profile
    return NextResponse.json({
      google_id: user.google_id,
      email: user.email,
      name: user.name,
      picture: user.picture,
      total_scans: user.total_scans,
      total_bombs: user.total_bombs,
      free_uses_remaining: user.free_uses_remaining,
      safety_score: safetyScore,
      is_premium: user.is_premium,
      created_at: user.created_at,
      last_active: user.last_active,
    });
  } catch (error) {
    console.error('Profile error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
