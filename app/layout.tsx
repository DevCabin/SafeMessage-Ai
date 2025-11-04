export const metadata = {
  title: "SafeMessage AI",
  description: "Check messages for phishing and scam risks"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "ui-sans-serif, system-ui, -apple-system", background: "#0b1120", color: "white" }}>
        <div style={{ maxWidth: 800, margin: "0 auto", padding: 24 }}>{children}</div>
      </body>
    </html>
  );
}
