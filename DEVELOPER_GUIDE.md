# ScamBomb Developer Guide

This guide provides a deep dive into the ScamBomb web application architecture, logic flow, and implementation details for developers.

## 🏗️ Application Architecture

### High-Level Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend UI   │────│   Next.js API   │────│   OpenAI API    │
│   (React)       │    │   Routes        │    │   (GPT-4o-mini) │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Session Mgmt   │    │   Vercel KV     │    │   Analysis      │
│  (HttpOnly      │    │   Database      │    │   Response      │
│   Cookies)      │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Core Components

1. **Frontend (React/Next.js)**: Modern UI with accessibility features, collapsible sections, and real-time red-flag detection
2. **API Layer (Next.js Routes)**: Server-side logic for analysis, payments, and data management
3. **AI Engine (OpenAI)**: GPT-4o-mini powered message analysis with structured threat assessment
4. **Red-Flag Scanner**: Client-side instant scam detection using pattern matching
5. **Database (Vercel KV)**: Redis-based storage for usage tracking and premium status
6. **Payment Processor (Stripe)**: Subscription management and billing

## 🔄 Main Application Logic Flow

### 1. User Session Management

**File:** `app/api/_session.ts`

```typescript
// Creates or retrieves a unique device identifier
export async function getOrCreateUid() {
  const store = await cookies();
  let uid = store.get(COOKIE_NAME)?.value;
  if (!uid) {
    uid = uuid(); // Generate new UUID
    store.set(COOKIE_NAME, uid, {
      httpOnly: true, // Prevents client-side access
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365 // 1 year expiry
    });
  }
  return uid as string;
}
```

