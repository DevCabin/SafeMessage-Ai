import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ScamBomb - Stop scams in one click',
  description: 'Paste any text, email, or SMS. ScamBomb checks red flags, explains the risk in plain English, and tells you exactly what to do next.',
  icons: {
    icon: 'https://scambomb.com/favicon.ico',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        {/* Google tag (gtag.js) */}
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-4T81F6BSYW"></script>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-4T81F6BSYW');
            `,
          }}
        />
      </head>
      <body className="bg-[#0B1324] text-white min-h-screen antialiased" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px" }}>{children}</div>
      </body>
    </html>
  )
}
