# ScamBomb

A web application that uses AI to analyze messages for phishing, scams, and social engineering risks. Built with Next.js, powered by OpenAI's GPT models, and featuring a freemium model with Stripe payments.

## 📊 Current Status

- **Version**: 1.1.0
- **Status**: Production Ready
- **Deployment**: Vercel (Production Ready)
- **Linting**: ESLint configured with strict rules

## 🎯 Project Goals

ScamBomb helps users determine if a message (email, text, etc.) is SAFE, UNSAFE, or UNKNOWN by analyzing:
- Sender information
- Message content and tone
- Links and requests
- Language patterns for fraud indicators

**Key Features:**
- ✅ Free tier: 5 message analyses per device
- 💳 Premium tier: Unlimited analyses for $5/month
- 🔒 Privacy-focused: No message content stored
- 🎨 Modern dark UI with accessibility features
- ⚡ Fast analysis powered by GPT-4o-mini
- 🚨 Instant red-flag detection with smart warnings
- 🎯 Interactive UI with collapsible sections
- 📱 Mobile-responsive design
- ♿ High contrast and font size controls

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- OpenAI API account
- Stripe account
- Vercel account (for hosting)

### Local Development

1. **Clone the repository:**
   ```bash
   git clone https://github.com/DevCabin/SafeMessage-Ai.git
   cd SafeMessage-Ai
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   Create `.env.local` with your API keys:
   ```env
   OPENAI_API_KEY=sk-your-openai-api-key
   STRIPE_SECRET_KEY=sk_your-stripe-secret-key
   STRIPE_PRICE_ID=price_your-stripe-price-id
   STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ```

4. **Run the development server:**
   ```bash
   npm run dev
   ```

5. **Open [http://localhost:3000](http://localhost:3000) in your browser**

## 🌐 Deployment to Vercel

### 1. Import to Vercel
- Go to [vercel.com](https://vercel.com)
- Click "Import Project"
- Connect your GitHub account
- Select the `SafeMessage-Ai` repository

### 2. Add Vercel KV Integration
- In your Vercel project dashboard, go to "Integrations"
- Search for "KV" and add the Vercel KV integration
- This will automatically populate the KV environment variables

### 3. Set Environment Variables in Vercel
In your Vercel project settings, add these environment variables:

| Variable | Value | Description |
|----------|-------|-------------|
| `OPENAI_API_KEY` | `sk-...` | Your OpenAI API key |
| `STRIPE_SECRET_KEY` | `sk_live_...` | Your Stripe secret key |
| `STRIPE_PRICE_ID` | `price_...` | Your Stripe product price ID |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | Stripe webhook signing secret |
| `NEXT_PUBLIC_SITE_URL` | `https://your-app.vercel.app` | Your Vercel deployment URL |

### 4. Configure Stripe

#### Create a Product and Price:
1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Navigate to "Products"
3. Create a new product (e.g., "ScamBomb Premium")
4. Add a recurring price: $5.00/month
5. Copy the `price_xxx` ID to `STRIPE_PRICE_ID`

#### Set up Webhooks:
1. In Stripe Dashboard, go to "Webhooks"
2. Add endpoint: `https://your-app.vercel.app/api/stripe/webhook`
3. Select events:
   - `checkout.session.completed`
   - `customer.subscription.deleted`
   - `customer.subscription.paused`
4. Copy the webhook signing secret to `STRIPE_WEBHOOK_SECRET`

### 5. Deploy
- Vercel will automatically deploy when you push to main
- Your app will be live at `https://your-app.vercel.app`

## 🏗️ Architecture

```
Frontend (Next.js + React)
    ↓
API Routes (/api/*)
    ↓
OpenAI API (GPT-4o-mini)
    ↓
Analysis Response

Payment Flow:
User → Stripe Checkout → Webhook → Vercel KV → Premium Access
```

## 📁 Project Structure

```
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   │   ├── analyze/       # Message analysis endpoint
│   │   ├── usage/         # Usage tracking
│   │   ├── stripe/        # Payment endpoints
│   │   └── _session.ts    # Device session management
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Main UI
├── lib/                   # Utility libraries
│   ├── kv.ts             # Database abstraction
│   └── safeMessagePrompt.ts # AI system prompt
├── .env.local            # Local environment (not committed)
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
└── vercel.json           # Vercel deployment config
```

## 🔧 API Endpoints

### `POST /api/analyze`
Analyzes a message for safety risks.

**Request:**
```json
{
  "sender": "support@bank.com",
  "body": "Your account has been compromised...",
  "context": "Received via email"
}
```

**Response:**
```json
{
  "text": "🔍 ScamBomb Analysis\n\nVerdict: UNSAFE\n...",
  "verdict": "UNSAFE",
  "threatLevel": "85% (High)"
}
```

### `GET /api/usage`
Returns current usage for the device.

**Response:**
```json
{
  "used": 2,
  "limit": 5,
  "premium": false
}
```

### `POST /api/stripe/checkout`
Creates a Stripe checkout session for premium upgrade.

### `POST /api/stripe/portal`
Creates a billing portal session for premium users.

## 🛡️ Security & Privacy

- **No message storage**: Messages are analyzed in real-time and not stored
- **Device-based tracking**: Uses HttpOnly cookies for session management
- **HTTPS only**: All communications are encrypted
- **API key protection**: Keys are server-side only

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

If you encounter issues:
1. Check the browser console for errors
2. Verify your environment variables are set correctly
3. Ensure Stripe webhooks are configured properly
4. Check Vercel deployment logs

For questions, please open an issue on GitHub.

## 📝 CHANGELOG

### v1.0.3 (2025-11-12)
- **Footer**: Added copyright notice and legal disclaimer to app footer
- **UI Enhancement**: Improved app completeness with professional footer section

### v1.0.2 (2025-11-12)
- **Payment System**: Added support for multiple pricing plans (monthly/annual)
- **Stripe Integration**: Updated checkout API to accept different price IDs
- **Build Fix**: Resolved Vercel deployment issues with TypeScript imports

### v1.0.1 (2025-11-12)
- **Red-Flag Detection**: Implemented instant client-side scam pattern scanning
- **UI Enhancements**: Added collapsible accordion sections and accessibility features
- **Typing Animation**: ChatGPT-style animated text reveal for analysis results
- **Mobile Optimization**: Responsive design with touch-friendly controls
- **Performance**: <2ms red-flag detection with 500+ patterns

### v1.0.0 (2025-11-12)
- **Initial Release**: Core AI message analysis functionality
- **Freemium Model**: 5 free analyses per device, Stripe payment integration
- **Modern UI**: Dark theme with professional design
- **Production Ready**: Vercel deployment with KV database
