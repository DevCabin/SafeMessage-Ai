import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { SAFE_MESSAGE_SYSTEM_PROMPT } from "@/lib/safeMessagePrompt";
import { getOrCreateUid } from "../_session";
import { getKV } from "@/lib/kv";
import { verifyJWT, isLegacyToken, verifyLegacyToken } from "@/lib/jwt";
import { rateLimitAnalyze, getRateLimitHeaders } from "@/lib/rateLimit";

const FREE_LIMIT = 5;

// Helper function to get user from session token (supports both JWT and legacy tokens)
async function getUserFromSessionForAnalyze(request: NextRequest) {
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

export async function POST(req: NextRequest) {
  const { sender = "", body = "", context = "", fingerprint } = await req.json().catch(() => ({}));
  if (!body || typeof body !== "string") {
    return NextResponse.json({ error: "Missing message body" }, { status: 400 });
  }

  const kv = getKV();

  // Check if user is authenticated
  const authResult = await getUserFromSessionForAnalyze(req);
  let user = null;
  let isAuthenticated = false;

  if (authResult) {
    user = authResult.user;
    isAuthenticated = true;
  }

  // For backward compatibility, still get/create UID for anonymous users
  const uid = await getOrCreateUid(fingerprint);

  let premium = false;
  let freeUsesRemaining = FREE_LIMIT;

  if (isAuthenticated) {
    // Use authenticated user data
    premium = user.is_premium || false;
    freeUsesRemaining = user.free_uses_remaining || 0;
  } else {
    // Use legacy anonymous tracking
    premium = (await kv.get<boolean>(`premium:${uid}`)) || false;
    const used = (await kv.get<number>(`usage:${uid}`)) || 0;
    freeUsesRemaining = FREE_LIMIT - used;
  }

  // Apply rate limiting
  const userId = isAuthenticated ? user.google_id : uid;
  const rateLimitResult = await rateLimitAnalyze(userId, premium, isAuthenticated);

  if (!rateLimitResult.allowed) {
    const resetTime = Math.ceil(rateLimitResult.resetTime / 1000);
    return NextResponse.json(
      {
        error: "Rate limit exceeded",
        message: `Too many requests. Try again after ${new Date(rateLimitResult.resetTime).toLocaleTimeString()}.`
      },
      {
        status: 429,
        headers: {
          'Retry-After': resetTime.toString(),
          ...getRateLimitHeaders(rateLimitResult),
        }
      }
    );
  }

  // Check free limits for non-premium users (after rate limiting to prevent abuse)
  if (!premium) {
    if (isAuthenticated) {
      if (freeUsesRemaining <= 0) {
        return NextResponse.json({ error: "Free limit reached" }, { status: 402 });
      }
    } else {
      const used = (await kv.get<number>(`usage:${uid}`)) || 0;
      if (used >= FREE_LIMIT) {
        return NextResponse.json({ error: "Free limit reached" }, { status: 402 });
      }
    }
  }

  // Decrement free uses for non-premium users
  if (!premium) {
    if (isAuthenticated) {
      user.free_uses_remaining = Math.max(0, user.free_uses_remaining - 1);
      user.total_scans = (user.total_scans || 0) + 1;
      user.last_active = new Date().toISOString();
      await kv.set(`user:${user.google_id}`, user);
    } else {
      // Legacy anonymous tracking
      const used = (await kv.get<number>(`usage:${uid}`)) || 0;
      await kv.set(`usage:${uid}`, used + 1);
    }
  }

  const userContent = [
    `Sender/From: ${sender || "(not provided)"}`,
    `Message Body: ${body}`,
    `Context: ${context || "(not provided)"}`
  ].join("\n");

  // Check if using local LM Studio or OpenAI
  const forceLocal = req.nextUrl.searchParams.get('local') === 'true' || process.env.USE_LOCAL_LM_STUDIO === 'true';
  const isDevelopment = process.env.NODE_ENV === 'development';

  let text: string;
  let usedLocalFallback = false;

  try {
    if (forceLocal) {
      throw new Error('Force local mode');
    }

    // Try OpenAI first
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: SAFE_MESSAGE_SYSTEM_PROMPT },
        { role: "user", content: userContent }
      ]
    });

    text = completion.choices[0]?.message?.content ?? "No response.";
  } catch (error) {
    // If OpenAI fails and we're in development, try LM Studio as fallback
    if (isDevelopment || forceLocal) {
      try {
        console.log('OpenAI failed, trying LM Studio fallback...', error instanceof Error ? error.message : String(error));
        const lmStudioUrl = process.env.LM_STUDIO_URL || 'http://192.168.1.11:1234';
        const response = await fetch(`${lmStudioUrl}/v1/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'openai/gpt-oss-20b',
            messages: [
              { role: 'system', content: SAFE_MESSAGE_SYSTEM_PROMPT },
              { role: 'user', content: userContent }
            ],
            temperature: 0.2,
            max_tokens: 1000
          })
        });

        if (!response.ok) {
          throw new Error(`LM Studio API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        text = data.choices?.[0]?.message?.content ?? "No response from local model.";
        usedLocalFallback = true;
      } catch (lmError) {
        console.error('Both OpenAI and LM Studio failed:', lmError instanceof Error ? lmError.message : String(lmError));
        throw new Error('Both OpenAI and local LM Studio are unavailable. Please check your API keys and LM Studio setup.');
      }
    } else {
      throw error; // Re-throw original error if not in development
    }
  }

  // Try to extract minimal structured bits for UI display
  // Even more robust regex to handle various AI response formats
  const verdictMatch = text.match(/(?:Verdict:).*?(SAFE|UNSAFE|UNKNOWN|UNSURE)/i);
  const threatMatch = text.match(/(?:Threat Level:).*?(\d+)%/i);

  let rawVerdict = verdictMatch?.[1]?.toUpperCase() ?? "UNKNOWN";
  const threatLevel = threatMatch?.[1] ?? "0";
  const threatPercentage = parseInt(threatLevel);

  // Convert "UNSURE" to "UNKNOWN" for consistency
  if (rawVerdict === "UNSURE") {
    rawVerdict = "UNKNOWN";
  }

  // Override verdict: anything 75%+ should be UNSAFE for safety
  if (threatPercentage >= 75) {
    rawVerdict = "UNSAFE";
  }

  const verdict = rawVerdict as "SAFE" | "UNSAFE" | "UNKNOWN";

  return NextResponse.json(
    {
      text,
      verdict,
      threatLevel: threatMatch ? `${threatPercentage}%` : "N/A"
    },
    {
      headers: getRateLimitHeaders(rateLimitResult)
    }
  );
}
