import { SignJWT, jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'fallback-secret-change-in-production'
);

export interface JWTPayload {
  google_id: string;
  email?: string;
  iat?: number;
  exp?: number;
}

/**
 * Sign a JWT token with user data
 */
export async function signJWT(payload: Omit<JWTPayload, 'iat' | 'exp'>): Promise<string> {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 24 * 60 * 60; // 24 hours

  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(iat)
    .setExpirationTime(exp)
    .sign(JWT_SECRET);
}

/**
 * Verify and decode a JWT token
 */
export async function verifyJWT(token: string): Promise<JWTPayload> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      algorithms: ['HS256'],
    });
    return {
      google_id: payload.google_id as string,
      email: payload.email as string,
      iat: payload.iat,
      exp: payload.exp,
    };
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}

/**
 * Check if a token is a legacy base64 token (for backward compatibility)
 */
export function isLegacyToken(token: string): boolean {
  try {
    // Try to decode as base64 and parse as JSON
    const decoded = Buffer.from(token, 'base64').toString();
    const parsed = JSON.parse(decoded);
    return !!(parsed.google_id && parsed.exp);
  } catch {
    return false;
  }
}

/**
 * Verify a legacy base64 token (for backward compatibility during migration)
 */
export function verifyLegacyToken(token: string): JWTPayload | null {
  try {
    const decoded = Buffer.from(token, 'base64').toString();
    const payload = JSON.parse(decoded) as JWTPayload;

    // Check if token is expired
    if (payload.exp && payload.exp < Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