**Logic:**
- Uses HttpOnly cookies for security (can't be accessed via JavaScript)
- Creates persistent device-based sessions
- UUID ensures uniqueness across devices

### 2. Message Analysis Flow

**File:** `app/api/analyze/route.ts`

```typescript
export async function POST(req: NextRequest) {
  // 1. Extract request data
  const { sender = "", body = "", context = "" } = await req.json();

  // 2. Validate input
  if (!body || typeof body !== "string") {
    return NextResponse.json({ error: "Missing message body" }, { status: 400 });
  }

  // 3. Get or create user session
  const uid = await getOrCreateUid();

  // 4. Check usage limits
  const kv = getKV();
  const premium = (await kv.get<boolean>(`premium:${uid}`)) || false;
  let used = (await kv.get<number>(`usage:${uid}`)) || 0;

  if (!premium && used >= FREE_LIMIT) {
    return NextResponse.json({ error: "Free limit reached" }, { status: 402 });
  }

  // 5. Increment usage counter (pre-call)
  if (!premium) {
    used += 1;
    await kv.set(`usage:${uid}`, used);
  }

  // 6. Prepare AI prompt
  const userContent = [
    `Sender/From: ${sender || "(not provided)"}`,
    `Message Body: ${body}`,
    `Context: ${context || "(not provided)"}`
  ].join("\n");

  // 7. Call OpenAI API
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2, // Low creativity for consistent analysis
    messages: [
      { role: "system", content: SAFE_MESSAGE_SYSTEM_PROMPT },
      { role: "user", content: userContent }
    ]
  });

  // 8. Process response
  const text = completion.choices[0]?.message?.content ?? "No response.";

  // 9. Extract structured data for UI
  const verdictMatch = text.match(/Verdict:\s*(SAFE|UNSAFE|UNKNOWN)/i);
  const threatMatch = text.match(/Threat Level:\s*([^\n]+)/i);

  // 10. Return formatted response
  return NextResponse.json({
    text, // Full AI response
    verdict: (verdictMatch?.[1]?.toUpperCase() ?? "UNKNOWN") as "SAFE" | "UNSAFE" | "UNKNOWN",
    threatLevel: threatMatch?.[1] ?? "N/A"
  });
}
```

**Logic Steps:**
1. **Input Validation:** Ensure message body exists
2. **Session Check:** Get device UID from cookies
3. **Usage Verification:** Check premium status and free limits
4. **Usage Tracking:** Increment counter for free users
5. **Prompt Construction:** Format user input for AI
6. **AI Processing:** Send to GPT-4o-mini with system prompt
7. **Response Parsing:** Extract verdict and threat level
8. **Data Return:** Send structured response to frontend

### 3. Usage Tracking Logic

**File:** `app/api/usage/route.ts`

```typescript
export async function GET() {
  const uid = await getOrCreateUid();
  const kv = getKV();
  const used = (await kv.get<number>(`usage:${uid}`)) || 0;
  const premium = (await kv.get<boolean>(`premium:${uid}`)) || false;

  return NextResponse.json({
    used,           // Number of analyses used
    limit: FREE_LIMIT, // Always 5 for free tier
    premium        // Boolean premium status
  });
}
```

**Storage Keys:**
- `usage:${uid}` - Counter of free analyses used
- `premium:${uid}` - Boolean indicating premium status
- `stripeCustomerFor:${uid}` - Stripe customer ID mapping
- `uidFor:${customerId}` - Reverse mapping for webhooks

### 4. Payment Flow Logic

#### Checkout Process
**File:** `app/api/stripe/checkout/route.ts`

```typescript
export async function POST(req: NextRequest) {
  const { email, fingerprint, productId, plan } = await req.json().catch(() => ({}));
  console.log('Checkout request:', { email: email ? 'provided' : 'not provided', fingerprint: fingerprint ? 'provided' : 'not provided', productId, plan });
  console.log('Environment variables:', {
    STRIPE_PRICE_ID: process.env.STRIPE_PRICE_ID ? 'set' : 'not set',
    STRIPE_ANNUAL_PRICE_ID: process.env.STRIPE_ANNUAL_PRICE_ID ? 'set' : 'not set'
  });
  const uid = await getOrCreateUid(fingerprint);

  // Determine price ID based on plan or provided productId
  let priceId = productId;
  if (!priceId) {
    if (plan === 'annual' && process.env.STRIPE_ANNUAL_PRICE_ID) {
      priceId = process.env.STRIPE_ANNUAL_PRICE_ID;
      console.log('Using annual price ID:', priceId);
    } else {
      priceId = process.env.STRIPE_PRICE_ID;
      console.log('Using monthly price ID:', priceId);
    }
  } else {
    console.log('Using provided productId:', priceId);
  }

  // Create Stripe checkout session
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: email || undefined,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/?status=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/?status=cancel`,
    metadata: { uid }, // Pass device ID to webhook
  });

  return NextResponse.json({ url: session.url });
}
```

#### Webhook Processing
**File:** `app/api/stripe/webhook/route.ts`

```typescript
export async function POST(req: NextRequest) {
  // 1. Verify webhook signature
  const event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET!);

  // 2. Process based on event type
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const uid = (session.metadata as any)?.uid;

      if (uid) {
        // Mark user as premium
        await kv.set(`premium:${uid}`, true);

        // Store customer mapping for billing portal
        if (session.customer) {
          const customerId = typeof session.customer === "string"
            ? session.customer
            : session.customer.id;

          await stripe.customers.update(customerId, { metadata: { uid } });
          await kv.set(`stripeCustomerFor:${uid}`, customerId);
          await kv.set(`uidFor:${customerId}`, uid);
        }
      }
      break;
    }

    case "customer.subscription.deleted":
    case "customer.subscription.paused": {
      // Remove premium access
      const sub = event.data.object as Stripe.Subscription;
      const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;

      const uid = await kv.get<string>(`uidFor:${customerId}`);
      if (uid) {
        await kv.set(`premium:${uid}`, false);
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
```

### 5. Red-Flag Detection System

**File:** `lib/redFlags.ts`

The client-side red-flag scanner provides instant feedback before AI analysis:

```typescript
// Pattern matching for common scam indicators
const redFlagPatterns = [
  /urgent/i, /act now/i, /within 24 hours/i,
  /gift card/i, /wire transfer/i, /bitcoin/i,
  /irs/i, /social security/i, /account suspended/i,
  /bit\.ly/i, /tinyurl/i, /https?:\/\/[^\s]*\.(ru|cn|tk)/i
  // Note: 'hey' was removed as it was too common in safe messages
];

// Fast pattern matching (<2ms for 500 patterns)
export function quickScan(text: string): RegExp | null {
  const lowerText = text.toLowerCase();
  return redFlagPatterns.find(pattern => pattern.test(lowerText)) || null;
}
```

**Integration in Frontend:**

```typescript
// Real-time scanning with debouncing
const checkForRedFlags = (text: string) => {
  const hit = quickScan(text);
  if (hit) {
    setRedFlag(typeof hit === 'string' ? hit : hit.source);
    return true;
  }
  setRedFlag(null);
  return false;
};

// Trigger on message input with 500ms debounce
useEffect(() => {
  const timeoutId = setTimeout(() => {
    checkForRedFlags(body);
  }, 500);
  return () => clearTimeout(timeoutId);
}, [body]);
```

**UI Response:**
- Shows prominent red warning banner with detected word highlighted
- Offers choice: "BOMB it!" (clear and start over) or "Full AI Scan" (proceed anyway)
- Purely client-side - doesn't block API calls, only provides guidance

### 6. Frontend Logic Flow

**File:** `app/page.tsx`

```typescript
export default function HomePage() {
  // State management
  const [usage, setUsage] = useState<{ used: number; limit: number; premium: boolean }>({
    used: 0, limit: 5, premium: false
  });

  // Load usage on component mount
  useEffect(() => {
    fetch("/api/usage").then(r => r.json()).then(setUsage);
  }, []);

  // Analysis handler with red-flag pre-check
  const analyze = async () => {
    // 1. Check for red flags first
    const hasRedFlags = checkForRedFlags(body);
    if (hasRedFlags) {
      // Show warning UI, let user decide
      return;
    }

    // 2. Proceed with AI analysis
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sender, body, context })
    });

    // 3. Handle payment required
    if (response.status === 402) {
      const confirmUpgrade = confirm("You've hit the free limit. Upgrade to premium?");
      if (confirmUpgrade) {
        // Redirect to Stripe checkout
        const { url } = await fetch("/api/stripe/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email })
        }).then(r => r.json());

        if (url) window.location.href = url;
      }
      return;
    }

    // 4. Process successful analysis
    const data = await response.json();
    setResult(data);

    // 5. Refresh usage counter
    const updatedUsage = await fetch("/api/usage").then(r => r.json());
    setUsage(updatedUsage);
  };
}
```

## 🎯 AI Analysis Logic

### System Prompt Structure

**File:** `lib/safeMessagePrompt.ts`

The system prompt defines:
- **Role:** Digital safety assistant
- **Input Format:** Sender, Message Body, Context
- **Output Format:** Structured analysis block
- **Classification Rules:** SAFE/UNSAFE/UNKNOWN
- **Threat Scoring:** 0-100% with risk bands
- **Response Template:** Consistent formatting

### Analysis Process

1. **Input Processing:** Extract sender, body, context
2. **Pattern Recognition:** Check for scam indicators
3. **Risk Assessment:** Calculate threat level
4. **Verdict Determination:** SAFE/UNSAFE/UNKNOWN
5. **Response Formatting:** Structured output with reasoning

## 🔐 Security Considerations

### Data Privacy
- **No Message Storage:** Messages are processed in real-time and not persisted
- **Session-Based Tracking:** Uses device cookies instead of user accounts
- **Minimal Data Retention:** Only usage counters and premium status stored

### API Security
- **Environment Variables:** All secrets stored securely
- **Webhook Verification:** Stripe webhooks validated with signatures
- **HttpOnly Cookies:** Session tokens protected from client-side access

### Rate Limiting
- **Free Tier Limits:** 5 analyses per device
- **Premium Unlimited:** No restrictions for paying users
- **Device-Based:** Prevents abuse via multiple accounts

## 🧪 Testing Strategy

### Local Development
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Test Stripe webhooks locally
npm run stripe:listen
```

