# ScamBomb

A web application that uses AI to analyze messages for phishing, scams, and social engineering risks. Built with Next.js, powered by OpenAI's GPT models, and featuring a freemium model with Stripe payments.

## 📊 Current Status

- **Version**: 2.1.0 (User Tracking & Authentication)
- **Status**: Development Ready
- **Deployment**: Vercel (Production Ready)
- **Linting**: ESLint configured with strict rules

## 🎯 Project Goals

ScamBomb helps users determine if a message (email, text, etc.) is SAFE, UNSAFE, or UNKNOWN by analyzing:
- Sender information
- Message content and tone
- Links and requests
- Language patterns for fraud indicators

**Key Features:**
- ✅ Free tier: 5 message analyses per device (10 after signup)
- 💳 Premium tier: Unlimited analyses for $5/month
- 🔒 Privacy-focused: No message content stored
- 🎨 Modern dark UI with accessibility features
- ⚡ Fast analysis powered by GPT-4o-mini
- 🚨 Instant red-flag detection with smart warnings
- 🎯 Interactive UI with collapsible sections
- 📱 Mobile-responsive design with camera capture
- ♿ Advanced accessibility: 75px square button with wheelchair icon, ARIA labels, high contrast & font controls
- 📧 Email/Text Message Toggle: Choose your input method
- 📸 Screenshot OCR: Upload images for automatic text extraction
- ❓ Built-in help: Screenshot instructions for iPhone/Android
- 💣 "Bomb It!" feature: Fun way to reject suspicious messages with animations
- 🎉 Success modal with actionable next steps
- 👤 **User Tracking**: Lifetime statistics and gamification
- 🔐 **Google OAuth**: Secure authentication for extended usage
- 📊 **Personal Dashboard**: View scan history and safety scores
- 🎮 **Gamified Experience**: Achievements, streaks, and leaderboards (planned)

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
   Copy `.env.local.example` to `.env.local` and fill in your API keys:
   ```bash
   cp .env.local.example .env.local
   ```

   Then edit `.env.local` with your actual values:
   ```env
   OPENAI_API_KEY=sk-your-openai-api-key
   STRIPE_SECRET_KEY=sk_your-stripe-secret-key
   STRIPE_PRICE_ID=price_your-monthly-stripe-price-id
   STRIPE_ANNUAL_PRICE_ID=price_your-annual-stripe-price-id
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
| `STRIPE_PRICE_ID` | `price_...` | Your Stripe monthly product price ID |
| `STRIPE_ANNUAL_PRICE_ID` | `price_...` | Your Stripe annual product price ID |
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
scambomb.com (Marketing Website)
    ↓
app.scambomb.com (Unified App)
├── Frontend (Next.js + React)
├── API Routes (/api/*)
├── Google OAuth Authentication
├── OpenAI API (GPT-4o-mini)
└── Vercel KV Database

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
│   └── page.tsx           # Main UI with OCR
├── lib/                   # Utility libraries
│   ├── kv.ts             # Database abstraction
│   ├── redFlags.ts       # Red-flag detection system
│   ├── scamPatterns.ts   # Comprehensive threat database
│   └── safeMessagePrompt.ts # AI system prompt
├── .env.local.example     # Environment variables template
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

### v2.1.1 (2025-11-14) - **SIMPLIFIED AUTH ARCHITECTURE**
- **🏗️ Unified App Architecture**: Auth now only on app.scambomb.com (removed from marketing site)
- **🎯 Streamlined OAuth**: Single-domain authentication eliminates cross-domain complexity
- **📚 Updated Documentation**: README.md and DEVELOPER_GUIDE.md reflect simplified architecture
- **🧹 Code Cleanup**: Removed dual-deployment auth logic and environment variables
- **🔧 Environment Variables**: Updated .env.local.example for unified app setup
- **🚀 Production Ready**: Clean separation between marketing (scambomb.com) and app (app.scambomb.com)

### v2.1.0 (2025-11-13) - **USER TRACKING & AUTHENTICATION SYSTEM**
- **👤 User Database**: Implemented comprehensive user tracking with permanent SBUID fingerprints
- **🔐 Google OAuth**: Added secure authentication supporting all Google accounts (gmail.com, Workspace, etc.)
- **📊 Lifetime Statistics**: Track total scans, bomb actions, and safety scores across sessions
- **🎮 Gamification Ready**: Foundation for achievements, streaks, and leaderboards
- **🔄 Extended Free Usage**: 5 additional free scans after email signup (10 total)
- **🎯 Smart User Journey**: Anonymous → Activated → Authenticated progression
- **🛡️ Enhanced Privacy**: User-controlled data with export/deletion capabilities
- **📈 Backward Compatibility**: Seamless migration from existing anonymous usage
- **🎨 Account Management**: Basic profile management and subscription controls
- **� Comprehensive Documentation**: Updated DEVELOPER_GUIDE.md with complete system architecture

### v2.0.2 (2025-11-13) - **UI/UX ENHANCEMENT RELEASE**
- **♿ Accessibility Overhaul**: Redesigned accessibility menu with 75×75px square button featuring custom wheelchair icon
- **🎨 Wheelchair Icon**: Created detailed SVG wheelchair with round wheels, proper proportions, and brand navy color (#0B1324)
- **🔍 Menu Improvements**: Accessibility menu now starts closed, includes ARIA labels, hover effects, and better UX
- **💛 Brand Consistency**: Updated bomb modal button to brand yellow (#F5C84C) for visual consistency
- **📐 Text Centering**: Fixed guarantee text centering with proper width constraints
- **�🔗 URL Correction**: Fixed blog URL from incorrect subdomain to correct `https://www.scambomb.com/blog`
- **🎯 Enhanced Features**: Improved "Bomb It!" animation with ref-based implementation and better error handling
- **📱 Responsive Design**: Better mobile experience with improved touch targets and spacing

