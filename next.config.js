/** @type {import('next').NextConfig} */
const nextConfig = {
  // experimental: {
  //   appDir: true, // Not needed in Next.js 15+
  // },

  // Security headers for all routes
  async headers() {
    return [
      {
        // Apply to all routes
        source: '/(.*)',
        headers: [
          // Prevent clickjacking attacks
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          // Prevent MIME type sniffing (critical for file uploads)
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          // Control referrer information leakage
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          // Restrict device feature access
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=()'
          },
          // Content Security Policy - Report Only Mode (safe for initial deployment)
          {
            key: 'Content-Security-Policy-Report-Only',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "font-src 'self'",
              "connect-src 'self' https://www.google-analytics.com https://*.vercel.app",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              // Report violations to a monitoring endpoint (you can set this up later)
              "report-uri /api/security/csp-report"
            ].join('; ')
          }
        ],
      },
    ];
  },
}

module.exports = nextConfig