### Environment Variables for Testing
```env
# Use test keys for development
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PRICE_ID=price_test_...
STRIPE_WEBHOOK_SECRET=whsec_test_...

# OpenAI test key
OPENAI_API_KEY=sk-test-...

# Local development URL
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### Test Scenarios
1. **Free User Flow:** Analyze 5 messages, attempt 6th → payment prompt
2. **Premium User Flow:** Unlimited analyses, billing portal access
3. **Webhook Testing:** Simulate subscription events
4. **Error Handling:** Invalid inputs, API failures

## 🚀 Deployment Architecture

### Vercel Configuration
- **Serverless Functions:** All API routes run as Vercel serverless functions
- **KV Integration:** Redis-based storage automatically provisioned
- **Environment Variables:** Secure secret management
- **Automatic Scaling:** Handles traffic spikes

### Database Schema (Vercel KV)
```
Key Pattern          | Value Type | Description
---------------------|------------|-------------
usage:{uid}         | number     | Free analyses used
premium:{uid}       | boolean    | Premium status
stripeCustomerFor:{uid} | string  | Stripe customer ID
uidFor:{customerId} | string     | Reverse customer mapping
```

### CDN and Performance
- **Global CDN:** Vercel automatically distributes assets worldwide
- **Edge Functions:** API routes run at the edge for low latency
- **Caching:** Static assets cached for optimal performance

## 🔧 Development Tips

### Debugging API Routes
```typescript
// Add logging to API routes
console.log('Processing request for UID:', uid);
console.log('Usage data:', { used, premium });
```

### Testing Webhooks Locally
```bash
# Forward Stripe webhooks to local server
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

