import { NextRequest, NextResponse } from "next/server";
import { getKV } from "@/lib/kv";
import { getOrCreateUid } from "../_session";

const FREE_LIMIT = 5;

// Helper function to get user from session token
async function getUserFromSessionForUsage(request: NextRequest) {
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

  // Verify session
  const session = await kv.get(`session:${sessionToken}`) as any;
  if (!session) {
    return null;
  }

  // Get user data
  const user = await kv.get(`user:${session.google_id}`) as any;
  if (!user) {
    return null;
  }

  return { user, session };
}

export async function GET(request: NextRequest) {
  const kv = getKV();

  // Check if user is authenticated
  const authResult = await getUserFromSessionForUsage(request);

  if (authResult) {
    const { user } = authResult;
    const used = FREE_LIMIT - (user.free_uses_remaining || 0);
    const premium = user.is_premium || false;

    return NextResponse.json({
      used: Math.max(0, used),
      limit: FREE_LIMIT,
      premium,
      authenticated: true
    });
  }

  // Fallback to anonymous tracking
  const uid = await getOrCreateUid();
  const used = (await kv.get<number>(`usage:${uid}`)) || 0;
  const premium = (await kv.get<boolean>(`premium:${uid}`)) || false;

  return NextResponse.json({
    used,
    limit: FREE_LIMIT,
    premium,
    authenticated: false
  });
}

export async function POST(req: NextRequest) {
  const { fingerprint } = await req.json().catch(() => ({}));
  const kv = getKV();

  // Check if user is authenticated
  const authResult = await getUserFromSessionForUsage(req);

  if (authResult) {
    const { user } = authResult;
    const used = FREE_LIMIT - (user.free_uses_remaining || 0);
    const premium = user.is_premium || false;

    return NextResponse.json({
      used: Math.max(0, used),
      limit: FREE_LIMIT,
      premium,
      authenticated: true
    });
  }

  // Fallback to anonymous tracking
  const uid = await getOrCreateUid(fingerprint);
  const used = (await kv.get<number>(`usage:${uid}`)) || 0;
  const premium = (await kv.get<boolean>(`premium:${uid}`)) || false;

  return NextResponse.json({
    used,
    limit: FREE_LIMIT,
    premium,
    authenticated: false
  });
}
