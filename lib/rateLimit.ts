import { getKV } from './kv';

export interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  identifier: string; // Unique identifier for the rate limit (e.g., 'analyze:free', 'analyze:premium')
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  current: number;
}

/**
 * Check if a request should be rate limited
 */
export async function checkRateLimit(
  userId: string,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  const kv = getKV();
  const now = Date.now();
  const windowStart = Math.floor(now / options.windowMs) * options.windowMs;

  const key = `ratelimit:${options.identifier}:${userId}:${windowStart}`;

  // Get current request count
  const current = (await kv.get<number>(key)) || 0;

  const remaining = Math.max(0, options.maxRequests - current - 1);
  const allowed = current < options.maxRequests;

  if (allowed) {
    // Increment the counter
    await kv.set(key, current + 1, { ex: Math.ceil(options.windowMs / 1000) * 2 }); // Expire after 2 windows
  }

  return {
    allowed,
    remaining: Math.max(0, remaining),
    resetTime: windowStart + options.windowMs,
    current: current + (allowed ? 1 : 0),
  };
}

/**
 * Rate limiting configurations
 */
export const RATE_LIMITS = {
  // Free users: 10 requests per minute
  FREE_USER: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,
    identifier: 'analyze:free',
  } as RateLimitOptions,

  // Premium users: 100 requests per minute
  PREMIUM_USER: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,
    identifier: 'analyze:premium',
  } as RateLimitOptions,

  // Anonymous users: 5 requests per minute (stricter)
  ANONYMOUS: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 5,
    identifier: 'analyze:anonymous',
  } as RateLimitOptions,
} as const;

/**
 * Apply rate limiting for analyze endpoint
 */
export async function rateLimitAnalyze(
  userId: string,
  isPremium: boolean,
  isAuthenticated: boolean
): Promise<RateLimitResult> {
  const config = isAuthenticated
    ? (isPremium ? RATE_LIMITS.PREMIUM_USER : RATE_LIMITS.FREE_USER)
    : RATE_LIMITS.ANONYMOUS;

  return checkRateLimit(userId, config);
}

/**
 * Get rate limit headers for response
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': result.current.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': Math.ceil(result.resetTime / 1000).toString(), // Unix timestamp
  };
}