### Monitoring Usage
```bash
# Check KV data in Vercel dashboard
# Or add admin endpoint to view usage stats
```

### Performance Optimization
- **Streaming Responses:** Consider streaming for long AI responses
- **Caching:** Cache frequent usage checks
- **Batch Processing:** Group multiple analyses if needed

## 📊 Monitoring and Analytics

### Key Metrics to Track
- **Usage Patterns:** Free vs premium analysis counts
- **Conversion Rate:** Free users upgrading to premium
- **Error Rates:** API failures and user-reported issues
- **Performance:** Response times for AI analysis

### Vercel Analytics
- **Function Metrics:** API route performance
- **Error Tracking:** Failed requests and exceptions
- **Usage Stats:** Bandwidth and function invocations

## 👤 User Tracking & Authentication System (v2.1.0)

### Overview
ScamBomb implements a sophisticated user tracking system that evolves from anonymous device-based usage to authenticated user accounts with lifetime statistics and gamification.

### User Journey Flow

```
Anonymous Visitor → Fingerprinted Device → Free Usage (5 scans)
       ↓
First Full Action (AI Scan OR Bomb) → User Record Created
       ↓
Free Limit Reached → Signup Prompt → Google OAuth
       ↓
Authenticated User → Extended Free Usage + Lifetime Stats
```

### Database Schema

**User Records (Vercel KV):**
```
Key Pattern: user:{sbuid}
Value: {
  sbuid: string,           // Permanent device fingerprint
  email: string | null,    // Added after authentication
  total_scans: number,     // Lifetime AI analysis count
  total_bombs: number,     // Lifetime bomb actions count
  free_uses_remaining: number, // 5 initially, +5 after signup
  created_at: timestamp,
  last_active: timestamp,
  is_premium: boolean
}
```

**Legacy Compatibility:**
- Existing `usage:{sbuid}` keys remain for backward compatibility
- Existing `premium:{sbuid}` keys continue to work
- Migration happens automatically when users authenticate

### Authentication Architecture

**Google OAuth Integration:**
- **Provider:** Google (supports all Google accounts: gmail.com, googlemail.com, Workspace domains)
- **Scopes:** `openid email profile`
- **Security:** Server-side token verification, no client-side secrets
- **Session:** JWT tokens with 24-hour expiry

**API Endpoints:**

#### `POST /api/auth/google`
Initiates Google OAuth flow and returns authorization URL with CSRF protection.

**Request:** `POST /api/auth/google`
**Response:**
```json
{
  "url": "https://accounts.google.com/oauth/authorize?..."
}
```

#### `GET /api/auth/callback`
Handles OAuth callback, verifies tokens, creates/updates user records, and establishes sessions.

**Request:** `GET /api/auth/callback?code=...&state=...`
**Response:** Redirect to frontend with session token

#### `GET /api/user/profile`
Returns current authenticated user profile and statistics.

