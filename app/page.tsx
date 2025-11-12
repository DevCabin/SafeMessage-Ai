"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
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
  const [highContrast, setHighContrast] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [fontSize, setFontSize] = useState(16); // in px
  const [activeSection, setActiveSection] = useState<'input' | 'results'>('input');

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

  const playInstructions = () => {
    const instructions = "Welcome to ScamBomb. To check a message, first enter the sender information. Then paste the message content. Optionally add context. Finally, click the Analyze Message button. Wait for results.";
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(instructions);
      utterance.rate = 0.8;
      utterance.pitch = 1;
      speechSynthesis.speak(utterance);
    } else {
      alert("Voice instructions not supported in this browser.");
    }
  };

  const baseFontSize = `${fontSize}px`;
  const largeFontSize = `${fontSize + 2}px`;
  const buttonHeight = '60px'; // at least 44px

  return (
    <div style={{
      minHeight: '100vh',
      background: highContrast ? '#000000' : '#0B1324',
      color: highContrast ? '#ffffff' : 'white',
      fontSize: baseFontSize,
      position: 'relative'
    }}>
      {/* Help Button - Fixed at top right */}
      <button
        onClick={() => setShowHelp(true)}
        style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          padding: '15px 20px',
          borderRadius: '10px',
          border: 'none',
          background: '#ff6b6b',
          color: 'white',
          fontSize: largeFontSize,
          fontWeight: 'bold',
          cursor: 'pointer',
          zIndex: 1000,
          boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
          minHeight: buttonHeight
        }}
      >
        ❓ Need Help?
      </button>

      {/* Accessibility Controls */}
      <div style={{
        position: 'fixed',
        top: '20px',
        left: '20px',
        display: 'flex',
        gap: '10px',
        zIndex: 1000
      }}>
        <button
          onClick={() => setHighContrast(!highContrast)}
          style={{
            padding: '10px 15px',
            borderRadius: '5px',
            border: '2px solid white',
            background: highContrast ? 'white' : 'transparent',
            color: highContrast ? 'black' : 'white',
            fontSize: '14px',
            cursor: 'pointer',
            minHeight: '44px'
          }}
        >
          High Contrast
        </button>
        <button
          onClick={() => setFontSize(Math.min(fontSize + 2, 28))}
          style={{
            padding: '10px 15px',
            borderRadius: '5px',
            border: '2px solid white',
            background: 'transparent',
            color: 'white',
            fontSize: '14px',
            cursor: 'pointer',
            minHeight: '44px'
          }}
        >
          + Font
        </button>
        <button
          onClick={() => setFontSize(Math.max(fontSize - 2, 16))}
          style={{
            padding: '10px 15px',
            borderRadius: '5px',
            border: '2px solid white',
            background: 'transparent',
            color: 'white',
            fontSize: '14px',
            cursor: 'pointer',
            minHeight: '44px'
          }}
        >
          - Font
        </button>
      </div>

      {/* Help Modal */}
      {showHelp && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000
        }}>
          <div style={{
            background: highContrast ? '#ffffff' : '#1e293b',
            color: highContrast ? '#000000' : 'white',
            padding: '30px',
            borderRadius: '15px',
            maxWidth: '600px',
            fontSize: largeFontSize,
            textAlign: 'center'
          }}>
            <h2 style={{ marginTop: 0, fontSize: '24px' }}>How to Use ScamBomb</h2>
            <p style={{ lineHeight: 1.6 }}>
              1. Enter the sender's information (email, phone, or name).<br/>
              2. Paste the full message content.<br/>
              3. Add any additional context if available.<br/>
              4. Click "Analyze Message" and wait for results.<br/>
              5. Review the safety verdict and follow recommendations.
            </p>
            <button
              onClick={playInstructions}
              style={{
                padding: '15px 20px',
                borderRadius: '10px',
                border: 'none',
                background: '#22c55e',
                color: 'white',
                fontSize: largeFontSize,
                cursor: 'pointer',
                margin: '10px',
                minHeight: buttonHeight
              }}
            >
              🔊 Play Instructions
            </button>
            <button
              onClick={() => setShowHelp(false)}
              style={{
                padding: '15px 20px',
                borderRadius: '10px',
                border: 'none',
                background: '#6b7280',
                color: 'white',
                fontSize: largeFontSize,
                cursor: 'pointer',
                margin: '10px',
                minHeight: buttonHeight
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      <main style={{
        maxWidth: 900,
        margin: '0 auto',
        padding: '32px 1rem 2rem 1rem' // extra top padding for fixed buttons
      }}>
        {/* Hero Section */}
        <div style={{
          textAlign: 'center',
          marginBottom: '2rem'
        }}>
          <Image
            src="/logo.png"
            alt="ScamBomb"
            width={150}
            height={150}
            style={{ maxHeight: '100px', width: 'auto', marginBottom: '1rem' }}
          />
          <h1 style={{
            fontSize: '2.5rem',
            fontWeight: 800,
            color: highContrast ? '#ffffff' : '#f8fafc',
            marginBottom: '1rem',
            lineHeight: 1.1
          }}>
            SafeMessage AI
          </h1>
        </div>



        {/* Accordion Container */}
        <div style={{
          background: highContrast ? '#ffffff' : 'rgba(15, 23, 42, 0.8)',
          border: highContrast ? '3px solid #000000' : '1px solid rgba(51, 65, 85, 0.5)',
          borderRadius: '15px',
          overflow: 'hidden',
          fontSize: baseFontSize
        }}>
          {/* Input Section Header */}
          <button
            onClick={() => setActiveSection('input')}
            style={{
              width: '100%',
              padding: '20px 30px',
              background: activeSection === 'input' ? (highContrast ? '#ffffff' : 'rgba(30, 41, 59, 0.8)') : 'transparent',
              border: 'none',
              borderBottom: activeSection === 'input' ? 'none' : `1px solid ${highContrast ? '#000000' : 'rgba(51, 65, 85, 0.5)'}`,
              color: highContrast ? '#000000' : '#f1f5f9',
              fontSize: largeFontSize,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              textAlign: 'left'
            }}
          >
            <span>🔍 Analyze Your Message</span>
            <span style={{
              transform: activeSection === 'input' ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.3s ease'
            }}>▼</span>
          </button>

          {/* Input Section Content */}
          <div style={{
            maxHeight: activeSection === 'input' ? '2000px' : '0',
            overflow: 'hidden',
            transition: 'max-height 0.5s ease-in-out',
            padding: activeSection === 'input' ? '0 30px 30px' : '0 30px'
          }}>
            <p style={{
              color: highContrast ? '#000000' : '#94a3b8',
              fontSize: baseFontSize,
              marginBottom: '20px'
            }}>
              Paste any suspicious message to check for potential threats
            </p>

            <div style={{ display: 'grid', gap: '20px' }}>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: largeFontSize,
                  fontWeight: 600,
                  color: highContrast ? '#000000' : '#f1f5f9',
                  marginBottom: '10px'
                }}>
                  👤 Step 1: Sender Information
                </label>
                <input
                  value={sender}
                  onChange={(e) => setSender(e.target.value)}
                  placeholder="Email address, phone number, or sender name"
                  style={{
                    width: '100%',
                    padding: '15px 20px',
                    borderRadius: '10px',
                    border: highContrast ? '3px solid #000000' : '2px solid rgba(71, 85, 105, 0.5)',
                    background: highContrast ? '#ffffff' : 'rgba(30, 41, 59, 0.8)',
                    color: highContrast ? '#000000' : 'white',
                    fontSize: baseFontSize,
                    outline: 'none',
                    minHeight: '50px'
                  }}
                />
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontSize: largeFontSize,
                  fontWeight: 600,
                  color: highContrast ? '#000000' : '#f1f5f9',
                  marginBottom: '10px'
                }}>
                  📝 Step 2: Message Content
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Paste the full message content here..."
                  rows={8}
                  style={{
                    width: '100%',
                    padding: '15px 20px',
                    borderRadius: '10px',
                    border: highContrast ? '3px solid #000000' : '2px solid rgba(71, 85, 105, 0.5)',
                    background: highContrast ? '#ffffff' : 'rgba(30, 41, 59, 0.8)',
                    color: highContrast ? '#000000' : 'white',
                    fontSize: baseFontSize,
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    outline: 'none',
                    minHeight: '120px'
                  }}
                />
              </div>



              <button
                onClick={() => {
                  setActiveSection('results');
                  analyze();
                }}
                disabled={loading || !body.trim()}
                style={{
                  width: '100%',
                  padding: '20px',
                  borderRadius: '15px',
                  border: 'none',
                  background: loading ? (highContrast ? '#cccccc' : 'rgba(71, 85, 105, 0.8)') : (highContrast ? '#000000' : 'linear-gradient(135deg, #22c55e, #16a34a)'),
                  color: loading ? (highContrast ? '#000000' : '#94a3b8') : (highContrast ? '#ffffff' : 'white'),
                  fontSize: largeFontSize,
                  fontWeight: 700,
                  cursor: loading || !body.trim() ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  opacity: loading || !body.trim() ? 0.6 : 1,
                  minHeight: buttonHeight
                }}
              >
                {loading ? (
                  <>
                    <div style={{
                      width: '20px',
                      height: '20px',
                      border: '3px solid #94a3b8',
                      borderTop: '3px solid transparent',
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

          {/* Results Section Header */}
          <button
            onClick={() => setActiveSection('results')}
            style={{
              width: '100%',
              padding: '20px 30px',
              background: activeSection === 'results' ? (highContrast ? '#ffffff' : 'rgba(30, 41, 59, 0.8)') : 'transparent',
              border: 'none',
              borderTop: `1px solid ${highContrast ? '#000000' : 'rgba(51, 65, 85, 0.5)'}`,
              color: highContrast ? '#000000' : '#f1f5f9',
              fontSize: largeFontSize,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              textAlign: 'left'
            }}
          >
            <span>📊 Scan Results</span>
            <span style={{
              transform: activeSection === 'results' ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.3s ease'
            }}>▼</span>
          </button>

          {/* Results Section Content */}
          <div style={{
            maxHeight: activeSection === 'results' ? '2000px' : '0',
            overflow: 'hidden',
            transition: 'max-height 0.5s ease-in-out',
            padding: activeSection === 'results' ? '0 30px 30px' : '0 30px'
          }}>
            {!result && loading && (
              <div style={{
                textAlign: 'center',
                padding: '40px',
                color: highContrast ? '#000000' : '#94a3b8'
              }}>
                <div style={{
                  width: '4rem',
                  height: '4rem',
                  border: `4px solid ${highContrast ? '#000000' : '#22c55e'}`,
                  borderTop: '4px solid transparent',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  margin: '0 auto 20px'
                }} />
                <h3 style={{
                  fontSize: largeFontSize,
                  fontWeight: 700,
                  color: highContrast ? '#000000' : '#f1f5f9',
                  marginBottom: '10px'
                }}>
                  🔍 Scanning your message...
                </h3>
                <p style={{ fontSize: baseFontSize }}>
                  Our AI is analyzing the content for potential security risks. This usually takes just a few seconds.
                </p>
              </div>
            )}

            {result && (
              <div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  marginBottom: '2rem',
                  flexWrap: 'wrap'
                }}>
                  <div style={{
                    width: '4rem',
                    height: '4rem',
                    borderRadius: '50%',
                    background: result.verdict === 'SAFE' ? (highContrast ? '#000000' : 'linear-gradient(135deg, #22c55e, #16a34a)') :
                               result.verdict === 'UNSAFE' ? (highContrast ? '#ff0000' : 'linear-gradient(135deg, #ef4444, #dc2626)') :
                               (highContrast ? '#ffff00' : 'linear-gradient(135deg, #f59e0b, #d97706)'),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '2rem'
                  }}>
                    {result.verdict === 'SAFE' ? '✅' : result.verdict === 'UNSAFE' ? '🚨' : '⚠️'}
                  </div>
                  <div>
                    <h3 style={{
                      fontSize: largeFontSize,
                      fontWeight: 700,
                      color: highContrast ? '#000000' : '#f1f5f9',
                      margin: 0,
                      lineHeight: 1.2
                    }}>
                      {result.verdict === 'SAFE' ? '✅ Message is Safe' :
                       result.verdict === 'UNSAFE' ? '🚨 Security Risk Detected' :
                       '⚠️ Unable to Determine'}
                    </h3>
                    <p style={{
                      color: highContrast ? '#000000' : '#94a3b8',
                      margin: '0.5rem 0 0',
                      fontSize: baseFontSize,
                      fontWeight: 'bold'
                    }}>
                      Threat Level: {result.threatLevel}
                    </p>
                  </div>
                </div>

                <div style={{
                  background: highContrast ? '#f0f0f0' : 'rgba(30, 41, 59, 0.8)',
                  border: highContrast ? '3px solid #000000' : '2px solid rgba(71, 85, 105, 0.5)',
                  borderRadius: '15px',
                  padding: '30px',
                  fontSize: baseFontSize,
                  lineHeight: 1.8,
                  color: highContrast ? '#000000' : '#e2e8f0',
                  whiteSpace: 'pre-wrap',
                  overflow: 'auto'
                }}>
                  {result.text}
                </div>

                {result.verdict === 'UNSAFE' && (
                  <div style={{
                    marginTop: '20px',
                    padding: '20px',
                    background: highContrast ? '#ffcccc' : '#ff6b6b',
                    color: highContrast ? '#000000' : 'white',
                    borderRadius: '10px',
                    fontSize: largeFontSize,
                    fontWeight: 'bold',
                    textAlign: 'center'
                  }}>
                    ⚠️ Warning: This message appears to be dangerous. Do not click any links or provide personal information. Delete this message immediately.
                  </div>
                )}

                {result.verdict === 'SAFE' && (
                  <div style={{
                    marginTop: '20px',
                    padding: '20px',
                    background: highContrast ? '#ccffcc' : '#22c55e',
                    color: highContrast ? '#000000' : 'white',
                    borderRadius: '10px',
                    fontSize: largeFontSize,
                    fontWeight: 'bold',
                    textAlign: 'center'
                  }}>
                    ✅ This message appears to be safe. You can proceed normally.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Combined Description & Usage Section */}
        <div style={{
          background: highContrast ? '#ffffff' : 'rgba(15, 23, 42, 0.8)',
          border: highContrast ? '3px solid #000000' : '1px solid rgba(51, 65, 85, 0.5)',
          borderRadius: '15px',
          padding: '20px',
          marginBottom: '2rem',
          fontSize: baseFontSize
        }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            alignItems: 'center'
          }}>
            {/* Description */}
            <div style={{ textAlign: 'center' }}>
              <p style={{
                fontSize: largeFontSize,
                color: highContrast ? '#000000' : '#94a3b8',
                margin: 0,
                lineHeight: 1.6,
                fontWeight: 'bold'
              }}>
                Protect yourself from dangerous messages with our easy-to-use AI scanner.
                <br />
                <span style={{ color: highContrast ? '#000000' : '#22c55e', fontWeight: 600 }}>5 free checks</span>, then $5/month for unlimited protection.
              </p>
            </div>

            {/* Usage & Pricing in horizontal layout */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              maxWidth: '800px',
              gap: '2rem',
              flexWrap: 'wrap'
            }}>
              {/* Usage Info */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                flex: '1',
                minWidth: '200px'
              }}>
                <div style={{
                  width: '3rem',
                  height: '3rem',
                  borderRadius: '50%',
                  background: usage.premium ? (highContrast ? '#000000' : 'linear-gradient(135deg, #22c55e, #16a34a)') : (highContrast ? '#666666' : '#475569'),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.25rem',
                  fontWeight: 700
                }}>
                  {usage.premium ? '∞' : usage.used}
                </div>
                <div>
                  <div style={{
                    fontSize: largeFontSize,
                    fontWeight: 700,
                    color: highContrast ? '#000000' : '#f1f5f9',
                    marginBottom: '4px'
                  }}>
                    {usage.premium ? 'Premium Account' : 'Free Account'}
                  </div>
                  <div style={{
                    fontSize: baseFontSize,
                    color: highContrast ? '#000000' : '#94a3b8',
                    fontWeight: 'bold'
                  }}>
                    {usage.premium ? 'Unlimited scans' : `${usage.used} of ${usage.limit} free scans used`}
                  </div>
                  {!usage.premium && (
                    <div style={{
                      fontSize: baseFontSize,
                      color: highContrast ? '#000000' : '#64748b'
                    }}>
                      {usage.limit - usage.used} scans remaining
                    </div>
                  )}
                </div>
              </div>

              {/* Pricing Buttons */}
              {!usage.premium && (
                <div style={{
                  display: 'flex',
                  gap: '1rem',
                  alignItems: 'center',
                  flexWrap: 'wrap'
                }}>
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch("/api/stripe/checkout", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ email, fingerprint, productId: 'prod_TPb59dA7O3DvRa' })
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
                      background: highContrast ? '#ffff00' : '#F5C84C',
                      color: highContrast ? '#000000' : '#0B1324',
                      border: 'none',
                      padding: '15px 20px',
                      borderRadius: '10px',
                      fontWeight: 700,
                      fontSize: baseFontSize,
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px',
                      minHeight: '60px',
                      minWidth: '120px'
                    }}
                  >
                    <div>⚡ Annual</div>
                    <div style={{ fontSize: '14px', opacity: 0.9 }}>$49.99/year</div>
                  </button>

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
                      background: highContrast ? '#ffff00' : '#F5C84C',
                      color: highContrast ? '#000000' : '#0B1324',
                      border: 'none',
                      padding: '15px 20px',
                      borderRadius: '10px',
                      fontWeight: 700,
                      fontSize: baseFontSize,
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px',
                      minHeight: '60px',
                      minWidth: '120px'
                    }}
                  >
                    <div>⚡ Monthly</div>
                    <div style={{ fontSize: '14px', opacity: 0.9 }}>$5/month</div>
                  </button>
                </div>
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
                    background: highContrast ? '#00ffff' : 'linear-gradient(135deg, #14b8a6, #0d9488)',
                    color: highContrast ? '#000000' : 'white',
                    border: 'none',
                    padding: '15px 20px',
                    borderRadius: '10px',
                    fontWeight: 700,
                    fontSize: baseFontSize,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    minHeight: '60px'
                  }}
                >
                  ⚙️ Manage Subscription
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Email Input for Premium */}
        {!usage.premium && (
          <div style={{
            background: highContrast ? '#ffffff' : 'rgba(15, 23, 42, 0.8)',
            border: highContrast ? '3px solid #000000' : '2px solid rgba(51, 65, 85, 0.5)',
            borderRadius: '15px',
            padding: '30px',
            marginBottom: '2rem',
            fontSize: baseFontSize,
            maxWidth: '500px',
            margin: '0 auto 2rem'
          }}>
            <label style={{
              display: 'block',
              fontSize: largeFontSize,
              fontWeight: 600,
              color: highContrast ? '#000000' : '#f1f5f9',
              marginBottom: '15px'
            }}>
              📧 Enter Your Email for Premium Upgrade
            </label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your.email@example.com"
              type="email"
              style={{
                width: '100%',
                padding: '15px 20px',
                borderRadius: '10px',
                border: highContrast ? '3px solid #000000' : '2px solid rgba(71, 85, 105, 0.5)',
                background: highContrast ? '#ffffff' : 'rgba(30, 41, 59, 0.8)',
                color: highContrast ? '#000000' : 'white',
                fontSize: baseFontSize,
                outline: 'none',
                minHeight: '50px'
              }}
            />
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
