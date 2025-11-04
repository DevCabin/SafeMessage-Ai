# SafeMessage AI Developer Guide

This guide provides a deep dive into the SafeMessage AI web application architecture, logic flow, and implementation details for developers.

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

1. **Frontend (React/Next.js)**: User interface for message input and results display
2. **API Layer (Next.js Routes)**: Server-side logic for analysis, payments, and data management
3. **AI Engine (OpenAI)**: GPT-4o-mini powered message analysis
4. **Database (Vercel KV)**: Redis-based storage for usage tracking and premium status
5. **Payment Processor (Stripe)**: Subscription management and billing

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
  const { email } = await req.json();
  const uid = await getOrCreateUid();

  // Create Stripe checkout session
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: email || undefined,
    line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
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

### 5. Frontend Logic Flow

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

  // Analysis handler
  const analyze = async () => {
    // 1. Prepare request
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sender, body, context })
    });

    // 2. Handle payment required
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

    // 3. Process successful analysis
    const data = await response.json();
    setResult(data);

    // 4. Refresh usage counter
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

## 🔄 Future Enhancements

### Potential Features
- **File Uploads:** Screenshot analysis with OCR
- **Batch Processing:** Multiple messages at once
- **Advanced Reporting:** Detailed threat analytics
- **Team Accounts:** Shared usage for organizations
- **API Access:** Direct API for integrations

### Architecture Improvements
- **Database Migration:** PostgreSQL for complex queries
- **Caching Layer:** Redis for frequently accessed data
- **Queue System:** Background processing for heavy analysis
- **Multi-Region:** Global deployment for better performance

This guide covers the complete logic flow and architecture of SafeMessage AI. The application follows a simple but effective freemium model with robust security and privacy protections.