**Request:** `GET /api/user/profile` (with Authorization header or session_token)
**Response:**
```json
{
  "google_id": "123456789",
  "email": "user@example.com",
  "name": "John Doe",
  "picture": "https://...",
  "total_scans": 15,
  "total_bombs": 3,
  "free_uses_remaining": 2,
  "safety_score": 83,
  "is_premium": false,
  "created_at": "2025-01-01T00:00:00.000Z",
  "last_active": "2025-01-15T10:30:00.000Z"
}
```

#### `POST /api/user/signup`
Links anonymous SBUID with authenticated Google account and migrates legacy data.

**Request:** `POST /api/user/signup`
```json
{
  "sbuid": "device-fingerprint-uuid"
}
```
**Response:**
```json
{
  "success": true,
  "message": "Account linked successfully",
  "migrated_scans": 3,
  "bonus_uses": 5,
  "user": { ... }
}
```

### User State Management

**Anonymous Phase (Current):**
```typescript
// Device fingerprinting (already implemented)
const fingerprint = await fp.get().visitorId;

// Usage tracking (already implemented)
const usage = await kv.get(`usage:${fingerprint}`) || 0;
```

**Activation Phase (New):**
```typescript
// After first full action (AI scan OR bomb)
const userRecord = {
  sbuid: fingerprint,
  total_scans: 1, // or total_bombs: 1
  free_uses_remaining: 4, // decremented from 5
  created_at: new Date(),
  last_active: new Date(),
  is_premium: false
};
await kv.set(`user:${fingerprint}`, userRecord);
```

**Authenticated Phase (New):**
```typescript
// After Google OAuth signup
const authenticatedUser = {
  ...userRecord,
  email: user.email,
  free_uses_remaining: 9 // +5 bonus after signup
};
await kv.set(`user:${fingerprint}`, authenticatedUser);
```

### Temporary Console Logging (Development)

**Add to `app/page.tsx` for testing:**
```typescript
// In useEffect after fingerprint generation
console.log('🔍 User Fingerprint:', fingerprint);

// In analyze function
console.log('📊 Usage Count:', usage.used);
console.log('🎯 Action Type:', hasRedFlags ? 'bomb' : 'ai_scan');

// In bomb button handler
console.log('💣 Bomb Action Triggered');
```

### Signup Flow Implementation

**Modal Trigger:**
- Automatically shown when `free_uses_remaining === 0`
- Manual trigger available in account section

**Google OAuth Process:**
```typescript
const handleGoogleSignup = async () => {
  const response = await fetch('/api/auth/google');
  const { url } = await response.json();
  window.location.href = url; // Redirect to Google
};
```

**Post-Authentication:**
- User redirected back to app
- Anonymous data merged with authenticated account
- Extended free usage granted
- Welcome message with stats

### Lifetime Statistics & Gamification

**Stats Display Component:**
```typescript
const UserStats = ({ user }) => (
  <div className="stats-container">
    <div className="stat-item">
      <span className="stat-icon">🔍</span>
      <span className="stat-value">{user.total_scans}</span>
      <span className="stat-label">Messages Analyzed</span>
    </div>
    <div className="stat-item">
      <span className="stat-icon">💣</span>
      <span className="stat-value">{user.total_bombs}</span>
      <span className="stat-label">Scams BOMBED</span>
    </div>
    <div className="stat-item">
      <span className="stat-icon">⭐</span>
      <span className="stat-value">{calculateSafetyScore(user)}</span>
      <span className="stat-label">Safety Score</span>
    </div>
  </div>
);
```

**Gamification Elements:**
- **Safety Score:** `(total_scans - total_bombs) / total_scans * 100`
- **Achievements:** "First Bomb", "Century Club", "Safety Guardian"
- **Streaks:** Consecutive safe message detections
- **Leaderboards:** (Future feature)

### Account Management

**Basic Account Page:**
- View lifetime statistics
- Manage subscription (link to Stripe portal)
- Account settings (email, preferences)
- Data export/deletion options

**Privacy Considerations:**
- **Data Ownership:** Users control their data
- **Export:** JSON export of all user data
- **Deletion:** Complete account and data removal
- **Anonymity:** Option to remain anonymous (no email required)

