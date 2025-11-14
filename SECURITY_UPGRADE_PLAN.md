# SafeMessage-Ai Security Upgrade Plan

## Pre-Upgrade State Documentation

### Current Session Token Implementation
**Location**: `app/api/auth/callback/route.ts`, `app/api/_session.ts`

**Current Implementation**:
- Session tokens are created as base64-encoded JSON objects
- Format: `Buffer.from(JSON.stringify({ google_id, email, exp })).toString('base64')`
- Stored in KV with 24-hour expiration
- No cryptographic signing or encryption

**Security Risk**: Tokens can be decoded, modified, and re-encoded by attackers

### Current Rate Limiting
**Status**: None implemented
**Impact**: OpenAI API can be abused, potential DoS attacks

### Current Security Headers
**Location**: `next.config.js`
**Status**: No security headers configured
**Missing**: CSP, HSTS, X-Frame-Options, X-Content-Type-Options, etc.

## Upgrade Plan

### Phase 1: Session Token Security (High Priority)

#### Objective
Replace insecure base64 JSON tokens with cryptographically signed JWTs

#### Implementation Steps
1. Install JWT library (`jose` or `jsonwebtoken`)
2. Create JWT signing utility
3. Update session creation in `app/api/auth/callback/route.ts`
4. Update session verification in all API routes
5. Add JWT secret to environment variables
6. Test backward compatibility and migration

#### Files to Modify
- `package.json` (add JWT dependency)
- `app/api/auth/callback/route.ts`
- `app/api/analyze/route.ts`
- `app/api/user/profile/route.ts`
- `lib/kv.ts` (if needed for JWT storage)
- `.env.local.example` (add JWT secret)

### Phase 2: Rate Limiting Implementation (High Priority)

#### Objective
Prevent API abuse and control OpenAI costs

#### Implementation Steps
1. Choose rate limiting solution (middleware vs Vercel Edge Functions)
2. Implement different limits for authenticated vs anonymous users
3. Add rate limiting to `/api/analyze` endpoint
4. Add rate limiting to other public endpoints
5. Configure appropriate limits (e.g., 10 requests/minute for free users)
6. Add rate limit headers to responses

#### Files to Modify
- `package.json` (add rate limiting library)
- `app/api/analyze/route.ts`
- `middleware.ts` (create if using Next.js middleware)
- Environment variables for rate limits

### Phase 3: Security Headers Configuration (Medium Priority)

#### Objective
Add essential security headers to prevent common attacks

#### Implementation Steps
1. Configure headers in `next.config.js`
2. Implement Content Security Policy (start with report-only)
3. Add HSTS, X-Frame-Options, X-Content-Type-Options
4. Configure Referrer-Policy and Permissions-Policy
5. Test header implementation
6. Monitor for CSP violations

#### Files to Modify
- `next.config.js`
- `app/layout.tsx` (if CSP affects inline scripts)

## Implementation Order

1. **Session Tokens** - Most critical security issue
2. **Rate Limiting** - Prevents financial loss from API abuse
3. **Security Headers** - Defense in depth

## Testing Strategy

- Unit tests for JWT creation/verification
- Integration tests for rate limiting
- Security header validation
- Backward compatibility testing
- Load testing for rate limits

## Rollback Plan

- Keep old session verification as fallback during transition
- Feature flags for new security features
- Database migration strategy for existing sessions

## Success Criteria

- Session tokens cannot be tampered with
- API abuse is prevented within reasonable limits
- Security headers are properly configured
- No breaking changes to user experience
- Performance impact is minimal
