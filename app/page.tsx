"use client";

import { useEffect, useState } from "react";
import FingerprintJS from "@fingerprintjs/fingerprintjs";

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
  const [fingerprint, setFingerprint] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);

  // Generate device fingerprint on mount
  useEffect(() => {
    const generateFingerprint = async () => {
      try {
        const fp = await FingerprintJS.load();
        const result = await fp.get();
        setFingerprint(result.visitorId);
      } catch (error) {
        console.warn("Fingerprint generation failed, using fallback:", error);
        // Fallback will be handled by server-side UUID
      }
    };
    generateFingerprint();
  }, []);

  useEffect(() => {
    if (fingerprint) {
      fetch("/api/usage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fingerprint })
      }).then(r => r.json()).then(setUsage).catch(() => {});
    }
  }, [fingerprint]);

  const analyze = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sender, body, context, fingerprint })
      });

      if (res.status === 402) {
        const data = await res.json();
        if (confirm("You've hit the free limit. Upgrade to premium?")) {
          const pay = await fetch("/api/stripe/checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, fingerprint })
          });
          const { url } = await pay.json();
          if (url) window.location.href = url;
        }
        return;
      }

      const data = await res.json();
      setResult(data);
      // Refresh usage with fingerprint after successful analysis
      if (fingerprint) {
        const u = await fetch("/api/usage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fingerprint })
        }).then(r => r.json());
        setUsage(u);
      }
    } catch (e) {
      console.error("Analysis error:", e);
      alert("Analysis failed. Please check your API keys are configured correctly.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0b1120 0%, #1e293b 50%, #0f172a 100%)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Animated background elements */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'radial-gradient(circle at 20% 80%, rgba(34, 197, 94, 0.1) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(251, 191, 36, 0.1) 0%, transparent 50%)',
        animation: 'float 20s ease-in-out infinite'
      }} />

      <main style={{
        position: 'relative',
        zIndex: 1,
        maxWidth: 900,
        margin: '0 auto',
        padding: '2rem 1rem'
      }}>
        {/* Hero Section */}
        <div style={{
          textAlign: 'center',
          marginBottom: '3rem',
          animation: 'fadeInUp 0.8s ease-out'
        }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            color: 'white'
          }}>
            <img
              style={{ maxHeight: '200px', width: 'auto' }}
              src="/images/SafeMessageAi-LOGO-TRANS.png"
              alt="SafeMessage AI Logo"
            />
          </div>

          <h1 style={{
            fontSize: 'clamp(2.5rem, 5vw, 4rem)',
            fontWeight: 800,
            background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: '1rem',
            lineHeight: 1.1
          }}>
            SafeMessage AI
          </h1>
        </div>

        {/* Analysis Form */}
        <div style={{
          background: 'rgba(15, 23, 42, 0.8)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(51, 65, 85, 0.5)',
          borderRadius: '1.5rem',
          padding: '2rem',
          marginBottom: '2rem',
          animation: 'slideIn 0.6s ease-out 0.2s both'
        }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              color: '#f1f5f9',
              marginBottom: '0.5rem'
            }}>
              🔍 Analyze Your Message
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
              Paste any suspicious message to check for potential threats
            </p>
          </div>

          <div style={{ display: 'grid', gap: '1.5rem' }}>
            <div>
              <label style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: '#f1f5f9',
                marginBottom: '0.5rem'
              }}>
                👤 Sender Information
              </label>
              <input
                value={sender}
                onChange={(e) => setSender(e.target.value)}
                placeholder="Email address, phone number, or sender name"
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  borderRadius: '0.5rem',
                  border: '1px solid rgba(71, 85, 105, 0.5)',
                  background: 'rgba(30, 41, 59, 0.8)',
                  color: 'white',
                  fontSize: '0.875rem',
                  transition: 'all 0.2s ease',
                  outline: 'none'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#22c55e';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(34, 197, 94, 0.1)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(71, 85, 105, 0.5)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
            </div>

            <div>
              <label style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: '#f1f5f9',
                marginBottom: '0.5rem'
              }}>
                📝 Message Content
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Paste the full message content here..."
                rows={6}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  borderRadius: '0.5rem',
                  border: '1px solid rgba(71, 85, 105, 0.5)',
                  background: 'rgba(30, 41, 59, 0.8)',
                  color: 'white',
                  fontSize: '0.875rem',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  transition: 'all 0.2s ease',
                  outline: 'none'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#22c55e';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(34, 197, 94, 0.1)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(71, 85, 105, 0.5)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
            </div>

            <div>
              <label style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: '#f1f5f9',
                marginBottom: '0.5rem'
              }}>
                📋 Additional Context <span style={{ color: '#94a3b8', fontWeight: 400 }}>(Optional)</span>
              </label>
              <input
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="Your relationship with sender, recent activity, etc."
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  borderRadius: '0.5rem',
                  border: '1px solid rgba(71, 85, 105, 0.5)',
                  background: 'rgba(30, 41, 59, 0.8)',
                  color: 'white',
                  fontSize: '0.875rem',
                  transition: 'all 0.2s ease',
                  outline: 'none'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#22c55e';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(34, 197, 94, 0.1)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(71, 85, 105, 0.5)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
            </div>

            <button
              onClick={analyze}
              disabled={loading || !body.trim()}
              style={{
                width: '100%',
                padding: '1rem 2rem',
                borderRadius: '0.75rem',
                border: 'none',
                background: loading ? 'rgba(71, 85, 105, 0.8)' : 'linear-gradient(135deg, #22c55e, #16a34a)',
                color: loading ? '#94a3b8' : 'white',
                fontSize: '1rem',
                fontWeight: 700,
                cursor: loading || !body.trim() ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: loading ? 'none' : '0 4px 14px 0 rgba(34, 197, 94, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                opacity: loading || !body.trim() ? 0.6 : 1
              }}
              onMouseEnter={(e) => {
                if (!loading && body.trim()) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 8px 25px 0 rgba(34, 197, 94, 0.4)';
                }
              }}
              onMouseLeave={(e) => {
                if (!loading && body.trim()) {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 14px 0 rgba(34, 197, 94, 0.3)';
                }
              }}
            >
              {loading ? (
                <>
                  <div style={{
                    width: '1rem',
                    height: '1rem',
                    border: '2px solid #94a3b8',
                    borderTop: '2px solid transparent',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                  Analyzing Message...
                </>
              ) : (
                <>
                  🔍 Analyze Message
                </>
              )}
            </button>
          </div>
        </div>

        {/* Description below form */}
        <div style={{
          textAlign: 'center',
          marginTop: '2rem',
          marginBottom: '2rem'
        }}>
          <p style={{
            fontSize: '1.25rem',
            color: '#94a3b8',
            maxWidth: '600px',
            margin: '0 auto',
            lineHeight: 1.6
          }}>
            Instantly detect phishing, scams, and suspicious messages with advanced AI analysis.
            <br />
            <span style={{ color: '#22c55e', fontWeight: 600 }}>5 free checks</span>, then $5/month for unlimited protection.
          </p>
        </div>

        {/* Usage & Premium Section */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '1rem',
          marginBottom: '2rem',
          flexWrap: 'wrap'
        }}>
          <div style={{
            background: 'rgba(15, 23, 42, 0.8)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(51, 65, 85, 0.5)',
            borderRadius: '1rem',
            padding: '1rem 1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{
                width: '2rem',
                height: '2rem',
                borderRadius: '50%',
                background: usage.premium ? 'linear-gradient(135deg, #22c55e, #16a34a)' : '#475569',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.875rem',
                fontWeight: 700
              }}>
                {usage.premium ? '∞' : usage.used}
              </div>
              <div>
                <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
                  {usage.premium ? 'Premium' : 'Free Checks'}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  {usage.premium ? 'Unlimited' : `${usage.used}/${usage.limit} used`}
                </div>
              </div>
            </div>

            {!usage.premium && (
              <div style={{
                height: '2rem',
                width: '1px',
                background: 'rgba(71, 85, 105, 0.5)'
              }} />
            )}

            {!usage.premium && (
              <div style={{ position: 'relative' }}>
                <div style={{
                  width: '8rem',
                  height: '0.5rem',
                  background: 'rgba(71, 85, 105, 0.3)',
                  borderRadius: '0.25rem',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${(usage.used / usage.limit) * 100}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #22c55e, #16a34a)',
                    borderRadius: '0.25rem',
                    transition: 'width 0.3s ease'
                  }} />
                </div>
              </div>
            )}
          </div>

          {!usage.premium && (
            <button
              onClick={async () => {
                try {
                  const res = await fetch("/api/stripe/checkout", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, fingerprint })
                  });
                  const data = await res.json();
                  if (data.url) {
                    window.location.href = data.url;
                  } else if (data.error) {
                    alert(`Payment setup failed: ${data.error}`);
                  } else {
                    alert("Payment setup failed. Please check your Stripe configuration.");
                  }
                } catch (e) {
                  console.error("Checkout error:", e);
                  alert("Payment setup failed. Please check your Stripe API keys are configured correctly.");
                }
              }}
              style={{
                background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
                color: '#1f2937',
                border: 'none',
                padding: '0.75rem 1.5rem',
                borderRadius: '0.75rem',
                fontWeight: 700,
                fontSize: '0.875rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 14px 0 rgba(251, 191, 36, 0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 25px 0 rgba(251, 191, 36, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 14px 0 rgba(251, 191, 36, 0.3)';
              }}
            >
              ⚡ Upgrade to Premium
              <span style={{ fontSize: '0.75rem', opacity: 0.9 }}>$5/mo</span>
            </button>
          )}

          {usage.premium && (
            <button
              onClick={async () => {
                const res = await fetch("/api/stripe/portal", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ fingerprint })
                });
                const data = await res.json();
                if (data.url) {
                  window.location.href = data.url;
                } else if (data.stripeDashboard) {
                  window.open(data.stripeDashboard, '_blank');
                  alert("Billing management coming soon. Opening Stripe dashboard for now.");
                } else {
                  alert(data.error || "Billing management not available yet.");
                }
              }}
              style={{
                background: 'linear-gradient(135deg, #14b8a6, #0d9488)',
                color: 'white',
                border: 'none',
                padding: '0.75rem 1.5rem',
                borderRadius: '0.75rem',
                fontWeight: 700,
                fontSize: '0.875rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 14px 0 rgba(20, 184, 166, 0.3)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 25px 0 rgba(20, 184, 166, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 14px 0 rgba(20, 184, 166, 0.3)';
              }}
            >
              ⚙️ Manage Billing
            </button>
          )}
        </div>

        {/* Email Input for Premium */}
        {!usage.premium && (
          <div style={{
            background: 'rgba(15, 23, 42, 0.8)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(51, 65, 85, 0.5)',
            borderRadius: '1rem',
            padding: '1.5rem',
            marginBottom: '2rem',
            animation: 'slideIn 0.6s ease-out'
          }}>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: '#f1f5f9',
              marginBottom: '0.5rem'
            }}>
              📧 Email for Premium Upgrade
            </label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your.email@example.com"
              type="email"
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                borderRadius: '0.5rem',
                border: '1px solid rgba(71, 85, 105, 0.5)',
                background: 'rgba(30, 41, 59, 0.8)',
                color: 'white',
                fontSize: '0.875rem',
                transition: 'all 0.2s ease',
                outline: 'none'
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#22c55e';
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(34, 197, 94, 0.1)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'rgba(71, 85, 105, 0.5)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
          </div>
        )}

        {/* Results Display */}
        {result && (
          <div style={{
            background: 'rgba(15, 23, 42, 0.8)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(51, 65, 85, 0.5)',
            borderRadius: '1.5rem',
            padding: '2rem',
            marginTop: '2rem',
            animation: 'slideIn 0.6s ease-out'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              marginBottom: '1.5rem'
            }}>
              <div style={{
                width: '3rem',
                height: '3rem',
                borderRadius: '50%',
                background: result.verdict === 'SAFE' ? 'linear-gradient(135deg, #22c55e, #16a34a)' :
                           result.verdict === 'UNSAFE' ? 'linear-gradient(135deg, #ef4444, #dc2626)' :
                           'linear-gradient(135deg, #f59e0b, #d97706)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.25rem'
              }}>
                {result.verdict === 'SAFE' ? '✅' : result.verdict === 'UNSAFE' ? '🚨' : '⚠️'}
              </div>
              <div>
                <h3 style={{
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  color: '#f1f5f9',
                  margin: 0
                }}>
                  {result.verdict === 'SAFE' ? 'Message is Safe' :
                   result.verdict === 'UNSAFE' ? 'Security Risk Detected' :
                   'Unable to Determine'}
                </h3>
                <p style={{
                  color: '#94a3b8',
                  margin: '0.25rem 0 0',
                  fontSize: '0.875rem'
                }}>
                  Threat Level: {result.threatLevel}
                </p>
              </div>
            </div>

            <div style={{
              background: 'rgba(30, 41, 59, 0.8)',
              border: '1px solid rgba(71, 85, 105, 0.5)',
              borderRadius: '0.75rem',
              padding: '1.5rem',
              fontFamily: 'ui-monospace, SFMono-Regular, monospace',
              fontSize: '0.875rem',
              lineHeight: 1.6,
              color: '#e2e8f0',
              whiteSpace: 'pre-wrap',
              overflow: 'auto'
            }}>
              {result.text}
            </div>
          </div>
        )}
      </main>

      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes float {
          0%, 100% {
            transform: translateY(0px) rotate(0deg);
          }
          33% {
            transform: translateY(-10px) rotate(1deg);
          }
          66% {
            transform: translateY(5px) rotate(-1deg);
          }
        }

        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