### Migration Strategy

**Backward Compatibility:**
- Existing anonymous users continue working
- No forced migration - signup is optional
- Gradual transition as users hit limits

**Data Migration:**
```typescript
// When user authenticates, merge existing data
const existingUsage = await kv.get(`usage:${sbuid}`) || 0;
const existingPremium = await kv.get(`premium:${sbuid}`) || false;

const mergedUser = {
  sbuid,
  email: authenticatedUser.email,
  total_scans: existingUsage, // Migrate legacy usage
  total_bombs: 0, // Start fresh
  free_uses_remaining: existingPremium ? 999 : 9, // Premium or extended free
  created_at: new Date(),
  last_active: new Date(),
  is_premium: existingPremium
};
```

### Security Considerations

**OAuth Security:**
- **State Parameter:** CSRF protection with random state tokens
- **PKCE:** Proof Key for Code Exchange for public clients
- **Token Storage:** HttpOnly cookies for session tokens

**Data Privacy:**
- **Minimal Collection:** Only necessary data for functionality
- **No Message Storage:** Messages never persisted
- **User Control:** Full data export and deletion capabilities

### Testing Strategy

**Test Scenarios:**
1. **Anonymous → Authenticated Flow:** Complete signup process
2. **Usage Limits:** Verify free limit enforcement and signup prompts
3. **Data Migration:** Ensure legacy users transition smoothly
4. **Stats Tracking:** Verify bomb counts and scan totals
5. **Account Management:** Test profile updates and data export

**Development Testing:**
```bash
# Test OAuth flow locally
# Use Google OAuth test credentials
# Verify token validation
# Test user record creation
```

## 📋 Recent Updates (v2.1.1)

### Bomb Modal Improvements
**Date:** November 2025
**Files:** `app/page.tsx`

**Changes:**
- **Text Instruction Update:** Changed the bomb modal instruction from generic "report as spam" to more specific "just say 'report as spam'" for clarity
- **Animation Enhancement:** Replaced the negative shake animation with a positive spin animation for better user experience
- **Usage Counter Fix:** Fixed critical bug where usage counter wasn't updating when users clicked "BOMB IT!" on red flag warnings

**Technical Details:**
```typescript
// Added usage refresh to BOMB IT! button
onClick={async () => {
  // ... existing code ...
  // Refresh usage counter since this counts as a scan attempt
  if (fingerprint) {
    const u = await fetch("/api/usage", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ fingerprint })
    }).then(r => r.json());
    setUsage(u);
  }
  // ... rest of animation code ...
}}
```

### Red Flag Pattern Optimization
**Date:** November 2025
**Files:** `lib/scamPatterns.ts`

**Changes:**
- Removed 'hey' from red flag patterns as it was too common in safe messages
- Improved pattern accuracy to reduce false positives

**Before:**
```typescript
const redFlagPatterns = [
  /urgent/i, /act now/i, /within 24 hours/i,
  /gift card/i, /wire transfer/i, /bitcoin/i,
  /irs/i, /social security/i, /account suspended/i,
  /bit\.ly/i, /tinyurl/i, /https?:\/\/[^\s]*\.(ru|cn|tk)/i,
  /hey/i  // ← Removed: too common in safe messages
];
```

## 🔄 Future Enhancements

### Potential Features
- **File Uploads:** Screenshot analysis with OCR
- **Batch Processing:** Multiple messages at once
- **Advanced Reporting:** Detailed threat analytics
- **Team Accounts:** Shared usage for organizations
- **API Access:** Direct API for integrations
- **Social Features:** Share achievements, compete on leaderboards
- **Advanced Gamification:** Badges, streaks, challenges

### Architecture Improvements
- **Database Migration:** PostgreSQL for complex queries
- **Caching Layer:** Redis for frequently accessed data
- **Queue System:** Background processing for heavy analysis
- **Multi-Region:** Global deployment for better performance
- **Real-time Stats:** WebSocket updates for live statistics

This guide covers the complete logic flow and architecture of ScamBomb. The application follows a simple but effective freemium model with robust security and privacy protections.
