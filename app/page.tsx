"use client";

import { useEffect, useState } from "react";

type Analysis = {
  verdict: "SAFE" | "UNSAFE" | "UNKNOWN";
  threatLevel: string;
  text: string; // full formatted block
};

export default function HomePage() {
  const [sender, setSender] = useState("");
  const [body, setBody] = useState("");
  const [context, setContext] = useState("");
  const [result, setResult] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [usage, setUsage] = useState<{ used: number; limit: number; premium: boolean }>({ used: 0, limit: 5, premium: false });
  const [email, setEmail] = useState("");

  useEffect(() => {
    fetch("/api/usage").then(r => r.json()).then(setUsage).catch(() => {});
  }, []);

  const analyze = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sender, body, context })
      });

      if (res.status === 402) {
        const data = await res.json();
        if (confirm("You've hit the free limit. Upgrade to premium?")) {
          const pay = await fetch("/api/stripe/checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email })
          });
          const { url } = await pay.json();
          if (url) window.location.href = url;
        }
        return;
      }

      const data = await res.json();
      setResult(data);
      const u = await fetch("/api/usage").then(r => r.json());
      setUsage(u);
    } catch (e) {
      alert("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const openPortal = async () => {
    const res = await fetch("/api/stripe/portal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
  };

  return (
    <main>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>SafeMessage AI</h1>
      <p style={{ color: "#9CA3AF", marginBottom: 20 }}>
        Check if a message is SAFE, UNSAFE, or UNKNOWN. 5 free checks, then $5/mo unlimited.
      </p>

      <div style={{ background: "#111827", padding: 16, borderRadius: 12, marginBottom: 16 }}>
        <label>Upgrade email (for premium): </label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          style={{ width: "100%", marginTop: 6, padding: 10, borderRadius: 8, color: "white", background: "#1F2937", border: "1px solid #374151" }}
        />
      </div>

      <div style={{ background: "#111827", padding: 16, borderRadius: 12 }}>
        <div style={{ display: "grid", gap: 12 }}>
          <input
            value={sender}
            onChange={(e) => setSender(e.target.value)}
            placeholder="Sender/From (e.g., 'support@bank.com' or '+1 555-...')"
            style={{ padding: 10, borderRadius: 8, color: "white", background: "#1F2937", border: "1px solid #374151" }}
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Paste the message body here..."
            rows={8}
            style={{ padding: 10, borderRadius: 8, color: "white", background: "#1F2937", border: "1px solid #374151" }}
          />
          <input
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Optional context (your relationship with sender, recent activity, etc.)"
            style={{ padding: 10, borderRadius: 8, color: "white", background: "#1F2937", border: "1px solid #374151" }}
          />

          <button
            onClick={analyze}
            disabled={loading || !body}
            style={{ padding: "10px 14px", borderRadius: 8, background: loading ? "#4B5563" : "#22c55e", color: "black", fontWeight: 700 }}
          >
            {loading ? "Analyzing..." : "Analyze"}
          </button>
        </div>
      </div>

      <div style={{ marginTop: 16, display: "flex", gap: 12, alignItems: "center" }}>
        <span style={{ fontSize: 14, color: "#9CA3AF" }}>
          Usage: {usage.used}/{usage.premium ? "∞" : usage.limit} {usage.premium ? "(Premium)" : ""}
        </span>
        {usage.premium ? (
          <button onClick={openPortal} style={{ padding: "6px 10px", borderRadius: 6, background: "#14b8a6", color: "black", fontWeight: 700 }}>Manage Billing</button>
        ) : (
          <button onClick={async () => {
            const res = await fetch("/api/stripe/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
            const data = await res.json();
            if (data.url) window.location.href = data.url;
          }} style={{ padding: "6px 10px", borderRadius: 6, background: "#fbbf24", color: "black", fontWeight: 700 }}>
            Upgrade ($5/mo)
          </button>
        )}
      </div>

      {result && (
        <pre style={{ background: "#0b1220", marginTop: 16, padding: 16, borderRadius: 12, whiteSpace: "pre-wrap", border: "1px solid #1F2937" }}>
{result.text}
        </pre>
      )}
    </main>
  );
}