### v2.0.1 (2025-11-13) - **FEATURE RELEASE**
- **📧 Email/Text Toggle**: Added prominent toggle switch for message type selection (Email vs Text Message)
- **📱 Conditional OCR**: Screenshot upload appears only when Text Message is selected with smooth animations
- **❓ Screenshot Help**: Built-in help modal with step-by-step instructions for iPhone and Android screenshot capture
- **🔒 Privacy Assurance**: Added clear messaging that images are processed immediately and never stored
- **🎯 UX Enhancement**: Repositioned OCR upload field right below toggle for better user flow
- **📝 User-Friendly Text**: Removed technical jargon ("OCR") and added privacy-focused messaging

### v2.0.0 (2025-11-13) - **MAJOR RELEASE**
- **🚀 Image Upload & OCR**: Added screenshot analysis with Tesseract.js OCR for automatic text extraction
- **🏗️ Scalable Pattern System**: Complete architectural overhaul with categorized threat database (`lib/scamPatterns.ts`)
- **📱 Enhanced Mobile UX**: Camera capture support, larger touch targets, improved accessibility
- **🔍 Advanced Catfishing Detection**: Added patterns for "are you there" and unsolicited checking messages
- **⚡ Performance Optimization**: Streamlined red-flag detection with organized pattern categories
- **📊 Threat Intelligence**: 100+ patterns across 11 categories (urgency, financial, authority, etc.)
- **🔧 Developer Experience**: Comprehensive utility functions for pattern management
- **🧹 Code Cleanup**: Removed unimplemented feedback commands, updated to modern TypeScript patterns

### v1.0.9 (2025-11-13)
- **Debugging Enhancement**: Added comprehensive logging to checkout API for troubleshooting plan routing
- **Documentation**: Created `.env.local.example` template and updated setup instructions
- **Developer Guide**: Updated payment flow documentation with current implementation

### v1.0.8 (2025-11-12)
- **Payment Fix**: Fixed annual button to use correct Stripe price ID via `STRIPE_ANNUAL_PRICE_ID`
- **API Enhancement**: Added plan-based price selection in checkout API
- **Environment Variables**: Added `STRIPE_ANNUAL_PRICE_ID` for annual pricing

### v1.0.7 (2025-11-12)
- **Button Styling**: Updated upgrade button padding to `8px 12px` for better consistency
- **Guarantee Text**: Updated to "No strings attached, 'cancel any time for any reason' guarantee"
- **Trust Enhancement**: Improved guarantee messaging for stronger user confidence

### v1.0.6 (2025-11-12)
- **Guarantee Text**: Added 30-day money-back guarantee below upgrade buttons
- **Trust Building**: Enhanced user confidence with clear refund policy

### v1.0.5 (2025-11-12)
- **UI Enhancement**: Updated upgrade button dimensions (55px height, 175px width) for better consistency
- **Button Styling**: Improved visual hierarchy and touch targets for pricing buttons

### v1.0.4 (2025-11-12)
- **Disclaimer**: Updated footer disclaimer with memorable "When in doubt... DON'T!" message
- **Legal Enhancement**: Improved user guidance with clear safety messaging

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
