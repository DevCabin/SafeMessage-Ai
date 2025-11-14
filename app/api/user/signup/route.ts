import { NextRequest, NextResponse } from 'next/server';
import { getKV } from '@/lib/kv';

// Helper function to get user from session token
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

export async function POST(request: NextRequest) {
  try {
    const authResult = await getUserFromSession(request);

    if (!authResult) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { user: authenticatedUser } = authResult;
    const { sbuid } = await request.json();

    if (!sbuid) {
      return NextResponse.json(
        { error: 'SBUID is required' },
        { status: 400 }
      );
    }

    const kv = getKV();

    // Check if anonymous user exists with this SBUID
    const existingUsage = await kv.get(`usage:${sbuid}`) as number | null;
    const existingPremium = await kv.get(`premium:${sbuid}`) as boolean | null;

    if (existingUsage !== null || existingPremium !== null) {
      // Migrate legacy data to authenticated user
      const migratedUser = {
        ...authenticatedUser,
        total_scans: existingUsage || 0,
        free_uses_remaining: existingPremium ? 999 : Math.max(0, 9 - (existingUsage || 0)), // +5 bonus after signup
        last_active: new Date().toISOString(),
      };

      // Update authenticated user with migrated data
      await kv.set(`user:${authenticatedUser.google_id}`, migratedUser);

      // Clean up legacy keys
      if (existingUsage !== null) {
        await kv.del(`usage:${sbuid}`);
      }
      if (existingPremium !== null) {
        await kv.del(`premium:${sbuid}`);
      }

      // Store mapping for future reference
      await kv.set(`sbuid:${sbuid}`, authenticatedUser.google_id);

      return NextResponse.json({
        success: true,
        message: 'Account linked successfully',
        migrated_scans: existingUsage || 0,
        bonus_uses: 5,
        user: {
          google_id: migratedUser.google_id,
          email: migratedUser.email,
          name: migratedUser.name,
          picture: migratedUser.picture,
          total_scans: migratedUser.total_scans,
          total_bombs: migratedUser.total_bombs,
          free_uses_remaining: migratedUser.free_uses_remaining,
          is_premium: migratedUser.is_premium,
        }
      });
    } else {
      // No legacy data to migrate, just return current user
      return NextResponse.json({
        success: true,
        message: 'Account already linked',
        user: {
          google_id: authenticatedUser.google_id,
          email: authenticatedUser.email,
          name: authenticatedUser.name,
          picture: authenticatedUser.picture,
          total_scans: authenticatedUser.total_scans,
          total_bombs: authenticatedUser.total_bombs,
          free_uses_remaining: authenticatedUser.free_uses_remaining,
          is_premium: authenticatedUser.is_premium,
        }
      });
    }
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
